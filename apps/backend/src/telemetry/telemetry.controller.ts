import { Controller, Logger, OnModuleDestroy, UseGuards } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { GrpcAgentJwtGuard } from '../agent/grpc-agent-auth.guard';
import { AgentService } from '../agent/agent.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MetricsQueueService } from 'src/device/metrics-queue/metrics-queue.service';
import { IngestMetricPoint } from 'src/device/metrics/metrics.service';
import { DeviceService } from 'src/device/device.service';
import { DashboardService } from 'src/device/dashboard/dashboard.service';
import { DashboardBroadcastService } from './dashboard-broadcast.service';
import { IngestAck, IngestStatus, ingestAck } from './ingest-status';
import { NotificationEventsService } from '../notifications/notification-events.service';

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
export class TelemetryController implements OnModuleDestroy {
  private readonly logger = new Logger(TelemetryController.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly metricsQueue: MetricsQueueService,
    private readonly deviceService: DeviceService,
    private readonly dashboardService: DashboardService,
    private readonly broadcasts: DashboardBroadcastService,
    private readonly agentService: AgentService,
    private readonly notifications: NotificationEventsService,
  ) {}

  /**
   * Exchange a durable enrollment token for a short-lived access token.
   * Deliberately NOT guarded by GrpcAgentJwtGuard — it authenticates via the
   * enrollment token in the request body, so an agent whose access token has
   * expired (e.g. after long downtime) can re-authenticate without operator
   * involvement.
   */
  @GrpcMethod('TelemetryIngestService', 'ExchangeToken')
  async exchangeToken(
    req: any,
  ): Promise<{ accessToken: string; expiresInSec: number }> {
    const enrollmentToken = req?.enrollmentToken as string | undefined;
    if (!enrollmentToken) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'missing enrollment token',
      });
    }
    try {
      return await this.agentService.exchange(enrollmentToken);
    } catch {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'invalid or revoked enrollment token',
      });
    }
  }

  @UseGuards(GrpcAgentJwtGuard)
  @GrpcMethod('TelemetryIngestService', 'IngestBatch')
  async ingestBatch(batch: any, metadata: any): Promise<IngestAck> {
    // Device identity comes from the authenticated access token (guard sets
    // metadata.agent.deviceId), never from the batch payload.
    const deviceId = metadata.agent?.deviceId as string | undefined;
    if (!deviceId) {
      return ingestAck(IngestStatus.UNAUTHENTICATED, 'missing authenticated deviceId');
    }

    const batchId = (batch.batchId as string | undefined) ?? '';

    try {

      const points: IngestMetricPoint[] = (batch.metrics ?? []).map(
        (m: MetricPoint) => ({
          name: m.name,
          value: Number(m.value),
          labels: m.labels ?? {},
          tsUnixMs: Number(m.tsUnixMs),
        }),
      );

      // Cold update of device info (not part of the durability contract).
      const systemInfo = batch.systemInfo ?? {};
      await this.deviceService.updateDeviceInfo(deviceId, {
        hostname: systemInfo.hostname ?? '',
        os: systemInfo.os ?? '',
        kernel: systemInfo.kernel ?? '',
        cpuName: systemInfo.cpuName ?? '',
        memoryCapacity: Number(systemInfo.memoryCapacity ?? 0),
        diskCapacity: Number(systemInfo.diskCapacity ?? 0),
        osName: systemInfo.osName ?? '',
      });

      // DURABLE PATH: wait for the DB commit before acking.
      const accepted = await this.metricsQueue.enqueue(deviceId, points, batchId);
      if (!accepted) {
        await this.deviceService.markSeen(deviceId);
        this.scheduleDashboardUpdate(deviceId);
        return ingestAck(IngestStatus.DUPLICATE, 'duplicate committed batch');
      }
      await this.deviceService.markSeen(deviceId);

      // Publish committed telemetry only: retries must not duplicate chart points.
      this.realtime.emitToDevice(deviceId, 'telemetry', {
        deviceId,
        batchId,
        sentAtUnixMs: batch.sentAtUnixMs,
        intervalSec: batch.intervalSec,
        metrics: batch.metrics ?? [],
      });


      // Fire-and-forget: push the recomputed dashboard card to subscribers,
      // throttled per device so ingest rate doesn't drive DB + pub/sub load.
      this.scheduleDashboardUpdate(deviceId);

      return ingestAck(IngestStatus.ACCEPTED, 'accepted');
    } catch (err: any) {
      // Transaction failure rolls back metrics and the receipt together.

      this.logger.warn(
        `ingest RETRY device=${deviceId} batch=${batchId}: ${err?.message ?? err}`,
      );
      return ingestAck(IngestStatus.RETRY, 'persistence failed, retry');
    }
  }

  private readonly dashboardThrottleMs = Number(process.env.DASHBOARD_EMIT_THROTTLE_MS ?? 2000);
  private readonly dashboardTimers = new Map<string, NodeJS.Timeout>();

  private scheduleDashboardUpdate(deviceId: string) {
    if (this.dashboardTimers.has(deviceId)) return;
    void this.emitDashboardUpdate(deviceId);
    const timer = setTimeout(() => {
      this.dashboardTimers.delete(deviceId);
      void this.emitDashboardUpdate(deviceId);
    }, Math.max(1, this.dashboardThrottleMs));
    timer.unref?.();
    this.dashboardTimers.set(deviceId, timer);
  }

  onModuleDestroy() {
    for (const timer of this.dashboardTimers.values()) clearTimeout(timer);
    this.dashboardTimers.clear();
  }

  private async emitDashboardUpdate(deviceId: string) {
    try {
      if (!await this.broadcasts.allowDashboardEmit(deviceId, this.dashboardThrottleMs)) return;
      const card = await this.dashboardService.getDeviceDashboardPayload(deviceId, '15m');
      this.realtime.emitToDashboard('dashboard.update', card);
      try { await this.notifications.evaluateCard(card); }
      catch (error) { this.logger.warn(`notification evaluation failed for ${deviceId}: ${error instanceof Error ? error.message : error}`); }
    } catch {
      // non-critical — dashboard subscribers will get the next update
    }
  }
}
