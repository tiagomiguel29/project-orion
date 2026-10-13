import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';
import { RedisLockService } from './redis-lock.service';

/**
 * Shared application-level Redis client (separate from the Socket.IO adapter's
 * dedicated pub/sub connections). Provides `REDIS_CLIENT`, which is a connected
 * `Redis` instance or `null` when `REDIS_URL` is not configured — callers must
 * degrade gracefully in the null case.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Redis | null => {
        const url = cfg.get<string>('REDIS_URL');
        if (!url) {
          // Redis is load-bearing for multi-instance: the Socket.IO adapter,
          // dashboard throttling, revocation, and the scheduler lock all rely on it.
          // Refuse to boot without it when explicitly required.
          if (cfg.get('REQUIRE_REDIS', 'false') === 'true') {
            throw new Error(
              'REQUIRE_REDIS=true but REDIS_URL is not set — Redis is mandatory when running more than one instance',
            );
          }
          new Logger('RedisModule').warn(
            'REDIS_URL not set — WS adapter, dashboard throttling, revocation and scheduler lock are disabled (single-instance only)',
          );
          return null;
        }
        // Bound command latency: an unavailable Redis must produce a retry,
        // not leave cancelled gRPC requests and readiness checks hanging.
        return new Redis(url, { maxRetriesPerRequest: 2, commandTimeout: 3000 });
      },
    },
    RedisLockService,
  ],
  exports: [REDIS_CLIENT, RedisLockService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
