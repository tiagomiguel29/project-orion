# Deploy Scope from container images

## Landing page only on Coolify

Use [landing.compose.yml](landing.compose.yml) when deploying only the public
landing page. In the Scope project and desired environment, add an Application
from the public Git repository
`https://github.com/tiagomiguel29/project-orion`, select the `main` branch and
the Docker Compose build strategy, then set **Base Directory** to `/` and
**Docker Compose Location** to `deploy/landing.compose.yml`. The Compose file
pulls the published Docker Hub image; Coolify does not build the website.

Under **Domains**, route your landing hostname to the `landing` service on
internal port `80`. Set `SCOPE_LANDING_URL` under **Environment Variables** to
that hostname's full HTTPS origin (for example `https://scope.example.com`,
without a trailing slash). This enables canonical links and the sitemap.
`SCOPE_UMAMI_WEBSITE_ID` and `SCOPE_UMAMI_SCRIPT_URL` are optional; leave them
empty until Umami is configured. The script URL defaults to Umami Cloud when
the website ID is set. `SCOPE_IMAGE_TAG` defaults to `main` and can be pinned
to a published image tag. Save and deploy after the [container image workflow](../.github/workflows/container-images.yml)
has published that tag, then check `/`, `/docs`, and `/sitemap.xml` at your
hostname. The Compose health check covers `/` and `/docs`.

The Compose file does not publish a host port; Coolify's proxy connects to the
service's internal port `80`.

## Full platform

The [Compose example](compose.yml) pulls `tiagomiguel29/scope-backend`,
`tiagomiguel29/scope-web`, and `tiagomiguel29/scope-landing` from Docker Hub.
It runs PostgreSQL, Redis, and a one-time database migration. No source checkout
or bundled reverse proxy is required.

Download [compose.yml](compose.yml) and [`.env.example`](.env.example) into the
same directory, copy `.env.example` to `.env`, and fill in the public endpoints
and four secrets. Use independent random hex values (for example,
`openssl rand -hex 32`). The PostgreSQL password is embedded in `DATABASE_URL`,
so URL-reserved characters need encoding; hex avoids that problem. Keep `.env`
private.

```sh
docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d
docker compose --env-file .env -f compose.yml ps
```

The example binds the application ports to `127.0.0.1` on the host. Point your
own reverse proxy at these upstreams, or change `SCOPE_BIND_ADDRESS` to a
private interface address if the proxy runs elsewhere. Restrict access to the
unencrypted upstream ports when using a remote proxy.
If your proxy is a container, connect it to the Compose network and route to
`web:3000`, `backend:4000`, `backend:50052`, and `landing:80` instead. The
landing service is optional if you host the site separately.

| Component | Default upstream | Public proxy behavior |
| --- | --- | --- |
| Dashboard | `127.0.0.1:3000` | Serve at `SCOPE_WEB_ORIGIN` over HTTPS. |
| API and WebSockets | `127.0.0.1:4000` | Serve at `SCOPE_API_URL` over HTTPS; forward WebSocket upgrades. |
| Agent gRPC | `127.0.0.1:50052` | Serve at `SCOPE_AGENT_GRPC_ADDRESS` with TLS to agents and HTTP/2 to the upstream. |
| Landing page | `127.0.0.1:8080` | Serve at any hostname you choose. |

The API and gRPC endpoints may share one public hostname and port if your proxy
routes gRPC requests separately by content type. Set `SCOPE_WEB_ORIGIN` to the
dashboard's exact public origin, with no trailing slash, because the API uses
it for CORS and passkeys. Set `SCOPE_API_URL` and
`SCOPE_AGENT_GRPC_ADDRESS` to addresses reachable from monitored machines; the
dashboard uses them when generating agent installation commands. Leave
`SCOPE_AGENT_TLS_DISABLE=false` for a TLS-enabled public gRPC endpoint.

Set `SCOPE_LANDING_URL` to the landing page's public HTTPS origin when it has
one. The image generates canonical links, social preview tags, `robots.txt`,
and `sitemap.xml` when the container starts. To enable Umami, set
`SCOPE_UMAMI_WEBSITE_ID`; the Cloud script is the default. Set
`SCOPE_UMAMI_SCRIPT_URL` for a self-hosted Umami instance. These values remain
optional and can be changed without rebuilding the image.

Notifications are configured by an admin in the dashboard's **Notifications**
page. Enable the global alert switch, set offline/CPU/RAM/disk/temperature
thresholds, and choose Webhook, Discord, or Email. Device pages link to their
own overrides. Provider secrets are encrypted in the database using
`MFA_ENCRYPTION_SECRET`; keep that secret stable across backend replicas. For
Email, choose Resend (API key) or Amazon SES (IAM keys or instance role) in the
admin UI, or use SMTP through the `SCOPE_SMTP_*` variables in `.env`. All backend
replicas share delivery work through PostgreSQL, so do not use different SMTP
settings or encryption secrets across replicas.
See the [notifications guide](../docs/notifications.md) for provider setup,
delivery behavior, and the webhook payload.

The migration container finishes before the backend starts. PostgreSQL and
Redis stay on the Compose network without host port bindings. Redis coordinates
realtime subscriptions and ingestion across backend replicas. The sample's fixed
host ports allow one backend replica. To scale the backend, replace those port
bindings with your proxy's container-network service discovery or a load
balancer that can route to every replica for both API/WebSockets and gRPC.

`SCOPE_IMAGE_TAG=main` follows the latest successful main-branch build. Pin a
published version tag or image digest for predictable production upgrades. The
publishing workflow is [container-images.yml](../.github/workflows/container-images.yml).
