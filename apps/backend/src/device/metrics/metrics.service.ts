import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricEntity } from '../entities/metric.entity';

export type IngestMetricPoint = {
  name: string;
  value: number;
  labels?: Record<string, string>;
  tsUnixMs: number; // from proto
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(MetricEntity)
    private readonly metricsRepo: Repository<MetricEntity>,
  ) {}

  /**
   * Bulk insert metrics. Uses INSERT (not SAVE) for performance.
   * chunkSize controls how many rows per INSERT statement.
   */
  async insertMany(deviceId: string, points: IngestMetricPoint[], chunkSize = 1000): Promise<void> {
    if (!points?.length) return;

    const rows = points.map((p) => ({
      time: new Date(p.tsUnixMs),
      deviceId,
      name: p.name,
      labels: p.labels ?? {},
      value: p.value,
    }));

    // TypeORM supports chunking in insert() options in some versions,
    // but for portability we chunk ourselves.
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.metricsRepo.insert(chunk);
    }
  }
}
