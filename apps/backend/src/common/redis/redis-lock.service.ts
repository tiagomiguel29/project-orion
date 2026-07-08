import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

/**
 * Best-effort distributed lock over Redis, used so cluster-wide singletons
 * (e.g. the device-status sweep) run on exactly one instance per tick.
 *
 * With no Redis configured (single-instance dev) the work simply runs locally.
 */
@Injectable()
export class RedisLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /**
   * Run `fn` only if this instance can acquire `key`. Returns the result, or
   * `undefined` if another instance currently holds the lock. The lock has a
   * TTL so a crashed holder can't wedge it, and is released on completion.
   */
  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.redis) {
      // No coordination needed when running a single instance.
      return fn();
    }

    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') {
      return undefined; // another instance is running it this tick
    }

    try {
      return await fn();
    } finally {
      // Release only if we still own it (the TTL is the backstop otherwise).
      try {
        const current = await this.redis.get(key);
        if (current === token) {
          await this.redis.del(key);
        }
      } catch {
        // ignore — the TTL will expire the lock
      }
    }
  }
}
