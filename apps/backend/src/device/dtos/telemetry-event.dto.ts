import { Expose, Type } from 'class-transformer';
import { DeviceSummaryDto } from './device-summary.dto';

export class TelemetryEventDto {
  @Expose()
  deviceId: string;

  @Expose()
  tsUnixMs: number;

  @Expose()
  @Type(() => DeviceSummaryDto)
  summary: DeviceSummaryDto;

  // Optional: include a few chart points inline
  // (if you want to append without mapping on client)
  @Expose()
  series?: Record<string, number>; // { cpuPct: 42.1, ramPct: 70.2, ... }
}
