import { Expose } from 'class-transformer';

export class DockerContainerDto {
  @Expose()
  name: string;

  @Expose()
  image: string;

  @Expose()
  health: string;

  @Expose()
  cpuPercent: number;

  @Expose()
  ramUsageBytes: number;

  @Expose()
  ramLimitBytes: number;

  @Expose()
  netRxBytes: number;

  @Expose()
  netTxBytes: number;
}
