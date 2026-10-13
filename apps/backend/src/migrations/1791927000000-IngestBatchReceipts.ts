import { MigrationInterface, QueryRunner } from 'typeorm';

export class IngestBatchReceipts1791927000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "ingest_batches" (
      "deviceId" text NOT NULL, "batchId" text NOT NULL,
      "committedAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("deviceId", "batchId")
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "ingest_batches"');
  }
}
