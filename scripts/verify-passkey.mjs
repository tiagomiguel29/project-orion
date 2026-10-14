// Exercises WebAuthn registration and MFA login with a software authenticator
// on the disposable local test account. The created passkey is removed in finally.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

const api = process.env.FLOW_API_URL ?? 'http://localhost:4000';
const origin = process.env.FLOW_WEB_ORIGIN ?? 'http://localhost:3000';
const email = process.env.FLOW_EMAIL ?? 'flow-test@example.com';
const password = process.env.FLOW_PASSWORD;
assert(password, 'Set FLOW_PASSWORD for the disposable local test account.');
const b64 = value => Buffer.from(value).toString('base64url');
const sha256 = value => createHash('sha256').update(value).digest();

async function request(path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${result.message ?? response.status}`);
  return result.data ?? result;
}

const login = await request('/auth/login', 'POST', { email, password }, undefined, 201);
assert(login.token, 'This test needs the disposable local account without MFA enabled.');
const token = login.token;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = publicKey.export({ format: 'jwk' });
const coseKey = isoCBOR.encode(new Map([
  [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')],
]));
const credentialId = randomBytes(32);
const rawId = b64(credentialId);
let passkeyId;

try {
  const options = await request('/auth/mfa/passkeys/registration-options', 'POST', {}, token, 201);
  const rpHash = sha256(options.rp.id);
  const registerClientData = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin }));
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(credentialId.length);
  const registrationAuthData = Buffer.concat([rpHash, Buffer.from([0x45, 0, 0, 0, 0]), Buffer.alloc(16), idLength, credentialId, Buffer.from(coseKey)]);
  const attestationObject = isoCBOR.encode(new Map([
    ['fmt', 'none'], ['attStmt', new Map()], ['authData', registrationAuthData],
  ]));
  const registrationBody = {
    name: 'Scope software test',
    response: {
      id: rawId, rawId, type: 'public-key', authenticatorAttachment: 'platform',
      response: { clientDataJSON: b64(registerClientData), attestationObject: b64(attestationObject), transports: ['internal'] },
      clientExtensionResults: {},
    },
  };
  const unverifiedAuthData = Buffer.from(registrationAuthData);
  unverifiedAuthData[32] &= ~0x04;
  const unverifiedAttestation = isoCBOR.encode(new Map([
    ['fmt', 'none'], ['attStmt', new Map()], ['authData', unverifiedAuthData],
  ]));
  await request('/auth/mfa/passkeys/register', 'POST', {
    ...registrationBody,
    response: {
      ...registrationBody.response,
      response: { ...registrationBody.response.response, attestationObject: b64(unverifiedAttestation) },
    },
  }, token, 401);
  const registered = await request('/auth/mfa/passkeys/register', 'POST', registrationBody, token, 201);
  const passkey = registered.passkeys.find(p => p.name === 'Scope software test');
  assert(passkey);
  passkeyId = passkey.id;
  console.log('PASS software passkey registration');

  const challengeLogin = await request('/auth/login', 'POST', { email, password }, undefined, 201);
  assert(challengeLogin.mfaRequired && challengeLogin.availableMethods.includes('passkey'));
  const pendingToken = challengeLogin.pendingToken;
  await request('/auth/me', 'GET', undefined, pendingToken, 401);
  const authenticationOptions = await request('/auth/mfa/passkeys/authentication-options', 'POST', {}, pendingToken, 201);
  assert(authenticationOptions.allowCredentials.some(c => c.id === rawId));
  const authClientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: authenticationOptions.challenge, origin }));
  const assertionAuthData = Buffer.concat([rpHash, Buffer.from([0x05, 0, 0, 0, 1])]);
  const signature = sign('sha256', Buffer.concat([assertionAuthData, sha256(authClientData)]), privateKey);
  const authenticationBody = {
    response: {
      id: rawId, rawId, type: 'public-key', authenticatorAttachment: 'platform',
      response: { authenticatorData: b64(assertionAuthData), clientDataJSON: b64(authClientData), signature: b64(signature), userHandle: null },
      clientExtensionResults: {},
    },
  };
  await request('/auth/mfa/passkeys/authenticate', 'POST', {
    response: {
      ...authenticationBody.response,
      response: { ...authenticationBody.response.response, signature: b64(randomBytes(64)) },
    },
  }, pendingToken, 401);
  const authenticated = await request('/auth/mfa/passkeys/authenticate', 'POST', authenticationBody, pendingToken, 201);
  assert(authenticated.token);
  assert.equal((await request('/auth/me', 'GET', undefined, authenticated.token)).email, email);
  await request('/auth/mfa/passkeys/authenticate', 'POST', authenticationBody, pendingToken, 401);
  console.log('PASS passkey MFA login and pending-token isolation');
} finally {
  if (passkeyId) {
    const status = await request(`/auth/mfa/passkeys/${passkeyId}`, 'DELETE', undefined, token);
    assert(!status.passkeys.some(p => p.id === passkeyId));
    console.log('PASS software passkey removed from test account');
  }
}
