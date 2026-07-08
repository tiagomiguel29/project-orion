import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('metrics')
@Index(['deviceId', 'time'])
@Index(['name'])
// Serves the dashboard "latest value per (device, metric)" query
// (distinctOn(deviceId, name) ORDER BY ... time DESC) and per-metric sparklines.
@Index(['deviceId', 'name', 'time'])
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
