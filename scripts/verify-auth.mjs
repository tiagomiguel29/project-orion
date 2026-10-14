// Exercises MFA on the disposable local flow-test account and restores its
// original TOTP-disabled state even when an assertion fails.
import assert from 'node:assert/strict';
import { generate } from 'otplib';

const api = process.env.FLOW_API_URL ?? 'http://localhost:4000';
const email = process.env.FLOW_EMAIL ?? 'flow-test@example.com';
const password = process.env.FLOW_PASSWORD;
assert(password, 'Set FLOW_PASSWORD for the disposable local test account.');

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

const initial = await request('/auth/login', 'POST', { email, password }, undefined, 201);
assert(initial.token, 'This test needs a local test account without MFA already enabled.');
const token = initial.token;
const before = await request('/auth/mfa/status', 'GET', undefined, token);
assert.equal(before.totpEnabled, false);

try {
  const options = await request('/auth/mfa/passkeys/registration-options', 'POST', {}, token, 201);
  assert(options.challenge && options.rp?.id && options.user?.id);
  console.log('PASS passkey registration challenge');

  const setup = await request('/auth/mfa/totp/setup', 'POST', {}, token, 201);
  assert(setup.secret && setup.uri);
  await request('/auth/mfa/totp/confirm', 'POST', { code: '000000' }, token, 401);
  const code = await generate({ secret: setup.secret });
  const confirmed = await request('/auth/mfa/totp/confirm', 'POST', { code }, token, 201);
  assert.equal(confirmed.totpEnabled, true);
  console.log('PASS TOTP setup and invalid-code rejection');

  const login = await request('/auth/login', 'POST', { email, password }, undefined, 201);
  assert.equal(login.mfaRequired, true);
  assert(login.availableMethods.includes('totp') && login.pendingToken);
  await request('/auth/me', 'GET', undefined, login.pendingToken, 401);
  await request('/auth/mfa/totp/verify', 'POST', { code: '000000' }, login.pendingToken, 401);
  const verified = await request('/auth/mfa/totp/verify', 'POST', { code: await generate({ secret: setup.secret }) }, login.pendingToken, 201);
  assert(verified.token);
  assert.equal((await request('/auth/me', 'GET', undefined, verified.token)).email, email);
  console.log('PASS MFA login, pending-token isolation, and invalid-code rejection');
} finally {
  const restored = await request('/auth/mfa/totp', 'DELETE', undefined, token);
  assert.equal(restored.totpEnabled, false);
  console.log('PASS test account MFA state restored');
}
