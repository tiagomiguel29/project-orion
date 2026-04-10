"use client"

import { useEffect, useRef, useState } from "react"
import { useSocket } from "@/components/socket-provider"
import type { DeviceCard, DeviceStatus } from "@/lib/dashboard-service"

interface DeviceStatusEvent {
  deviceId: string
  status: DeviceStatus
  lastSeenAt: string | null
}

/**
 * Subscribes to a specific device's WS room and merges live updates
 * from `dashboard.update` events into the device data.
 * Falls back to the REST-fetched initial data.
 */
export function useRealtimeDevice(
  externalId: string,
  initial: DeviceCard | undefined
) {
  const { socket } = useSocket()
  const [device, setDevice] = useState<DeviceCard | undefined>(initial)
  const subscribedRef = useRef<string | null>(null)

  // Sync from REST initial load
  useEffect(() => {
    if (initial) {
      setDevice(initial)
    }
  }, [initial])

  // Subscribe to device room + listen for updates
  useEffect(() => {
    if (!socket) return

    // Subscribe to device-specific room (for telemetry events)
    if (subscribedRef.current !== externalId) {
      socket.emit("subscribeDevice", { deviceId: externalId })
      subscribedRef.current = externalId
    }

    function handleDashboardUpdate(updatedCard: DeviceCard) {
      if (updatedCard.externalId === externalId) {
        // Merge live summary + status but keep sparklines from REST
        // (WS card uses '15m' dashboard sparklines, not the page's selected range)
        setDevice((prev) => {
          if (!prev) return updatedCard
          return {
            ...prev,
            status: updatedCard.status,
            lastSeenAt: updatedCard.lastSeenAt,
            summary: updatedCard.summary,
            containers: updatedCard.containers,
            tunnels: updatedCard.tunnels,
            // Keep prev.sparklines — they match the user's selected range
          }
        })
      }
    }

    function handleDeviceStatus(event: DeviceStatusEvent) {
      if (event.deviceId === externalId) {
        setDevice((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            status: event.status,
            lastSeenAt: event.lastSeenAt ?? prev.lastSeenAt,
          }
        })
      }
    }

    socket.on("dashboard.update", handleDashboardUpdate)
    socket.on("device.status", handleDeviceStatus)

    return () => {
      socket.off("dashboard.update", handleDashboardUpdate)
      socket.off("device.status", handleDeviceStatus)
    }
  }, [socket, externalId])

  return device
}
