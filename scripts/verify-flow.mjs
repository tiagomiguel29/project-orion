// Run against a disposable local development stack. Leaves the test device and
// its history available for inspection; never deletes existing accounts/data.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';

const api = process.env.FLOW_API_URL ?? 'http://localhost:4000';
const email = process.env.FLOW_EMAIL ?? 'flow-test@example.com';
const password = process.env.FLOW_PASSWORD;
assert(password, 'Set FLOW_PASSWORD for the local test account.');
const deviceId = `flow-test-${Date.now()}`;
let token;
async function request(path, body, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
  return result.data ?? result;
}
function event(socket, name, predicate = () => true, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, timeout);
    function listener(value) {
      if (!predicate(value)) return;
      clearTimeout(timer); socket.off(name, listener); resolve(value);
    }
    socket.on(name, listener);
  });
}
async function subscribe(socket, name, body) {
  const ack = await socket.timeout(10000).emitWithAck(name, body);
  assert.equal(ack.ok, true);
}
const directory = await mkdtemp(join(tmpdir(), 'orion-flow-'));
let socket;
let agent;
const fakeCloudflared = [];
let agentLog = '';
async function reserveAvailablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
try {
  assert.equal((await request('/health/ready')).status, 'ok');
  const setup = await request('/auth/setup');
  if (setup.setupRequired) {
    const registered = await request('/auth/register-first', { name: 'Local Flow Test', email, password }, 201);
    assert(registered.token);
    assert.equal((await request('/auth/setup')).setupRequired, false);
    console.log('PASS first account setup');
  }
  await request('/auth/login', { email, password: `${password}-wrong` }, 401);
  const login = await request('/auth/login', { email, password }, 201);
  assert(login.token, 'Use a test account without MFA for this smoke test.');
  token = login.token;
  assert.equal((await request('/auth/me')).email, email);
  console.log('PASS sign-in and invalid-password rejection');
  const created = await request('/devices', { externalId: deviceId, hostname: 'Flow test' }, 201);
  assert(created.token);
  assert((await request('/devices/dashboard')).devices.some(d => d.externalId === deviceId));
  console.log('PASS device registration');
  if (process.env.FLOW_SIMULATE_CLOUDFLARE === 'true') {
    const fixtureBinary = join(directory, 'cloudflared');
    execFileSync('go', ['build', '-o', fixtureBinary, './scripts/fixtures/cloudflared/main.go'], { env: process.env, stdio: 'pipe' });
    for (const [tunnelId, tunnelName, connections] of [
      ['scope-e2e-tunnel', 'Scope E2E Tunnel', 4],
      ['scope-e2e-secondary', 'Scope E2E Secondary', 2],
    ]) {
      await writeFile(join(directory, `${tunnelId}.json`), JSON.stringify({ TunnelID: tunnelId, TunnelName: tunnelName }));
      const port = await reserveAvailablePort();
      const fake = spawn(fixtureBinary, [`--metrics=127.0.0.1:${port}`, `--tunnel-id=${tunnelId}`, `--connections=${connections}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      fakeCloudflared.push(fake);
      await new Promise((resolve, reject) => {
        fake.once('error', reject);
        fake.once('exit', code => reject(new Error(`Fake cloudflared exited before ready (${code})`)));
        fake.stdout.once('data', data => data.toString().includes('READY') ? resolve() : reject(new Error('Fake cloudflared did not start')));
      });
    }
  }
  socket = io(api, { auth: { token }, transports: ['websocket'], autoConnect: false });
  const connected = event(socket, 'connect');
  socket.connect(); await connected;
  await subscribe(socket, 'subscribeDashboard');
  await subscribe(socket, 'subscribeDevice', { deviceId });
  const telemetry = event(socket, 'telemetry', data => data.deviceId === deviceId);
  const dashboard = event(socket, 'dashboard.update', data => data.externalId === deviceId && data.status === 'online');
  const agentBinary = process.env.FLOW_AGENT_BINARY ?? join(directory, 'agent');
  if (!process.env.FLOW_AGENT_BINARY) {
    execFileSync('go', ['build', '-o', agentBinary, './cmd/agent'], {
      cwd: new URL('../apps/agent/', import.meta.url),
      env: process.env,
      stdio: 'pipe',
    });
  }
  agent = spawn(agentBinary, [], {
    cwd: new URL('../apps/agent/', import.meta.url),
    env: { ...process.env, AGENT_DEVICE_ID: deviceId, AGENT_ENROLLMENT_TOKEN: created.token,
      AGENT_SERVER_ADDRESS: process.env.FLOW_GRPC_ADDRESS ?? 'localhost:50052', AGENT_TLS_DISABLE: 'true',
      AGENT_INTERVAL_SEC: '2', AGENT_WAL_PATH: join(directory, 'agent.wal'),
      ...(fakeCloudflared.length ? { AGENT_CLOUDFLARED_CONFIG_DIR: directory } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  agent.on('error', error => { agentLog += error.message; });
  agent.stdout.on('data', data => { agentLog += data; });
  agent.stderr.on('data', data => { agentLog += data; });
  const liveTelemetry = await telemetry;
  assert(liveTelemetry.metrics.length > 0);
  if (fakeCloudflared.length) assert.equal(liveTelemetry.metrics.filter(m => m.name === 'cloudflare.tunnel.ha_connections').length, 2);
  const card = await dashboard;
  assert(card.summary.ramTotalBytes > 0);
  assert(card.sparklines.some(s => s.points.length > 0));
  console.log('PASS real Go agent enrollment, telemetry and dashboard broadcast');
  let latestCard = card;
  for (let i = 1; i < Number(process.env.FLOW_LIVE_BATCHES ?? 2); i++) {
    const nextCard = await event(socket, 'dashboard.update', data =>
      data.externalId === deviceId && data.lastSeenAt > latestCard.lastSeenAt);
    assert(nextCard.sparklines.some(s => s.points.length > 0));
    latestCard = nextCard;
  }
  console.log('PASS successive live dashboard updates');
  const persisted = await request(`/devices/dashboard/${deviceId}?range=1m`);
  assert.equal(persisted.status, 'online');
  assert(persisted.sparklines.some(s => s.points.length > 0));
  console.log('PASS history survives a fresh API load');
  if (process.env.FLOW_EXPECT_DOCKER === 'true') {
    assert(persisted.containers.length > 0, 'Local Docker is running but no containers reached the device detail API.');
    assert(persisted.containers.every(c => c.name && c.image && c.ramLimitBytes > 0));
    console.log(`PASS Docker container detail (${persisted.containers.length} containers)`);
  }
  if (fakeCloudflared.length) {
    const tunnel = persisted.tunnels.find(t => t.tunnelId === 'scope-e2e-tunnel');
    const secondary = persisted.tunnels.find(t => t.tunnelId === 'scope-e2e-secondary');
    assert(tunnel && secondary, 'Both fake cloudflared processes must reach the device detail API.');
    assert.equal(tunnel.tunnelName, 'Scope E2E Tunnel');
    assert.equal(tunnel.status, 'healthy');
    assert.equal(tunnel.haConnections, 4);
    assert.equal(tunnel.totalRequests, 27);
    assert.equal(tunnel.requestErrors, 2);
    assert.equal(secondary.tunnelName, 'Scope E2E Secondary');
    assert.equal(secondary.status, 'degraded');
    assert.equal(secondary.haConnections, 2);
    console.log('PASS two fake cloudflared processes → real agent → gRPC → database → tunnel detail API');
  }
  const offline = event(socket, 'device.status', data => data.deviceId === deviceId && data.status === 'offline', 60000);
  agent.kill('SIGTERM');
  await offline;
  assert.equal((await request(`/devices/dashboard/${deviceId}`)).status, 'offline');
  console.log('PASS agent stop causes offline broadcast and persisted status');
  console.log(`Verified device: ${deviceId}`);
} catch (error) {
  // Avoid dumping enrollment/access tokens from agent output.
  console.error(error.message);
  if (agentLog) console.error('Agent produced logs; inspect its runtime locally for details.');
  process.exitCode = 1;
} finally {
  agent?.kill('SIGTERM');
  for (const fake of fakeCloudflared) fake.kill('SIGTERM');
  socket?.disconnect();
  await rm(directory, { recursive: true, force: true });
}
