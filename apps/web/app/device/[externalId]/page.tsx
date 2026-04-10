"use client"

import { use, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DeleteDeviceDialog } from "@/components/delete-device-dialog"
import { fetchDevice } from "@/lib/dashboard-service"
import { useRealtimeDevice } from "@/hooks/use-realtime-device"
import {
  DASHBOARD_RANGES,
  RANGE_LABELS,
  type DashboardRange,
} from "@/lib/dashboard-service"
import { mapDeviceToSystem, mapDeviceToChartData, generateTicks, formatTickLabel, getRangeDomain } from "@/lib/device-mapper"
import { StatusIndicator } from "@/components/status-indicator"
import { MetricBar } from "@/components/metric-bar"
import { cn } from "@/lib/utils"
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Activity,
  ArrowLeft,
  Monitor,
  AlertTriangle,
  Clock,
  Info,
  Terminal,
  Microchip,
  Container,
  Cloud,
} from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from "recharts"

const TOOLTIP_STYLE = {
  backgroundColor: "#0e120e",
  border: "1px solid #1e2a1c",
  borderRadius: 4,
  fontSize: 11,
  color: "#c8d0c0",
}

function getTempColor(temp: number) {
  if (temp >= 85) return "#ef4444"
  if (temp >= 70) return "#f59e0b"
  return "#4ade80"
}

