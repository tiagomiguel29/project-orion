"use client"

import { useState, useEffect } from "react"
import { Search, Monitor, Wifi, WifiOff, AlertTriangle, LogOut, User } from "lucide-react"
import type { SystemData } from "./system-card"
import type { DashboardTotals } from "@/lib/dashboard-service"

interface DashboardHeaderProps {
  systems: SystemData[]
  totals?: DashboardTotals | null
  searchQuery: string
  onSearchChange: (query: string) => void
  name?: string
  email?: string
  role?: string
  onLogout?: () => void
  onProfileClick?: () => void
}

export function DashboardHeader({ systems, totals, searchQuery, onSearchChange, name, email, role, onLogout, onProfileClick }: DashboardHeaderProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Use API totals when available, otherwise compute from local data
  const onlineCount = totals?.online ?? systems.filter((s) => s.status === "online").length
  const offlineCount = totals?.offline ?? systems.filter((s) => s.status === "offline").length
  const warningCount = totals?.warning ?? systems.filter((s) => s.status === "warning").length
  const totalCount = totals?.total ?? systems.length

  return (
    <header className="border-b border-border bg-card/50">
      {/* Top bar with grid coordinates */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-border/50">
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground tracking-widest">
          <span>A</span>
          <span className="text-border">|</span>
          <span>B</span>
          <span className="text-border">|</span>
          <span>C</span>
          <span className="text-border">|</span>
          <span>D</span>
          <span className="text-border">|</span>
          <span>E</span>
          <span className="text-border">|</span>
          <span>F</span>
        </div>
        <span className="text-[9px] text-muted-foreground tabular-nums tracking-widest">
          {time.toISOString().replace("T", " // ").split(".")[0]} UTC
        </span>
      </div>

      {/* Main header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="border border-primary/30 p-1.5 bg-secondary">
              <Monitor className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-foreground">
                [SCOPE]
              </h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">
                Infrastructure Monitor
              </p>
            </div>
          </div>

          {/* Status summary */}
          <div className="hidden md:flex items-center gap-3 ml-6 pl-6 border-l border-border">
            <div className="flex items-center gap-1.5">
              <Wifi className="h-3 w-3 text-[#4ade80]" />
              <span className="text-xs text-[#4ade80] tabular-nums font-medium">{onlineCount}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Online</span>
            </div>
            {offlineCount > 0 && (
              <div className="flex items-center gap-1.5">
                <WifiOff className="h-3 w-3 text-[#ef4444]" />
                <span className="text-xs text-[#ef4444] tabular-nums font-medium">{offlineCount}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Offline</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-[#f59e0b]" />
                <span className="text-xs text-[#f59e0b] tabular-nums font-medium">{warningCount}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Warning</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pl-3 border-l border-border">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</span>
              <span className="text-xs text-foreground tabular-nums font-medium">{totalCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="search systems..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-48 bg-secondary border border-border pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-0 transition-colors"
            />
          </div>

          {/* User info & logout */}
          {(name || email) && (
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                aria-label="Open profile"
              >
                <User className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground hover:text-primary transition-colors">{name || email}</span>
                {role && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider border border-border px-1.5 py-0.5 bg-secondary">
                    {role}
                  </span>
                )}
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 h-7 px-2.5 border border-border bg-secondary text-muted-foreground hover:text-destructive-foreground hover:border-destructive/30 hover:bg-destructive/5 transition-colors"
                  aria-label="Disconnect"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="text-[9px] uppercase tracking-widest hidden sm:inline">
                    Disconnect
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
