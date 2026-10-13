import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricEntity } from '../entities/metric.entity';
import { IngestBatchEntity } from '../entities/ingest-batch.entity';

export type IngestMetricPoint = {
  name: string;
  value: number;
  labels?: Record<string, string>;
  tsUnixMs: number; // from proto
};

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(MetricEntity)
    private readonly metricsRepo: Repository<MetricEntity>,
  ) {}

  // Metrics and all newly accepted batch receipts share one transaction.
  // A failed chunk rolls back the entire group; concurrent duplicates wait
  // on the receipt's unique key before they can be acknowledged.
  async insertBatches(
    deviceId: string,
    batches: { batchId: string; points: IngestMetricPoint[] }[],
    chunkSize = 1000,
  ): Promise<boolean[]> {
    return this.metricsRepo.manager.transaction(async (manager) => {
      const accepted = batches.map(() => false);
      const rows: Partial<MetricEntity>[] = [];
      // Stable acquisition order avoids receipt-lock deadlocks across replicas.
      const ordered = batches.map((batch, index) => ({ ...batch, index }))
        .sort((a, b) => a.batchId.localeCompare(b.batchId));
      for (const batch of ordered) {
        if (batch.batchId) {
          const receipt = await manager.createQueryBuilder()
            .insert().into(IngestBatchEntity)
            .values({ deviceId, batchId: batch.batchId })
            .orIgnore().returning('"batchId"').execute();
          if (receipt.raw.length === 0) continue;
        }
        accepted[batch.index] = true;
        rows.push(...batch.points.map((p) => ({
          time: new Date(p.tsUnixMs), deviceId, name: p.name,
          labels: p.labels ?? {}, value: p.value,
        })));
      }
      for (let i = 0; i < rows.length; i += chunkSize) {
        await manager.insert(MetricEntity, rows.slice(i, i + chunkSize));
      }
      return accepted;
    });
  }
}
