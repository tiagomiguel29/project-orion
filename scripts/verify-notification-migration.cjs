// Run inside the development backend container with PostgreSQL available:
// docker exec -i project-orion-dev-backend-1 node - < scripts/verify-notification-migration.cjs
const { Client } = require('pg');
const { Notifications1791994000000 } = require('./dist/migrations/1791994000000-Notifications');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA notification_migration_check');
    await client.query('SET LOCAL search_path TO notification_migration_check, public');
    await client.query('CREATE TABLE devices (id uuid PRIMARY KEY)');
    await client.query('CREATE TABLE events (id uuid PRIMARY KEY)');
    const migration = new Notifications1791994000000();
    const runner = { query: (sql) => client.query(sql) };
    await migration.up(runner);
    const tables = await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'notification_migration_check' AND (tablename LIKE '%notification_%')");
    if (tables.rows[0].count !== 4) throw new Error('Expected four notification tables');
    await migration.down(runner);
    console.log('PASS: notification migration up and down');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1 });
