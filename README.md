# Project Orion

This project is a real-time device monitoring platform that uses a lightweight agent to collect system telemetry, a backend to ingest and stream data, and web and iOS clients to manage devices and view live and historical system health.

The project is current in early development.

## Structure

```text
project-orion/
├── apps/
│   ├── agent/      # Go telemetry agent
│   ├── backend/    # NestJS API + realtime backend
│   ├── ios/        # Native iOS client
│   └── web/        # Next.js dashboard
└── package.json    # Root workspace scripts for Node apps
```

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
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API URL baked into the web build |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin |
| `AGENT_JWT_SECRET`, `USER_JWT_SECRET` | dev defaults | Token signing secrets |

> `NEXT_PUBLIC_API_URL` is inlined into the web bundle at **build time**. If you
> change `HTTP_PORT`, rebuild the web image with a matching value, e.g.
> `HTTP_PORT=4001 NEXT_PUBLIC_API_URL=http://localhost:4001 docker compose -f docker-compose.dev.yml up --build`.

Tear everything down (including the database volume):

```bash
docker compose -f docker-compose.dev.yml down -v
```

> The TLS / reverse-proxy (Caddy) deployment used by the agent over the public
> internet lives in `apps/backend/docker-compose.yml`.

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

