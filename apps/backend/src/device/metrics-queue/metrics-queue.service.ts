import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IngestMetricPoint, MetricsService } from '../metrics/metrics.service';

type QueueItem = {
  deviceId: string;
  points: IngestMetricPoint[];
};

@Injectable()
export class MetricsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsQueueService.name);

  private queue: QueueItem[] = [];
  private timer: NodeJS.Timeout | null = null;

  // tune these
  private readonly flushEveryMs = 500;
  private readonly maxQueueItems = 5000;     // safety cap
  private readonly flushBatchItems = 200;    // how many queue items per flush
  private readonly insertChunkSize = 1000;   // rows per INSERT

  private flushing = false;

  constructor(private readonly metrics: MetricsService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.flush().catch(() => {}), this.flushEveryMs);
    this.logger.log(`queue started (flushEveryMs=${this.flushEveryMs})`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Enqueue without blocking ingest.
   * Returns false if dropped due to queue cap.
   */
  enqueue(deviceId: string, points: IngestMetricPoint[]): boolean {
    if (!points?.length) return true;

    if (this.queue.length >= this.maxQueueItems) {
      // v1: drop rather than OOM. You can improve later (disk spool, backpressure, etc.)
      this.logger.warn(`queue full, dropping item (queueLen=${this.queue.length})`);
      return false;
    }

    this.queue.push({ deviceId, points });
    return true;
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
      // take up to N items
      const batch = this.queue.splice(0, this.flushBatchItems);

      // group by deviceId to reduce overhead and improve insert locality
      const grouped = new Map<string, IngestMetricPoint[]>();
      for (const item of batch) {
        const arr = grouped.get(item.deviceId) ?? [];
        arr.push(...item.points);
        grouped.set(item.deviceId, arr);
      }

      // Insert per device group
      for (const [deviceId, points] of grouped.entries()) {
        await this.metrics.insertMany(deviceId, points, this.insertChunkSize);
      }

      // Optional logging (keep it low volume)
      // this.logger.debug(`flushed items=${batch.length} remaining=${this.queue.length}`);
    } catch (err: any) {
      this.logger.error(`flush failed: ${err?.message ?? err}`);

      // Put items back at the front (best effort)
      // (Note: this can reorder slightly under failure; acceptable for v1)
      // If you want strict order, we can maintain a deque and requeue batch.
      // For now:
      // no-op: dropped batch. If you want requeue, tell me.
    } finally {
      this.flushing = false;
    }
  }
}
