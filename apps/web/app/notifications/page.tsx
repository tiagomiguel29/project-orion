"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, ArrowLeft, RefreshCw, Send } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useSocket } from "@/components/socket-provider"
import { fetchDashboard, type DeviceCard } from "@/lib/dashboard-service"
import { notificationApi, type AlertEvent, type Delivery, type DeviceSettings, type GlobalConfig, type GlobalSettings, type Policy, type Provider } from "@/lib/notification-service"

const providers: Provider[] = ["webhook", "discord", "email"]
const box = "border border-border bg-card/80 p-5"
const input = "w-full border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
const button = "border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary hover:bg-primary/20 disabled:opacity-40"

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex items-center justify-between gap-4 py-2 text-sm text-foreground"><span>{label}</span><input aria-label={label} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-[#4ade80]" /></label>
}

function PolicyEditor({ value, onChange, global }: { value: Policy; onChange: (policy: Policy) => void; global?: boolean }) {
  const rule = (name: keyof Policy["rules"], val: boolean | number) => onChange({ ...value, rules: { ...value.rules, [name]: val } })
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className={box}>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">Triggers</h2>
      <Switch label="Enable notifications" checked={value.enabled} onChange={v => onChange({ ...value, enabled: v })} />
      <Switch label="Agent offline" checked={value.rules.offline} onChange={v => rule("offline", v)} />
      <Switch label="Send recovery alerts" checked={value.rules.recovery} onChange={v => rule("recovery", v)} />
      <div className="grid grid-cols-2 gap-3 pt-3">
        {([ ["offlineAfterSec", "Offline after (seconds)", 10, 3600], ["cpuPct", "CPU (%)", 1, 100], ["ramPct", "RAM (%)", 1, 100], ["diskPct", "Disk (%)", 1, 100], ["temperatureC", "CPU temp (°C)", 1, 150] ] as const).map(([key, label, min, max]) =>
          <label key={key} className="text-xs text-muted-foreground">{label}<input className={`${input} mt-1`} type="number" min={min} max={max} value={value.rules[key]} onChange={e => rule(key, Number(e.target.value))} /></label>
        )}
      </div>
      {global && <p className="mt-3 text-xs text-muted-foreground">The offline timeout also determines when Scope marks an agent offline.</p>}
    </section>
    <section className={box}>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">Providers</h2>
      {providers.map(provider => <Switch key={provider} label={provider === "email" ? "Email" : provider === "discord" ? "Discord" : "Webhook"} checked={value.providers[provider]} onChange={v => onChange({ ...value, providers: { ...value.providers, [provider]: v } })} />)}
      {!global && <p className="mt-4 text-xs text-muted-foreground">A device can only use providers enabled globally.</p>}
    </section>
  </div>
}

