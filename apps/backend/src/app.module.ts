import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';

import { AgentModule } from './agent/agent.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceModule } from './device/device.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.getOrThrow('DATABASE_URL'),
        autoLoadEntities: true,
        // Schema is managed by migrations (see data-source.ts). Keep the escape
        // hatch of DB_SYNCHRONIZE=true for throwaway local databases only —
        // never with multiple instances (concurrent DDL races).
        synchronize: cfg.get('DB_SYNCHRONIZE', 'false') === 'true',
        migrationsRun: false,
        connectTimeoutMS: 5000,
        // Bound the per-instance pool so replicas × max stays under the
        // Postgres connection limit (front with pgbouncer for higher scale).
        extra: { max: Number(cfg.get('DB_POOL_MAX', 10)) },
      }),
    }),
    AgentModule,
    AuthModule,
    RealtimeModule,
    TelemetryModule,
    DeviceModule,
    UserModule,
    HealthModule,
  ],
  // Controllers are declared in their feature modules (TelemetryModule,
  // AuthModule). Declaring them here too created duplicate instances in the
  // AppModule scope that could not see feature-module-scoped providers.
  controllers: [],
  providers: [],
})
export class AppModule {}
