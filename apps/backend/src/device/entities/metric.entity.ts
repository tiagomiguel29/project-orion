import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('metrics')
@Index(['deviceId', 'time'])
@Index(['name'])
export class MetricEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  time: Date;

  @Column({ type: 'text' })
  deviceId: string; // store as text for now (easy). You can switch to uuid later.

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'jsonb', default: {} })
  labels: Record<string, string>;

  @Column({ type: 'double precision' })
  value: number;
}
