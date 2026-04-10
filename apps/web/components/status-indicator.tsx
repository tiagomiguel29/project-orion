"use client"

import { cn } from "@/lib/utils"

interface StatusIndicatorProps {
  status: "online" | "offline" | "warning"
  size?: "sm" | "md" | "lg"
  label?: string
}

export function StatusIndicator({ status, size = "md", label }: StatusIndicatorProps) {
  const sizeMap = {
    sm: { dot: "h-2 w-2", ping: "h-2 w-2", wrapper: "h-5 w-5" },
    md: { dot: "h-3 w-3", ping: "h-3 w-3", wrapper: "h-7 w-7" },
    lg: { dot: "h-4 w-4", ping: "h-4 w-4", wrapper: "h-9 w-9" },
  }

  const colorMap = {
    online: {
      dot: "bg-[#4ade80]",
      ping: "bg-[#4ade80]",
      glow: "glow-green",
    },
    offline: {
      dot: "bg-[#ef4444]",
      ping: "bg-[#ef4444]",
      glow: "glow-red",
    },
    warning: {
      dot: "bg-[#f59e0b]",
      ping: "bg-[#f59e0b]",
      glow: "",
    },
  }

  const { dot, ping, wrapper } = sizeMap[size]
  const colors = colorMap[status]

  return (
    <div className="flex items-center gap-2">
      <div className={cn("relative flex items-center justify-center", wrapper)}>
        {status === "online" && (
          <span
            className={cn(
              "absolute rounded-full opacity-75 animate-ping-slow",
              ping,
              colors.ping
            )}
          />
        )}
        {status === "offline" && (
          <span
            className={cn(
              "absolute rounded-full opacity-75 animate-ping-slow",
              ping,
              colors.ping
            )}
          />
        )}
        <span className={cn("relative rounded-full", dot, colors.dot)} />
      </div>
      {label && (
        <span className={cn(
          "text-xs font-medium uppercase tracking-wider",
          status === "online" && "text-[#4ade80]",
          status === "offline" && "text-[#ef4444]",
          status === "warning" && "text-[#f59e0b]"
        )}>
          {label}
        </span>
      )}
    </div>
  )
}
