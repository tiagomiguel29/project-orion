import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { AgentService } from './agent.service';

function makeRedis() {
  const set = new Set<string>();
  const pairs = new Map<string, string>();
  return {
    sadd: jest.fn(async (_k: string, v: string) => (set.add(v), 1)),
    srem: jest.fn(async (_k: string, v: string) => (set.delete(v), 1)),
    sismember: jest.fn(async (_k: string, v: string) => (set.has(v) ? 1 : 0)),
    set: jest.fn(async (key: string, value: string) => (pairs.set(key, value), 'OK')),
    eval: jest.fn(async (_script: string, _count: number, key: string, hash: string) => {
      if (pairs.get(key) !== hash) return 0;
      pairs.delete(key);
      return 1;
    }),
  };
}

function makeService(redis: any = makeRedis()) {
  const jwt = new JwtService({ secret: 'test-secret' });
  const config = {
    get: (key: string, def?: any) =>
      key === 'AGENT_ACCESS_TTL_SEC' ? 900 : def,
  } as unknown as ConfigService;
  return new AgentService(jwt as any, config, redis);
}

describe('AgentService', () => {
  it('mints an enrollment token that exchanges for a scoped access token', async () => {
    const svc = makeService();
    const enrollment = svc.mintEnrollment('dev-1');

    const { accessToken, expiresInSec } = await svc.exchange(enrollment);
    expect(expiresInSec).toBe(900);

    const payload = await svc.verifyAccess(accessToken);
    expect(payload.sub).toBe('dev-1');
    expect(payload.scope).toBe('ingest');
  });

  it('rejects using an access token on the exchange path (scope enforced)', async () => {
    const svc = makeService();
    const access = svc.mintAccess('dev-1');
    await expect(svc.exchange(access)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an enrollment token on the ingest path (scope enforced)', async () => {
    const svc = makeService();
    const enrollment = svc.mintEnrollment('dev-1');
    await expect(svc.verifyAccess(enrollment)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('blocks exchange and ingest once a device is revoked', async () => {
    const svc = makeService();
    const enrollment = svc.mintEnrollment('dev-1');
    const { accessToken } = await svc.exchange(enrollment);

    await svc.revoke('dev-1');

    await expect(svc.exchange(enrollment)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(svc.verifyAccess(accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a revoked device work again after unrevoke', async () => {
    const svc = makeService();
    const enrollment = svc.mintEnrollment('dev-1');
    await svc.revoke('dev-1');
    await svc.unrevoke('dev-1');
    await expect(svc.exchange(enrollment)).resolves.toHaveProperty(
      'accessToken',
    );
  });

  it('rejects a garbage token', async () => {
    const svc = makeService();
    await expect(svc.verifyAccess('not-a-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('redeems a pairing code exactly once on any replica', async () => {
    const redis = makeRedis();
    const first = makeService(redis);
    const second = makeService(redis);
    const code = await first.createPairingCode('dev-1');
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(redis.set).toHaveBeenCalledWith('agent:pair:device:dev-1', expect.stringMatching(/^[a-f0-9]{64}$/), 'EX', 600);
    const token = await second.redeemPairingCode(code, 'dev-1');
    await expect(first.exchange(token)).resolves.toHaveProperty('accessToken');
    await expect(first.redeemPairingCode(code, 'dev-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects pairing for the wrong or revoked device', async () => {
    const svc = makeService();
    const wrongDeviceCode = await svc.createPairingCode('dev-1');
    await expect(svc.redeemPairingCode(wrongDeviceCode, 'dev-2')).rejects.toBeInstanceOf(UnauthorizedException);
    const revokedCode = await svc.createPairingCode('dev-1');
    await svc.revoke('dev-1');
    await expect(svc.redeemPairingCode(revokedCode, 'dev-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('invalidates an older pairing code when a new one is issued', async () => {
    const svc = makeService();
    const oldCode = await svc.createPairingCode('dev-1');
    const newCode = await svc.createPairingCode('dev-1');
    await expect(svc.redeemPairingCode(oldCode, 'dev-1')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.redeemPairingCode(newCode, 'dev-1')).resolves.toEqual(expect.any(String));
  });
});
