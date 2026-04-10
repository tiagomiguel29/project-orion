import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { TelemetryController } from './telemetry/telemetry.controller';
import { AuthController } from './auth/auth.controller';
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
  controllers: [TelemetryController, AuthController],
  providers: [],
})
export class AppModule {}
