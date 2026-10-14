import { useEffect, useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowRight,
  Github,
  Check,
  Copy,
  Activity,
  Cpu,
  HardDrive,
  Terminal,
  Menu,
  X,
  Radio,
  ShieldCheck,
  Layers,
  Server,
  BookOpen,
  Monitor,
  Network,
  Container,
  Fingerprint,
  Crosshair,
} from "lucide-react";
import "./style.css";
import { ProductDemo, SignalPreview, ContainerPreview } from "./product-demo";
import composeExample from "../../../deploy/compose.yml?raw";
const REPO = "https://github.com/tiagomiguel29/project-orion";
function Logo() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Monitor size={20} />
      </span>
      <span>
        [SCOPE]<small>INFRASTRUCTURE MONITOR</small>
      </span>
    </span>
  );
}
function Shell() {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="nav-wrap">
          <Link to="/" aria-label="Scope home" onClick={() => setMenu(false)}>
            <Logo />
          </Link>
          <button
            className="menu-toggle"
            aria-expanded={menu}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav className={menu ? "open" : ""} aria-label="Main navigation">
            <a href="/#features" onClick={() => setMenu(false)}>
              01 / CAPABILITIES
            </a>
            <a href="/#architecture" onClick={() => setMenu(false)}>
              02 / ARCHITECTURE
            </a>
            <Link to="/docs" onClick={() => setMenu(false)}>
              03 / DEPLOY
            </Link>
            <a
              className="nav-github"
              href={REPO}
              target="_blank"
              rel="noreferrer"
            >
              <Github size={15} /> SOURCE <ArrowUpRight size={13} />
            </a>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer>
        <div className="footer-top">
          <Link to="/" aria-label="Scope home">
            <Logo />
          </Link>
          <a href={REPO}>
            VIEW SOURCE <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SCOPE // MIT LICENSE</span>
          <span>
            <span className="status-dot" /> BUILT IN THE OPEN
          </span>
          <a href={`${REPO}/issues`}>
            REPORT AN ISSUE <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </>
  );
}
function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-topline">
          <span>SYS.MONITOR / OPEN SOURCE</span>
          <span>
            SELF-HOSTED <span className="status-dot" />
          </span>
        </div>
        <div className="hero-content">
          <div>
            <p className="eyebrow">
              <span className="status-dot" /> OPEN SOURCE / [SCOPE]
            </p>
            <h1>
              YOUR SYSTEMS.
              <br />
              <span>IN FULL SCOPE.</span>
            </h1>
          </div>
          <div className="hero-intro">
            <p>
              Real-time infrastructure monitoring.
              <br />
              CPU. Memory. Disk. Network. Temperature.
            </p>
            <p className="secondary-copy">
              A Go agent, a streaming backend, and the SCOPE dashboard. Run the
              entire stack on your infrastructure.
            </p>
            <div className="hero-actions">
              <Link className="button primary" to="/docs">
                DEPLOY SCOPE <ArrowUpRight size={16} />
              </Link>
              <a className="button secondary" href={REPO}>
                <Github size={16} /> VIEW SOURCE
              </a>
            </div>
            <div className="hero-notes">
              <span>MIT LICENSE</span>
              <span>SELF-HOSTED</span>
              <span>EARLY DEVELOPMENT</span>
            </div>
          </div>
        </div>
        <ProductDemo />
        <div className="hero-caption">
          <span>01 — EXPLORE THE PLATFORM / INTERACTIVE DEMO</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section className="stack-band" aria-label="Technology stack">
        <span>
          THE STACK
          <br />
          <strong>FROM AGENT TO SCREEN</strong>
        </span>
        <div>
          <span>
            GO <small>AGENT</small>
          </span>
          <span>
            gRPC <small>INGESTION</small>
          </span>
          <span>
            NestJS <small>BACKEND</small>
          </span>
          <span>
            PostgreSQL <small>STORAGE</small>
          </span>
          <span>
            Redis <small>PUB/SUB</small>
          </span>
        </div>
      </section>
      <section id="features" className="section features">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / CAPABILITIES</p>
            <h2>
              EVERY SIGNAL.
              <br />
              <span>ONE CONTROL SURFACE.</span>
            </h2>
          </div>
          <p>
            From fleet status to a single device.
            <br />
            The same focused interface, down to the details.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card corner-marks">
            <div className="card-number">
              <Cpu size={18} /> 01.1 / SYSTEM METRICS
            </div>
            <h3>
              THE MACHINE,
              <br />
              AT A GLANCE.
            </h3>
            <p>
              Track CPU, RAM, disk, network I/O, and CPU temperature. Inspect
              hardware, operating system, uptime, and last-seen status alongside
              the charts.
            </p>
            <SignalPreview />
            <div className="metric-legend">
              <span>CPU</span>
              <span>RAM</span>
              <span>DISK</span>
              <span>NET</span>
            </div>
          </article>
          <article className="feature-card corner-marks">
            <div className="card-number">
              <Activity size={18} /> 01.2 / METRIC HISTORY
            </div>
            <h3>
              CHANGE THE RANGE.
              <br />
              KEEP THE CONTEXT.
            </h3>
            <p>
              Explore eleven time ranges, from one minute to all available
              history. Bucketed data keeps charts readable as you zoom out.
            </p>
            <div className="range-scale">
              <span>1 MIN</span>
              <span>1 HOUR</span>
              <span>1 DAY</span>
              <span>ALL TIME</span>
            </div>
          </article>
          <article className="feature-card corner-marks">
            <div className="card-number">
              <Container size={18} /> 01.3 / DEVICE DETAIL
            </div>
            <h3>
              BEYOND
              <br />
              THE HOST.
            </h3>
            <p>
              Inspect Docker containers with CPU, memory, network traffic, and
              runtime status. See detected Cloudflare tunnels on the device
              detail page.
            </p>
            <ContainerPreview />
            <div className="feature-status">
              <Container size={15} />
              <span>CONTAINER TELEMETRY</span>
              <span className="status-dot" />
            </div>
          </article>
        </div>
        <div className="security-strip">
          <Fingerprint size={22} />
          <div>
            <strong>CONTROL ACCESS. KEEP OWNERSHIP.</strong>
            <span>
              Account authentication, MFA and passkeys. Device enrollment
              tokens. A stack you host and inspect.
            </span>
          </div>
          <a href={`${REPO}#readme`}>
            PROJECT GUIDE <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
      <section id="architecture" className="architecture section">
        <div className="architecture-copy">
          <p className="eyebrow">02 / ARCHITECTURE</p>
          <h2>
            COLLECT.
            <br />
            PERSIST.
            <br />
            <span>STREAM.</span>
          </h2>
          <p>
            A lightweight Go agent sends telemetry over gRPC. The backend
            commits metrics to PostgreSQL, distributes updates through Redis,
            and streams them to the dashboard over WebSockets.
          </p>
          <ul>
            <li>
              <Check size={15} /> Agent buffering and retry
            </li>
            <li>
              <Check size={15} /> Transactional batch deduplication
            </li>
            <li>
              <Check size={15} /> Cross-replica live metric delivery
            </li>
          </ul>
          <a
            className="text-link"
            href={`${REPO}/blob/main/docs/live-metrics.md`}
          >
            READ THE LIVE METRICS REPORT <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="flow-diagram corner-marks">
          <div className="diagram-top">
            <span>TELEMETRY / SIGNAL PATH</span>
            <Network size={15} />
          </div>
          <div className="diagram-devices">
            {["SERVER", "WORKSTATION", "EDGE DEVICE"].map((d) => (
              <div key={d}>
                <Server size={22} />
                <span>{d}</span>
                <small>GO AGENT</small>
              </div>
            ))}
          </div>
          <div className="flow-connector">
            <span />
            gRPC / TLS
            <span />
          </div>
          <div className="scope-node">
            <Layers size={20} />
            <strong>SCOPE BACKEND</strong>
            <span>NestJS</span>
          </div>
          <div className="storage-nodes">
            <div>
              <HardDrive size={15} />
              <span>
                PostgreSQL<small>COMMITTED METRICS</small>
              </span>
            </div>
            <div>
              <Layers size={15} />
              <span>
                Redis<small>PUB / SUB</small>
              </span>
            </div>
          </div>
          <div className="flow-connector">
            <span />
            WEBSOCKETS
            <span />
          </div>
          <div className="diagram-output">
            <Monitor size={21} />
            <span>
              [SCOPE]<small>INFRASTRUCTURE MONITOR</small>
            </span>
            <span className="status-dot" />
          </div>
          <p className="diagram-note">DESIGNED FOR MULTIPLE BACKEND REPLICAS</p>
        </div>
      </section>
      <section className="open-source section">
        <div className="source-mark">
          <img src="/favicon.svg" width="100" height="100" alt="" />
        </div>
        <div>
          <p className="eyebrow">03 / OPEN SOURCE</p>
          <h2>
            YOUR INFRASTRUCTURE.
            <br />
            <span>YOUR SOURCE CODE.</span>
          </h2>
          <p>
            Scope is in early development and released under the MIT license.
            Self-host it, inspect the implementation, report an issue, or
            contribute a change.
          </p>
          <a className="button secondary" href={REPO}>
            <Github size={16} /> EXPLORE THE REPOSITORY{" "}
            <ArrowUpRight size={15} />
          </a>
        </div>
        <span className="license-stamp">
          MIT<small>LICENSED</small>
        </span>
      </section>
      <section className="get-started section">
        <p className="eyebrow">
          <Terminal size={15} /> INITIALIZE / SCOPE
        </p>
        <h2>
          BRING YOUR SYSTEMS
          <br />
          <span>INTO SCOPE.</span>
        </h2>
        <p>
          Deploy the server with prebuilt images, then install an agent on each
          machine with a command from the dashboard. No source checkout needed.
        </p>
        <CopyCommand command="docker compose --env-file .env -f compose.yml up -d" />
        <Link className="button primary" to="/docs">
          READ THE SETUP GUIDE <ArrowRight size={16} />
        </Link>
        <span className="getting-note">
          GO AGENT // NESTJS BACKEND // SCOPE DASHBOARD
        </span>
      </section>
    </main>
  );
}
function CopyCommand({
  command,
  multiline = false,
}: {
  command: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={`command ${multiline ? "multiline" : ""}`}>
      <code>{command}</code>
      <button
        aria-label="Copy command"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
      <span className="sr-only" role="status">
        {copied
          ? "Command copied"
          : failed
            ? "Copy unavailable. Select and copy the command manually."
            : ""}
      </span>
    </div>
  );
}
function HighlightedCompose() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const highlightValue = (value: string) =>
    value.split(/(\$\{[^}]+\}|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:true|false|null)\b|\b\d+\b)/g).map((part, index) => {
      const kind = part.startsWith("${")
        ? "variable"
        : /^['"]/.test(part)
          ? "string"
          : /^(?:true|false|null|\d+)$/.test(part)
            ? "literal"
            : "plain";
      return <span className={`yaml-${kind}`} key={index}>{part}</span>;
    });

  return (
    <section className="docs-compose" aria-labelledby="compose-title">
      <div className="docs-compose-head">
        <div>
          <span>DEPLOYMENT TEMPLATE / YAML</span>
          <h3 id="compose-title">THE COMPLETE COMPOSE FILE.</h3>
          <p>Shown in full below. Copy it or download the exact file from the repository.</p>
        </div>
        <button
          type="button"
          aria-label={copied ? "Compose file copied" : "Copy Compose file"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(composeExample);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "COPIED" : "COPY YAML"}
        </button>
      </div>
      <pre className="docs-compose-code"><code>{composeExample.trimEnd().split("\n").map((line, index) => {
        const key = line.match(/^(\s*)(-\s+)?([A-Za-z_][\w.-]*)(:)(.*)$/);
        return (
          <span className="yaml-line" key={index}>
            {line.trimStart().startsWith("#") ? <span className="yaml-comment">{line}</span> : key ? <>
              {key[1]}{key[2]}<span className="yaml-key">{key[3]}</span><span className="yaml-punctuation">{key[4]}</span>{highlightValue(key[5])}
            </> : highlightValue(line)}{"\n"}
          </span>
        );
      })}</code></pre>
      <span className="sr-only" role="status">{copied ? "Compose file copied" : ""}</span>
    </section>
  );
}
function Docs() {
  useEffect(() => {
    document.title = "Get started — Scope";
    window.scrollTo(0, 0);
    return () => {
      document.title = "Scope // Infrastructure Monitor";
    };
  }, []);
  return (
    <main id="main" className="docs section">
      <Link to="/" className="text-link">
        ← Back to Scope
      </Link>
      <p className="eyebrow docs-eyebrow">
        <BookOpen size={15} /> THE FIRST SIGNAL
      </p>
      <h1>
        INITIALIZE.
        <br />
        <em>GET CONNECTED.</em>
      </h1>
      <p className="docs-intro">
        Deploy Scope from prebuilt container images, or run a local development
        stack from source. Then connect each machine with the one-command agent
        installer. The image deployment and monitored machines need no source
        checkout.
      </p>
      <div className="docs-paths" aria-label="Installation requirements">
        <div>
          <span>01 / SCOPE SERVER</span>
          <strong>Docker Compose</strong>
          <p>Pulls the dashboard, API, and landing images with PostgreSQL and Redis.</p>
        </div>
        <div>
          <span>02 / MONITORED MACHINE</span>
          <strong>Linux or macOS</strong>
          <p>One command from the dashboard. No Git, Go, or Docker required.</p>
        </div>
      </div>
      <h2 id="deploy" className="docs-section-heading">DEPLOY FROM IMAGES.</h2>
      <p className="docs-section-intro">
        Scope publishes <code>scope-backend</code>, <code>scope-web</code>, and
        <code> scope-landing</code> on Docker Hub under <code>tiagomiguel29</code> for Linux x64
        and ARM64. The example below adds PostgreSQL, Redis, and a one-time
        database migration. You choose how to host each component and which
        reverse proxy handles HTTPS, WebSockets, and gRPC.
      </p>
      <div className="docs-steps">
        <article>
          <span>A</span>
          <div>
            <h2>DOWNLOAD THE DEPLOYMENT FILES.</h2>
            <p>
              These are the complete <a href={`${REPO}/blob/main/deploy/compose.yml`} target="_blank" rel="noreferrer">Compose file <ArrowUpRight size={12} /></a>,
              and environment template. No repository clone is needed.
            </p>
            <CopyCommand multiline command={`mkdir scope && cd scope\ncurl -fsSLO ${REPO.replace("github.com", "raw.githubusercontent.com")}/main/deploy/compose.yml\ncurl -fsSLo .env.example ${REPO.replace("github.com", "raw.githubusercontent.com")}/main/deploy/.env.example`} />
          </div>
        </article>
        <article>
          <span>B</span>
          <div>
            <h2>SET ENDPOINTS AND SECRETS.</h2>
            <p>
              Copy the template to <code>.env</code>. Set the dashboard’s public
              HTTPS origin, the API URL, and the agent’s public gRPC address.
              Add a database password and three independent random secrets;
              <code> openssl rand -hex 32</code> can generate each one. Keep
              this file private.
            </p>
            <CopyCommand command="cp .env.example .env" />
            <p className="docs-note">
              The default <code>main</code> image tag tracks new builds. Pin
              <code> SCOPE_IMAGE_TAG</code> to a released version or digest for
              controlled production upgrades.
            </p>
          </div>
        </article>
        <article>
          <span>C</span>
          <div>
            <h2>START THE STACK.</h2>
            <p>
              Compose pulls the images, waits for PostgreSQL and Redis, runs
              migrations once, then starts the backend, dashboard, and landing
              page on local ports. Connect the reverse proxy of your choice and
              open your dashboard hostname to create an account.
            </p>
            <CopyCommand command="docker compose --env-file .env -f compose.yml up -d" />
            <p className="docs-note">
              Check progress with <code>docker compose --env-file .env -f compose.yml ps</code>.
              By default, the ports bind to <code>127.0.0.1</code>: dashboard
              <code> 3000</code>, API/WebSockets <code>4000</code>, gRPC
              <code> 50052</code>, and landing page <code>8080</code>.
            </p>
          </div>
        </article>
      </div>
      <p className="docs-scale-note">
        Your proxy should terminate TLS, forward WebSocket upgrades to port
        <code> 4000</code>, and speak HTTP/2 to the gRPC upstream on port
        <code> 50052</code>. The API and gRPC can share a public hostname when
        your proxy routes them separately. For backend replicas, replace the
        sample’s fixed host port bindings with your proxy’s service discovery
        or load balancer; Redis shares realtime state across replicas. A proxy
        container can also join the Compose network and route to the service
        names directly.
      </p>
      <HighlightedCompose />
      <h2 id="server" className="docs-section-heading">START THE SCOPE SERVER.</h2>
      <p className="docs-section-intro">
        Prefer source checkout for local development? These steps run the
        development stack. You’ll need Git and Docker Compose on this machine.
      </p>
      <div className="docs-steps">
        <article>
          <span>01</span>
          <div>
            <h2>CLONE THE REPOSITORY.</h2>
            <p>
              Clone the open-source repository and enter the project directory.
            </p>
            <CopyCommand
              multiline
              command={`git clone ${REPO}.git scope\ncd scope`}
            />
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>START THE STACK.</h2>
            <p>
              Start the dashboard, backend, PostgreSQL, and Redis. The initial
              build can take a few minutes.
            </p>
            <CopyCommand command="docker compose -f docker-compose.dev.yml up --build" />
            <p className="docs-note">
              This configuration is for local development. For public
              deployments, configure your secrets, TLS, and allowed origins.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>OPEN THE DASHBOARD.</h2>
            <p>
              Open{" "}
              <a href="http://localhost:3000" target="_blank" rel="noreferrer">
                localhost:3000 <ArrowUpRight size={13} />
              </a>
              , create your account, and sign in. The dashboard is where you
              register each device and get its installation command.
            </p>
          </div>
        </article>
      </div>
      <h2 id="agent" className="docs-section-heading">INSTALL AN AGENT.</h2>
      <p className="docs-section-intro">
        On the dashboard, select <strong>Add device</strong>. For an existing
        device, open its page and select <strong>Install agent</strong>. Each
        command is tied to one device and one short-lived pairing code.
      </p>
      <div className="docs-steps">
        <article>
          <span>04</span>
          <div>
            <h2>SET REACHABLE ADDRESSES.</h2>
            <p>
              Enter the backend URL for pairing and the gRPC host and port for
              telemetry. Both must be reachable from the machine you’re
              installing on. Use an HTTPS URL and TLS-enabled gRPC endpoint
              for a remote machine. The default <code>localhost:4000</code> API
              and <code>localhost:50052</code> gRPC addresses work only when the
              agent and backend run on the same machine.
            </p>
            <p className="docs-note">
              The dashboard’s plaintext gRPC option is for localhost development
              only. Public deployments need a trusted certificate and a reachable
              gRPC endpoint.
            </p>
          </div>
        </article>
        <article>
          <span>05</span>
          <div>
            <h2>COPY AND RUN THE COMMAND.</h2>
            <p>
              Copy the complete command generated by Scope and run it in a
              terminal on the machine to monitor. You’ll need sudo access and
              <code> curl</code>. The installer selects the matching Linux or
              macOS x64/ARM64 binary from the <a href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer">latest release <ArrowUpRight size={12} /></a>,
              checks its SHA-256 hash, pairs the device, and starts the service.
              The device ID and pairing code are unique; the example below shows
              the command’s shape, not values to paste.
            </p>
            <pre className="install-example"><code>curl -fsSL https://github.com/tiagomiguel29/project-orion/releases/latest/download/install.sh | sudo sh -s -- --server https://scope.example.com --grpc scope.example.com:443 --device DEVICE_ID --pair PAIRING_CODE</code></pre>
            <p className="docs-note">
              The pairing code expires after 10 minutes and works once. Get a
              fresh command through <strong>Install agent</strong> if it expires.
              Don’t share a command containing a live pairing code.
            </p>
          </div>
        </article>
        <article>
          <span>06</span>
          <div>
            <h2>CHECK THE FIRST SIGNAL.</h2>
            <p>
              The installer reports that the agent started. Return to the device
              page and wait for its live metrics. On Linux, inspect the service
              with <code>systemctl status scope-agent</code>; on macOS, use
              <code> launchctl print system/dev.scope.agent</code>. A fresh
              dashboard command can reinstall or update the agent without
              deleting the device’s history.
            </p>
            <p className="docs-note">
              The binary lives at <code>/usr/local/bin/scope-agent</code>, its
              private configuration at <code>/etc/scope/.env</code>, and buffered
              telemetry at <code>/var/lib/scope/wal.db</code>.
            </p>
          </div>
        </article>
      </div>
      <div className="docs-next">
        <Terminal size={25} />
        <div>
          <h3>NEED DEPLOYMENT DETAILS?</h3>
          <p>
            Read the agent guide for pairing, TLS, local development, and release
            details.
          </p>
        </div>
        <a className="button secondary" href={`${REPO}/blob/main/docs/agent-install.md`} target="_blank" rel="noreferrer">
          Agent installation guide <ArrowUpRight size={16} />
        </a>
      </div>
    </main>
  );
}
const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: () => (
    <main id="main" className="docs section">
      <h1>ROUTE NOT FOUND.</h1>
      <p>This page doesn’t exist yet.</p>
      <Link className="button primary" to="/">
        Back to Scope <ArrowRight size={16} />
      </Link>
    </main>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: Docs,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, docsRoute]),
  scrollRestoration: true,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
export default function App() {
  return <RouterProvider router={router} />;
}
