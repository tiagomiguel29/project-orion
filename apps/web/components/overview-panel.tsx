"use client"

import { cn } from "@/lib/utils"
import type { SystemData } from "./system-card"
import { Sparkline } from "./sparkline"
import { MetricBar } from "./metric-bar"
import { StatusIndicator } from "./status-indicator"
import Link from "next/link"
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
  ExternalLink,
} from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface OverviewPanelProps {
  system: SystemData
}

export function OverviewPanel({ system }: OverviewPanelProps) {
  const getTempColor = (temp: number) => {
    if (temp >= 85) return "#ef4444"
    if (temp >= 70) return "#f59e0b"
    return "#4ade80"
  }

  const cpuChartData = system.cpu.history.map((v, i) => ({
    time: `${i}m`,
    cpu: v,
  }))

  const ramChartData = system.ram.history.map((v, i) => ({
    time: `${i}m`,
    ram: v,
  }))

  const networkChartData = system.network.downloadHistory.map((v, i) => ({
    time: `${i}m`,
    download: v,
    upload: system.network.uploadHistory[i] || 0,
  }))

  const tempChartData = system.temperature.history.map((v, i) => ({
    time: `${i}m`,
    temp: v,
  }))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative p-2 border border-border bg-secondary">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground tracking-wide">
                {system.name}
              </h2>
              <StatusIndicator status={system.status} size="sm" label={system.status} />
            </div>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
              {system.hostname} // Uptime: {system.uptime}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/device/${encodeURIComponent(system.externalId)}`}
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors border border-border px-2 py-1 hover:border-primary/30"
          >
            <ExternalLink className="h-3 w-3" />
            Full View
          </Link>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-widest">Live</span>
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#4ade80] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-5 border-b border-border">
        {[
          {
            label: "CPU",
            value: `${system.cpu.usage.toFixed(1)}%`,
            icon: <Cpu className="h-3 w-3" />,
            color: system.cpu.usage >= 90 ? "#ef4444" : system.cpu.usage >= 70 ? "#f59e0b" : "#4ade80",
          },
          {
            label: "RAM",
            value: `${system.ram.usage.toFixed(1)}%`,
            icon: <MemoryStick className="h-3 w-3" />,
            color: system.ram.usage >= 90 ? "#ef4444" : system.ram.usage >= 70 ? "#f59e0b" : "#4ade80",
          },
          {
            label: "Disk",
            value: `${system.disk.usage.toFixed(1)}%`,
            icon: <HardDrive className="h-3 w-3" />,
            color: system.disk.usage >= 90 ? "#ef4444" : system.disk.usage >= 70 ? "#f59e0b" : "#4ade80",
          },
          {
            label: "Net",
            value: `${(system.network.download + system.network.upload).toFixed(1)}`,
            icon: <Network className="h-3 w-3" />,
            color: "#3b82f6",
            unit: "MB/s",
          },
          {
            label: "Temp",
            value: `${system.temperature.current}°`,
            icon: <Thermometer className="h-3 w-3" />,
            color: getTempColor(system.temperature.current),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center justify-center py-3 border-r border-border last:border-r-0"
          >
            <div className="flex items-center gap-1 mb-0.5" style={{ color: stat.color }}>
              {stat.icon}
            </div>
            <span
              className="text-base font-bold tabular-nums"
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CPU Chart */}
          <ChartPanel title="CPU Usage" color="#4ade80" icon={<Cpu className="h-3 w-3" />}>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={cpuChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e120e",
                    border: "1px solid #1e2a1c",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#c8d0c0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#4ade80"
                  strokeWidth={1.5}
                  fill="url(#cpuGrad)"
                  dot={false}
                />
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
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={ramChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e120e",
                    border: "1px solid #1e2a1c",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#c8d0c0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ram"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  fill="url(#ramGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Network Chart */}
          <ChartPanel title="Network I/O" color="#3b82f6" icon={<Network className="h-3 w-3" />}>
            <div className="mb-2 flex items-center gap-4">
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-[#3b82f6]" />
                <span className="text-[10px] text-[#3b82f6] font-medium tabular-nums">
                  {system.network.upload.toFixed(1)} MB/s
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3 text-[#4ade80]" />
                <span className="text-[10px] text-[#4ade80] font-medium tabular-nums">
                  {system.network.download.toFixed(1)} MB/s
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={networkChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e120e",
                    border: "1px solid #1e2a1c",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#c8d0c0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="download"
                  stroke="#4ade80"
                  strokeWidth={1.5}
                  fill="url(#dlGrad)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="upload"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fill="url(#ulGrad)"
                  dot={false}
                />
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
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={tempChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={getTempColor(system.temperature.current)} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={getTempColor(system.temperature.current)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1c" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[20, 100]}
                  tick={{ fontSize: 9, fill: "#6b7a5e" }}
                  axisLine={{ stroke: "#1e2a1c" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e120e",
                    border: "1px solid #1e2a1c",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#c8d0c0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke={getTempColor(system.temperature.current)}
                  strokeWidth={1.5}
                  fill="url(#tempGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Disk Usage */}
          <div className="lg:col-span-2 border border-border bg-card p-4 corner-marks relative">
            <div className="flex items-center gap-1.5 mb-3">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Disk Usage
              </span>
            </div>
            <div className="flex items-center gap-6">
              {/* Disk visual */}
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#1e2a1c"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={system.disk.usage >= 90 ? "#ef4444" : system.disk.usage >= 70 ? "#f59e0b" : "#4ade80"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${system.disk.usage * 2.51} 251`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {system.disk.usage.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-widest">Used</span>
                  <span className="text-foreground tabular-nums font-medium">{system.disk.used} GB</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-widest">Total</span>
                  <span className="text-foreground tabular-nums font-medium">{system.disk.total} GB</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-widest">Free</span>
                  <span className="text-foreground tabular-nums font-medium">{system.disk.total - system.disk.used} GB</span>
                </div>
                <MetricBar
                  label=""
                  value={system.disk.usage}
                  icon={null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
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
