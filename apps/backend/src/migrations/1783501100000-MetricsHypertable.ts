import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts `metrics` into a TimescaleDB hypertable with a retention policy —
 * the change that lets the write + dashboard-aggregation load keep up as agents
 * and app instances scale out.
 *
 * Guarded: it no-ops on a plain Postgres server (timescaledb not available), so
 * the same migration set runs everywhere. To enable, run against a
 * `timescale/timescaledb` image (see docker-compose.scale.yml).
 *
 * Hypertables can't keep a unique constraint that excludes the partition column,
 * so the surrogate `id` primary key is dropped (metrics are addressed by
 * (deviceId, name, time), which the composite index already serves).
 *
 * Note: continuous aggregates for the latest/sparkline queries are a follow-up —
 * they need query rewrites in dashboard.service and are an optimization on top
 * of this. The hypertable + composite index deliver the core scaling benefit.
 */
export class MetricsHypertable1783501100000 implements MigrationInterface {
  name = 'MetricsHypertable1783501100000';
  private readonly logger = new Logger(MetricsHypertable1783501100000.name);

  public async up(q: QueryRunner): Promise<void> {
    const [{ available }] = await q.query(
      `SELECT count(*) > 0 AS available FROM pg_available_extensions WHERE name = 'timescaledb'`,
    );
    if (!available) {
      this.logger.warn(
        'timescaledb not available — skipping hypertable conversion (plain Postgres)',
      );
      return;
    }

    await q.query(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    // Drop the surrogate PK so the table can be partitioned by time.
    const pk = await q.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'metrics'::regclass AND contype = 'p'`,
    );
    if (pk[0]?.conname) {
      await q.query(`ALTER TABLE "metrics" DROP CONSTRAINT "${pk[0].conname}"`);
    }

    // Convert to a hypertable (migrating any existing rows).
    await q.query(
      `SELECT create_hypertable('metrics', 'time', migrate_data => true, if_not_exists => true)`,
    );

    // Drop chunks older than the retention window (default 30 days).
    await q.query(
      `SELECT add_retention_policy('metrics', INTERVAL '30 days', if_not_exists => true)`,
    );

    this.logger.log('metrics converted to a TimescaleDB hypertable (30d retention)');
  }

  public async down(q: QueryRunner): Promise<void> {
    const [{ available }] = await q.query(
      `SELECT count(*) > 0 AS available FROM pg_available_extensions WHERE name = 'timescaledb'`,
    );
    if (!available) return;
    // Hypertable → plain table conversion is not reversible in place; only drop
    // the retention policy. (A full rollback would rebuild the table.)
    await q.query(`SELECT remove_retention_policy('metrics', if_exists => true)`);
  }
}
