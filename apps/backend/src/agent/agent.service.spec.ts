import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { AgentService } from './agent.service';

function makeRedis() {
  const set = new Set<string>();
  return {
    sadd: jest.fn(async (_k: string, v: string) => (set.add(v), 1)),
    srem: jest.fn(async (_k: string, v: string) => (set.delete(v), 1)),
    sismember: jest.fn(async (_k: string, v: string) => (set.has(v) ? 1 : 0)),
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
});
