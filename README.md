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

