import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_rule_states')
export class NotificationRuleStateEntity {
  @PrimaryColumn({ type: 'uuid' })
  deviceId: string;

  @PrimaryColumn({ type: 'text' })
  rule: string;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
