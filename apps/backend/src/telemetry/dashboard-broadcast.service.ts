import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../common/redis/redis.constants';

// Redis coordinates broadcast load only. Durable batch deduplication lives in
// the database transaction, so Redis loss/TTL expiry cannot acknowledge lost data.
@Injectable()
export class DashboardBroadcastService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async allowDashboardEmit(deviceId: string, throttleMs: number): Promise<boolean> {
    if (!this.redis) return true;
    return (await this.redis.set(`dashboard:emit:${deviceId}`, '1', 'PX', Math.max(1, throttleMs), 'NX')) === 'OK';
  }
}
