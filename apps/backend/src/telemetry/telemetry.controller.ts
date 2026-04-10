import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcAgentJwtGuard } from '../agent/grpc-agent-auth.guard';
import { RealtimeService } from '../realtime/realtime.service';
import { MetricsQueueService } from 'src/device/metrics-queue/metrics-queue.service';
import { IngestMetricPoint } from 'src/device/metrics/metrics.service';
import { DeviceService } from 'src/device/device.service';
import { DashboardService } from 'src/device/dashboard/dashboard.service';

type MetricPoint = {
  name: string;
  value: number;
  labels?: Record<string, string>;
  tsUnixMs: string | number;
};

type SystemInfo = {
  hostname: string;
  os: string;
  osName: string;
  kernel: string;
  cpuName: string;
  memoryCapacity: number;
  diskCapacity: number;
};

type TelemetryBatch = {
  sentAtUnixMs: string | number;
  intervalSec: number;
  metrics: MetricPoint[];
};

@Controller()
export class TelemetryController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly metricsQueue: MetricsQueueService,
    private readonly deviceService: DeviceService,
    private readonly dashboardService: DashboardService,
  ) {}

  @UseGuards(GrpcAgentJwtGuard)
  @GrpcMethod('TelemetryIngestService', 'IngestBatch')
  ingestBatch(batch: any, metadata: any) {
    // IMPORTANT: per your discovery, metadata is the gRPC Metadata object
    // and the guard should attach deviceId somewhere you control.
    // Since metadata is not a plain object, easiest is: have guard attach to payload.
    // We'll assume guard set: batch._deviceId = <jwt sub>

    const deviceId = metadata.agent?.deviceId as string | undefined;

    if (!deviceId) {
      return { ok: false, message: 'missing authenticated deviceId' };
    }

    this.deviceService.markSeen(deviceId);

    const points: IngestMetricPoint[] = (batch.metrics ?? []).map((m: MetricPoint) => ({
      name: m.name,
      value: Number(m.value),
      labels: m.labels ?? {},
      tsUnixMs: Number(m.tsUnixMs),
    }));

    // HOT PATH: realtime immediately
    this.realtime.emitToDevice(deviceId, 'telemetry', {
      deviceId,
      sentAtUnixMs: batch.sentAtUnixMs,
      intervalSec: batch.intervalSec,
      metrics: batch.metrics ?? [],
    });

    // COLD PATH: enqueue for DB (non-blocking)
    const ok = this.metricsQueue.enqueue(deviceId, points);

    // Cold update device info
    this.deviceService.updateDeviceInfo(deviceId, {
      hostname: batch.systemInfo.hostname ?? '',
      os: batch.systemInfo.os ?? '',
      kernel: batch.systemInfo.kernel ?? '',
      cpuName: batch.systemInfo.cpuName ?? '',
      memoryCapacity: Number(batch.systemInfo.memoryCapacity ?? 0),
      diskCapacity: Number(batch.systemInfo.diskCapacity ?? 0),
      osName: batch.systemInfo.osName ?? '',
    });

    // Fire-and-forget: emit computed dashboard card to all dashboard subscribers
    this.emitDashboardUpdate(deviceId);

    if (!ok) {
      // still ack ingestion; realtime already sent
      return { ok: true, message: 'received (dropped persistence due to queue full)' };
    }

    return { ok: true, message: 'received' };
  }

  private async emitDashboardUpdate(deviceId: string) {
    try {
      const card = await this.dashboardService.getDeviceDashboardPayload(deviceId, '15m');
      this.realtime.emitToDashboard('dashboard.update', card);
    } catch {
      // non-critical — dashboard subscribers will get the next update
    }
  }
}
