// Integration check for an isolated docker-compose.scale.yml stack. Requires
// three replicas with localhost-only test ports (see docs/live-metrics.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, connect as tcpConnect } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createSocket } from '../apps/web/lib/socket.ts';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const project = process.env.SCALE_PROJECT ?? 'project-orion-scale';
const proxy = process.env.SCALE_PROXY_URL ?? 'https://localhost:18443';
const rootCA = process.env.SCALE_CA_FILE ?? '/private/tmp/orion-scale-ca.crt';
const docker = (...args) => execFileSync('docker', args, {encoding:'utf8'}).trim();
const port = (index, internal) => docker('port', `${project}-backend-${index}`, `${internal}/tcp`).split(':').at(-1);
const http = [1,2,3].map(i => `http://127.0.0.1:${port(i,4000)}`);
const addresses = [1,2,3].map(i => `127.0.0.1:${port(i,50052)}`);
const sql = query => docker('exec', '-i', `${project}-timescaledb-1`, 'psql', '-U', 'orion', '-d', 'orion', '-tAc', query);
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
const id = `scale-${Date.now()}`;
let token;
// Docker may allocate a new ephemeral host port after restart. Keep the
// subscriber's endpoint stable, as it is behind the production load balancer.
let subscriberPort = Number(port(2,4000));
const relay = createServer(client => {
  const upstream = tcpConnect(subscriberPort, '127.0.0.1');
  client.pipe(upstream); upstream.pipe(client);
  upstream.on('error', () => client.destroy());
  client.on('error', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.on('close', () => upstream.destroy());
});
await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
const subscriberURL = `http://127.0.0.1:${relay.address().port}`;
const sockets = [];
const clients = [];
const definition = protoLoader.loadSync(new URL('../apps/backend/src/proto/telemetry.proto',import.meta.url).pathname, {keepCase:false,longs:String,enums:String,defaults:true});
const Service = grpc.loadPackageDefinition(definition).telemetry.v1.TelemetryIngestService;
function rpc(client, method, body, accessToken) {
  const metadata = new grpc.Metadata();
  if (accessToken) metadata.set('authorization',`Bearer ${accessToken}`);
  return new Promise((resolve,reject) => client[method](body,metadata,{deadline:Date.now()+15000},(error,response) => error ? reject(error) : resolve(response)));
}
async function request(base,path,body,expected=200) {
  const response = await fetch(`${base}${path}`, {method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const result = await response.json();
  assert.equal(response.status,expected,`${path}: ${JSON.stringify(result)}`);
  return result.data ?? result;
}
function event(socket,name,predicate=()=>true,timeout=15000) {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{socket.off(name,listener);reject(new Error(`Timed out: ${name}`));},timeout);
    function listener(data) {if(!predicate(data))return;clearTimeout(timer);socket.off(name,listener);resolve(data);}
    socket.on(name,listener);
  });
}
async function connect(base,authToken=token) {
  const socket=createSocket(authToken,base);
  sockets.push(socket);const connected=event(socket,'connect');socket.connect();await connected;return socket;
}
const ranges={'1m':[60000,12],'5m':[300000,20],'1h':[3600000,60],'2h':[7200000,60],
  '5h':[18000000,60],'12h':[43200000,72],'1d':[86400000,96],'1w':[604800000,84],
  '1mo':[2592000000,120],'1y':[31536000000,120],all:[20*31536000000,120]};
