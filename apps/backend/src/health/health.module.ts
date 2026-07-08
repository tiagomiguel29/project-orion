import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// REDIS_CLIENT comes from the global RedisModule; the DataSource from the
// root TypeOrmModule — both are available without extra imports here.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
