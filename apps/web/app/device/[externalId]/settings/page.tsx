"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bell, Settings2 } from "lucide-react"
import { AuthGuard } from "@/components/guards/auth-guard"
import { useAuth } from "@/components/auth-provider"
import { DashboardHeader } from "@/components/dashboard-header"
import { DeviceChannelEditor, NotificationRuleEditor, SettingSwitch } from "@/components/notification-policy-editor"
import { notificationApi, type DeviceSettings, type GlobalSettings, type Policy } from "@/lib/notification-service"

const card = "relative border border-border bg-card corner-marks"
const button = "border border-primary/40 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/20 disabled:opacity-40"

function DeviceSettingsContent({ externalId }: { externalId: string }) {
  const router = useRouter()
  const { token, user, logout } = useAuth()
  const [global, setGlobal] = useState<GlobalSettings | null>(null)
  const [device, setDevice] = useState<DeviceSettings | null>(null)
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState<Policy | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token || user?.role !== "admin") return
    let cancelled = false
    Promise.all([notificationApi.global(token), notificationApi.device(token, externalId)])
      .then(([globalSettings, deviceSettings]) => {
        if (cancelled) return
        setGlobal(globalSettings)
        setDevice(deviceSettings)
        setCustom(deviceSettings.override !== null)
        setDraft(deviceSettings.override ?? deviceSettings.effective)
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load device settings") })
    return () => { cancelled = true }
  }, [token, user?.role, externalId])

  async function save() {
    if (!token || !draft) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const saved = custom
        ? await notificationApi.saveDevice(token, externalId, draft)
        : await notificationApi.resetDevice(token, externalId)
      setDevice(saved)
      setCustom(saved.override !== null)
      setDraft(saved.override ?? saved.effective)
      setMessage(custom ? "Device override saved" : "Device now uses global settings")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save device settings")
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== "admin") return <p className="p-6 text-sm text-muted-foreground">Admin access is required to manage device settings.</p>

  return (
    <div className="min-h-screen bg-background grid-overlay text-foreground">
      <DashboardHeader section="Device settings" name={user?.name} email={user?.email}
        onLogout={() => { logout(); router.push("/") }} onSettingsClick={() => router.push("/settings?tab=account")} />
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-5 py-3">
        <button type="button" onClick={() => router.push(`/device/${encodeURIComponent(externalId)}`)} aria-label="Back to device" className="text-muted-foreground hover:text-primary"><ArrowLeft size={17} /></button>
        <Settings2 size={17} className="text-primary" />
        <div><h1 className="text-sm font-bold uppercase tracking-[.2em]">Device settings</h1><p className="text-[11px] text-muted-foreground">{externalId}</p></div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-5 pb-20 md:p-7">
        {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
        {message && <p role="status" className="border border-primary/40 bg-primary/10 p-3 text-xs text-primary">{message}</p>}
        {!device || !global || !draft ? <p className="text-sm text-muted-foreground">{error ? "" : "Loading device settings…"}</p> : <>
          <section className={card}>
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2"><h2 className="text-[9px] uppercase tracking-widest text-muted-foreground">Notification override</h2><Bell size={13} className="text-muted-foreground" /></div>
            <div className="px-4"><SettingSwitch label="Use custom notification settings" description="When off, this device follows the global notification policy." checked={custom} onChange={checked => { setCustom(checked); if (checked && !device.override) setDraft(structuredClone(device.effective)) }} /></div>
          </section>
          {custom && <div className="grid gap-6 lg:grid-cols-2">
            <section className={card}><div className="border-b border-border bg-secondary/50 px-4 py-2"><h2 className="text-[9px] uppercase tracking-widest text-muted-foreground">Triggers and thresholds</h2></div><div className="p-4"><NotificationRuleEditor value={draft} onChange={setDraft} /></div></section>
            <section className={card}><div className="border-b border-border bg-secondary/50 px-4 py-2"><h2 className="text-[9px] uppercase tracking-widest text-muted-foreground">Delivery channels</h2></div><div className="p-4"><DeviceChannelEditor value={draft} globalProviders={global.config.providers} onChange={setDraft} /><p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">Global provider switches remain the master controls.</p></div></section>
          </div>}
          <div className="flex items-center gap-3"><button type="button" className={button} disabled={busy} onClick={() => void save()}>Save device settings</button>{device.override && <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => { setCustom(false); setDraft(device.effective) }}>Use global settings</button>}</div>
        </>}
      </main>
    </div>
  )
}

export default function DeviceSettingsPage({ params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = use(params)
  return <AuthGuard><DeviceSettingsContent externalId={externalId} /></AuthGuard>
}
