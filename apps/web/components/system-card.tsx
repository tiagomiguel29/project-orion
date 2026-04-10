"use client"

import { cn } from "@/lib/utils"
import { StatusIndicator } from "./status-indicator"
import { MetricBar } from "./metric-bar"
import { Sparkline } from "./sparkline"
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"

export interface SystemData {
  id: string
  externalId: string
  name: string
  hostname: string
  status: "online" | "offline" | "warning"
  uptime: string
  cpu: {
    usage: number
    history: number[]
  }
  ram: {
    usage: number
    used: number
    total: number
    history: number[]
  }
  disk: {
    usage: number
    used: number
    total: number
  }
  network: {
    upload: number
    download: number
    uploadHistory: number[]
    downloadHistory: number[]
  }
  temperature: {
    current: number
    history: number[]
  }
}

interface SystemCardProps {
  system: SystemData
  isSelected?: boolean
  onClick?: () => void
}

export function SystemCard({ system, isSelected, onClick }: SystemCardProps) {
  const getTempColor = (temp: number) => {
    if (temp >= 85) return "#ef4444"
    if (temp >= 70) return "#f59e0b"
    return "#4ade80"
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full text-left border border-border bg-card p-4 transition-all duration-200 corner-marks",
        "hover:border-primary/30 hover:bg-accent/50",
        isSelected && "border-primary/50 bg-accent/80 glow-green",
        system.status === "offline" && "opacity-70"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIndicator status={system.status} size="md" />
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-wide">
              {system.name}
            </h3>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
              {system.hostname}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Uptime
          </span>
          <span className="text-xs text-foreground tabular-nums">{system.uptime}</span>
        </div>
      </div>

      {/* CPU + Sparkline */}
      <div className="mb-3">
        <MetricBar
          label="CPU"
          value={system.cpu.usage}
          icon={<Cpu className="h-3 w-3" />}
        />
        <div className="mt-1">
          <Sparkline
            data={system.cpu.history}
            color={system.cpu.usage >= 90 ? "#ef4444" : system.cpu.usage >= 70 ? "#f59e0b" : "#4ade80"}
            height={24}
          />
        </div>
      </div>

      {/* RAM */}
      <div className="mb-3">
        <MetricBar
          label="RAM"
          value={system.ram.usage}
          icon={<MemoryStick className="h-3 w-3" />}
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {system.ram.used.toFixed(1)} / {system.ram.total.toFixed(1)} GB
          </span>
        </div>
      </div>

      {/* Disk */}
      <div className="mb-3">
        <MetricBar
          label="Disk"
          value={system.disk.usage}
          icon={<HardDrive className="h-3 w-3" />}
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {system.disk.used} / {system.disk.total} GB
          </span>
        </div>
      </div>

      {/* Network */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Network className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Network
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-[#3b82f6]" />
            <span className="text-[10px] text-[#3b82f6] tabular-nums font-medium">
              {system.network.upload.toFixed(1)} MB/s
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDownRight className="h-3 w-3 text-[#4ade80]" />
            <span className="text-[10px] text-[#4ade80] tabular-nums font-medium">
              {system.network.download.toFixed(1)} MB/s
            </span>
          </div>
        </div>
        <div className="mt-1">
          <Sparkline
            data={system.network.downloadHistory}
            color="#4ade80"
            height={20}
          />
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Thermometer className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              CPU Temp
            </span>
          </div>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: getTempColor(system.temperature.current) }}
          >
            {system.temperature.current}°C
          </span>
        </div>
        <div className="mt-1">
          <Sparkline
            data={system.temperature.history}
            color={getTempColor(system.temperature.current)}
            height={20}
          />
        </div>
      </div>

      {/* Dashed border accent */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </button>
  )
}
