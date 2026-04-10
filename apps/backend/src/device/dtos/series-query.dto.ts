import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SeriesQueryDto {
  @IsString()
  deviceId: string;

  @IsString()
  metric: string; // "cpuPct" or "system.cpu.pct" (your naming)

  @IsInt()
  @Min(0)
  fromUnixMs: number;

  @IsInt()
  @Min(0)
  toUnixMs: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bucketSec?: number; // optional downsampling (e.g. 2,5,10)
}
