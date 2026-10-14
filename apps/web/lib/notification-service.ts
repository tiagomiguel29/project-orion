import { getRuntimeConfig } from "@/lib/runtime-config"

export type Provider = "webhook" | "discord" | "email"
export type Policy = {
  enabled: boolean
  rules: { offline: boolean; offlineAfterSec: number; recovery: boolean; cpuPct: number; ramPct: number; diskPct: number; temperatureC: number }
  providers: Record<Provider, boolean>
}
export type EmailTransport = "smtp" | "resend" | "ses"
export type GlobalConfig = Policy & { emailRecipients: string[]; emailTransport: EmailTransport; emailFrom: string; sesRegion: string }
export type GlobalSettings = { config: GlobalConfig; webhookConfigured: boolean; discordConfigured: boolean; smtpConfigured: boolean; resendConfigured: boolean; sesCredentialsConfigured: boolean }
export type DeviceSettings = { override: Policy | null; effective: Policy }
export type AlertEvent = { id: string; deviceId: string; deviceName: string; type: string; severity: string; message: string; time: string }
export type Delivery = { id: string; eventId: string; provider: Provider; status: string; attempts: number; lastError: string | null; createdAt: string }

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getRuntimeConfig().apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    cache: "no-store",
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || `Request failed (${response.status})`)
  }
  return response.json()
}

export const notificationApi = {
  global: (token: string) => request<GlobalSettings>(token, "/notifications/settings"),
  saveGlobal: (token: string, body: { config: GlobalConfig; webhookUrl?: string | null; discordUrl?: string | null; resendApiKey?: string | null; sesAccessKeyId?: string | null; sesSecretAccessKey?: string | null }) =>
    request<GlobalSettings>(token, "/notifications/settings", { method: "PUT", body: JSON.stringify(body) }),
  device: (token: string, id: string) => request<DeviceSettings>(token, `/notifications/devices/${encodeURIComponent(id)}/settings`),
  saveDevice: (token: string, id: string, policy: Policy) =>
    request<DeviceSettings>(token, `/notifications/devices/${encodeURIComponent(id)}/settings`, { method: "PUT", body: JSON.stringify(policy) }),
  resetDevice: (token: string, id: string) =>
    request<DeviceSettings>(token, `/notifications/devices/${encodeURIComponent(id)}/settings`, { method: "DELETE" }),
  events: (token: string) => request<AlertEvent[]>(token, "/notifications/events?limit=50"),
  deliveries: (token: string) => request<Delivery[]>(token, "/notifications/deliveries?limit=30"),
  test: (token: string, provider: Provider) => request<{ sent: boolean }>(token, `/notifications/test/${provider}`, { method: "POST" }),
}
