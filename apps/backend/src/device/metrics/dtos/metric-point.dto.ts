import { Expose } from 'class-transformer';

export class MetricPointDto {
  @Expose()
  tsUnixMs: number;

  @Expose()
  value: number | null;

  @Expose()
  sampleCount?: number;

  @Expose()
  firstTsUnixMs?: number;

  @Expose()
  lastTsUnixMs?: number;
}
