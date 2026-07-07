import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

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
          new Logger('RedisModule').warn(
            'REDIS_URL not set — ingest dedup and revocation checks are disabled',
          );
          return null;
        }
        return new Redis(url, { maxRetriesPerRequest: null });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
