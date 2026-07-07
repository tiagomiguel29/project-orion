import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { TelemetryController } from './telemetry.controller';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { AgentModule } from 'src/agent/agent.module';
import { DeviceModule } from 'src/device/device.module';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [AuthModule, RealtimeModule, AgentModule, DeviceModule],
  controllers: [TelemetryController],
  providers: [IdempotencyService],
})
export class TelemetryModule {}
