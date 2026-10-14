# Notifications

Scope records alerts for agent availability, CPU, RAM, disk usage, and CPU
temperature. An admin chooses which rules are active and where alerts go.
Notifications are disabled by default.

## Configure global alerts

Open **Notifications** from the dashboard header and enable notifications.
Choose thresholds for:

| Rule | Default | Unit |
| --- | ---: | --- |
| Agent offline | 20 | seconds since the last telemetry batch |
| CPU | 85 | percent |
| RAM | 85 | percent |
| Disk | 90 | percent |
| CPU temperature | 80 | °C |

An alert is created when a device crosses a threshold. Scope does not create a
new alert for every sample that remains above it. Enable **Send recovery alerts**
to receive a second event when the device returns to normal. The offline timeout
also determines when the device is marked offline on the dashboard. Device
overrides can change that timeout for a particular device.

Turn on one or more providers after configuring their destinations. The global
enable switch and each global provider switch cap the effective policy for all
devices.

## Configure destinations

**Webhook:** Enter a public HTTPS URL in the Notifications page, then enable
Webhook. Scope sends a JSON `POST`. The webhook URL is encrypted in PostgreSQL
using `MFA_ENCRYPTION_SECRET`; all backend replicas must have the same secret.

**Discord:** Create a webhook for the intended Discord channel, paste its URL
in the Notifications page, and enable Discord. Scope sends an alert message with
mentions disabled. This URL is encrypted in PostgreSQL too.

**Email:** Enter up to 20 recipients, choose Resend, Amazon SES, or SMTP in the
Notifications page, then enable Email and save. API credentials are encrypted
in PostgreSQL with `MFA_ENCRYPTION_SECRET` and shared by backend replicas.

For **Resend**, verify your sending domain in Resend, create a **Sending access**
API key, and enter the key and a sender address on that domain. No backend
restart is needed. Resend requests use the alert event ID as an idempotency key
to avoid duplicate messages if a delivery is retried. See [Resend's API key
guide](https://resend.com/docs/dashboard/api-keys/introduction) and [domain
guide](https://resend.com/docs/dashboard/domains/introduction).

For **Amazon SES**, verify the sender identity in the selected AWS region, then
enter the region and sender address. You can enter an IAM access key ID and
secret access key with `ses:SendEmail` permission, or leave both fields blank
to use the backend container's IAM role / default AWS credential chain. SES
sandbox accounts can only send to verified recipients. If keys were saved
previously, select **Remove saved keys and use the backend IAM role**. See
[SES identity verification](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)
and [SES SendEmail](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html).

For **SMTP**, set the relay values on every backend replica and redeploy. The
image-based Compose deployment reads these values from `deploy/.env`:

```dotenv
SCOPE_SMTP_HOST=smtp.example.com
SCOPE_SMTP_PORT=587
SCOPE_SMTP_USER=your-smtp-user
SCOPE_SMTP_PASSWORD=your-smtp-password
SCOPE_SMTP_FROM=alerts@example.com
SCOPE_SMTP_SECURE=false
SCOPE_SMTP_REQUIRE_TLS=true
```

Port 587 uses STARTTLS with the defaults shown above. For an SMTP relay that
uses implicit TLS on port 465, set `SCOPE_SMTP_PORT=465` and
`SCOPE_SMTP_SECURE=true`. `SCOPE_SMTP_USER` and `SCOPE_SMTP_PASSWORD` can be
left empty if your relay does not require authentication. Set
`SCOPE_SMTP_REQUIRE_TLS=false` only if your relay intentionally does not
support STARTTLS; use a trusted private network for such a relay.

After editing `.env` for the image deployment, run:

```sh
docker compose --env-file .env -f compose.yml up -d backend
```

The **Test** button beside each provider sends a real test message to its
configured destination. Test messages do not create an alert or delivery
history row. Save the global settings before testing newly entered URLs or
recipients.

## Override a device

On a device page, select **Alerts**, or choose the device on the Notifications
page. Enable custom settings, then choose its own thresholds and providers.
Disable custom settings and save to restore inheritance from the global policy.
The global enable and provider switches remain in force; an override cannot
activate a globally disabled provider.

## Delivery and webhook format

Alerts and pending deliveries are committed to PostgreSQL together. All backend
replicas claim work from the same queue, so replicas do not deliberately send
the same pending delivery concurrently. Failed sends retry with increasing
delays, up to five attempts. A worker crash after a provider accepts a message
but before Scope records success can cause a duplicate. Consumers should use
the stable event ID for deduplication. Recent alerts and delivery statuses are
visible on the Notifications page.

An ordinary webhook receives JSON shaped like this:

```json
{
  "id": "event-uuid",
  "deviceId": "production-01",
  "deviceName": "production-01",
  "type": "alert.offline.triggered",
  "severity": "critical",
  "message": "production-01 is offline",
  "time": "2026-10-14T16:00:00.000Z",
  "labels": { "deviceName": "production-01", "externalId": "production-01", "rule": "offline" }
}
```

The `X-Scope-Event-Id` request header repeats `id`. A test send uses
`type: "alert.test"` and `deviceId: "test"`.

## Deployment notes

Run database migrations before starting a new backend image with
`DB_SYNCHRONIZE=false`; the published Compose example includes a migration
service. Keep `MFA_ENCRYPTION_SECRET` and any SMTP settings identical across
replicas. Redis distributes dashboard events across WebSocket replicas;
PostgreSQL coordinates alert transitions and delivery claims.
