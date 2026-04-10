import { Expose } from 'class-transformer';

export class DiskSummaryDto {
  @Expose()
  usedBytes: number;

  @Expose()
  totalBytes: number;

  @Expose()
  usedPct: number;
}

export class NetworkSummaryDto {
  @Expose()
  inBps: number;

  @Expose()
  outBps: number;
}

export class DeviceSummaryDto {
  @Expose()
  cpuPct: number;

  @Expose()
  ramPct: number;

  @Expose()
  ramUsedBytes: number;

  @Expose()
  ramTotalBytes: number;

  @Expose()
  disk: DiskSummaryDto;

  @Expose()
  network: NetworkSummaryDto;

  @Expose()
  cpuTempC?: number;

  @Expose()
  gpuPct?: number;

  @Expose()
  gpuTempC?: number;

  @Expose()
  uptimeSec?: number;
}
