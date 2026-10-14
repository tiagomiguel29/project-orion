import { useEffect, useRef, useState, useId } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Layers,
  Network,
  Thermometer,
  Pause,
  Play,
  Zap,
  Server,
  ChevronDown,
} from "lucide-react";

const ranges = [
  "1 MIN",
  "5 MIN",
  "1 HOUR",
  "2 HOURS",
  "5 HOURS",
  "12 HOURS",
  "1 DAY",
  "1 WEEK",
  "1 MONTH",
  "1 YEAR",
  "ALL TIME",
];
const devices = [
  {
    name: "production-01",
    os: "Ubuntu 24.04",
    cpu: "AMD EPYC",
    memory: 32,
    offset: 0,
  },
  {
    name: "workstation",
    os: "macOS",
    cpu: "Apple M2 Max",
    memory: 32,
    offset: 13,
  },
  {
    name: "edge-node",
    os: "Debian 12",
    cpu: "ARM Cortex-A72",
    memory: 8,
    offset: 26,
  },
];
const durations = [
  60, 300, 3600, 7200, 18000, 43200, 86400, 604800, 2592000, 31536000, 63072000,
];
function sample(i: number, channel: number, seed: number, spike: boolean) {
  const baseline = [29, 61, 18, 48][channel];
  return Math.max(
    3,
    Math.min(
      96,
      baseline +
        Math.sin(i * 0.31 + seed) * [12, 3, 9, 4][channel] +
        Math.sin(i * 0.91 + seed) * [5, 1, 4, 2][channel] +
        (spike ? [42, 10, 24, 15][channel] : 0),
    ),
  );
}
function Chart({
  channel,
  tick,
  seed,
  spike,
  range,
  paused,
}: {
  channel: number;
  tick: number;
  seed: number;
  spike: boolean;
  range: number;
  paused: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const color = channel === 2 ? "#3b82f6" : "#4ade80";
  const samples = Array.from({ length: 48 }, (_, i) =>
    sample(i + tick, channel, seed + (range * (47 - i)) / 47, spike && i > 40),
  );
  // Leave room for the endpoint marker and its glow inside the SVG viewport.
  const xAt = (i: number) => 6 + (i * 458) / 47;
  const path = samples
    .map((v, i) => `${i ? "L" : "M"}${xAt(i)},${112 - v}`)
    .join(" ");
  const title = ["CPU USAGE", "MEMORY USAGE", "NETWORK I/O", "CPU TEMPERATURE"][
    channel
  ];
  const Icon = [Cpu, Layers, Network, Thermometer][channel];
  const current = samples[47];
  const startLabel =
    range < 2
      ? `${durations[range] / 60}m ago`
      : range < 6
        ? `${durations[range] / 3600}h ago`
        : range < 9
          ? `${Math.round(durations[range] / 86400)}d ago`
          : range === 9
            ? "1y ago"
            : "First sample";
  return (
    <div className="demo-chart corner-marks">
      <div className="demo-chart-label">
        <Icon size={12} />
        {title}
      </div>
      <div className="demo-chart-reading">
        <strong style={{ color }}>
          {channel === 2 ? (current / 12).toFixed(1) : current.toFixed(1)}
        </strong>
        <span>{channel === 2 ? "MB/s" : channel === 3 ? "°C" : "%"}</span>
        <span className="chart-state">{paused ? "HELD" : "STREAMING"}</span>
      </div>
      <div className="demo-plot">
        <div className="demo-axis">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>
        <svg
          viewBox="0 0 470 120"
          role="img"
          aria-label={`${title}: ${(channel === 2 ? current / 12 : current).toFixed(1)} ${channel === 2 ? "megabytes per second" : channel === 3 ? "degrees Celsius" : "percent"}, simulated data`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".2" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[12, 62, 112].map((y) => (
            <line
              key={y}
              x1="0"
              x2="470"
              y1={y}
              y2={y}
              stroke="#1e2a1c"
              strokeDasharray="3 4"
            />
          ))}
          {[0, 94, 188, 282, 376, 470].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1="12"
              y2="112"
              stroke="#1e2a1c"
              strokeDasharray="3 4"
            />
          ))}
          <path
            className="demo-area"
            d={`${path} L464,120 L6,120 Z`}
            fill={`url(#${id})`}
          />
          <path
            className="demo-line"
            d={path}
            stroke={color}
            strokeWidth="1.6"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          {channel === 2 && (
            <path
              className="demo-line"
              d={samples
                .map((v, i) => `${i ? "L" : "M"}${xAt(i)},${112 - v * 0.55}`)
                .join(" ")}
              stroke="#4ade80"
              strokeWidth="1.4"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle cx="464" cy={112 - current} r="3" fill={color} />
        </svg>
      </div>
      <div className="demo-times">
        <span>{startLabel}</span>
        <span>
          {range < 2
            ? "SECONDS"
            : range < 6
              ? "HOURS"
              : range < 9
                ? "DAYS"
                : "HISTORY"}
        </span>
        <span>Now</span>
      </div>
    </div>
  );
}
export function ProductDemo() {
  const [tick, setTick] = useState(0),
    [device, setDevice] = useState(0),
    [range, setRange] = useState(2),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(false),
    [visible, setVisible] = useState(true),
    [spikeTicks, setSpikeTicks] = useState(0);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (paused || reduced || !visible) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
      setSpikeTicks((t) => Math.max(0, t - 1));
    }, 1600);
    return () => clearInterval(timer);
  }, [paused, reduced, visible]);
  const held = paused || reduced;
  const d = devices[device];
  const spike = spikeTicks > 0;
  return (
    <figure
      ref={ref}
      className="product-frame live-product corner-marks"
      data-paused={held}
      data-tick={tick}
    >
      <div className="demo-window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>scope / device / {d.name}</span>
        <span className="playground-label">PRODUCT PLAYGROUND</span>
      </div>
      <div className="demo-device-header">
        <div className="demo-device">
          <Server size={20} />
          <div>
            <label className="device-select">
              <span className="sr-only">Demo device</span>
              <select
                aria-label="Demo device"
                value={device}
                onChange={(e) => {
                  setDevice(Number(e.target.value));
                  setSpikeTicks(0);
                }}
              >
                {devices.map((d, i) => (
                  <option value={i} key={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <span>
              {d.os} // {d.cpu} // {d.memory} GB RAM
            </span>
          </div>
        </div>
        <span className="demo-live">
          <span className="status-dot" />
          {held ? "PAUSED" : "LIVE DEMO"}
        </span>
      </div>
      <div className="product-toolbar">
        <span>RANGE:</span>
        <div className="range-tabs" aria-label="Demo time range">
          {ranges.map((r, i) => (
            <button
              key={r}
              aria-pressed={range === i}
              onClick={() => setRange(i)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="demo-metrics">
        {[
          {
            label: "CPU",
            icon: Cpu,
            value: sample(47 + tick, 0, d.offset, spike).toFixed(1),
            unit: "%",
            color: "#4ade80",
          },
          {
            label: "RAM",
            icon: Layers,
            value: sample(47 + tick, 1, d.offset, spike).toFixed(1),
            unit: "%",
            color: "#f59e0b",
          },
          {
            label: "DISK",
            icon: HardDrive,
            value: device === 2 ? "24.6" : "41.8",
            unit: "%",
            color: "#4ade80",
          },
          {
            label: "NETWORK",
            icon: Network,
            value: (sample(47 + tick, 2, d.offset, spike) / 12).toFixed(1),
            unit: "MB/s",
            color: "#3b82f6",
          },
          {
            label: "CPU TEMP",
            icon: Thermometer,
            value: sample(47 + tick, 3, d.offset, spike).toFixed(0),
            unit: "°C",
            color: "#4ade80",
          },
        ].map((m) => (
          <div key={m.label}>
            <span>
              <m.icon size={12} />
              {m.label}
            </span>
            <strong style={{ color: m.color }}>
              {m.value}
              <small>{m.unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="demo-charts">
        {[0, 1, 2, 3].map((channel) => (
          <Chart
            key={channel}
            channel={channel}
            tick={tick}
            seed={d.offset}
            spike={spike}
            range={range}
            paused={held}
          />
        ))}
      </div>
      <div className="demo-controls">
        <span className="demo-event">
          <Activity size={13} />
          <span>
            {spike
              ? "Load spike detected — metrics responding"
              : held
                ? "Stream paused — explore the controls"
                : `Batch ${String(1042 + tick).padStart(5, "0")} received · metrics updated`}
          </span>
        </span>
        <div>
          <button
            onClick={() => {
              setSpikeTicks((s) => (s ? 0 : 6));
            }}
            aria-pressed={spike}
          >
            <Zap size={13} />
            {spike ? "CLEAR SPIKE" : "SIMULATE LOAD"}
          </button>
          <button
            onClick={() => setPaused(!paused)}
            disabled={reduced}
            aria-label={paused ? "Resume demo" : "Pause demo"}
          >
            {held ? <Play size={13} /> : <Pause size={13} />}
            <span>{held ? "RESUME" : "PAUSE"}</span>
          </button>
        </div>
      </div>
      <figcaption>
        <span>INTERACTIVE SCOPE PREVIEW</span>
        <span>
          SIMULATED TELEMETRY ·{" "}
          {reduced ? "REDUCED MOTION" : "NO CONNECTION REQUIRED"}
        </span>
      </figcaption>
    </figure>
  );
}
export function SignalPreview() {
  return (
    <div className="signal-preview" aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          style={{
            height: `${18 + ((i * 37) % 70)}%`,
            animationDelay: `${i * -0.13}s`,
          }}
        />
      ))}
    </div>
  );
}
export function ContainerPreview() {
  return (
    <div className="container-preview" aria-hidden="true">
      {["scope-backend", "postgres", "redis"].map((name, i) => (
        <div key={name}>
          <span className="status-dot" />
          <span>{name}</span>
          <span className="container-meter">
            <i style={{ animationDelay: `-${i * 1.5}s` }} />
          </span>
          <small>RUNNING</small>
        </div>
      ))}
    </div>
  );
}
