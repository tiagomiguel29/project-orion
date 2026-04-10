import { Expose, Type } from 'class-transformer';
import { DeviceSummaryDto } from './device-summary.dto';
import { SparklineDto } from '../metrics/dtos/sparkline.dto';
import { DockerContainerDto } from './docker-container.dto';
import { CloudflareTunnelDto } from './cloudflare-tunnel.dto';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

export class DeviceCardDto {
  @Expose()
  externalId: string; // "PROD-WEB-01"

  @Expose()
  hostname?: string;

  @Expose()
  ipAddress?: string;

  @Expose()
  status: DeviceStatus;

  @Expose()
  os: string;

  @Expose()
  osName: string;

  @Expose()
  kernel: string;

  @Expose()
  cpuName: string;

  @Expose()
  memoryCapacity: number;

  @Expose()
  diskCapacity: number;

  @Expose()
  lastSeenAt?: string; // ISO string (easy for clients)

  @Expose()
  @Type(() => DeviceSummaryDto)
  summary: DeviceSummaryDto;

  @Expose()
  @Type(() => SparklineDto)
  sparklines: SparklineDto[]; // usually cpu/ram/disk/net/temp

  @Expose()
  @Type(() => DockerContainerDto)
  containers?: DockerContainerDto[];

  @Expose()
  @Type(() => CloudflareTunnelDto)
  tunnels?: CloudflareTunnelDto[];
}
