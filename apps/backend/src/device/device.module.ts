import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { MetricsService } from './metrics/metrics.service';
import { MetricsQueueService } from './metrics-queue/metrics-queue.service';
import { DeviceEntity } from './entities/device.entity';
import { MetricEntity } from './entities/metric.entity';
import { EventEntity } from './entities/event.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DeviceStatusScheduler } from './device-status.scheduler';
import { AuthModule } from 'src/auth/auth.module';
import { AgentModule } from 'src/agent/agent.module';
import { DashboardService } from './dashboard/dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity, MetricEntity, EventEntity]),
    RealtimeModule,
    ScheduleModule.forRoot(),
    AuthModule,
    AgentModule,
  ],
  providers: [DeviceService, MetricsService, MetricsQueueService, DeviceStatusScheduler, DashboardService],
  controllers: [DeviceController],
  exports: [DeviceService, MetricsService, MetricsQueueService, DashboardService],
})
export class DeviceModule {}
