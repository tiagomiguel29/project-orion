// Local, disposable release server + real backend + installed Go agent flow.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const password = process.env.FLOW_PASSWORD;
assert(password, 'Set FLOW_PASSWORD for the disposable local test account.');
const api = process.env.FLOW_API_URL ?? 'http://localhost:4000';
const email = process.env.FLOW_EMAIL ?? 'flow-test@example.com';
const root = await mkdtemp(join(tmpdir(), 'scope-install-'));
const binary = join(root, 'scope-agent');
const asset = `scope-agent_${process.platform === 'darwin' ? 'darwin' : 'linux'}_${process.arch === 'arm64' ? 'arm64' : 'amd64'}.tar.gz`;
let server;
let agent;
let createdDeviceId;
let userToken;

async function request(path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${path}: ${result?.message ?? response.status}`);
  return result?.data ?? result;
}

function runInstaller(base, deviceId, code) {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn('sh', ['scripts/install-agent.sh', '--server', api, '--grpc', 'localhost:50052', '--device', deviceId, '--pair', code, '--tls-disable'], {
      env: { ...process.env, SCOPE_RELEASE_BASE: base, SCOPE_INSTALL_ROOT: join(root, 'installed'), SCOPE_INSTALL_TEST_MODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
  });
}

try {
  execFileSync('go', ['build', '-o', binary, './cmd/agent'], { cwd: new URL('../apps/agent/', import.meta.url), env: process.env });
  execFileSync('tar', ['-C', root, '-czf', join(root, asset), 'scope-agent']);
  const archive = await readFile(join(root, asset));
  const digest = createHash('sha256').update(archive).digest('hex');
  server = createServer((req, res) => {
    if (req.url?.endsWith(`/${asset}`)) return res.end(archive);
    if (req.url?.endsWith('/SHA256SUMS')) return res.end(`${req.url.startsWith('/bad/') ? '0'.repeat(64) : digest}  ${asset}\n`);
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const login = await request('/auth/login', 'POST', { email, password }, undefined, 201);
  assert(login.token, 'Use a test account without MFA.');
  userToken = login.token;
  const deviceId = `install-test-${Date.now()}`;
  const created = await request('/devices', 'POST', { externalId: deviceId }, login.token, 201);
  createdDeviceId = deviceId;
  assert.match(created.pairingCode, /^[A-Za-z0-9_-]{32}$/);
  const renewed = await request(`/devices/${deviceId}/pairing-code`, 'POST', {}, login.token, 201);
  assert.notEqual(renewed.pairingCode, created.pairingCode);
  await request('/devices/pair/redeem', 'POST', { code: created.pairingCode, deviceId }, undefined, 401);
  await request('/devices/pair/redeem', 'POST', { code: 'x'.repeat(32), deviceId }, undefined, 401);

  const bad = await runInstaller(`${base}/bad`, deviceId, renewed.pairingCode);
  assert.notEqual(bad.code, 0);
  assert.match(bad.output, /checksum mismatch/);
  console.log('PASS invalid release checksum rejected before pairing');

  const installed = await runInstaller(`${base}/good`, deviceId, renewed.pairingCode);
  assert.equal(installed.code, 0, installed.output);
  const configDir = join(root, 'installed/etc/scope');
  const configPath = join(configDir, '.env');
  const config = await readFile(configPath, 'utf8');
  assert(config.includes(`AGENT_DEVICE_ID=${deviceId}`));
  assert(config.includes('AGENT_ENROLLMENT_TOKEN='));
  assert(!config.includes(renewed.pairingCode));
  assert.equal((await stat(configPath)).mode & 0o777, 0o600);
  await request('/devices/pair/redeem', 'POST', { code: renewed.pairingCode, deviceId }, undefined, 401);
  console.log('PASS release download, verified install and single-use pairing');

  agent = spawn(join(root, 'installed/usr/local/bin/scope-agent'), [], { cwd: configDir, stdio: ['ignore', 'pipe', 'pipe'] });
  let agentError = '';
  agent.stderr.on('data', chunk => { agentError += chunk; });
  let online = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const detail = await request(`/devices/dashboard/${deviceId}`, 'GET', undefined, login.token);
    if (detail.status === 'online' && detail.sparklines.some(series => series.points.length > 0)) {
      online = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(online, `Installed agent did not deliver telemetry: ${agentError}`);
  console.log('PASS installed binary enrolls and sends live metrics');
} finally {
  agent?.kill('SIGTERM');
  if (createdDeviceId && userToken) {
    try { await request(`/devices/${createdDeviceId}`, 'DELETE', undefined, userToken); } catch { /* retain the original test failure */ }
  }
  await new Promise(resolve => server?.close(resolve) ?? resolve());
  await rm(root, { recursive: true, force: true });
}
