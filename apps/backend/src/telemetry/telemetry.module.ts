import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { TelemetryController } from './telemetry.controller';
import { RealtimeService } from 'src/realtime/realtime.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { AgentModule } from 'src/agent/agent.module';
import { DeviceModule } from 'src/device/device.module';
import { MetricsQueueService } from 'src/device/metrics-queue/metrics-queue.service';
import { MetricsService } from 'src/device/metrics/metrics.service';

@Module({
  imports: [AuthModule, RealtimeModule, AgentModule, DeviceModule],
  controllers: [TelemetryController],
  providers: [
    
  ],
})
export class TelemetryModule {}
