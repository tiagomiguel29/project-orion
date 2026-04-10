import { Expose } from 'class-transformer';

export class DeviceDto {
  @Expose()
  id: string;

  @Expose()
  externalId: string;

  @Expose()
  hostname: string | null;

  @Expose()
  os: string | null;

  @Expose()
  isActive: boolean;

  @Expose()
  status: string;

  @Expose()
  lastSeenAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
