"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Bell, Mail, Plus, RefreshCw, Send, Webhook, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useSocket } from "@/components/socket-provider"
import { NotificationRuleEditor, SettingSwitch } from "@/components/notification-policy-editor"
import { notificationApi, type AlertEvent, type Delivery, type GlobalConfig, type GlobalSettings, type Provider } from "@/lib/notification-service"

const providerNames: Record<Provider, string> = { webhook: "Webhook", discord: "Discord", email: "Email" }
const providerDescriptions: Record<Provider, string> = {
  webhook: "Send an HTTP request to your endpoint.",
  discord: "Post alerts to a Discord channel.",
  email: "Deliver alerts through Resend, Amazon SES, or SMTP.",
}
const input = "mt-1 h-9 w-full border border-border bg-secondary px-3 text-xs text-foreground outline-none focus:border-primary/50"
const primaryButton = "border border-primary/40 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
const secondaryButton = "border border-border bg-secondary px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
const card = "relative border border-border bg-card corner-marks"
const cardHeader = "flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2"
const cardTitle = "text-[9px] uppercase tracking-widest text-muted-foreground"
const divider = "flex items-center gap-3 text-[9px] uppercase tracking-[0.25em] text-muted-foreground"

function isConfigured(provider: Provider, settings: GlobalSettings) {
  if (provider === "webhook") return settings.webhookConfigured
  if (provider === "discord") return settings.discordConfigured
  const { config } = settings
  if (!config.emailRecipients.length) return false
  if (config.emailTransport === "smtp") return settings.smtpConfigured
  if (config.emailTransport === "resend") return !!config.emailFrom && settings.resendConfigured
  return !!config.emailFrom && !!config.sesRegion
}

