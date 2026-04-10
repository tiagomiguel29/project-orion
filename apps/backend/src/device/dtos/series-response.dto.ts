import { Expose, Type } from 'class-transformer';
import { MetricPointDto } from '../metrics/dtos/metric-point.dto';

export class SeriesResponseDto {
  @Expose()
  deviceId: string;

  @Expose()
  metric: string;

  @Expose()
  unit: string;

  @Expose()
  fromUnixMs: number;

  @Expose()
  toUnixMs: number;

  @Expose()
  bucketSec?: number;

  @Expose()
  @Type(() => MetricPointDto)
  points: MetricPointDto[];
}
