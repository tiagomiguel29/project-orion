import type { DeviceCard, SparklineData } from "./dashboard-service"
import type { SystemData } from "@/components/system-card"

// ── Helpers ─────────────────────────────────────────────────────────

function bytesToGB(bytes: number): number {
  return Math.round((bytes / 1_073_741_824) * 10) / 10
}

function bpsToMBs(bps: number): number {
  return Math.round((bps / 1_000_000) * 10) / 10
}

function secondsToUptime(sec?: number): string {
  if (!sec || sec <= 0) return "0d 0h 0m"
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

/**
 * Extract the `value` array from a sparklines entry by metric name.
 * Falls back to an empty array when the sparkline is not present.
 */
function extractSparkline(device: DeviceCard, name: string): number[] {
  const spark = device.sparklines.find((s) => s.name === name)
  if (!spark || !spark.points.length) return []
  return spark.points.flatMap((p) =>
    p.value === null ? [] : [Math.round(p.value * 10) / 10]
  )
}

// ── Mapper ──────────────────────────────────────────────────────────

export function mapDeviceToSystem(device: DeviceCard): SystemData {
  const { summary } = device

  // Map API "unknown" status to our "warning" variant
  const statusMap: Record<string, SystemData["status"]> = {
    online: "online",
    offline: "offline",
    unknown: "warning",
  }

  const cpuHistory = extractSparkline(device, "cpuPct")
  const ramHistory = extractSparkline(device, "ramPct")
  const tempHistory = extractSparkline(device, "cpuTempC")
  const netInHistory = extractSparkline(device, "netIn").map(bpsToMBs)
  const netOutHistory = extractSparkline(device, "netOut").map(bpsToMBs)

  return {
    id: device.externalId,
    externalId: device.externalId,
    name: device.externalId,
    hostname: device.ipAddress ?? device.hostname ?? "N/A",
    status: statusMap[device.status] ?? "warning",
    uptime: secondsToUptime(summary.uptimeSec),
    cpu: {
      usage: Math.round(summary.cpuPct * 10) / 10,
      history: cpuHistory,
    },
    ram: {
      usage: Math.round(summary.ramPct * 10) / 10,
      used: bytesToGB(summary.ramUsedBytes),
      total: bytesToGB(summary.ramTotalBytes),
      history: ramHistory,
    },
    disk: {
      usage: Math.round(summary.disk.usedPct * 10) / 10,
      used: bytesToGB(summary.disk.usedBytes),
      total: bytesToGB(summary.disk.totalBytes),
    },
    network: {
      upload: bpsToMBs(summary.network.outBps),
      download: bpsToMBs(summary.network.inBps),
      uploadHistory: netOutHistory,
      downloadHistory: netInHistory,
    },
    temperature: {
      current: Math.round(summary.cpuTempC ?? 0),
      history: tempHistory,
    },
  }
}

/**
 * Map the full dashboard payload into the UI's SystemData array.
 */
export function mapDevicesToSystems(devices: DeviceCard[]): SystemData[] {
  return devices.map(mapDeviceToSystem)
}

// ── X-axis tick configuration per range ─────────────────────────────

import type { DashboardRange } from "./dashboard-service"

/** Tick interval in milliseconds for each dashboard range */
const TICK_INTERVALS: Record<DashboardRange, number> = {
  "1m":  10_000,          // 10 seconds
  "5m":  30_000,          // 30 seconds
  "1h":  5 * 60_000,      // 5 minutes
  "2h":  10 * 60_000,     // 10 minutes
  "5h":  30 * 60_000,     // 30 minutes
  "12h": 60 * 60_000,     // 1 hour
  "1d":  4 * 60 * 60_000, // 4 hours
  "1w":  24 * 60 * 60_000, // 1 day
  "1mo": 4 * 24 * 60 * 60_000, // 4 days
  "1y":  30 * 24 * 60 * 60_000, // ~1 month
  all:   30 * 24 * 60 * 60_000, // ~1 month
}

/** Duration in milliseconds for each dashboard range */
const RANGE_DURATIONS: Record<DashboardRange, number> = {
  "1m":   60_000,
  "5m":   5 * 60_000,
  "1h":   60 * 60_000,
  "2h":   2 * 60 * 60_000,
  "5h":   5 * 60 * 60_000,
  "12h":  12 * 60 * 60_000,
  "1d":   24 * 60 * 60_000,
  "1w":   7 * 24 * 60 * 60_000,
  "1mo":  30 * 24 * 60 * 60_000,
  "1y":   365 * 24 * 60 * 60_000,
  all:    0, // special: uses data boundaries
}

const LIVE_EDGE_PAD_RANGES = new Set<DashboardRange>(["1m", "5m"])

const LIVE_EDGE_PAD_FALLBACK_MS: Record<DashboardRange, number> = {
  "1m": 12_000,
  "5m": 35_000,
  "1h": 0,
  "2h": 0,
  "5h": 0,
  "12h": 0,
  "1d": 0,
  "1w": 0,
  "1mo": 0,
  "1y": 0,
  all: 0,
}

/**
 * Compute the full time domain [start, end] for a range.
 * Always uses the full time window so the chart shows the correct time span.
 */
export function getRangeDomain(
  range: DashboardRange,
  data?: { ts: number }[],
  nowMs: number = Date.now()
): [number, number] {
  const now = nowMs

  if (range === "all") {
    if (data?.length) {
      return [data[0].ts, data[data.length - 1].ts]
    }
    return [now - 30 * 24 * 60 * 60_000, now]
  }

  const duration = RANGE_DURATIONS[range]
  return [now - duration, now]
}

/**
 * Generate evenly spaced tick positions across the full range window.
 * Ticks span the entire requested time range (not just where data exists).
 */
export function generateTicks(
  range: DashboardRange,
  data?: { ts: number }[],
  nowMs: number = Date.now()
): number[] {
  const interval = TICK_INTERVALS[range]
  const [start, end] = getRangeDomain(range, data, nowMs)

  const ticks: number[] = []
  for (let t = start; t <= end; t += interval) {
    ticks.push(t)
  }
  return ticks
}

/**
 * Format a unix-ms timestamp for the X-axis label based on range.
 * Short ranges show HH:MM:SS, medium show HH:MM, long show date.
 */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatTickLabel(tsMs: number, range: DashboardRange): string {
  const d = new Date(tsMs)
  const hh = d.getHours().toString().padStart(2, "0")
  const mm = d.getMinutes().toString().padStart(2, "0")
  const ss = d.getSeconds().toString().padStart(2, "0")

  // Ranges <= 5 minutes: show HH:MM:SS
  if (range === "1m" || range === "5m") {
    return `${hh}:${mm}:${ss}`
  }
  // Ranges up to 1 day: show HH:MM
  if (range === "1h" || range === "2h" || range === "5h" || range === "12h" || range === "1d") {
    return `${hh}:${mm}`
  }
  // 1 week and up: show "21 Feb" style
  const day = d.getDate()
  const month = MONTH_ABBR[d.getMonth()]
  return `${day} ${month}`
}

// ── Timestamp-aware chart data for the detail page ──────────────────

export interface TimeSeriesPoint {
  ts: number        // unix ms
  time: string      // formatted label
  value: number | null
}

export interface DeviceChartData {
  cpu: TimeSeriesPoint[]
  ram: TimeSeriesPoint[]
  cpuTemp: TimeSeriesPoint[]
  netIn: TimeSeriesPoint[]
  netOut: TimeSeriesPoint[]
  network: { ts: number; time: string; download: number | null; upload: number | null }[]
}

function formatTimestamp(tsMs: number): string {
  const d = new Date(tsMs)
  const hh = d.getHours().toString().padStart(2, "0")
  const mm = d.getMinutes().toString().padStart(2, "0")
  const ss = d.getSeconds().toString().padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function extractTimeSeries(
  sparklines: SparklineData[],
  name: string,
  transform?: (v: number) => number
): TimeSeriesPoint[] {
  const spark = sparklines.find((s) => s.name === name)
  if (!spark?.points?.length) return []

  const sortedPoints = [...spark.points].sort((a, b) => a.tsUnixMs - b.tsUnixMs)
  const points: TimeSeriesPoint[] = []

  for (const p of sortedPoints) {
    const value =
      p.value === null
        ? null
        : transform
          ? transform(p.value)
          : Math.round(p.value * 10) / 10

    const previous = points[points.length - 1]

    if (value === null) {
      if (!previous || previous.ts !== p.tsUnixMs || previous.value !== null) {
        points.push({
          ts: p.tsUnixMs,
          time: formatTimestamp(p.tsUnixMs),
          value: null,
        })
      }
      continue
    }

    if (previous && previous.ts === p.tsUnixMs && previous.value !== null) {
      previous.value = Math.max(previous.value, value)
      continue
    }

    points.push({
      ts: p.tsUnixMs,
      time: formatTimestamp(p.tsUnixMs),
      value,
    })
  }

  const realPoints = points.filter((point) => point.value !== null)

  // Detect gaps larger than 3× the median interval and insert nulls
  // so the chart line breaks where data is missing
  if (realPoints.length >= 2) {
    const intervals: number[] = []
    let previousRealPoint: TimeSeriesPoint | null = null

    for (const point of points) {
      if (point.value === null) {
        previousRealPoint = null
        continue
      }

      if (!previousRealPoint) {
        previousRealPoint = point
        continue
      }

      const interval = point.ts - previousRealPoint.ts
      if (interval > 0) {
        intervals.push(interval)
      }
      previousRealPoint = point
    }

    if (intervals.length === 0) return points

    intervals.sort((a, b) => a - b)
    const median = intervals[Math.floor(intervals.length / 2)]
    const gapThreshold = median * 3

    const result: TimeSeriesPoint[] = []
    let previousNumericPoint: TimeSeriesPoint | null = null

    for (const point of points) {
      if (point.value === null) {
        result.push(point)
        previousNumericPoint = null
        continue
      }

      if (previousNumericPoint && point.ts - previousNumericPoint.ts > gapThreshold) {
        // Insert a null point to break the line
        result.push({ ts: previousNumericPoint.ts + 1, time: "", value: null })
      }
      result.push(point)
      previousNumericPoint = point
    }

    return result
  }

  return points
}

function padRangeEdges(
  points: TimeSeriesPoint[],
  range: DashboardRange,
  status: DeviceCard["status"],
  nowMs: number
): TimeSeriesPoint[] {
  if (!LIVE_EDGE_PAD_RANGES.has(range) || status !== "online" || points.length === 0) {
    return points
  }

  const realPoints = points.filter((point) => point.value !== null)
  if (realPoints.length === 0) return points

  const intervals: number[] = []
  for (let i = 1; i < realPoints.length; i++) {
    const interval = realPoints[i].ts - realPoints[i - 1].ts
    if (interval > 0) {
      intervals.push(interval)
    }
  }

  const medianInterval =
    intervals.length > 0
      ? [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
      : 0

  const gapAllowance = Math.max(
    LIVE_EDGE_PAD_FALLBACK_MS[range],
    Math.round(medianInterval * 2.5)
  )

  const [start, end] = getRangeDomain(range, realPoints, nowMs)
  const result = [...points]

  const first = realPoints[0]
  if (first.ts > start && first.ts - start <= gapAllowance) {
    result.unshift({
      ts: start,
      time: formatTimestamp(start),
      value: first.value,
    })
  }

  const last = realPoints[realPoints.length - 1]
  if (end > last.ts && end - last.ts <= gapAllowance) {
    result.push({
      ts: end,
      time: formatTimestamp(end),
      value: last.value,
    })
  }

  return result
}

/**
 * Extract all time-series chart data from a single DeviceCard for the detail page.
 */
export function mapDeviceToChartData(
  device: DeviceCard,
  range: DashboardRange,
  nowMs: number = Date.now()
): DeviceChartData {
  const cpu = padRangeEdges(
    extractTimeSeries(device.sparklines, "cpuPct"),
    range,
    device.status,
    nowMs
  )
  const ram = padRangeEdges(
    extractTimeSeries(device.sparklines, "ramPct"),
    range,
    device.status,
    nowMs
  )
  const cpuTemp = padRangeEdges(
    extractTimeSeries(device.sparklines, "cpuTempC"),
    range,
    device.status,
    nowMs
  )
  const netIn = padRangeEdges(
    extractTimeSeries(device.sparklines, "netIn", bpsToMBs),
    range,
    device.status,
    nowMs
  )
  const netOut = padRangeEdges(
    extractTimeSeries(device.sparklines, "netOut", bpsToMBs),
    range,
    device.status,
    nowMs
  )

  // Merge network in/out into one combined series for the chart
  // Filter out null gap-marker points for the merge maps
  const netInReal = netIn.filter((p) => p.value !== null)
  const netOutReal = netOut.filter((p) => p.value !== null)
  const netInMap = new Map(netInReal.map((p) => [p.ts, p.value]))
  const netOutMap = new Map(netOutReal.map((p) => [p.ts, p.value]))
  // Collect gap-marker timestamps
  const gapTs = new Set([
    ...netIn.filter((p) => p.value === null).map((p) => p.ts),
    ...netOut.filter((p) => p.value === null).map((p) => p.ts),
  ])
  const allTs = [...new Set([
    ...netIn.map((p) => p.ts),
    ...netOut.map((p) => p.ts),
  ])].sort()

  const network = allTs.map((ts) => ({
    ts,
    time: formatTimestamp(ts),
    download: gapTs.has(ts) ? null : (netInMap.get(ts) ?? 0),
    upload: gapTs.has(ts) ? null : (netOutMap.get(ts) ?? 0),
  }))

  return { cpu, ram, cpuTemp, netIn, netOut, network }
}
