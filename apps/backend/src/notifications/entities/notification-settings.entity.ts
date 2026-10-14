import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { GlobalNotificationConfig } from '../notification.types';

@Entity('notification_settings')
export class NotificationSettingsEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'jsonb' })
  config: GlobalNotificationConfig;

  @Column({ type: 'text', nullable: true })
  webhookUrlEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  discordUrlEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  resendApiKeyEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  sesAccessKeyIdEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  sesSecretAccessKeyEncrypted: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
