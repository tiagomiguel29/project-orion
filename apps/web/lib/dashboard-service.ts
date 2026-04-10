import axios, { type AxiosError } from "axios"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

// ── Types matching NestJS DTOs ──────────────────────────────────────

export type DeviceStatus = "online" | "offline" | "unknown"

export interface MetricPoint {
  tsUnixMs: number
  value: number | null
}

export interface SparklineData {
  name: string
  unit: string
  points: MetricPoint[]
}

export interface DiskSummary {
  usedBytes: number
  totalBytes: number
  usedPct: number
}

export interface NetworkSummary {
  inBps: number
  outBps: number
}

export interface DeviceSummary {
  cpuPct: number
  ramPct: number
  ramUsedBytes: number
  ramTotalBytes: number
  disk: DiskSummary
  network: NetworkSummary
  cpuTempC?: number
  gpuPct?: number
  gpuTempC?: number
  uptimeSec?: number
}

export interface DockerContainer {
  name: string
  image: string
  health: string
  cpuPercent: number
  ramUsageBytes: number
  ramLimitBytes: number
  netRxBytes: number
  netTxBytes: number
}

export interface CloudflareTunnel {
  tunnelId: string
  tunnelName: string
  status: string   // "healthy" | "degraded" | "down"
  haConnections: number
  totalRequests: number
  requestErrors: number
}

export interface DeviceCard {
  externalId: string
  hostname?: string
  ipAddress?: string
  status: DeviceStatus
  os: string
  osName: string
  kernel: string
  cpuName: string
  memoryCapacity: number   // bytes
  diskCapacity: number     // bytes
  lastSeenAt?: string
  summary: DeviceSummary
  sparklines: SparklineData[]
  containers?: DockerContainer[]
  tunnels?: CloudflareTunnel[]
}

export interface DashboardTotals {
  total: number
  online: number
  offline: number
  warning: number
}

export interface DashboardPayload {
  totals: DashboardTotals
  devices: DeviceCard[]
}

interface BaseResponse<T> {
  success: boolean
  message: string
  data?: T
}

// ── Axios instance ──────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
})

function extractError(err: unknown): string {
  const axiosErr = err as AxiosError<BaseResponse<unknown>>
  return (
    axiosErr.response?.data?.message ??
    axiosErr.message ??
    "An unexpected error occurred"
  )
}

// ── Range types ─────────────────────────────────────────────────────

export const DASHBOARD_RANGES = [
  "1m", "5m", "1h", "2h", "5h", "12h", "1d", "1w", "1mo", "1y", "all",
] as const

export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const RANGE_LABELS: Record<DashboardRange, string> = {
  "1m": "1 min",
  "5m": "5 min",
  "1h": "1 hour",
  "2h": "2 hours",
  "5h": "5 hours",
  "12h": "12 hours",
  "1d": "1 day",
  "1w": "1 week",
  "1mo": "1 month",
  "1y": "1 year",
  all: "All time",
}

// ── Device creation types ────────────────────────────────────────────

export interface CreateDeviceRequest {
  externalId: string
  hostname?: string
}

export interface CreateDeviceResponse {
  token: string
  device: {
    id: string
    externalId: string
    hostname: string | null
    status: string
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * POST /devices — register a new device and receive an agent token.
 */
export async function createDevice(
  token: string,
  body: CreateDeviceRequest
): Promise<CreateDeviceResponse> {
  try {
    const { data } = await api.post<BaseResponse<CreateDeviceResponse>>(
      "/devices",
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!data.data) throw new Error("Device creation failed: no data returned")
    return data.data
  } catch (err) {
    throw new Error(extractError(err))
  }
}

/**
 * DELETE /devices/:externalId — delete a device and all its data.
 */
export async function deleteDevice(
  token: string,
  externalId: string
): Promise<void> {
  try {
    await api.delete(`/devices/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    throw new Error(extractError(err))
  }
}

/**
 * GET /devices/dashboard — fetch all devices with metrics (requires JWT).
 */
export async function fetchDashboard(token: string): Promise<DashboardPayload> {
  try {
    const { data } = await api.get<BaseResponse<DashboardPayload>>("/devices/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!data.data) throw new Error("Dashboard load failed: no data returned")
    return data.data
  } catch (err) {
    throw new Error(extractError(err))
  }
}

/**
 * GET /devices/dashboard/:externalId?range=... — fetch single device with metrics.
 */
export async function fetchDevice(
  token: string,
  externalId: string,
  range?: DashboardRange
): Promise<DeviceCard> {
  try {
    const params = range ? { range } : {}
    const { data } = await api.get<BaseResponse<DeviceCard>>(
      `/devices/dashboard/${encodeURIComponent(externalId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }
    )
    if (!data.data) throw new Error("Device load failed: no data returned")
    return data.data
  } catch (err) {
    throw new Error(extractError(err))
  }
}
