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
        synchronize: true,
        connectTimeoutMS: 5000,
      }),
    }),
    AgentModule,
    AuthModule,
    RealtimeModule,
    TelemetryModule,
    DeviceModule,
    UserModule,
  ],
  // Controllers are declared in their feature modules (TelemetryModule,
  // AuthModule). Declaring them here too created duplicate instances in the
  // AppModule scope that could not see feature-module-scoped providers.
  controllers: [],
  providers: [],
})
export class AppModule {}
