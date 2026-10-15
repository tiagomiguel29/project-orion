"use client"

import { Switch } from "@/components/ui/switch"
import type { Policy, Provider } from "@/lib/notification-service"

const inputClass = "mt-1 w-full border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"

export function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {description && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export function NotificationRuleEditor({
  value,
  onChange,
  global = false,
}: {
  value: Policy
  onChange: (policy: Policy) => void
  global?: boolean
}) {
  const setRule = (name: keyof Policy["rules"], val: boolean | number) =>
    onChange({ ...value, rules: { ...value.rules, [name]: val } })

  return (
    <div className="space-y-5">
      <div>
        <SettingSwitch
          label="Enable notifications"
          description={global ? "Master switch for alerts across all devices." : "Allow alerts for this device when global notifications are enabled."}
          checked={value.enabled}
          onChange={enabled => onChange({ ...value, enabled })}
        />
        <SettingSwitch label="Agent offline" checked={value.rules.offline} onChange={checked => setRule("offline", checked)} />
        <SettingSwitch label="Send recovery alerts" checked={value.rules.recovery} onChange={checked => setRule("recovery", checked)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {([
          ["offlineAfterSec", "Offline after (seconds)", 10, 3600],
          ["cpuPct", "CPU usage (%)", 1, 100],
          ["ramPct", "Memory usage (%)", 1, 100],
          ["diskPct", "Disk usage (%)", 1, 100],
          ["temperatureC", "CPU temperature (°C)", 1, 150],
        ] as const).map(([key, label, min, max]) => (
          <label key={key} className="text-[11px] text-muted-foreground">
            {label}
            <input className={inputClass} type="number" min={min} max={max} value={value.rules[key]}
              onChange={event => setRule(key, Number(event.target.value))} />
          </label>
        ))}
      </div>
      {global && <p className="text-[11px] text-muted-foreground">The offline timeout also determines when Scope marks an agent offline.</p>}
    </div>
  )
}

export function DeviceChannelEditor({
  value,
  globalProviders,
  onChange,
}: {
  value: Policy
  globalProviders: Record<Provider, boolean>
  onChange: (policy: Policy) => void
}) {
  return (
    <div>
      {(["webhook", "discord", "email"] as const).map(provider => (
        <SettingSwitch
          key={provider}
          label={provider === "email" ? "Email" : provider === "discord" ? "Discord" : "Webhook"}
          description={!globalProviders[provider] ? "Enable this provider in global settings first." : undefined}
          checked={value.providers[provider]}
          disabled={!globalProviders[provider]}
          onChange={checked => onChange({ ...value, providers: { ...value.providers, [provider]: checked } })}
        />
      ))}
    </div>
  )
}
