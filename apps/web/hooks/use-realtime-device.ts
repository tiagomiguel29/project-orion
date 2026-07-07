"use client"

import { useEffect, useRef, useState } from "react"
import { useSocket } from "@/components/socket-provider"
import { getRangeDurationMs } from "@/lib/device-mapper"
import type {
  DashboardRange,
  DeviceCard,
  DeviceStatus,
} from "@/lib/dashboard-service"

interface DeviceStatusEvent {
  deviceId: string
  status: DeviceStatus
  lastSeenAt: string | null
}

interface TelemetryMetric {
  name: string
  value: number
}

interface TelemetryEvent {
  deviceId: string
  metrics?: TelemetryMetric[]
}

// Raw agent metric name → sparkline key used by the detail charts.
const SPARKLINE_KEY_BY_METRIC: Record<string, string> = {
  "cpu.percent": "cpuPct",
  "mem.percent": "ramPct",
  "net.rx_bytes_per_sec": "netIn",
  "net.tx_bytes_per_sec": "netOut",
}
const TEMP_METRIC = "sensor.temperature_celsius"

// Safety cap so a long-lived "all" session can't grow points unbounded.
const MAX_POINTS = 3000

/**
 * Subscribes to a device's WS room and keeps its data live:
 *  - `dashboard.update` refreshes the scalar summary / status,
 *  - `device.status` refreshes online/offline,
 *  - `telemetry` (raw per-batch metrics) is appended to the time-series
 *    sparklines and trimmed to the selected range, so the charts advance in
 *    real time instead of freezing at the initial REST fetch.
 */
export function useRealtimeDevice(
  externalId: string,
  initial: DeviceCard | undefined,
  range: DashboardRange
) {
  const { socket } = useSocket()
  const [device, setDevice] = useState<DeviceCard | undefined>(initial)
  const subscribedRef = useRef<string | null>(null)

  // Keep the current window length in a ref so the telemetry handler always
  // trims to the latest selected range without re-subscribing.
  const windowMsRef = useRef(getRangeDurationMs(range))
  useEffect(() => {
    windowMsRef.current = getRangeDurationMs(range)
  }, [range])

  // Sync from REST initial load (also resets on range change → new fetch).
  useEffect(() => {
    if (initial) {
      setDevice(initial)
    }
  }, [initial])

  useEffect(() => {
    if (!socket) return

    if (subscribedRef.current !== externalId) {
      socket.emit("subscribeDevice", { deviceId: externalId })
      subscribedRef.current = externalId
    }

    function handleDashboardUpdate(updatedCard: DeviceCard) {
      if (updatedCard.externalId !== externalId) return
      // Live summary/status only; sparklines are advanced by `telemetry`.
      setDevice((prev) =>
        prev
          ? {
              ...prev,
              status: updatedCard.status,
              lastSeenAt: updatedCard.lastSeenAt,
              summary: updatedCard.summary,
              containers: updatedCard.containers,
              tunnels: updatedCard.tunnels,
            }
          : updatedCard
      )
    }

    function handleDeviceStatus(event: DeviceStatusEvent) {
      if (event.deviceId !== externalId) return
      setDevice((prev) =>
        prev
          ? {
              ...prev,
              status: event.status,
              lastSeenAt: event.lastSeenAt ?? prev.lastSeenAt,
            }
          : prev
      )
    }

    function handleTelemetry(event: TelemetryEvent) {
      if (event.deviceId !== externalId) return
      const metrics = event.metrics ?? []
      if (metrics.length === 0) return

      // Use client receive-time: the event's sent_at is a proto int64 (arrives
      // as a Long object, not a number), and receive-time aligns the point with
      // the chart's `now` edge (also client Date.now()). One ts per batch so
      // netIn/netOut (merged by ts downstream) stay aligned.
      const ts = Date.now()

      const values: Record<string, number> = {}
      let tempMax: number | undefined
      for (const m of metrics) {
        const key = SPARKLINE_KEY_BY_METRIC[m.name]
        if (key) {
          values[key] = Number(m.value)
        } else if (m.name === TEMP_METRIC) {
          const v = Number(m.value)
          tempMax = tempMax === undefined ? v : Math.max(tempMax, v)
        }
      }
      if (tempMax !== undefined) values["cpuTempC"] = tempMax
      if (Object.keys(values).length === 0) return

      const windowMs = windowMsRef.current
      const cutoff = windowMs > 0 ? ts - windowMs : 0

      setDevice((prev) => {
        if (!prev) return prev
        const sparklines = prev.sparklines.map((s) => {
          if (!(s.name in values)) return s
          let points = [...s.points, { tsUnixMs: ts, value: values[s.name] }]
          if (cutoff > 0) points = points.filter((p) => p.tsUnixMs >= cutoff)
          if (points.length > MAX_POINTS) {
            points = points.slice(points.length - MAX_POINTS)
          }
          return { ...s, points }
        })
        return { ...prev, sparklines }
      })
    }

    socket.on("dashboard.update", handleDashboardUpdate)
    socket.on("device.status", handleDeviceStatus)
    socket.on("telemetry", handleTelemetry)

    return () => {
      socket.off("dashboard.update", handleDashboardUpdate)
      socket.off("device.status", handleDeviceStatus)
      socket.off("telemetry", handleTelemetry)
    }
  }, [socket, externalId])

  return device
}
