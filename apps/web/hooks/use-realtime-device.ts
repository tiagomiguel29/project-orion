"use client"

import { useEffect, useState } from "react"
import { useSocket } from "@/components/socket-provider"
import { useAuth } from "@/components/auth-provider"
import { fetchDevice, type DashboardRange, type DeviceCard, type DeviceStatus } from "@/lib/dashboard-service"
import { applyTelemetry, compactSeries, type TelemetryEvent } from "@/lib/live-series"

type State = { key: string; device: DeviceCard }

export function useRealtimeDevice(externalId: string, initial: DeviceCard | undefined, range: DashboardRange) {
  const { socket } = useSocket()
  const { token } = useAuth()
  const key = `${externalId}:${range}`
  const [state, setState] = useState<State | undefined>()

  useEffect(() => {
    if (!initial) return
    setState(previous => {
      // Keep newer live buckets when an in-flight REST response arrives.
      const device = { ...initial, sparklines: initial.sparklines.map(series => {
        const live = previous?.key === key
          ? previous.device.sparklines.find(s => s.name === series.name)?.points ?? [] : []
        const merged = new Map(series.points.map(p => [p.tsUnixMs, p]))
        for (const point of live) {
          const fetched = merged.get(point.tsUnixMs)
          if (!fetched || (point.lastTsUnixMs ?? point.tsUnixMs) > (fetched.lastTsUnixMs ?? fetched.tsUnixMs)) merged.set(point.tsUnixMs, point)
        }
        return { ...series, points: compactSeries([...merged.values()], range, Date.now(), series.name === "cpuTempC") }
      }) }
      return { key, device }
    })
  }, [initial, key, range])

  useEffect(() => {
    if (!socket || !token) return
    const connection = socket
    let active = true
    async function subscribe() {
      try {
        await connection.timeout(10000).emitWithAck("subscribeDevice", { deviceId: externalId })
        // Redis Pub/Sub does not replay missed events: recover from persistence.
        const recovered = await fetchDevice(token!, externalId, range)
        if (active) setState({ key, device: recovered })
      } catch {
        // SWR handles initial-load errors; a subsequent reconnect retries recovery.
      }
    }
    function handleDashboardUpdate(card: DeviceCard) {
      if (card.externalId !== externalId) return
      setState(previous => {
        if (previous?.key !== key) return previous
        if (card.lastSeenAt && previous.device.lastSeenAt && card.lastSeenAt < previous.device.lastSeenAt) return previous
        return { key, device: { ...previous.device, ...card, sparklines: previous.device.sparklines } }
      })
    }
    function handleStatus(event: { deviceId: string; status: DeviceStatus; lastSeenAt: string | null }) {
      if (event.deviceId !== externalId) return
      setState(previous => {
        if (previous?.key !== key) return previous
        if (event.lastSeenAt && previous.device.lastSeenAt && event.lastSeenAt < previous.device.lastSeenAt) return previous
        return { key, device: { ...previous.device,
          status: event.status, lastSeenAt: event.lastSeenAt ?? previous.device.lastSeenAt } }
      })
    }
    function handleTelemetry(event: TelemetryEvent) {
      if (event.deviceId !== externalId) return
      setState(previous => previous?.key === key ? { key,
        device: applyTelemetry(previous.device, event, range, Date.now()) } : previous)
    }
    socket.on("connect", subscribe)
    socket.on("stream.recovered", subscribe)
    socket.on("dashboard.update", handleDashboardUpdate)
    socket.on("device.status", handleStatus)
    socket.on("telemetry", handleTelemetry)
    if (socket.connected) void subscribe()
    return () => {
      active = false
      socket.off("connect", subscribe)
      socket.off("stream.recovered", subscribe)
      socket.off("dashboard.update", handleDashboardUpdate)
      socket.off("device.status", handleStatus)
      socket.off("telemetry", handleTelemetry)
      socket.emit("unsubscribeDevice", { deviceId: externalId })
    }
  }, [socket, token, externalId, key, range])

  return state?.key === key ? state.device : initial
}
