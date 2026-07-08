import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../common/redis/redis.constants';

/**
 * Liveness and readiness probes for load balancers / orchestrators.
 *  - /health/live  : process is up (never touches dependencies).
 *  - /health/ready : dependencies reachable (DB required, Redis if configured).
 *    Returns 503 when not ready so the LB stops routing and rolling deploys wait.
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.db = 'up';
    } catch {
      checks.db = 'down';
    }

    if (!this.redis) {
      checks.redis = 'disabled';
    } else {
      try {
        checks.redis = (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
      } catch {
        checks.redis = 'down';
      }
    }

    const ready = checks.db === 'up' && checks.redis !== 'down';
    if (!ready) {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ok', checks };
  }
}
