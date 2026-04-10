"use client"

import { useEffect, useRef, useState } from "react"
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
  }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket listeners
  useEffect(() => {
    if (!socket) return

    function handleDashboardUpdate(updatedCard: DeviceCard) {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.externalId === updatedCard.externalId)
        let next: DeviceCard[]
        if (idx >= 0) {
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
      socket.off("dashboard.update", handleDashboardUpdate)
      socket.off("device.status", handleDeviceStatus)
    }
  }, [socket])

  return { devices, totals }
}
