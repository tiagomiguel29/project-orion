import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IngestMetricPoint, MetricsService } from '../metrics/metrics.service';

type QueueItem = {
  deviceId: string;
  points: IngestMetricPoint[];
  resolve: () => void;
  reject: (err: unknown) => void;
};

/**
 * Buffers metric points and flushes them to the DB in batched INSERTs.
 *
 * `enqueue` returns a Promise that resolves only once the points have been
 * durably committed (or rejects if the flush fails). This lets the ingest
 * handler ack the agent *after* persistence, so nothing is silently dropped —
 * a rejected enqueue tells the agent to retry the same batch.
 */
@Injectable()
export class MetricsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsQueueService.name);

  private queue: QueueItem[] = [];
  private timer: NodeJS.Timeout | null = null;

  // tune these
  private readonly flushEveryMs = 200;
  private readonly maxQueueItems = 5000; // safety cap (backpressure signal)
  private readonly flushBatchItems = 200; // how many queue items per flush
  private readonly insertChunkSize = 1000; // rows per INSERT

  private flushing = false;

  constructor(private readonly metrics: MetricsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.flush(), this.flushEveryMs);
    this.logger.log(`queue started (flushEveryMs=${this.flushEveryMs})`);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Best-effort drain so in-flight acks resolve/reject on shutdown.
    await this.flush();
    for (const item of this.queue.splice(0)) {
      item.reject(new Error('shutting down'));
    }
  }

  /**
   * Enqueue points for durable persistence.
   * @returns a Promise that resolves when committed, rejects on failure or when
   * the queue is full (caller should map a rejection to a RETRY ack).
   */
  enqueue(deviceId: string, points: IngestMetricPoint[]): Promise<void> {
    if (!points?.length) return Promise.resolve();

    if (this.queue.length >= this.maxQueueItems) {
      // Signal backpressure instead of silently dropping — the agent keeps the
      // batch in its WAL and retries.
      this.logger.warn(`queue full (queueLen=${this.queue.length}) — asking agent to retry`);
      return Promise.reject(new Error('ingest queue full'));
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ deviceId, points, resolve, reject });
      // Kick a flush promptly so ack latency stays low.
      if (!this.flushing) void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
      // take up to N items
      const batch = this.queue.splice(0, this.flushBatchItems);

      // group by deviceId to reduce overhead and improve insert locality
      const grouped = new Map<string, QueueItem[]>();
      for (const item of batch) {
        const arr = grouped.get(item.deviceId) ?? [];
        arr.push(item);
        grouped.set(item.deviceId, arr);
      }

      // Insert per device group; resolve/reject each item by its group's result.
      for (const [deviceId, items] of grouped.entries()) {
        const points = items.flatMap((i) => i.points);
        try {
          await this.metrics.insertMany(deviceId, points, this.insertChunkSize);
          for (const item of items) item.resolve();
        } catch (err: any) {
          this.logger.error(
            `flush failed for device=${deviceId}: ${err?.message ?? err}`,
          );
          for (const item of items) item.reject(err);
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}
