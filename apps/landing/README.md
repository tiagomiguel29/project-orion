# Scope landing page

React + Vite + TypeScript with TanStack Router. Independent of the Next.js device dashboard.

From the repository root:

```sh
npm install
npm run dev:landing
npm run build:landing
```

Development: http://localhost:5173. Production output: `apps/landing/dist`.
The build pre-renders `/` and `/docs` into HTML so their headings and guide
content are available to crawlers before JavaScript runs. Serve `/docs` from
`docs/index.html` and return 404 for unknown paths. The published
`scope-landing` image includes an Nginx configuration for these routes. The
`/docs` page displays the actual [deployment Compose file](../../deploy/compose.yml)
in a syntax-highlighted, copyable panel. It explains the prebuilt images,
user-selected reverse proxy, migrations, backend scaling, one-command agent
installation, and notification setup. The [notifications guide](../../docs/notifications.md)
covers provider settings and delivery behavior in detail.

The homepage contains a native React/SVG SCOPE playground, feature demonstrations, an animated telemetry diagram, a simulated notification flow, and repository links. The playground uses simulated data; no backend or credentials are needed. It supports device and range selection, load simulation, and pause/resume. Streaming updates pause when the playground is off-screen or the tab is hidden. Reduced-motion preferences disable automatic updates and decorative animation. `/docs` covers local Docker setup, notifications with Resend, Amazon SES or SMTP, and the one-command agent installation on Linux or macOS, with links to the published release and agent guide.

The colors, monospace typography, monitor/reticle marks, metric labels, status treatments, and panel corners follow the actual web platform. Product visuals are DOM/SVG, not scaled screenshots. Fonts load from Google Fonts with local system fallbacks.

## Search and analytics

Set these environment variables when starting the published Docker image:

```sh
docker run -p 8080:80 \
  -e SCOPE_LANDING_URL=https://scope.example.com \
  -e SCOPE_UMAMI_WEBSITE_ID=your-umami-website-id \
  -e SCOPE_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js \
  tiagomiguel29/scope-landing:latest
```

`SCOPE_LANDING_URL` is the public HTTPS origin, without a path. It adds
canonical and Open Graph URLs to both pages and generates `sitemap.xml` and
`robots.txt`. Leave it unset until the site has a public URL. The social image
is `social-card.png`.

`SCOPE_UMAMI_WEBSITE_ID` is the public website ID copied from Umami's tracking
code. Analytics is disabled when it is unset. The script URL defaults to Umami
Cloud (`https://cloud.umami.is/script.js`); set
`SCOPE_UMAMI_SCRIPT_URL=https://your-umami.example.com/script.js` for a
self-hosted instance. Umami automatically tracks TanStack Router page changes.
Scope also records clicks on the main deploy, source, and setup-guide links.
The tracker respects Do Not Track and excludes search query values.

For a standalone static build, set the same `SCOPE_*` variables during
`npm run build:landing`; they are baked into the generated HTML and
`runtime-config.js`. The Docker image reads them at **container startup**, so
you can use one published image for different domains and Umami instances.