const counts={};
try {
  for(const base of [...http,proxy])assert.equal((await request(base,'/health/ready')).status,'ok');
  const credentialsPath=process.env.SCALE_CREDENTIALS ?? '/private/tmp/orion-scale-credentials.json';
  let credentials;
  if((await request(proxy,'/auth/setup')).setupRequired) {
    credentials={email:'scale-test@example.com',password:randomBytes(18).toString('base64url')};
    writeFileSync(credentialsPath,JSON.stringify(credentials),{mode:0o600});
    await request(proxy,'/auth/register-first',{name:'Scale verification',...credentials},201);
  } else credentials=JSON.parse(readFileSync(credentialsPath));
  token=(await request(proxy,'/auth/login',credentials,201)).token;
  assert(token);
  console.log('PASS three replicas, PgBouncer, TimescaleDB, Redis and TLS HTTP proxy');
  const created=await request(proxy,'/devices',{externalId:id},201);
  clients.push(...addresses.map(address=>new Service(address,grpc.credentials.createInsecure())));
  const proxyClient=new Service(new URL(proxy).host,grpc.credentials.createSsl(readFileSync(rootCA)));
  clients.push(proxyClient);
  const access=(await rpc(proxyClient,'exchangeToken',{enrollmentToken:created.token})).accessToken;
  const subscriber=await connect(subscriberURL);
  assert.equal((await subscriber.timeout(5000).emitWithAck('subscribeDevice',{deviceId:id})).ok,true);
  assert.equal((await subscriber.timeout(5000).emitWithAck('subscribeDashboard')).ok,true);
  const received=[];subscriber.on('telemetry',data=>{if(data.deviceId===id)received.push(data);});
  const ts=Date.now()-50;
  const batch={batchId:randomUUID(),deviceId:'spoofed-id',sentAtUnixMs:String(ts),intervalSec:2,
    metrics:[{name:'cpu.percent',value:42,tsUnixMs:String(ts),labels:{}}],systemInfo:{hostname:'scale-test',os:'linux'}};
  const telemetry=event(subscriber,'telemetry',data=>data.batchId===batch.batchId);
  const card=event(subscriber,'dashboard.update',data=>data.externalId===id);
  const acks=await Promise.all(clients.slice(0,3).map(c=>rpc(c,'ingestBatch',batch,access)));
  assert.equal(acks.filter(a=>a.status==='INGEST_STATUS_ACCEPTED').length,1);
  assert.equal(acks.filter(a=>a.status==='INGEST_STATUS_DUPLICATE').length,2);
  assert.equal((await telemetry).deviceId,id);
  await card;await delay(200);
  assert.equal(received.filter(data=>data.batchId===batch.batchId).length,1);
  assert.equal(Number(sql(`SELECT count(*) FROM metrics WHERE "deviceId"='${id}'`)),1);
  console.log('PASS concurrent cross-replica dedup, commit-before-broadcast and Redis room delivery');
  await assert.rejects(rpc(clients[0],'ingestBatch',{...batch,batchId:randomUUID()},'invalid'),e=>e.code===grpc.status.UNAUTHENTICATED);
  const denied=await connect(http[2],'invalid');
  const rejected=event(denied,'exception');denied.emit('subscribeDevice',{deviceId:id});await rejected;
  denied.disconnect();
  console.log('PASS gRPC and WebSocket authorization');
  assert.equal((await subscriber.timeout(5000).emitWithAck('unsubscribeDevice',{deviceId:id})).ok,true);
  await rpc(clients[0],'ingestBatch',{...batch,batchId:randomUUID()},access);await delay(200);
  assert.equal(received.length,1);
  subscriber.disconnect();
  const reconnect=event(subscriber,'connect');subscriber.connect();await reconnect;
  await subscriber.timeout(5000).emitWithAck('subscribeDevice',{deviceId:id});
  const replay=event(subscriber,'telemetry',data=>data.deviceId===id);
  await rpc(clients[2],'ingestBatch',{...batch,batchId:randomUUID()},access);await replay;
  console.log('PASS room unsubscribe and reconnect/resubscribe across replicas');
  // Force the second insert chunk to fail. The first chunk and its receipt
  // must roll back, allowing the SAME batch ID to succeed on another replica.
  sql(`CREATE OR REPLACE FUNCTION scale_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='scale.fail' THEN RAISE EXCEPTION 'test insert failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER scale_test_reject BEFORE INSERT ON metrics FOR EACH ROW EXECUTE FUNCTION scale_test_reject();`);
  const failingId=randomUUID();
  const points=Array.from({length:1001},(_,i)=>({name:i===1000?'scale.fail':'scale.atomic',value:i,tsUnixMs:String(ts+i),labels:{}}));
  const failed=await rpc(clients[0],'ingestBatch',{...batch,batchId:failingId,metrics:points},access);
  assert.equal(failed.status,'INGEST_STATUS_RETRY');
  assert.equal(Number(sql(`SELECT count(*) FROM metrics WHERE "deviceId"='${id}' AND name='scale.atomic'`)),0);
  assert.equal(Number(sql(`SELECT count(*) FROM ingest_batches WHERE "deviceId"='${id}' AND "batchId"='${failingId}'`)),0);
  sql('DROP TRIGGER scale_test_reject ON metrics; DROP FUNCTION scale_test_reject();');
  assert.equal((await rpc(clients[2],'ingestBatch',{...batch,batchId:failingId,metrics:points.map(p=>({...p,name:'scale.atomic'}))},access)).status,'INGEST_STATUS_ACCEPTED');
  assert.equal(Number(sql(`SELECT count(*) FROM metrics WHERE "deviceId"='${id}' AND name='scale.atomic'`)),1001);
  console.log('PASS chunk failure rollback and same-ID retry on another replica');
  const proxied=await connect(proxy);
  await proxied.timeout(5000).emitWithAck('subscribeDevice',{deviceId:id});
  const proxiedEvent=event(proxied,'telemetry',data=>data.deviceId===id);
  assert.equal((await rpc(proxyClient,'ingestBatch',{...batch,batchId:randomUUID()},access)).status,'INGEST_STATUS_ACCEPTED');
  await proxiedEvent;
  console.log('PASS TLS gRPC + WebSocket delivery through dynamic Caddy load balancer');
  const burst = await Promise.all(Array.from({length:100}, (_, i) => rpc(clients[i%3], 'ingestBatch', {
    ...batch, batchId:randomUUID(), metrics:[{name:'scale.burst',value:i,tsUnixMs:String(Date.now()),labels:{}}],
  }, access)));
  assert(burst.every(ack=>ack.status==='INGEST_STATUS_ACCEPTED'));
  assert.equal(Number(sql(`SELECT count(*) FROM metrics WHERE "deviceId"='${id}' AND name='scale.burst'`)),100);
  console.log('PASS 100-batch concurrent burst across three replicas');
  if(process.env.SCALE_FAULTS === 'true') {
    subscriber.on('disconnect',reason=>console.log(`Replica disconnect: ${reason}`));
    const reconnected=event(subscriber,'connect',()=>true,60000);
    docker('restart',`${project}-backend-2`);
    subscriberPort = Number(port(2,4000));
    http[1] = `http://127.0.0.1:${subscriberPort}`;
    await reconnected;
    await subscriber.timeout(5000).emitWithAck('subscribeDevice',{deviceId:id});
    const afterRestart=event(subscriber,'telemetry',data=>data.deviceId===id);
    await rpc(clients[0],'ingestBatch',{...batch,batchId:randomUUID()},access);
    await afterRestart;
    console.log('PASS subscriber replica restart and resubscription');
    try {
      docker('stop',`${project}-backend-2`);
      const duringDowntime=await Promise.all(Array.from({length:20},()=>rpc(proxyClient,'ingestBatch',{
        ...batch,batchId:randomUUID(),metrics:[{name:'scale.failover',value:1,tsUnixMs:String(Date.now()),labels:{}}],
      },access)));
      assert(duringDowntime.every(ack=>ack.status==='INGEST_STATUS_ACCEPTED'));
      assert.equal((await request(proxy,'/health/ready')).status,'ok');
      console.log('PASS Caddy routes gRPC and HTTP with one replica unavailable');
    } finally { docker('start',`${project}-backend-2`); subscriberPort = Number(port(2,4000)); http[1] = `http://127.0.0.1:${subscriberPort}`; }
    if(!subscriber.connected) await event(subscriber,'connect',()=>true,30000);
    await subscriber.timeout(5000).emitWithAck('subscribeDevice',{deviceId:id});

    const recovered=event(subscriber,'stream.recovered',()=>true,30000);
    docker('restart',`${project}-redis-1`);
    await recovered;
    const afterRedis=event(subscriber,'telemetry',data=>data.deviceId===id);
    await rpc(clients[0],'ingestBatch',{...batch,batchId:randomUUID()},access);
    await afterRedis;
    assert.equal((await request(proxy,'/health/ready')).status,'ok');
    console.log('PASS Redis restart, pub/sub resubscription and recovery signal');
  }
  for(const [range,[duration,target]] of Object.entries(ranges)) {
    const historyId=`${id}-${range}`;
    await request(proxy,'/devices',{externalId:historyId},201);
    sql(`INSERT INTO metrics (time,"deviceId",name,value,labels)
      SELECT now() - (${duration}::numeric * (2000-i)/2000.0) * interval '1 millisecond', '${historyId}', metric, 30+i%60,
        CASE WHEN metric='disk.used_percent' THEN '{"mount":"/"}'::jsonb ELSE '{}'::jsonb END
      FROM generate_series(0,2000) i CROSS JOIN (VALUES ('cpu.percent'),('mem.percent'),('disk.used_percent'),('net.rx_bytes_per_sec'),('net.tx_bytes_per_sec'),('sensor.temperature_celsius')) names(metric)`);
    const response=await request(http[range.length%3],`/devices/dashboard/${historyId}?range=${range}`);
    counts[range]={};
    for(const series of response.sparklines) {
      const real=series.points.filter(p=>p.value!==null);
      assert(real.length>0 && real.length<=target+1,`${range}/${series.name}: ${real.length} points`);
      assert(series.points.length<=2*(target+1)-1);
      assert(series.points.every((p,i)=>i===0||p.tsUnixMs>series.points[i-1].tsUnixMs),`${range}: points must be chronological`);
      assert(real.every(p=>Number.isFinite(p.value) && p.sampleCount>0));
      counts[range][series.name]=real.length;
    }
  }
  console.log('PASS all 11 REST ranges: bounded points, numeric values, ordered gaps (20 years for all-time)');
  writeFileSync('/private/tmp/orion-scale-results.json',JSON.stringify({replicas:3,faults:process.env.SCALE_FAULTS==='true',device:id,counts},null,2));
} finally {
  for(const socket of sockets)socket.disconnect();
  for(const client of clients)client.close();
  relay.close();
  try {sql('DROP TRIGGER IF EXISTS scale_test_reject ON metrics; DROP FUNCTION IF EXISTS scale_test_reject();');} catch {}
}
