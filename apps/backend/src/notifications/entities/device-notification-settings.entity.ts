import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { NotificationPolicy } from '../notification.types';

@Entity('device_notification_settings')
export class DeviceNotificationSettingsEntity {
  @PrimaryColumn({ type: 'uuid' })
  deviceId: string;

  @Column({ type: 'jsonb' })
  config: NotificationPolicy;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
