import { Expose, Type } from 'class-transformer';
import { MetricPointDto } from './metric-point.dto';

export class SparklineDto {
  @Expose()
  name: string; // e.g. "cpuPct"

  @Expose()
  unit: string; // "%", "C", "Bps"

  @Expose()
  @Type(() => MetricPointDto)
  points: MetricPointDto[];
}
