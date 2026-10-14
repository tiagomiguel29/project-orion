"use client"

import { useEffect, useRef, useState } from "react"
import { fetchDashboard } from "@/lib/dashboard-service"
import { useAuth } from "@/components/auth-provider"
import { useSocket } from "@/components/socket-provider"
import type {
  DashboardPayload,
  DashboardTotals,
  DeviceCard,
  DeviceStatus,
} from "@/lib/dashboard-service"

interface DeviceStatusEvent {
  deviceId: string
  status: DeviceStatus
  lastSeenAt: string | null
}

function recomputeTotals(devices: DeviceCard[]): DashboardTotals {
  let online = 0
  let offline = 0
  let warning = 0
  for (const d of devices) {
    if (d.status === "online") online++
    else if (d.status === "offline") offline++

    // Warning conditions match backend logic
    if (
      d.summary.cpuPct >= 85 ||
      d.summary.ramPct >= 85 ||
      d.summary.disk.usedPct >= 90 ||
      (d.summary.cpuTempC ?? 0) >= 80
    ) {
      warning++
    }
  }
  return { total: devices.length, online, offline, warning }
}

/**
 * Takes the initial REST payload and keeps it up-to-date via WebSocket events.
 * Returns the live dashboard state.
 */
export function useRealtimeDashboard(initial: DashboardPayload | undefined) {
  const { socket } = useSocket()
  const { token } = useAuth()
  const [devices, setDevices] = useState<DeviceCard[]>([])
  const [totals, setTotals] = useState<DashboardTotals | null>(null)

  // Sync from REST initial load (SWR)
  const initialRef = useRef(initial)
  useEffect(() => {
    if (initial && initial !== initialRef.current) {
      initialRef.current = initial
      setDevices(initial.devices)
      setTotals(initial.totals)
    } else if (initial && devices.length === 0) {
      setDevices(initial.devices)
      setTotals(initial.totals)
    }
  }, [initial])

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !token) return
    let active = true
    async function recover() {
      try {
        const payload = await fetchDashboard(token!)
        if (active) { setDevices(payload.devices); setTotals(payload.totals) }
      } catch { /* initial-load failures are handled by SWR */ }
    }
    socket.on("connect", recover)
    socket.on("stream.recovered", recover)


    function handleDashboardUpdate(updatedCard: DeviceCard) {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.externalId === updatedCard.externalId)
        let next: DeviceCard[]
        if (idx >= 0) {
          if (updatedCard.lastSeenAt && prev[idx].lastSeenAt && updatedCard.lastSeenAt < prev[idx].lastSeenAt!) return prev
          next = [...prev]
          next[idx] = updatedCard
        } else {
          // New device appeared
          next = [...prev, updatedCard]
        }
        setTotals(recomputeTotals(next))
        return next
      })
    }

    function handleDeviceStatus(event: DeviceStatusEvent) {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.externalId === event.deviceId)
        if (idx < 0) return prev
        if (event.lastSeenAt && prev[idx].lastSeenAt && event.lastSeenAt < prev[idx].lastSeenAt!) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          status: event.status,
          lastSeenAt: event.lastSeenAt ?? next[idx].lastSeenAt,
        }
        setTotals(recomputeTotals(next))
        return next
      })
    }

    socket.on("dashboard.update", handleDashboardUpdate)
    socket.on("device.status", handleDeviceStatus)

    return () => {
      active = false
      socket.off("connect", recover)
      socket.off("stream.recovered", recover)
      socket.off("dashboard.update", handleDashboardUpdate)
      socket.off("device.status", handleDeviceStatus)
    }
  }, [socket, token])

  return { devices, totals }
}
