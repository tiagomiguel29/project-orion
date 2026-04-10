import { Expose } from 'class-transformer';

export class MetricPointDto {
  @Expose()
  tsUnixMs: number;

  @Expose()
  value: number | null;
}
