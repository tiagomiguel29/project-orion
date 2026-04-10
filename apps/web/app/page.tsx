"use client"

import { useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { SystemCard } from "@/components/system-card"
import type { SystemData } from "@/components/system-card"
import { OverviewPanel } from "@/components/overview-panel"
import { LoginPage } from "@/components/login-page"
import { useAuth } from "@/components/auth-provider"
import { useSocket } from "@/components/socket-provider"
import { fetchDashboard } from "@/lib/dashboard-service"
import type { DashboardTotals } from "@/lib/dashboard-service"
import { mapDevicesToSystems } from "@/lib/device-mapper"
import { useRealtimeDashboard } from "@/hooks/use-realtime-dashboard"
import { AddDeviceDialog } from "@/components/add-device-dialog"
import { cn } from "@/lib/utils"
import { X, LayoutGrid, List, Monitor, AlertTriangle } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, authState, user, token, logout } = useAuth()

  const { connected } = useSocket()

  const [selectedSystemExternalId, setSelectedSystemExternalId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // ── SWR for initial load only (no polling) ────────────────────
  const { data, error, isLoading: isLoadingDashboard, mutate } = useSWR(
    isAuthenticated && token ? ["dashboard", token] : null,
    ([, t]) => fetchDashboard(t),
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  )

  // ── WebSocket keeps data live after initial load ──────────────
  const { devices: liveDevices, totals: liveTotals } = useRealtimeDashboard(data)

  const systems: SystemData[] = liveDevices.length > 0 ? mapDevicesToSystems(liveDevices) : (data ? mapDevicesToSystems(data.devices) : [])
  const totals: DashboardTotals | null = liveTotals ?? data?.totals ?? null
  const selectedSystem =
    selectedSystemExternalId
      ? systems.find((system) => system.externalId === selectedSystemExternalId) ?? null
      : null

  const filteredSystems = systems.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Auth gates ──────────────────────────────────────────────────

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

  if (authState === "setup") {
    return <LoginPage mode="setup" />
  }

  if (!isAuthenticated) {
    return <LoginPage mode="login" />
  }

  // ── Dashboard ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background grid-overlay">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline z-50 pointer-events-none" />

      <DashboardHeader
        systems={systems}
        totals={totals}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        name={user?.name}
        email={user?.email}
        role={user?.role}
        onLogout={logout}
        onProfileClick={() => router.push("/profile")}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* System list */}
        <div
          className={cn(
            "flex flex-col border-r border-border transition-all duration-300",
            selectedSystem ? "w-80 lg:w-96" : "w-full"
          )}
        >
          {/* List header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Systems
              </span>
              <span className="text-[9px] text-primary tabular-nums">
                [{filteredSystems.length}]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AddDeviceDialog onDeviceCreated={() => mutate()} />
              {!selectedSystem && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1 transition-colors",
                      viewMode === "grid" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1 transition-colors",
                      viewMode === "list" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Loading state */}
            {isLoadingDashboard && systems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="border border-primary/30 p-3 bg-secondary">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Loading systems
                  </span>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && systems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="border border-destructive/30 p-3 bg-secondary">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <span className="text-[10px] text-destructive-foreground uppercase tracking-widest">
                  Failed to load
                </span>
                <span className="text-[10px] text-muted-foreground max-w-xs text-center">
                  {error.message}
                </span>
              </div>
            )}

            {/* No devices */}
            {!isLoadingDashboard && !error && systems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="border border-border p-3 bg-secondary">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  No devices registered
                </span>
              </div>
            )}

            {/* Devices */}
            {systems.length > 0 && (
              <>
                {selectedSystem ? (
                  <div className="space-y-1">
                    {filteredSystems.map((system) => (
                      <SystemCard
                        key={system.id}
                        system={system}
                        isSelected={selectedSystemExternalId === system.externalId}
                        onClick={() => setSelectedSystemExternalId(system.externalId)}
                      />
                    ))}
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filteredSystems.map((system) => (
                      <SystemCard
                        key={system.id}
                        system={system}
                        onClick={() => setSelectedSystemExternalId(system.externalId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredSystems.map((system) => (
                      <SystemCard
                        key={system.id}
                        system={system}
                        onClick={() => setSelectedSystemExternalId(system.externalId)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {selectedSystem && (
          <div className="flex-1 flex flex-col bg-card/30 overflow-hidden">
            <div className="absolute top-[105px] right-4 z-10">
              <button
                onClick={() => setSelectedSystemExternalId(null)}
                className="p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close detail panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <OverviewPanel system={selectedSystem} />
          </div>
        )}
      </div>

      {/* Footer bar */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card/50">
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Stream: Real-time
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Protocol: WebSocket
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
            connected ? "text-primary" : "text-destructive-foreground"
          )}>
            <span className={cn(
              "h-1 w-1 rounded-full",
              connected ? "bg-primary animate-pulse" : "bg-destructive"
            )} />
            {connected ? "Online" : "Offline"}
          </span>
        </div>
      </footer>
    </div>
  )
}
