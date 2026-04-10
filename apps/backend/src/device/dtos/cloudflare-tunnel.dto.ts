import { Expose } from 'class-transformer';

export class CloudflareTunnelDto {
  @Expose()
  tunnelId: string;

  @Expose()
  tunnelName: string;

  @Expose()
  status: string; // "healthy" | "degraded" | "down"

  @Expose()
  haConnections: number;

  @Expose()
  totalRequests: number;

  @Expose()
  requestErrors: number;
}
