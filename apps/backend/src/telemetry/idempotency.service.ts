import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../common/redis/redis.constants';

/**
 * Batch-level idempotency for ingestion. Each batch carries a stable `batch_id`
 * (generated once by the agent, reused on every retry). We claim the id in
 * Redis before persisting so a retried batch that already succeeded is detected
 * as a duplicate instead of being inserted twice.
 *
 * Contract:
 *  - `claim` uses SET NX so only the first attempt for an id wins.
 *  - On a persistence failure the caller MUST `release` the id, so the agent's
 *    retry can re-acquire and try again (no data loss).
 *  - TTL bounds memory to a window comfortably longer than the max retry span.
 *  - With no Redis configured, dedup is disabled (claim always succeeds) — the
 *    only downside is possible duplicate rows on the rare retry-after-success.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly ttlSec = 300;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  private key(batchId: string): string {
    return `ingest:batch:${batchId}`;
  }

  /** Returns true if newly claimed (process it), false if already seen. */
  async claim(batchId: string): Promise<boolean> {
    if (!batchId) return true; // no id → cannot dedupe, process it
    if (!this.redis) return true;

    const res = await this.redis.set(
      this.key(batchId),
      '1',
      'EX',
      this.ttlSec,
      'NX',
    );
    return res === 'OK';
  }

  /** Release a claimed id after a persistence failure so retries can proceed. */
  async release(batchId: string): Promise<void> {
    if (!batchId || !this.redis) return;
    try {
      await this.redis.del(this.key(batchId));
    } catch (err: any) {
      this.logger.warn(
        `failed to release idempotency key ${batchId}: ${err?.message ?? err}`,
      );
    }
  }
}
