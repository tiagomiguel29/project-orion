import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('events')
@Index(['deviceId', 'time'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  time: Date;

  @Column({ type: 'uuid' })
  deviceId: string;

  @Column({ type: 'text' })
  type: string; // "agent.online", "tunnel.down", ...

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'text', default: 'info' })
  severity: 'info' | 'warning' | 'critical';

  @Column({ type: 'jsonb', default: {} })
  labels: Record<string, string>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
