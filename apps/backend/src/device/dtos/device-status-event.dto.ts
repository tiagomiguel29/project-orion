import { Expose } from 'class-transformer';
import type{ DeviceStatus } from './device-card.dto';

export class DeviceStatusEventDto {
  @Expose()
  deviceId: string;

  @Expose()
  status: DeviceStatus;

  @Expose()
  lastSeenAt?: string; // ISO
}
