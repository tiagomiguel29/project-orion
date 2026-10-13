import { Column, Entity, PrimaryColumn } from 'typeorm';

// A receipt is committed in the same transaction as its metrics. Concurrent
// replicas wait on this unique key and can only acknowledge committed batches.
@Entity('ingest_batches')
export class IngestBatchEntity {
  @PrimaryColumn({ type: 'text' })
  deviceId: string;

  @PrimaryColumn({ type: 'text' })
  batchId: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  committedAt: Date;
}