export default function NotificationsPage() {
  const router = useRouter()
  const { token, user, authState } = useAuth()
  const { socket } = useSocket()
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [devices, setDevices] = useState<DeviceCard[]>([])
  const [selected, setSelected] = useState("")
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings | null>(null)
  const [override, setOverride] = useState<Policy | null>(null)
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [webhookUrl, setWebhookUrl] = useState("")
  const [discordUrl, setDiscordUrl] = useState("")
  const [recipients, setRecipients] = useState("")
  const [resendApiKey, setResendApiKey] = useState("")
  const [sesAccessKeyId, setSesAccessKeyId] = useState("")
  const [sesSecretAccessKey, setSesSecretAccessKey] = useState("")
  const [removeResendKey, setRemoveResendKey] = useState(false)
  const [useSesIamRole, setUseSesIamRole] = useState(false)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    try {
      const [global, dashboard, recent, attempts] = await Promise.all([
        notificationApi.global(token), fetchDashboard(token), notificationApi.events(token), notificationApi.deliveries(token),
      ])
      setSettings(global); setConfig(global.config); setRecipients(global.config.emailRecipients.join(", ")); setDevices(dashboard.devices); setEvents(recent); setDeliveries(attempts); setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load notifications") }
  }, [token])
  useEffect(() => { setSelected(new URLSearchParams(window.location.search).get("device") || "") }, [])
  useEffect(() => { if (authState === "authenticated" && user?.role === "admin") void load() }, [authState, user?.role, load])
  useEffect(() => {
    if (!socket || !token || user?.role !== "admin") return
    const onEvent = (event: AlertEvent) => setEvents(previous => [event, ...previous.filter(item => item.id !== event.id)].slice(0, 50))
    const refresh = () => { void notificationApi.events(token).then(setEvents).catch(() => {}) }
    socket.on("notification.event", onEvent)
    socket.on("connect", refresh)
    socket.on("stream.recovered", refresh)
    return () => { socket.off("notification.event", onEvent); socket.off("connect", refresh); socket.off("stream.recovered", refresh) }
  }, [socket, token, user?.role])
  useEffect(() => {
    if (!token || !selected) { setDeviceSettings(null); setOverride(null); return }
    notificationApi.device(token, selected).then(data => { setDeviceSettings(data); setOverride(data.override) }).catch(e => setError(e.message))
  }, [token, selected])

  async function action(name: string, run: () => Promise<void>) {
    setBusy(name); setError(""); setMessage("")
    try { await run(); setMessage(`${name} complete`) } catch (e) { setError(e instanceof Error ? e.message : "Request failed") }
    finally { setBusy("") }
  }

  if (authState === "loading") return <div className="min-h-screen bg-background p-8 text-muted-foreground">Loading…</div>
  if (authState !== "authenticated") { router.replace("/"); return null }
  if (user?.role !== "admin") return <div className="min-h-screen bg-background p-8 text-foreground">Admin access is required to manage notifications.</div>

  return <main className="min-h-screen bg-background grid-overlay text-foreground">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4">
      <div className="flex items-center gap-4"><button onClick={() => router.push("/")} aria-label="Back to dashboard" className="text-muted-foreground hover:text-primary"><ArrowLeft size={18} /></button><Bell size={18} className="text-primary" /><div><h1 className="text-sm font-bold uppercase tracking-[.2em]">Notifications</h1><p className="text-xs text-muted-foreground">Alerts, providers and delivery status</p></div></div>
      <button onClick={() => void load()} aria-label="Refresh notifications" className="text-muted-foreground hover:text-primary"><RefreshCw size={17} /></button>
    </header>
    <div className="mx-auto max-w-6xl space-y-7 p-5 pb-20">
      {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{message}</p>}
      {!config || !settings ? <p className="text-sm text-muted-foreground">Loading settings…</p> : <>
        <div><h2 className="mb-2 text-lg font-semibold">Global settings</h2><p className="text-sm text-muted-foreground">These rules apply to every device unless a device has an override. Global enable and provider switches remain the master controls.</p></div>
        <PolicyEditor value={config} onChange={policy => setConfig({ ...config, ...policy })} global />
        <section className={box}><h2 className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-primary">Delivery destinations</h2><div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">Webhook URL {settings.webhookConfigured && <span className="text-primary">· configured</span>}<input type="url" className={`${input} mt-1`} placeholder="https://example.com/scope-alerts" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} /><span className="mt-1 block">Leave blank to keep the saved secret.</span></label>
          <label className="text-xs text-muted-foreground">Discord webhook URL {settings.discordConfigured && <span className="text-primary">· configured</span>}<input type="url" className={`${input} mt-1`} placeholder="https://discord.com/api/webhooks/..." value={discordUrl} onChange={e => setDiscordUrl(e.target.value)} /><span className="mt-1 block">Leave blank to keep the saved secret.</span></label>
          <label className="text-xs text-muted-foreground md:col-span-2">Email recipients (comma separated)<input className={`${input} mt-1`} value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="ops@example.com, you@example.com" /></label>
          <label className="text-xs text-muted-foreground">Email service<select className={`${input} mt-1`} value={config.emailTransport} onChange={e => setConfig({ ...config, emailTransport: e.target.value as GlobalConfig["emailTransport"] })}><option value="resend">Resend API</option><option value="ses">Amazon SES</option><option value="smtp">SMTP relay</option></select></label>
          {config.emailTransport === "smtp" ? <p className="self-end text-xs text-muted-foreground">SMTP is {settings.smtpConfigured ? "configured" : "not configured"} on the backend. Set SCOPE_SMTP_HOST and SCOPE_SMTP_FROM in every replica.</p> : <>
            <label className="text-xs text-muted-foreground">Verified sender address<input type="email" className={`${input} mt-1`} value={config.emailFrom} onChange={e => setConfig({ ...config, emailFrom: e.target.value })} placeholder="alerts@example.com" /></label>
            {config.emailTransport === "resend" ? <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Resend API key {settings.resendConfigured && <span className="text-primary">· saved</span>}<input type="password" autoComplete="off" className={`${input} mt-1`} value={resendApiKey} onChange={e => setResendApiKey(e.target.value)} placeholder="re_..." disabled={removeResendKey} /><span className="mt-1 block">Use a sending-only key. Leave blank to keep the saved key.</span></label>{settings.resendConfigured && <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={removeResendKey} onChange={e => setRemoveResendKey(e.target.checked)} /> Remove saved Resend key</label>}</div> : <>
              <label className="text-xs text-muted-foreground">AWS region<input className={`${input} mt-1`} value={config.sesRegion} onChange={e => setConfig({ ...config, sesRegion: e.target.value })} placeholder="eu-west-1" /></label>
              <label className="text-xs text-muted-foreground">AWS access key ID {settings.sesCredentialsConfigured && <span className="text-primary">· saved</span>}<input type="password" autoComplete="off" className={`${input} mt-1`} value={sesAccessKeyId} onChange={e => setSesAccessKeyId(e.target.value)} placeholder="AKIA..." disabled={useSesIamRole} /></label>
              <label className="text-xs text-muted-foreground">AWS secret access key<input type="password" autoComplete="off" className={`${input} mt-1`} value={sesSecretAccessKey} onChange={e => setSesSecretAccessKey(e.target.value)} placeholder="Secret access key" disabled={useSesIamRole} /></label>
              <div className="self-end text-xs text-muted-foreground"><p>Enter both keys, or leave both blank to use the backend&apos;s IAM role or saved keys.</p>{settings.sesCredentialsConfigured && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={useSesIamRole} onChange={e => setUseSesIamRole(e.target.checked)} /> Remove saved keys and use the backend IAM role</label>}</div>
            </>}
          </>}
        </div><div className="mt-5 flex flex-wrap items-center gap-3"><button className={button} disabled={!!busy} onClick={() => void action("Save global settings", async () => { const saved = await notificationApi.saveGlobal(token!, { config: { ...config, emailRecipients: recipients.split(",").map(v => v.trim()).filter(Boolean) }, ...(webhookUrl ? { webhookUrl } : {}), ...(discordUrl ? { discordUrl } : {}), ...(removeResendKey ? { resendApiKey: null } : resendApiKey ? { resendApiKey } : {}), ...(useSesIamRole ? { sesAccessKeyId: null, sesSecretAccessKey: null } : { ...(sesAccessKeyId ? { sesAccessKeyId } : {}), ...(sesSecretAccessKey ? { sesSecretAccessKey } : {}) }) }); setSettings(saved); setConfig(saved.config); setRecipients(saved.config.emailRecipients.join(", ")); setWebhookUrl(""); setDiscordUrl(""); setResendApiKey(""); setSesAccessKeyId(""); setSesSecretAccessKey(""); setRemoveResendKey(false); setUseSesIamRole(false) })}>Save settings</button>{providers.map(provider => <button key={provider} className="flex items-center gap-1 border border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-40" disabled={!!busy} onClick={() => void action(`Test ${provider}`, () => notificationApi.test(token!, provider).then(() => {}))}><Send size={12} /> Test {provider}</button>)}</div><p className="mt-3 text-xs text-muted-foreground">Save settings before testing. Test sends a real message to the configured destination.</p></section>
        <section className="space-y-4"><div><h2 className="text-lg font-semibold">Device overrides</h2><p className="text-sm text-muted-foreground">Select a device to customize its thresholds and channels.</p></div><select aria-label="Select device" className={input} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a device</option>{devices.map(device => <option key={device.externalId} value={device.externalId}>{device.hostname || device.externalId} ({device.externalId})</option>)}</select>{selected && deviceSettings && <><div className="flex items-center gap-3"><Switch label="Use custom settings for this device" checked={override !== null} onChange={v => setOverride(v ? structuredClone(deviceSettings.effective) : null)} />{override && <button className="text-xs text-muted-foreground underline" onClick={() => setOverride(structuredClone(deviceSettings.effective))}>Reset form</button>}</div>{override && <PolicyEditor value={override} onChange={setOverride} />}<button className={button} disabled={!!busy} onClick={() => void action("Save device settings", async () => { const saved = override ? await notificationApi.saveDevice(token!, selected, override) : await notificationApi.resetDevice(token!, selected); setDeviceSettings(saved); setOverride(saved.override) })}>Save device settings</button></>}</section>
      </>}
      <section className="grid gap-5 lg:grid-cols-2"><div className={box}><h2 className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-primary">Recent alerts</h2>{events.length ? <div className="space-y-3">{events.map(event => <div key={event.id} className="border-t border-border pt-3"><div className="flex justify-between gap-3 text-xs"><span className={event.severity === "critical" ? "text-red-400" : event.severity === "warning" ? "text-amber-400" : "text-primary"}>{event.message}</span><time className="shrink-0 text-muted-foreground">{new Date(event.time).toLocaleString()}</time></div><p className="mt-1 text-xs text-muted-foreground">{event.deviceName}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No alerts yet.</p>}</div><div className={box}><h2 className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-primary">Delivery attempts</h2>{deliveries.length ? <div className="space-y-3">{deliveries.map(delivery => <div key={delivery.id} className="flex justify-between gap-3 border-t border-border pt-3 text-xs"><div><span className="uppercase">{delivery.provider}</span><span className="ml-2 text-muted-foreground">{delivery.attempts} attempt(s)</span>{delivery.lastError && <p className="text-red-400">{delivery.lastError}</p>}</div><span className={delivery.status === "sent" ? "text-primary" : delivery.status === "failed" ? "text-red-400" : "text-amber-400"}>{delivery.status}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No deliveries yet.</p>}</div></section>
    </div>
  </main>
}
