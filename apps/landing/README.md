# Scope landing page

React + Vite + TypeScript with TanStack Router. Independent of the Next.js device dashboard.

From the repository root:

```sh
npm install
npm run dev:landing
npm run build:landing
```

Development: http://localhost:5173. Production output: `apps/landing/dist`.
Serve the output on a static host with an SPA fallback to `index.html` so `/docs` and unknown routes work on direct navigation.
The published `scope-landing` image includes Nginx with that fallback. The
`/docs` page displays the actual [deployment Compose file](../../deploy/compose.yml)
in a syntax-highlighted, copyable panel. It explains the prebuilt images,
user-selected reverse proxy, migrations, backend scaling, and one-command agent
installation.

The homepage contains a native React/SVG SCOPE playground, feature demonstrations, an animated telemetry diagram, and repository links. The playground uses simulated data; no backend or credentials are needed. It supports device and range selection, load simulation, and pause/resume. Streaming updates pause when the playground is off-screen or the tab is hidden. Reduced-motion preferences disable automatic updates and decorative animation. `/docs` covers local Docker setup and the one-command agent installation on Linux or macOS, with links to the published release and agent guide.

The colors, monospace typography, monitor/reticle marks, metric labels, status treatments, and panel corners follow the actual web platform. Product visuals are DOM/SVG, not scaled screenshots. Fonts load from Google Fonts with local system fallbacks.
