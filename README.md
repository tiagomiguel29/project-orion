# Scope

Scope is a real-time device monitoring platform that uses a lightweight agent to collect system telemetry, a backend to ingest and stream data, and a web dashboard to manage devices and view live and historical system health.

The project is current in early development.

## Structure

```text
scope/
├── apps/
│   ├── agent/      # Go telemetry agent
│   ├── backend/    # NestJS API + realtime backend
│   ├── ios/        # Future native iOS client
│   ├── landing/    # React + Vite + TanStack marketing site
│   └── web/        # Next.js dashboard
└── package.json    # Root workspace scripts for Node apps
```

## Deploy prebuilt images

Scope publishes the backend, dashboard, and landing page as Linux x64/ARM64
images on Docker Hub. The [deployment guide](deploy/README.md)
and [Compose example](deploy/compose.yml) use those images with PostgreSQL,
Redis, and a one-time migration. Set the public endpoints and secrets in
`deploy/.env.example`, then run from the `deploy` directory:

```bash
docker compose --env-file .env -f compose.yml up -d
```

The Compose file and its companion `.env.example` can be downloaded without
cloning this repository. Bring your own reverse proxy or hosting setup for
HTTPS, WebSockets, and gRPC. The landing page's `/docs` guide includes the
download commands and the complete Compose file.

## Quick start

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Run the web app

```bash
npm run dev:web
```

### 3. Run the backend

```bash
npm run dev:backend
```

### 4. Run the Go agent

```bash
npm run agent:run
```

## Install an agent on another machine

The dashboard's **Add Device** dialog creates a 10-minute, single-use pairing
code and a one-line install command. Set the backend HTTPS URL and gRPC address
to endpoints reachable from the target machine, then run the command there.
The installer downloads the matching Linux or macOS release binary, verifies its
SHA-256 checksum, redeems the pairing code, and starts the agent with systemd
or launchd. It stores the enrollment token in `/etc/scope/.env` with mode `0600`
and the durable telemetry buffer in `/var/lib/scope/wal.db`.
If the code expires, open that device and select **Install agent** to create a
fresh one without deleting its telemetry history.

The [v0.1.0 agent release](https://github.com/tiagomiguel29/project-orion/releases/tag/v0.1.0)
contains four Linux/macOS x64/ARM64 archives, checksums, and `install.sh`. The
dashboard generates the complete command with a fresh pairing code.

For local development, the backend uses `localhost:4000` and plaintext gRPC on
`localhost:50052`. These addresses only work when the agent runs on the same
machine. Public deployments should use HTTPS for pairing and trusted TLS for
gRPC; the installer rejects plaintext outside localhost.

Run `FLOW_PASSWORD=… node scripts/verify-agent-install.mjs` against a disposable
development stack to test download, checksum verification, one-time pairing,
and live telemetry from the installed binary without touching system services.

## Test / development environment (Docker)

Bring up the whole stack — Postgres, Redis, the backend (HTTP + gRPC) and the web
dashboard — with a single command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Service | URL |
| --- | --- |
| Web dashboard | http://localhost:3000 |
| Backend HTTP API | http://localhost:4000 |
| Backend gRPC (agent ingestion) | localhost:50052 |

Postgres and Redis run inside the compose network only (they are **not** published
to the host, so they won't clash with anything you run locally). Ports and secrets
can be overridden via environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_PORT` | `3000` | Web dashboard host port |
| `HTTP_PORT` | `4000` | Backend HTTP host port |
| `GRPC_PORT` | `50052` | Backend gRPC host port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser API URL served by runtime config in the dev stack |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin |
| `AGENT_JWT_SECRET`, `USER_JWT_SECRET` | dev defaults | Token signing secrets |

The dashboard image reads its browser-facing API and agent addresses at runtime.
Set `NEXT_PUBLIC_API_URL` to the browser-reachable HTTP address when overriding
`HTTP_PORT` in the development Compose file.

Tear everything down (including the database volume):

```bash
docker compose -f docker-compose.dev.yml down -v
```

> The image-based HTTPS deployment lives in `deploy/compose.yml`.

### Verify the complete local flow

With the development stack running and Go installed, set `FLOW_PASSWORD` to
the local test account's password and run `npm run test:flow`. On a fresh
database the script creates the first account (`flow-test@example.com`);
otherwise it signs into that account. Set `FLOW_EMAIL` to use another account
without MFA.

The check registers a unique test device, runs the real Go agent, verifies
authenticated WebSocket telemetry and successive dashboard/chart updates,
reloads persisted history, then stops the agent and waits for the offline
transition. It leaves the account, device and history available for inspection.
Use a disposable development database. `FLOW_API_URL` and `FLOW_GRPC_ADDRESS`
override the default local endpoints; `FLOW_AGENT_BINARY` can point to a
prebuilt agent instead of running it through Go.

The device dialog generates agent instructions for the development stack's
published gRPC port. For image deployments, set `SCOPE_PUBLIC_API_URL`,
`SCOPE_PUBLIC_AGENT_SERVER_ADDRESS`, and `SCOPE_PUBLIC_AGENT_TLS_DISABLE` on the
web container. Use plaintext only for local development. Run the endpoint
regression checks with `node --experimental-strip-types --test scripts/agent-config.test.mjs`.

## Environment files

- `apps/web/.env.example`
- `apps/backend/.env.example`
- `apps/agent/.env.example`

Copy the examples you need to `.env` files inside each app directory before running locally.

## Docker helpers

```bash
npm run backend:docker
npm run agent:docker
```


## Live metrics and horizontal scaling

See [the verification report](docs/live-metrics.md) for the complete ingestion,
persistence, Redis, WebSocket and chart flow; per-range point budgets; repeatable
three-replica/failure tests; and retention/capacity limits.

## Notifications

Admins can open **Notifications** from the dashboard to enable alerts, set
offline/CPU/RAM/disk/temperature thresholds, and configure HTTPS webhooks,
Discord webhooks, or email. Each device page links to an override for its
thresholds and channels. Global provider switches remain authoritative. Alerts
are recorded on threshold transitions, with optional recovery messages; failed
deliveries retry from a PostgreSQL queue shared by all backend replicas.

For email, choose Resend (API key), Amazon SES (IAM key pair or instance role),
or SMTP in the Notifications page, then enter recipients. Resend and SES can be
configured there without redeploying; SMTP uses `SCOPE_SMTP_*` variables on
every backend replica. Provider secrets are encrypted using
`MFA_ENCRYPTION_SECRET`; all replicas must use the same secret. The
[notifications guide](docs/notifications.md) covers setup, webhook payloads,
retries, and device overrides. The admin page
has test-send buttons for each provider and shows recent alerts and deliveries.

## Landing page

Run `npm run dev:landing` to open the standalone marketing site at
http://localhost:5173. Build with `npm run build:landing`. See
[the landing app guide](apps/landing/README.md) for deployment details.
