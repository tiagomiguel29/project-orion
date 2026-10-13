import type { DashboardRange, DeviceCard, MetricPoint, SparklineData } from './dashboard-service'

export const RANGE_POINTS: Record<DashboardRange, number> = {
  '1m': 12, '5m': 20, '1h': 60, '2h': 60, '5h': 60, '12h': 72,
  '1d': 96, '1w': 84, '1mo': 120, '1y': 120, all: 120,
}
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const WINDOWS: Record<DashboardRange, number> = {
  '1m': MINUTE, '5m': 5 * MINUTE, '1h': 60 * MINUTE, '2h': 120 * MINUTE,
  '5h': 300 * MINUTE, '12h': 720 * MINUTE, '1d': DAY, '1w': 7 * DAY,
  '1mo': 30 * DAY, '1y': 365 * DAY, all: 0,
}
const BUCKETS = [5000, 10000, 15000, 30000, MINUTE, 2 * MINUTE, 5 * MINUTE,
  10 * MINUTE, 15 * MINUTE, 30 * MINUTE, 60 * MINUTE, 120 * MINUTE,
  180 * MINUTE, 360 * MINUTE, 720 * MINUTE, DAY, 2 * DAY, 3 * DAY,
  4 * DAY, 7 * DAY, 14 * DAY, 30 * DAY]

export function bucketSize(range: DashboardRange, span = DAY): number {
  const raw = Math.max(1, Math.ceil((WINDOWS[range] || span) / RANGE_POINTS[range]))
  return BUCKETS.find(size => size >= raw) ?? Math.ceil(raw / (30 * DAY)) * 30 * DAY
}

// gRPC int64 fields may arrive as numbers, decimal strings or serialized Longs.
export function timestamp(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string') return Number(value)
  if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
    const long = value as { low: number; high: number }
    return (long.high >>> 0) * 4294967296 + (long.low >>> 0)
  }
  return NaN
}

export function compactSeries(
  points: MetricPoint[], range: DashboardRange, now: number, maximum = false,
): MetricPoint[] {
  const valid = points.filter(p => p.value !== null && Number.isFinite(p.value) &&
    Number.isFinite(p.tsUnixMs) && p.tsUnixMs <= now &&
    (!WINDOWS[range] || (p.lastTsUnixMs ?? p.tsUnixMs) >= now - WINDOWS[range]))
  const span = valid.length ? now - Math.min(...valid.map(p => p.firstTsUnixMs ?? p.tsUnixMs)) : DAY
  const size = bucketSize(range, span)
  const buckets = new Map<number, MetricPoint>()
  for (const point of valid) {
    const ts = Math.floor(point.tsUnixMs / size) * size
    const count = point.sampleCount ?? 1
    const first = point.firstTsUnixMs ?? point.tsUnixMs
    const last = point.lastTsUnixMs ?? point.tsUnixMs
    const prev = buckets.get(ts)
    if (!prev) {
      buckets.set(ts, { tsUnixMs: ts, value: point.value, sampleCount: count,
        firstTsUnixMs: first, lastTsUnixMs: last })
    } else {
      const prevCount = prev.sampleCount ?? 1
      prev.value = maximum ? Math.max(prev.value!, point.value!)
        : (prev.value! * prevCount + point.value! * count) / (prevCount + count)
      prev.sampleCount = prevCount + count
      prev.firstTsUnixMs = Math.min(prev.firstTsUnixMs!, first)
      prev.lastTsUnixMs = Math.max(prev.lastTsUnixMs!, last)
    }
  }
  const sorted = [...buckets.values()].sort((a, b) => a.tsUnixMs - b.tsUnixMs)
  const result: MetricPoint[] = []
  for (const point of sorted) {
    const previous = result[result.length - 1]
    if (previous && point.firstTsUnixMs! - previous.lastTsUnixMs! > 20_000) {
      result.push({ tsUnixMs: (previous.tsUnixMs + point.tsUnixMs) / 2, value: null })
    }
    result.push(point)
  }
  return result
}

export interface TelemetryEvent {
  deviceId: string
  batchId?: string
  sentAtUnixMs?: unknown
  metrics?: { name: string; value: number; tsUnixMs?: unknown; labels?: Record<string, string> }[]
}
const KEYS: Record<string, string> = {
  'cpu.percent': 'cpuPct', 'mem.percent': 'ramPct', 'disk.used_percent': 'diskPct',
  'net.rx_bytes_per_sec': 'netIn', 'net.tx_bytes_per_sec': 'netOut',
  'sensor.temperature_celsius': 'cpuTempC',
}

export function applyTelemetry(device: DeviceCard, event: TelemetryEvent, range: DashboardRange, now: number): DeviceCard {
  const additions = new Map<string, Map<number, number>>()
  for (const metric of event.metrics ?? []) {
    const key = KEYS[metric.name]
    const ts = timestamp(metric.tsUnixMs ?? event.sentAtUnixMs)
    const value = Number(metric.value)
    if (!key || !Number.isFinite(ts) || !Number.isFinite(value) || ts > now) continue
    if (key === 'diskPct' && metric.labels?.mount !== (device.os === 'windows' ? 'C:\\' : '/')) continue
    const byTime = additions.get(key) ?? new Map<number, number>()
    byTime.set(ts, key === 'cpuTempC' ? Math.max(byTime.get(ts) ?? -Infinity, value) : value)
    additions.set(key, byTime)
  }
  const sparklines: SparklineData[] = device.sparklines.map(series => {
    const last = Math.max(0, ...series.points.filter(p => p.value !== null).map(p => p.lastTsUnixMs ?? p.tsUnixMs))
    const fresh = [...(additions.get(series.name) ?? [])].filter(([ts]) => ts > last)
      .map(([tsUnixMs, value]) => ({ tsUnixMs, value }))
    return { ...series, points: compactSeries([...series.points, ...fresh], range, now, series.name === 'cpuTempC') }
  })
  return { ...device, sparklines }
}
