// Exercises labelled Docker and Cloudflare telemetry through gRPC and the
// detail API on a disposable local test device.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const api = process.env.FLOW_API_URL ?? 'http://localhost:4000';
const email = process.env.FLOW_EMAIL ?? 'flow-test@example.com';
const password = process.env.FLOW_PASSWORD;
assert(password, 'Set FLOW_PASSWORD for the local test account.');

const definition = protoLoader.loadSync(new URL('../apps/backend/src/proto/telemetry.proto', import.meta.url).pathname, {
  keepCase: false, longs: String, enums: String, defaults: true,
});
const Service = grpc.loadPackageDefinition(definition).telemetry.v1.TelemetryIngestService;
const client = new Service(process.env.FLOW_GRPC_ADDRESS ?? 'localhost:50052', grpc.credentials.createInsecure());
const id = `details-test-${Date.now()}`;

function rpc(method, body, accessToken) {
  const metadata = new grpc.Metadata();
  if (accessToken) metadata.set('authorization', `Bearer ${accessToken}`);
  return new Promise((resolve, reject) => client[method](body, metadata, { deadline: Date.now() + 10000 },
    (error, response) => error ? reject(error) : resolve(response)));
}
async function request(path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${result.message ?? response.status}`);
  return result.data ?? result;
}

try {
  const login = await request('/auth/login', 'POST', { email, password }, undefined, 201);
  const token = login.token;
  assert(token);
  const device = await request('/devices', 'POST', { externalId: id, hostname: 'Detail verification' }, token, 201);
  const access = (await rpc('exchangeToken', { enrollmentToken: device.token })).accessToken;
  assert(access);
  const ts = Date.now();
  const docker = { container: 'scope-test-container', image: 'scope/test:1', health: 'unhealthy' };
  const tunnel = { tunnel_id: 'scope-test-tunnel', tunnel_name: 'Scope test tunnel', status: 'degraded' };
  const values = [
    ['docker.container.cpu_percent', 12.5, docker],
    ['docker.container.ram_usage_bytes', 1048576, docker],
    ['docker.container.ram_limit_bytes', 4194304, docker],
    ['docker.container.net_rx_bytes', 2048, docker],
    ['docker.container.net_tx_bytes', 4096, docker],
    ['cloudflare.tunnel.ha_connections', 2, tunnel],
    ['cloudflare.tunnel.total_requests', 32, tunnel],
    ['cloudflare.tunnel.request_errors', 1, tunnel],
  ];
  const ack = await rpc('ingestBatch', {
    batchId: randomUUID(), deviceId: id, sentAtUnixMs: String(ts), intervalSec: 2,
    systemInfo: { hostname: 'Detail verification', os: 'linux' },
    metrics: values.map(([name, value, labels]) => ({ name, value, labels, tsUnixMs: String(ts) })),
  }, access);
  assert.equal(ack.status, 'INGEST_STATUS_ACCEPTED');
  const detail = await request(`/devices/dashboard/${id}?range=1m`, 'GET', undefined, token);
  const container = detail.containers.find(c => c.name === docker.container);
  assert(container && container.image === docker.image && container.health === 'unhealthy');
  assert.equal(container.cpuPercent, 12.5);
  assert.equal(container.ramUsageBytes, 1048576);
  assert.equal(container.netRxBytes, 2048);
  const detectedTunnel = detail.tunnels.find(t => t.tunnelId === tunnel.tunnel_id);
  assert(detectedTunnel && detectedTunnel.tunnelName === tunnel.tunnel_name && detectedTunnel.status === 'degraded');
  assert.equal(detectedTunnel.haConnections, 2);
  assert.equal(detectedTunnel.totalRequests, 32);
  console.log(`PASS Docker container and Cloudflare tunnel telemetry through gRPC, storage, and detail API (${id})`);
} finally {
  client.close();
}
