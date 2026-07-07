import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../common/redis/redis.constants';

// String token (matches AgentModule's AGENT_JWT provider) — kept as a literal to
// avoid a circular import with agent.module.ts.
const AGENT_JWT = 'AGENT_JWT';

/**
 * Two kinds of agent credential:
 *  - `enroll`: durable, long-lived token handed out once at device creation and
 *    stored by the agent. Never expires, but is revocable per-device. Used only
 *    to obtain access tokens.
 *  - `ingest`: short-lived access token the agent gets by exchanging its
 *    enrollment token. Presented on every IngestBatch call.
 *
 * A machine that is offline for days simply re-exchanges its enrollment token on
 * reconnect — no manual token provisioning. Revocation blocks both new
 * exchanges and (once the short access token expires) further ingestion.
 */
export type AgentScope = 'enroll' | 'ingest';

export type AgentJwtPayload = {
  sub: string; // deviceId
  scope: AgentScope;
};

export type TokenExchangeResult = {
  accessToken: string;
  expiresInSec: number;
};

@Injectable()
export class AgentService {
  private readonly accessTtlSec: number;

  constructor(
    @Inject(AGENT_JWT) private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {
    this.accessTtlSec = Number(this.config.get('AGENT_ACCESS_TTL_SEC', 900));
  }

  /** Durable, non-expiring enrollment token issued at device creation. */
  mintEnrollment(deviceId: string): string {
    const payload: AgentJwtPayload = { sub: deviceId, scope: 'enroll' };
    return this.jwt.sign(payload);
  }

  /** Short-lived access token used for ingestion. */
  mintAccess(deviceId: string): string {
    const payload: AgentJwtPayload = { sub: deviceId, scope: 'ingest' };
    return this.jwt.sign(payload, { expiresIn: this.accessTtlSec });
  }

  /**
   * Exchange a durable enrollment token for a fresh short-lived access token.
   * Throws UnauthorizedException if the enrollment token is invalid or the
   * device has been revoked.
   */
  async exchange(enrollmentToken: string): Promise<TokenExchangeResult> {
    const payload = this.verifyEnrollment(enrollmentToken);
    await this.assertNotRevoked(payload.sub);
    return {
      accessToken: this.mintAccess(payload.sub),
      expiresInSec: this.accessTtlSec,
    };
  }

  /** Verify a short-lived access token for the ingest path. */
  async verifyAccess(token: string): Promise<AgentJwtPayload> {
    const payload = this.verifyScoped(token, 'ingest');
    await this.assertNotRevoked(payload.sub);
    return payload;
  }

  private verifyEnrollment(token: string): AgentJwtPayload {
    return this.verifyScoped(token, 'enroll');
  }

  private verifyScoped(token: string, scope: AgentScope): AgentJwtPayload {
    let payload: AgentJwtPayload;
    try {
      payload = this.jwt.verify<AgentJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid agent token');
    }
    if (!payload?.sub || payload.scope !== scope) {
      throw new UnauthorizedException('Invalid agent token payload');
    }
    return payload;
  }

  // ── Revocation (per-device deny-list) ────────────────────────────────────

  private static readonly REVOKED_SET = 'agent:revoked';

  async revoke(deviceId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.sadd(AgentService.REVOKED_SET, deviceId);
  }

  async unrevoke(deviceId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.srem(AgentService.REVOKED_SET, deviceId);
  }

  async isRevoked(deviceId: string): Promise<boolean> {
    if (!this.redis) return false;
    return (await this.redis.sismember(AgentService.REVOKED_SET, deviceId)) === 1;
  }

  private async assertNotRevoked(deviceId: string): Promise<void> {
    if (await this.isRevoked(deviceId)) {
      throw new UnauthorizedException('Device revoked');
    }
  }
}
