import { useEffect, useRef, useState } from "react";
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
  Bell,
  Webhook,
  MessageCircle,
  Mail,
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
const previewAlerts = [
  { type: "AGENT OFFLINE", device: "production-01", detail: "No telemetry for 20 seconds", severity: "CRITICAL", color: "critical" },
  { type: "CPU USAGE", device: "edge-node", detail: "92.4% usage · threshold 85%", severity: "WARNING", color: "warning" },
  { type: "RECOVERED", device: "production-01", detail: "Agent is back online", severity: "RESOLVED", color: "resolved" },
] as const;
function NotificationPreview() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => { motion.removeEventListener("change", updateMotion); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (reduced || !visible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % previewAlerts.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [reduced, visible]);
  const alert = previewAlerts[index];
  return (
    <div ref={ref} className="notification-preview corner-marks" aria-label="Simulated notification flow">
      <div className="notification-preview-head">
        <span><Bell size={14} /> ALERT ENGINE</span>
        <span>INTERACTIVE PREVIEW / NO MESSAGES SENT</span>
      </div>
      <div className="notification-preview-body" key={index}>
        <div className="notification-preview-event">
          <div className="notification-preview-event-top">
            <span className={`notification-severity ${alert.color}`}><span className="status-dot" /> {alert.severity}</span>
            <span>NOW</span>
          </div>
          <strong>{alert.type}</strong>
          <p>{alert.device} <span>//</span> {alert.detail}</p>
        </div>
        <div className="notification-preview-rail" aria-hidden="true"><span /></div>
        <div className="notification-preview-destinations">
          <div><Webhook size={16} /><span>WEBHOOK</span><small>QUEUED → SENT</small><Check size={14} /></div>
          <div><MessageCircle size={16} /><span>DISCORD</span><small>QUEUED → SENT</small><Check size={14} /></div>
          <div><Mail size={16} /><span>EMAIL / RESEND · SES · SMTP</span><small>QUEUED → SENT</small><Check size={14} /></div>
        </div>
      </div>
      <div className="notification-preview-foot">
        <span>ONE EVENT / SELECT YOUR CHANNELS</span>
        <button type="button" onClick={() => setIndex((current) => (current + 1) % previewAlerts.length)}>
          NEXT EVENT <ArrowRight size={13} />
        </button>
      </div>
    </div>
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
      <section className="notifications-showcase section" aria-labelledby="notifications-title">
        <div className="notifications-copy">
          <p className="eyebrow">ALERTS / NOTIFICATION ROUTING</p>
          <h2 id="notifications-title">KNOW WHEN<br /><span>THE SIGNAL CHANGES.</span></h2>
          <p>
            Set fleet-wide thresholds for agent availability, CPU, RAM, disk,
            and temperature. Override rules for individual devices, then route
            alerts to a webhook, Discord, or email through Resend, Amazon SES, or SMTP.
          </p>
          <div className="notification-points">
            <span><Check size={14} /> Trigger and recovery alerts</span>
            <span><Check size={14} /> Per-device overrides</span>
            <span><Check size={14} /> Delivery history and retries</span>
          </div>
          <Link className="text-link" to="/docs">CONFIGURE NOTIFICATIONS <ArrowUpRight size={15} /></Link>
        </div>
        <NotificationPreview />
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
          <span>01</span>
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
          <span>02</span>
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
          <span>03</span>
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
      <h2 id="alerts" className="docs-section-heading">CONFIGURE NOTIFICATIONS.</h2>
      <p className="docs-section-intro">
        Notifications start disabled. Sign in as an admin and open the bell in
        the dashboard header. The page shows recent alerts and delivery
        attempts alongside the settings. Thresholds are evaluated when new
        telemetry arrives; offline alerts fire after the configured timeout.
      </p>
      <div className="docs-steps">
        <article>
          <span>07</span>
          <div>
            <h2>CHOOSE GLOBAL RULES.</h2>
            <p>
              Enable notifications, then set the offline timeout in seconds,
              CPU/RAM/disk thresholds in percent, and CPU temperature in °C.
              Recovery alerts are optional. Scope records an alert when a rule
              changes state, rather than sending one for every metric sample.
            </p>
          </div>
        </article>
        <article>
          <span>08</span>
          <div>
            <h2>CONNECT YOUR PROVIDERS.</h2>
            <p>
              For Webhook, enter a public HTTPS endpoint. For Discord, paste a
              Discord channel webhook URL. Switch on either provider and save;
              Scope stores provider secrets encrypted using your
              <code> MFA_ENCRYPTION_SECRET</code>. For email, choose Resend,
              Amazon SES, or SMTP in the same page, enter recipients, and
              enable Email.
            </p>
            <p className="docs-note">
              <strong>Resend:</strong> Verify a sending domain, create a sending-only API key,
              then enter the key and sender address. <strong>Amazon SES:</strong> Verify
              the sender in your AWS region, then enter the region and an IAM
              access key pair, or use the backend&apos;s IAM role. Both options
              save directly from the dashboard without a redeploy.
            </p>
            <p className="docs-note">
              <strong>SMTP:</strong> Add these values to the deployment <code>.env</code> on every backend replica.
              Port <code>587</code> uses STARTTLS by default; port <code>465</code> needs <code>SCOPE_SMTP_SECURE=true</code>.
            </p>
            <pre className="install-example"><code>{`# SMTP option in the deployment .env
SCOPE_SMTP_HOST=smtp.example.com
SCOPE_SMTP_PORT=587
SCOPE_SMTP_USER=your-smtp-user
SCOPE_SMTP_PASSWORD=your-smtp-password
SCOPE_SMTP_FROM=alerts@example.com`}</code></pre>
            <p className="docs-note">
              After changing SMTP variables, run <code>docker compose --env-file .env -f compose.yml up -d backend</code>.
              Save settings before using the Test buttons; they send a real message.
            </p>
          </div>
        </article>
        <article>
          <span>09</span>
          <div>
            <h2>OVERRIDE A DEVICE.</h2>
            <p>
              Open a device and select <strong>Alerts</strong>, or choose it on
              the Notifications page. Turn on custom settings to replace its
              thresholds and channel choices; turn custom settings off to
              inherit the global policy again. The global enable switch and
              provider switches always remain the master controls.
            </p>
          </div>
        </article>
      </div>
      <div className="docs-next">
        <Bell size={25} />
        <div>
          <h3>NEED DELIVERY DETAILS?</h3>
          <p>Read provider setup, alert payloads, and retry behavior in the notifications guide.</p>
        </div>
        <a className="button secondary" href={`${REPO}/blob/main/docs/notifications.md`} target="_blank" rel="noreferrer">
          Notifications guide <ArrowUpRight size={16} />
        </a>
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