function getUsageColor(value: number) {
  if (value >= 90) return "#ef4444"
  if (value >= 70) return "#f59e0b"
  return "#4ade80"
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "N/A"
  const gb = bytes / 1_073_741_824
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb.toFixed(1)} GB`
}

function formatContainerBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(sec?: number): string {
  if (!sec || sec <= 0) return "N/A"
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface DevicePageProps {
  params: Promise<{ externalId: string }>
}

export default function DevicePage({ params }: DevicePageProps) {
  const { externalId } = use(params)
  const router = useRouter()
  const { isAuthenticated, authState, token } = useAuth()
  const [range, setRange] = useState<DashboardRange>("1h")
  const chartNowMs = Date.now()

  const { data: deviceData, error, isLoading } = useSWR(
    isAuthenticated && token ? ["device", externalId, range, token] : null,
    ([, id, r, t]) => fetchDevice(t, id, r),
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  )

  // WebSocket keeps device data live after initial REST fetch
  const liveDevice = useRealtimeDevice(externalId, deviceData)

  const system = liveDevice ? mapDeviceToSystem(liveDevice) : null
  const chartData = liveDevice ? mapDeviceToChartData(liveDevice, range, chartNowMs) : null

  // Precompute domain and ticks for the selected range
  const cpuDomain = getRangeDomain(range, chartData?.cpu, chartNowMs)
  const ramDomain = getRangeDomain(range, chartData?.ram, chartNowMs)
  const networkDomain = getRangeDomain(range, chartData?.network, chartNowMs)
  const tempDomain = getRangeDomain(range, chartData?.cpuTemp, chartNowMs)

  const cpuTicks = generateTicks(range, chartData?.cpu, chartNowMs)
  const ramTicks = generateTicks(range, chartData?.ram, chartNowMs)
  const networkTicks = generateTicks(range, chartData?.network, chartNowMs)
  const tempTicks = generateTicks(range, chartData?.cpuTemp, chartNowMs)
  const tickFormatter = (ts: number) => formatTickLabel(ts, range)

  // Auth gate
  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background grid-overlay">
        <div className="fixed inset-0 scanline z-50 pointer-events-none" />
        <div className="flex flex-col items-center gap-4">
          <div className="border border-primary/30 p-3 bg-secondary">
            <Monitor className="h-6 w-6 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              Initializing
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push("/")
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-background grid-overlay">
      <div className="fixed inset-0 scanline z-50 pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-widest">Dashboard</span>
          </button>

          <div className="h-4 w-px bg-border" />

          {system && (
            <div className="flex items-center gap-3">
              <div className="p-1.5 border border-border bg-secondary">
                <Server className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-foreground tracking-wide">
                    {system.name}
                  </h1>
                  <StatusIndicator status={system.status} size="sm" label={system.status} />
                </div>
                <p className="text-[9px] text-muted-foreground tracking-wider uppercase">
                  {system.hostname}
                  {liveDevice?.osName ? ` // ${liveDevice!.osName}` : ""}
                  {" // "}Uptime: {system.uptime}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Live</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="h-4 w-px bg-border" />
          <DeleteDeviceDialog
            externalId={externalId}
            hostname={system?.hostname}
            onDeleted={() => router.push("/")}
          />
        </div>
      </header>

      {/* Time range selector */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 overflow-x-auto relative z-10">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest shrink-0">
          Range:
        </span>
        <div className="flex items-center gap-1">
          {DASHBOARD_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-1 text-[10px] uppercase tracking-wider transition-colors border",
                range === r
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {/* Loading */}
        {isLoading && !system && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="border border-primary/30 p-3 bg-secondary">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Loading device
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !system && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="border border-destructive/30 p-3 bg-secondary">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <span className="text-[10px] text-destructive-foreground uppercase tracking-widest">
              Failed to load device
            </span>
            <span className="text-[10px] text-muted-foreground max-w-xs text-center">
              {error.message}
            </span>
            <button
              onClick={() => router.push("/")}
              className="mt-2 px-3 py-1.5 border border-border text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* Device data */}
        {system && chartData && (
          <div className="p-4 space-y-4">
            {/* Quick stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                {
                  label: "CPU",
                  value: `${system.cpu.usage.toFixed(1)}%`,
                  icon: <Cpu className="h-3.5 w-3.5" />,
                  color: getUsageColor(system.cpu.usage),
                },
                {
                  label: "RAM",
                  value: `${system.ram.usage.toFixed(1)}%`,
                  sub: `${system.ram.used.toFixed(1)} / ${system.ram.total.toFixed(1)} GB`,
                  icon: <MemoryStick className="h-3.5 w-3.5" />,
                  color: getUsageColor(system.ram.usage),
                },
                {
                  label: "Disk",
                  value: `${system.disk.usage.toFixed(1)}%`,
                  sub: `${system.disk.used} / ${system.disk.total} GB`,
                  icon: <HardDrive className="h-3.5 w-3.5" />,
                  color: getUsageColor(system.disk.usage),
                },
                {
                  label: "Network",
                  value: `${(system.network.download + system.network.upload).toFixed(1)} MB/s`,
                  icon: <Network className="h-3.5 w-3.5" />,
                  color: "#3b82f6",
                },
                {
                  label: "CPU Temp",
                  value: `${system.temperature.current}°C`,
                  icon: <Thermometer className="h-3.5 w-3.5" />,
                  color: getTempColor(system.temperature.current),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative border border-border bg-card p-4 corner-marks"
                >
                  <div className="flex items-center gap-1.5 mb-2" style={{ color: stat.color }}>
                    {stat.icon}
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                    {stat.value}
                  </span>
                  {"sub" in stat && stat.sub && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* System Information */}
            <div className="border border-border bg-card p-4 corner-marks relative">
              <div className="flex items-center gap-1.5 mb-4">
                <Info className="h-3 w-3 text-primary" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  System Information
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  {
                    label: "Hostname",
                    value: liveDevice?.hostname || "N/A",
                    icon: <Server className="h-3 w-3" />,
                  },
                  {
                    label: "IP Address",
                    value: liveDevice?.ipAddress || "N/A",
                    icon: <Network className="h-3 w-3" />,
                  },
                  {
                    label: "OS",
                    value: liveDevice?.osName || liveDevice?.os || "N/A",
                    icon: <Terminal className="h-3 w-3" />,
                  },
                  {
                    label: "Kernel",
                    value: liveDevice?.kernel || "N/A",
                    icon: <Terminal className="h-3 w-3" />,
                  },
                  {
                    label: "CPU",
                    value: liveDevice?.cpuName || "N/A",
                    icon: <Microchip className="h-3 w-3" />,
                  },
                  {
                    label: "Uptime",
                    value: formatUptime(liveDevice?.summary?.uptimeSec),
                    icon: <Clock className="h-3 w-3" />,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      {item.icon}
                      <span className="text-[9px] uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-xs text-foreground font-medium truncate" title={item.value}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Secondary row: capacity info */}
              <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MemoryStick className="h-3 w-3" />
                    <span className="text-[9px] uppercase tracking-widest">Memory Capacity</span>
                  </div>
                  <span className="text-xs text-foreground font-medium tabular-nums">
                    {formatBytes(liveDevice?.memoryCapacity ?? 0)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <HardDrive className="h-3 w-3" />
                    <span className="text-[9px] uppercase tracking-widest">Disk Capacity</span>
                  </div>
                  <span className="text-xs text-foreground font-medium tabular-nums">
                    {formatBytes(liveDevice?.diskCapacity ?? 0)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    <span className="text-[9px] uppercase tracking-widest">Last Seen</span>
                  </div>
                  <span className="text-xs text-foreground font-medium">
                    {liveDevice?.lastSeenAt
                      ? new Date(liveDevice!.lastSeenAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Terminal className="h-3 w-3" />
                    <span className="text-[9px] uppercase tracking-widest">OS Type</span>
                  </div>
                  <span className="text-xs text-foreground font-medium">
                    {liveDevice?.os || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CPU Chart */}
              <ChartPanel title="CPU Usage" color="#4ade80" icon={<Cpu className="h-3 w-3" />}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData.cpu} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                    <XAxis dataKey="ts" type="number" scale="time" domain={cpuDomain} ticks={cpuTicks} tickFormatter={tickFormatter} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} allowDataOverflow />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(ts: number) => formatTickLabel(ts, range === "1m" || range === "5m" ? range : "5m")} formatter={(v: number) => [`${v.toFixed(1)}%`, "CPU"]} />
                    <Area type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={1.5} fill="url(#cpuDetailGrad)" dot={false} connectNulls={false} name="CPU" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* RAM Chart */}
              <ChartPanel title="Memory Usage" color="#22c55e" icon={<MemoryStick className="h-3 w-3" />}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-[#22c55e]">
                    {system.ram.used.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    / {system.ram.total.toFixed(1)} GB
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={chartData.ram} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ramDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                    <XAxis dataKey="ts" type="number" scale="time" domain={ramDomain} ticks={ramTicks} tickFormatter={tickFormatter} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} allowDataOverflow />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(ts: number) => formatTickLabel(ts, range === "1m" || range === "5m" ? range : "5m")} formatter={(v: number) => [`${v.toFixed(1)}%`, "RAM"]} />
                    <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={1.5} fill="url(#ramDetailGrad)" dot={false} connectNulls={false} name="RAM" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Network Chart */}
              <ChartPanel title="Network I/O" color="#3b82f6" icon={<Network className="h-3 w-3" />}>
                <div className="mb-2 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-[#4ade80]" />
                    <span className="text-[10px] text-[#4ade80] font-medium tabular-nums">
                      {system.network.download.toFixed(1)} MB/s
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-1">IN</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[#3b82f6]" />
                    <span className="text-[10px] text-[#3b82f6] font-medium tabular-nums">
                      {system.network.upload.toFixed(1)} MB/s
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-1">OUT</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={chartData.network} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dlDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ulDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                    <XAxis dataKey="ts" type="number" scale="time" domain={networkDomain} ticks={networkTicks} tickFormatter={tickFormatter} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} allowDataOverflow />
                    <YAxis tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(ts: number) => formatTickLabel(ts, range === "1m" || range === "5m" ? range : "5m")} formatter={(v: number, name: string) => [`${v.toFixed(2)} MB/s`, name === "download" ? "In" : "Out"]} />
                    <Area type="monotone" dataKey="download" stroke="#4ade80" strokeWidth={1.5} fill="url(#dlDetailGrad)" dot={false} connectNulls={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="upload" stroke="#3b82f6" strokeWidth={1.5} fill="url(#ulDetailGrad)" dot={false} connectNulls={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Temperature Chart */}
              <ChartPanel
                title="CPU Temperature"
                color={getTempColor(system.temperature.current)}
                icon={<Thermometer className="h-3 w-3" />}
              >
                <div className="mb-2 flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: getTempColor(system.temperature.current) }}
                  >
                    {system.temperature.current}°C
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={chartData.cpuTemp} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tempDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={getTempColor(system.temperature.current)} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={getTempColor(system.temperature.current)} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                    <XAxis dataKey="ts" type="number" scale="time" domain={tempDomain} ticks={tempTicks} tickFormatter={tickFormatter} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} allowDataOverflow />
                    <YAxis domain={[20, 100]} tick={{ fontSize: 9, fill: "#6b7a5e" }} axisLine={{ stroke: "#1e2a1c" }} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(ts: number) => formatTickLabel(ts, range === "1m" || range === "5m" ? range : "5m")} formatter={(v: number) => [`${v.toFixed(1)}°C`, "Temp"]} />
                    <Area type="monotone" dataKey="value" stroke={getTempColor(system.temperature.current)} strokeWidth={1.5} fill="url(#tempDetailGrad)" dot={false} connectNulls={false} name="Temp" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Disk Usage - full width */}
              <div className="lg:col-span-2 border border-border bg-card p-4 corner-marks relative">
                <div className="flex items-center gap-1.5 mb-4">
                  <HardDrive className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Disk Usage
                  </span>
                </div>
                <div className="flex items-center gap-8">
                  {/* Disk ring */}
                  <div className="relative h-28 w-28 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#1e2a1c" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke={getUsageColor(system.disk.usage)}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${system.disk.usage * 2.51} 251`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold tabular-nums text-foreground">
                        {system.disk.usage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Used", value: `${system.disk.used} GB` },
                        { label: "Total", value: `${system.disk.total} GB` },
                        { label: "Free", value: `${(system.disk.total - system.disk.used).toFixed(1)} GB` },
                      ].map((item) => (
                        <div key={item.label}>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-widest block">
                            {item.label}
                          </span>
                          <span className="text-sm text-foreground tabular-nums font-medium">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <MetricBar label="" value={system.disk.usage} icon={null} />
                  </div>
                </div>
              </div>

              {/* Docker Containers - full width */}
              <div className="lg:col-span-2 border border-border bg-card p-4 corner-marks relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <Container className="h-3 w-3 text-[#2496ED]" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Docker Containers
                    </span>
                  </div>
                  {liveDevice?.containers && liveDevice!.containers.length > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {liveDevice!.containers.length} container{liveDevice!.containers.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {liveDevice?.containers && liveDevice!.containers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          {["Name", "Image", "Status", "CPU", "RAM", "Net RX", "Net TX"].map((h) => (
                            <th
                              key={h}
                              className="text-[9px] uppercase tracking-widest text-muted-foreground font-normal pb-2 pr-4"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liveDevice!.containers.map((c) => (
                          <tr key={c.name} className="border-b border-border/50 last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="text-xs text-foreground font-medium">{c.name}</span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px] block">
                                {c.image}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium",
                                  c.health === "healthy" || c.health === "running"
                                    ? "text-[#4ade80]"
                                    : c.health === "unhealthy"
                                      ? "text-[#ef4444]"
                                      : c.health === "exited"
                                        ? "text-muted-foreground"
                                        : "text-[#f59e0b]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    c.health === "healthy" || c.health === "running"
                                      ? "bg-[#4ade80]"
                                      : c.health === "unhealthy"
                                        ? "bg-[#ef4444]"
                                        : c.health === "exited"
                                          ? "bg-muted-foreground"
                                          : "bg-[#f59e0b]"
                                  )}
                                />
                                {c.health}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className="text-xs tabular-nums font-medium"
                                style={{ color: getUsageColor(c.cpuPercent ?? 0) }}
                              >
                                {(c.cpuPercent ?? 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs tabular-nums text-foreground">
                                {formatContainerBytes(c.ramUsageBytes ?? 0)}
                              </span>
                              <span className="text-[9px] text-muted-foreground ml-1">
                                / {formatContainerBytes(c.ramLimitBytes ?? 0)}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs tabular-nums text-foreground">
                                {formatContainerBytes(c.netRxBytes ?? 0)}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs tabular-nums text-foreground">
                                {formatContainerBytes(c.netTxBytes ?? 0)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Container className="h-8 w-8 mb-3 opacity-30" />
                    <span className="text-xs">No containers detected</span>
                    <span className="text-[10px] mt-1 opacity-60">
                      Docker may not be running on this device
                    </span>
                  </div>
                )}
              </div>

              {/* Cloudflare Tunnels - full width */}
              <div className="lg:col-span-2 border border-border bg-card p-4 corner-marks relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="h-3 w-3 text-[#F6821F]" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Cloudflare Tunnels
                    </span>
                  </div>
                  {liveDevice?.tunnels && liveDevice!.tunnels.length > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {liveDevice!.tunnels.length} tunnel{liveDevice!.tunnels.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {liveDevice?.tunnels && liveDevice!.tunnels.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          {["Name", "Status", "HA Connections", "Requests", "Errors"].map((h) => (
                            <th
                              key={h}
                              className="text-[9px] uppercase tracking-widest text-muted-foreground font-normal pb-2 pr-4"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liveDevice!.tunnels.map((t) => (
                          <tr key={t.tunnelId} className="border-b border-border/50 last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="text-xs text-foreground font-medium">{t.tunnelName}</span>
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium",
                                  t.status === "healthy"
                                    ? "text-[#4ade80]"
                                    : t.status === "degraded"
                                      ? "text-[#f59e0b]"
                                      : "text-[#ef4444]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    t.status === "healthy"
                                      ? "bg-[#4ade80]"
                                      : t.status === "degraded"
                                        ? "bg-[#f59e0b]"
                                        : "bg-[#ef4444]"
                                  )}
                                />
                                {t.status}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs tabular-nums text-foreground">
                                {t.haConnections ?? 0}
                              </span>
                              <span className="text-[9px] text-muted-foreground ml-1">/ 4</span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs tabular-nums text-foreground">
                                {(t.totalRequests ?? 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className={cn(
                                "text-xs tabular-nums",
                                (t.requestErrors ?? 0) > 0 ? "text-[#ef4444]" : "text-foreground"
                              )}>
                                {(t.requestErrors ?? 0).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Cloud className="h-8 w-8 mb-3 opacity-30" />
                    <span className="text-xs">No Cloudflare tunnels detected</span>
                    <span className="text-[10px] mt-1 opacity-60">
                      cloudflared may not be running on this device
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card/50 relative z-10">
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Device: {externalId}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Range: {RANGE_LABELS[range]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {error && (
            <span className="text-[9px] text-destructive-foreground uppercase tracking-widest flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Fetch error
            </span>
          )}
          <span className={cn(
            "text-[9px] uppercase tracking-widest flex items-center gap-1",
            error ? "text-destructive-foreground" : "text-primary"
          )}>
            <span className={cn(
              "h-1 w-1 rounded-full animate-pulse",
              error ? "bg-destructive" : "bg-primary"
            )} />
            {error ? "Degraded" : "Connected"}
          </span>
        </div>
      </footer>
    </div>
  )
}

function ChartPanel({
  title,
  color,
  icon,
  children,
}: {
  title: string
  color: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative border border-border bg-card p-4 corner-marks">
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
