import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

@Entity('devices')
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  @Index({ unique: true })
  externalId: string; // e.g. "dev_local_1" (agent uses this)

  @Column({ type: 'text', nullable: true })
  hostname: string | null;

  @Column({ type: 'text', nullable: true })
  os: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  lastSeenAt: Date | null;

  @Column({ type: 'text', default: 'unknown' })
  @Index()
  status: DeviceStatus;

  @Column({ type: 'text', nullable: true })
  kernel: string | null;

  @Column({ type: 'text', nullable: true })
  cpuName: string | null;

  @Column({ type: 'double precision', nullable: true })
  memoryCapacity: number | null;

  @Column({ type: 'double precision', nullable: true })
  diskCapacity: number | null;

  @Column({ type: 'text', nullable: true })
  osName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  statusChangedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
