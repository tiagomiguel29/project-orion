"use client"

import { cn } from "@/lib/utils"

interface MetricBarProps {
  label: string
  value: number
  max?: number
  unit?: string
  icon?: React.ReactNode
  thresholds?: { warning: number; critical: number }
}

export function MetricBar({
  label,
  value,
  max = 100,
  unit = "%",
  icon,
  thresholds = { warning: 70, critical: 90 },
}: MetricBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const getColor = () => {
    if (value >= thresholds.critical) return { bar: "bg-[#ef4444]", text: "text-[#ef4444]" }
    if (value >= thresholds.warning) return { bar: "bg-[#f59e0b]", text: "text-[#f59e0b]" }
    return { bar: "bg-[#4ade80]", text: "text-[#4ade80]" }
  }

  const colors = getColor()

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        </div>
        <span className={cn("text-xs font-bold tabular-nums", colors.text)}>
          {value.toFixed(1)}
          <span className="text-muted-foreground font-normal">{unit}</span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", colors.bar)}
          style={{ width: `${percentage}%` }}
        />
        {/* Threshold markers */}
        <div
          className="absolute top-0 h-full w-px bg-muted-foreground/30"
          style={{ left: `${thresholds.warning}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-muted-foreground/30"
          style={{ left: `${thresholds.critical}%` }}
        />
      </div>
    </div>
  )
}
