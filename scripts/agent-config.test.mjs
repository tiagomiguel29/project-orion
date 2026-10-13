import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentConnection } from '../apps/web/lib/agent-config.ts';

test('local development uses the plaintext gRPC port', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.deepEqual(getAgentConnection(`http://${host}:4000`), {
      address: `${host}:50052`, tlsDisable: true,
    });
  }
  assert.equal(getAgentConnection('http://localhost:4000', '', '').tlsDisable, true);
});

test('remote hosts and HTTPS retain TLS', () => {
  for (const url of ['https://orion.example.com', 'http://orion.example.com']) {
    assert.deepEqual(getAgentConnection(url), { address: 'orion.example.com:443', tlsDisable: false });
  }
  assert.equal(getAgentConnection('https://localhost').tlsDisable, false);
});

test('custom endpoints require an explicit plaintext setting', () => {
  assert.deepEqual(getAgentConnection('http://localhost:4001', 'localhost:50053', 'true'), {
    address: 'localhost:50053', tlsDisable: true,
  });
  assert.equal(getAgentConnection('http://localhost:4000', 'server.example.com:443').tlsDisable, false);
  assert.equal(getAgentConnection('http://localhost:4000', undefined, 'false').tlsDisable, false);
});
