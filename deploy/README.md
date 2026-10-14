# Deploy Scope from container images

The [Compose example](compose.yml) pulls `scope-backend`, `scope-web`, and
`scope-landing` from GitHub Container Registry. Only PostgreSQL, Redis, and
Caddy come from their upstream registries. The web image reads its browser API
and agent defaults from runtime environment variables, so it does not need to
be rebuilt for each domain.

The stack needs three DNS names pointing to the host: one for the landing page,
one for the dashboard, and one for the API and agent gRPC traffic. Allow inbound
TCP 80 and 443 so Caddy can obtain and renew trusted certificates. Copy
[`.env.example`](.env.example) to `.env`, set the DNS names, and fill all four
secrets. Use long random hex values (for example, `openssl rand -hex 32` for
each); the PostgreSQL password is embedded in `DATABASE_URL`, so URL-reserved
characters must be encoded if used. Keep `.env` private.

```sh
docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d
docker compose --env-file .env -f compose.yml ps
```

The migration container finishes before backend instances start. Schema
synchronization is disabled, and Redis coordinates realtime subscriptions and
ingestion across replicas. Caddy discovers backend container addresses through
Docker DNS for both HTTP/WebSockets and gRPC, so you can scale without changing
the proxy configuration:

```sh
docker compose --env-file .env -f compose.yml up -d --scale backend=3
```

The dashboard is at `https://<SCOPE_WEB_DOMAIN>`. Its **Add device** dialog
generates the one-line Linux/macOS agent installer with
`https://<SCOPE_API_DOMAIN>` for pairing and `<SCOPE_API_DOMAIN>:443` for gRPC.
The landing page is at `https://<SCOPE_LANDING_DOMAIN>`.

`SCOPE_IMAGE_TAG=main` follows the latest successful main-branch build. Use a
published version tag or image digest for predictable production upgrades.
The registry workflow is [container-images.yml](../.github/workflows/container-images.yml).
