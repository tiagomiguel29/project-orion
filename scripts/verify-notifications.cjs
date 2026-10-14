// Run inside the disposable development backend container:
// docker exec -i project-orion-dev-backend-1 node - < scripts/verify-notifications.cjs
const { Client } = require('pg');
const { JwtService } = require('@nestjs/jwt');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let deviceId = null;
  let changedSettings = false;
  try {
    const existing = await db.query('SELECT count(*)::int AS count FROM notification_settings');
    if (existing.rows[0].count !== 0) throw new Error('Use a disposable database with no saved notification settings');
    const users = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!users.rows.length) throw new Error('Create an admin user in the disposable database first');
    const token = new JwtService({ secret: process.env.USER_JWT_SECRET }).sign({ sub: users.rows[0].id, role: 'admin', scope: 'api' });
    const api = async (path, init = {}) => {
      const response = await fetch(`http://localhost:4000${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
      const body = await response.json();
      if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
      return body;
    };
    const initial = await api('/notifications/settings');
    if (initial.config.enabled !== false) throw new Error('Expected notifications to default off');
    const config = { ...initial.config, enabled: true };
    await api('/notifications/settings', { method: 'PUT', body: JSON.stringify({ config }) });
    changedSettings = true;
    deviceId = `notif-smoke-${Date.now()}`;
    await api('/devices', { method: 'POST', body: JSON.stringify({ externalId: deviceId, hostname: 'Notification smoke test' }) });
    const override = { enabled: true, rules: { ...config.rules, offlineAfterSec: 10 }, providers: config.providers };
    await api(`/notifications/devices/${deviceId}/settings`, { method: 'PUT', body: JSON.stringify(override) });
    const effective = await api(`/notifications/devices/${deviceId}/settings`);
    if (effective.effective.rules.offlineAfterSec !== 10) throw new Error('Device timeout override was not applied');
    await db.query('UPDATE devices SET status = $2, "lastSeenAt" = NOW() - INTERVAL \'5 minutes\' WHERE "externalId" = $1', [deviceId, 'online']);
    let events = [];
    for (let i = 0; i < 8; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      events = await api(`/notifications/events?deviceId=${deviceId}`);
      if (events.length) break;
    }
    if (events.length !== 1 || events[0].type !== 'alert.offline.triggered') throw new Error(`Expected one offline alert, found ${JSON.stringify(events)}`);
    console.log('PASS: settings, device override, scheduled offline transition, deduplicated alert');
  } finally {
    try { if (deviceId) await db.query('DELETE FROM events WHERE "deviceId" IN (SELECT id FROM devices WHERE "externalId" = $1)', [deviceId]); } catch {}
    try { if (deviceId) await db.query('DELETE FROM devices WHERE "externalId" = $1', [deviceId]); } catch {}
    try { if (changedSettings) await db.query('DELETE FROM notification_settings WHERE id = 1'); } catch {}
    await db.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1 });