export function NotificationSettingsPanel() {
  const { token, user } = useAuth()
  const { socket } = useSocket()
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [discordUrl, setDiscordUrl] = useState("")
  const [recipients, setRecipients] = useState("")
  const [resendApiKey, setResendApiKey] = useState("")
  const [sesAccessKeyId, setSesAccessKeyId] = useState("")
  const [sesSecretAccessKey, setSesSecretAccessKey] = useState("")
  const [useSesIamRole, setUseSesIamRole] = useState(false)
  const [emailTransport, setEmailTransport] = useState<GlobalConfig["emailTransport"]>("resend")
  const [emailFrom, setEmailFrom] = useState("")
  const [sesRegion, setSesRegion] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    try {
      const [global, recent, attempts] = await Promise.all([
        notificationApi.global(token), notificationApi.events(token), notificationApi.deliveries(token),
      ])
      setSettings(global)
      setConfig(global.config)
      setEvents(recent)
      setDeliveries(attempts)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notification settings")
    }
  }, [token])

  useEffect(() => { if (token && user?.role === "admin") void load() }, [token, user?.role, load])
  useEffect(() => {
    if (!socket || !token || user?.role !== "admin") return
    const onEvent = (event: AlertEvent) => setEvents(previous => [event, ...previous.filter(item => item.id !== event.id)].slice(0, 50))
    const refresh = () => { void notificationApi.events(token).then(setEvents).catch(() => {}) }
    socket.on("notification.event", onEvent)
    socket.on("connect", refresh)
    socket.on("stream.recovered", refresh)
    return () => { socket.off("notification.event", onEvent); socket.off("connect", refresh); socket.off("stream.recovered", refresh) }
  }, [socket, token, user?.role])

  function openForm(provider: Provider | null) {
    setSelectedProvider(provider)
    setFormOpen(true)
    setWebhookUrl("")
    setDiscordUrl("")
    setResendApiKey("")
    setSesAccessKeyId("")
    setSesSecretAccessKey("")
    setUseSesIamRole(false)
    setRecipients(config?.emailRecipients.join(", ") ?? "")
    setEmailTransport(provider === "email" && settings && isConfigured("email", settings) ? config?.emailTransport ?? "resend" : "resend")
    setEmailFrom(config?.emailFrom ?? "")
    setSesRegion(config?.sesRegion ?? "")
    setError("")
  }

  async function persist(next: GlobalConfig, extras: Parameters<typeof notificationApi.saveGlobal>[1] = { config: next }, success = "Settings saved") {
    if (!token) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const saved = await notificationApi.saveGlobal(token, { ...extras, config: next })
      setSettings(saved)
      setConfig(saved.config)
      setMessage(success)
      setFormOpen(false)
      setSelectedProvider(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings")
    } finally {
      setBusy(false)
    }
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!config || !selectedProvider) return
    const next: GlobalConfig = { ...config, providers: { ...config.providers, [selectedProvider]: true } }
    const extras: Parameters<typeof notificationApi.saveGlobal>[1] = { config: next }
    if (selectedProvider === "webhook" && webhookUrl.trim()) extras.webhookUrl = webhookUrl.trim()
    if (selectedProvider === "discord" && discordUrl.trim()) extras.discordUrl = discordUrl.trim()
    if (selectedProvider === "email") {
      next.emailTransport = emailTransport
      next.emailRecipients = recipients.split(",").map(value => value.trim()).filter(Boolean)
      next.emailFrom = emailFrom.trim()
      next.sesRegion = sesRegion.trim()
      if (resendApiKey.trim()) extras.resendApiKey = resendApiKey.trim()
      if (useSesIamRole) {
        extras.sesAccessKeyId = null
        extras.sesSecretAccessKey = null
      } else if (sesAccessKeyId.trim() || sesSecretAccessKey.trim()) {
        extras.sesAccessKeyId = sesAccessKeyId.trim()
        extras.sesSecretAccessKey = sesSecretAccessKey.trim()
      }
    }
    await persist(next, extras, `${providerNames[selectedProvider]} saved`)
  }

  async function removeProvider(provider: Provider) {
    if (!config) return
    const next: GlobalConfig = { ...config, providers: { ...config.providers, [provider]: false } }
    const extras: Parameters<typeof notificationApi.saveGlobal>[1] = { config: next }
    if (provider === "webhook") extras.webhookUrl = null
    if (provider === "discord") extras.discordUrl = null
    if (provider === "email") {
      next.emailRecipients = []
      next.emailFrom = ""
      next.sesRegion = ""
      extras.resendApiKey = null
      extras.sesAccessKeyId = null
      extras.sesSecretAccessKey = null
    }
    await persist(next, extras, `${providerNames[provider]} removed`)
  }

  async function testProvider(provider: Provider) {
    if (!token) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await notificationApi.test(token, provider)
      setMessage(`Test ${providerNames[provider].toLowerCase()} sent`)
      setDeliveries(await notificationApi.deliveries(token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send test alert")
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== "admin") return <p className="p-6 text-sm text-muted-foreground">Admin access is required to manage notifications.</p>
  if (!settings || !config) return <p className="p-6 text-sm text-muted-foreground">{error || "Loading notification settings…"}</p>

  const configured = (["webhook", "discord", "email"] as const).filter(provider => isConfigured(provider, settings))
  const available = (["webhook", "discord", "email"] as const).filter(provider => !isConfigured(provider, settings))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 pb-20 md:p-7">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div><h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Notifications</h2><p className="mt-1 text-[10px] text-muted-foreground">Global alerts and delivery destinations. Device overrides live in each device&apos;s settings.</p></div>
        <button type="button" onClick={() => void load()} aria-label="Refresh notifications" className={secondaryButton}><RefreshCw size={14} /></button>
      </div>

      {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
      {message && <p role="status" className="border border-primary/40 bg-primary/10 p-3 text-xs text-primary">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className={divider}><span className="h-px flex-1 bg-border" />Alert policy<span className="h-px flex-1 bg-border" /></div>
          <section className={card}>
            <div className={cardHeader}><h3 className={cardTitle}>Global rules</h3><Bell size={13} className="text-muted-foreground" /></div>
            <div className="space-y-4 p-4">
              <NotificationRuleEditor value={config} onChange={policy => setConfig({ ...config, ...policy })} global />
              <button type="button" className={`w-full ${primaryButton}`} disabled={busy} onClick={() => void persist(config, { config }, "Global rules saved")}>Save global rules</button>
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <div className={divider}><span className="h-px flex-1 bg-border" />Delivery<span className="h-px flex-1 bg-border" /></div>

      <section className={card}>
        <div className={cardHeader}><h3 className={cardTitle}>Providers</h3><Send size={13} className="text-muted-foreground" /></div>
        <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground">Configured delivery destinations</p>
          <button type="button" className={`${primaryButton} flex items-center gap-2`} disabled={busy || available.length === 0} onClick={() => openForm(null)}><Plus size={13} /> Add provider</button>
        </div>
        {configured.length === 0 ? <div className="border border-border bg-secondary/30 p-5 text-center text-[10px] text-muted-foreground">No providers configured yet. Add one to receive alerts.</div> : (
          <div className="space-y-3">
            {configured.map(provider => (
              <div key={provider} className="border border-border bg-secondary/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><span className="border border-primary/30 bg-secondary p-2 text-primary">{provider === "email" ? <Mail size={15} /> : <Webhook size={15} />}</span><div><h4 className="text-xs text-foreground">{providerNames[provider]}</h4><p className="mt-1 text-[10px] text-muted-foreground">{provider === "email" ? `${config.emailTransport.toUpperCase()} · ${config.emailRecipients.length} recipient${config.emailRecipients.length === 1 ? "" : "s"}` : "Destination configured"}</p></div></div>
                  <span className={`text-[10px] uppercase tracking-wider ${config.providers[provider] ? "text-primary" : "text-muted-foreground"}`}>{config.providers[provider] ? "Active" : "Paused"}</span>
                </div>
                <div className="mt-3 border-t border-border"><SettingSwitch label={`Enable ${providerNames[provider]}`} checked={config.providers[provider]} onChange={checked => void persist({ ...config, providers: { ...config.providers, [provider]: checked } }, { config }, `${providerNames[provider]} ${checked ? "enabled" : "paused"}`)} disabled={busy} /></div>
                <div className="mt-3 flex flex-wrap gap-2"><button className={secondaryButton} disabled={busy} onClick={() => openForm(provider)}>Edit</button><button className={secondaryButton} disabled={busy || !config.providers[provider]} onClick={() => void testProvider(provider)}><span className="flex items-center gap-1"><Send size={12} /> Test</span></button><button className={`${secondaryButton} hover:text-red-300`} disabled={busy} onClick={() => void removeProvider(provider)}>Remove</button></div>
              </div>
            ))}
          </div>
        )}

        {formOpen && <div className="border border-primary/30 bg-secondary/30 p-4">
          <div className="mb-4 flex items-center justify-between"><div><h4 className="text-xs font-bold uppercase tracking-[.18em] text-primary">{selectedProvider && isConfigured(selectedProvider, settings) ? `Edit ${providerNames[selectedProvider]}` : "Add provider"}</h4><p className="mt-1 text-[11px] text-muted-foreground">{selectedProvider ? providerDescriptions[selectedProvider] : "Choose a delivery type to continue."}</p></div><button type="button" aria-label="Close provider form" className="text-muted-foreground hover:text-foreground" onClick={() => setFormOpen(false)}><X size={16} /></button></div>
          {!selectedProvider ? <div className="grid gap-2">{available.map(provider => <button type="button" key={provider} onClick={() => setSelectedProvider(provider)} className="border border-border bg-secondary/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"><span className="text-xs text-foreground">{providerNames[provider]}</span><span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">{providerDescriptions[provider]}</span></button>)}</div> : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={event => void saveProvider(event)}>
              {selectedProvider === "webhook" && <label className="text-xs text-muted-foreground md:col-span-2">Webhook URL<input type="url" className={input} value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} required={!settings.webhookConfigured} placeholder="https://example.com/scope-alerts" /><span className="mt-1 block text-[11px]">Leave blank to retain the saved URL when editing.</span></label>}
              {selectedProvider === "discord" && <label className="text-xs text-muted-foreground md:col-span-2">Discord webhook URL<input type="url" className={input} value={discordUrl} onChange={event => setDiscordUrl(event.target.value)} required={!settings.discordConfigured} placeholder="https://discord.com/api/webhooks/..." /><span className="mt-1 block text-[11px]">Leave blank to retain the saved URL when editing.</span></label>}
              {selectedProvider === "email" && <>
                <label className="text-xs text-muted-foreground md:col-span-2">Recipients (comma separated)<input className={input} value={recipients} onChange={event => setRecipients(event.target.value)} required placeholder="ops@example.com, you@example.com" /></label>
                <label className="text-xs text-muted-foreground">Email service<select className={input} value={emailTransport} onChange={event => setEmailTransport(event.target.value as GlobalConfig["emailTransport"])}><option value="resend">Resend API</option><option value="ses">Amazon SES</option><option value="smtp">SMTP relay</option></select></label>
                {emailTransport === "smtp" ? <p className="self-end text-xs text-muted-foreground">SMTP is {settings.smtpConfigured ? "configured" : "not configured"} on the backend. Set SCOPE_SMTP_HOST and SCOPE_SMTP_FROM on every replica.</p> : <>
                  <label className="text-xs text-muted-foreground">Verified sender address<input type="email" className={input} value={emailFrom} onChange={event => setEmailFrom(event.target.value)} required placeholder="alerts@example.com" /></label>
                  {emailTransport === "resend" ? <label className="text-xs text-muted-foreground md:col-span-2">Resend API key {settings.resendConfigured && <span className="text-primary">· saved</span>}<input type="password" autoComplete="off" className={input} value={resendApiKey} onChange={event => setResendApiKey(event.target.value)} required={!settings.resendConfigured} placeholder="re_..." /><span className="mt-1 block text-[11px]">Leave blank to keep the saved key.</span></label> : <>
                    <label className="text-xs text-muted-foreground">AWS region<input className={input} value={sesRegion} onChange={event => setSesRegion(event.target.value)} required placeholder="eu-west-1" /></label>
                    <div className="md:col-span-2"><SettingSwitch label="Use the backend IAM role" description="Remove saved access keys and use the backend's assigned role." checked={useSesIamRole} onChange={setUseSesIamRole} /></div>
                    {!useSesIamRole && <><label className="text-xs text-muted-foreground">AWS access key ID {settings.sesCredentialsConfigured && <span className="text-primary">· saved</span>}<input type="password" autoComplete="off" className={input} value={sesAccessKeyId} onChange={event => setSesAccessKeyId(event.target.value)} placeholder="AKIA..." /></label><label className="text-xs text-muted-foreground">AWS secret access key<input type="password" autoComplete="off" className={input} value={sesSecretAccessKey} onChange={event => setSesSecretAccessKey(event.target.value)} placeholder="Secret access key" /></label><p className="text-[11px] text-muted-foreground md:col-span-2">Enter both keys or leave both blank to retain saved keys or use the backend IAM role.</p></>}
                  </>}
                </>}
              </>}
              <div className="flex gap-2 md:col-span-2"><button type="submit" className={primaryButton} disabled={busy}>Save provider</button><button type="button" className={secondaryButton} onClick={() => setFormOpen(false)}>Cancel</button></div>
            </form>
          )}
        </div>}
        <p className="border-t border-border pt-3 text-[10px] text-muted-foreground">A test sends a real alert to the selected destination.</p>
        </div>
      </section>
        </div>
      </div>

      <div className={divider}><span className="h-px flex-1 bg-border" />Activity<span className="h-px flex-1 bg-border" /></div>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className={card}><div className={cardHeader}><h3 className={cardTitle}>Recent alerts</h3><Bell size={13} className="text-muted-foreground" /></div><div className="p-4">{events.length ? <div className="space-y-3">{events.map(event => <div key={event.id} className="border-b border-border pb-3 last:border-0"><div className="flex justify-between gap-3 text-[10px]"><span className={event.severity === "critical" ? "text-red-400" : event.severity === "warning" ? "text-amber-400" : "text-primary"}>{event.message}</span><time className="shrink-0 text-muted-foreground">{new Date(event.time).toLocaleString()}</time></div><p className="mt-1 text-[10px] text-muted-foreground">{event.deviceName}</p></div>)}</div> : <p className="text-[10px] text-muted-foreground">No alerts yet.</p>}</div></div>
        <div className={card}><div className={cardHeader}><h3 className={cardTitle}>Delivery attempts</h3><Send size={13} className="text-muted-foreground" /></div><div className="p-4">{deliveries.length ? <div className="space-y-3">{deliveries.map(delivery => <div key={delivery.id} className="flex justify-between gap-3 border-b border-border pb-3 text-[10px] last:border-0"><div><span className="uppercase">{delivery.provider}</span><span className="ml-2 text-muted-foreground">{delivery.attempts} attempt(s)</span>{delivery.lastError && <p className="text-red-400">{delivery.lastError}</p>}</div><span className={delivery.status === "sent" ? "text-primary" : delivery.status === "failed" ? "text-red-400" : "text-amber-400"}>{delivery.status}</span></div>)}</div> : <p className="text-[10px] text-muted-foreground">No deliveries yet.</p>}</div></div>
      </section>
    </div>
  )
}
