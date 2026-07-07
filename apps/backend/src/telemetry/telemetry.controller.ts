import { Controller, Logger, UseGuards } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { GrpcAgentJwtGuard } from '../agent/grpc-agent-auth.guard';
import { AgentService } from '../agent/agent.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MetricsQueueService } from 'src/device/metrics-queue/metrics-queue.service';
import { IngestMetricPoint } from 'src/device/metrics/metrics.service';
import { DeviceService } from 'src/device/device.service';
import { DashboardService } from 'src/device/dashboard/dashboard.service';
import { IdempotencyService } from './idempotency.service';
import { IngestAck, IngestStatus, ingestAck } from './ingest-status';

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
  private readonly logger = new Logger(TelemetryController.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly metricsQueue: MetricsQueueService,
    private readonly deviceService: DeviceService,
    private readonly dashboardService: DashboardService,
    private readonly idempotency: IdempotencyService,
    private readonly agentService: AgentService,
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

    // Idempotency: claim the batch first. If it was already seen, this is a
    // retry of a batch that already committed — ack DUPLICATE so the agent
    // drops it from its WAL without re-emitting or re-persisting.
    const claimed = await this.idempotency.claim(batchId);
    if (!claimed) {
      return ingestAck(IngestStatus.DUPLICATE, 'duplicate batch');
    }

    try {
      this.deviceService.markSeen(deviceId);

      const points: IngestMetricPoint[] = (batch.metrics ?? []).map(
        (m: MetricPoint) => ({
          name: m.name,
          value: Number(m.value),
          labels: m.labels ?? {},
          tsUnixMs: Number(m.tsUnixMs),
        }),
      );

      // HOT PATH: realtime immediately (before persistence — latency unchanged).
      this.realtime.emitToDevice(deviceId, 'telemetry', {
        deviceId,
        sentAtUnixMs: batch.sentAtUnixMs,
        intervalSec: batch.intervalSec,
        metrics: batch.metrics ?? [],
      });

      // Cold update of device info (not part of the durability contract).
      const systemInfo = batch.systemInfo ?? {};
      this.deviceService.updateDeviceInfo(deviceId, {
        hostname: systemInfo.hostname ?? '',
        os: systemInfo.os ?? '',
        kernel: systemInfo.kernel ?? '',
        cpuName: systemInfo.cpuName ?? '',
        memoryCapacity: Number(systemInfo.memoryCapacity ?? 0),
        diskCapacity: Number(systemInfo.diskCapacity ?? 0),
        osName: systemInfo.osName ?? '',
      });

      // DURABLE PATH: wait for the DB commit before acking.
      await this.metricsQueue.enqueue(deviceId, points);

      // Fire-and-forget: push the recomputed dashboard card to subscribers.
      void this.emitDashboardUpdate(deviceId);

      return ingestAck(IngestStatus.ACCEPTED, 'accepted');
    } catch (err: any) {
      // Persistence (or backpressure) failed — release the claim so the
      // agent's retry with the same batch_id can re-acquire and try again.
      await this.idempotency.release(batchId);
      this.logger.warn(
        `ingest RETRY device=${deviceId} batch=${batchId}: ${err?.message ?? err}`,
      );
      return ingestAck(IngestStatus.RETRY, 'persistence failed, retry');
    }
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
