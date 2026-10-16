"use client"

import { useState } from "react"
import { Plus, Copy, Check, Monitor, Terminal, Rocket, X, ShieldCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { createDevice, createPairingCode } from "@/lib/dashboard-service"
import { getAgentConnection, getAgentInstallCommand } from "@/lib/agent-config"
import { getRuntimeConfig } from "@/lib/runtime-config"

interface AddDeviceDialogProps {
  onDeviceCreated?: () => void
  existingDeviceId?: string
}

const fieldClass = "h-9 rounded-none border-border bg-secondary px-3 font-mono text-xs text-foreground focus-visible:border-primary/50 focus-visible:ring-0"
const fieldLabelClass = "text-[9px] uppercase tracking-widest text-muted-foreground"
const secondaryButtonClass = "h-9 rounded-none border border-border bg-secondary px-3 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary/40 hover:bg-secondary hover:text-foreground"
const primaryButtonClass = "h-9 rounded-none border border-primary/40 bg-primary/10 px-4 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/20 disabled:opacity-40"

export function AddDeviceDialog({ onDeviceCreated, existingDeviceId }: AddDeviceDialogProps) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"form" | "result">("form")

  // Form state
  const [externalId, setExternalId] = useState(existingDeviceId ?? "")
  const [hostname, setHostname] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Result state
  const [agentToken, setAgentToken] = useState("")
  const [pairingCode, setPairingCode] = useState("")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const runtimeConfig = getRuntimeConfig()
  const defaultApiUrl = runtimeConfig.apiUrl
  const defaultConnection = getAgentConnection(
    defaultApiUrl,
    runtimeConfig.agentServerAddress,
    runtimeConfig.agentTlsDisable,
  )
  const [backendUrl, setBackendUrl] = useState(defaultApiUrl)
  const [agentAddress, setAgentAddress] = useState(defaultConnection.address)
  const [tlsDisable, setTlsDisable] = useState(defaultConnection.tlsDisable)

  function reset() {
    setStep("form")
    setExternalId(existingDeviceId ?? "")
    setHostname("")
    setError("")
    setLoading(false)
    setAgentToken("")
    setPairingCode("")
    setCopiedKey(null)
    setBackendUrl(defaultApiUrl)
    setAgentAddress(defaultConnection.address)
    setTlsDisable(defaultConnection.tlsDisable)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const trimmedId = externalId.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(trimmedId)) {
      setError("Use 3–64 letters, numbers, dots, underscores or hyphens for the device ID")
      return
    }

    setError("")
    setLoading(true)

    try {
      const result = existingDeviceId
        ? await createPairingCode(token, existingDeviceId)
        : await createDevice(token, { externalId: trimmedId, hostname: hostname.trim() || undefined })
      setAgentToken(result.token)
      setPairingCode(result.pairingCode)
      setStep("result")
      if (!existingDeviceId) onDeviceCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create device")
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const normalizedBackendUrl = backendUrl.trim().replace(/\/+$/, "")
  const normalizedAgentAddress = agentAddress.trim()
  const installCommand = getAgentInstallCommand({ backendUrl: normalizedBackendUrl, grpcAddress: normalizedAgentAddress, deviceId: externalId, pairingCode, tlsDisable })

  const envVars = [
    `AGENT_DEVICE_ID=${externalId.trim()}`,
    `AGENT_ENROLLMENT_TOKEN=${agentToken}`,
    `AGENT_SERVER_ADDRESS=${normalizedAgentAddress}`,
    `AGENT_TLS_DISABLE=${tlsDisable}`,
  ].join("\n")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary border border-border hover:border-primary/50 bg-card/50 transition-colors"
          aria-label={existingDeviceId ? "Install agent" : "Add device"}
        >
          {existingDeviceId ? <Terminal className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {existingDeviceId ? "Install agent" : "Add Device"}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden rounded-none border-border bg-card p-0 shadow-2xl sm:max-w-xl corner-marks" showCloseButton={false}>
        {step === "form" ? (
          <>
            <DialogHeader className="gap-0 text-left">
              <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Devices // Enrollment</span>
                <button type="button" onClick={() => handleOpenChange(false)} aria-label="Close add device dialog" className="text-muted-foreground transition-colors hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="border border-primary/30 bg-secondary p-2"><Monitor className="h-4 w-4 text-primary" /></div>
                <div>
                  <DialogTitle className="text-sm font-bold uppercase tracking-wider text-foreground">{existingDeviceId ? "Install Agent" : "Register Device"}</DialogTitle>
                  <DialogDescription className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {existingDeviceId ? "Generate a fresh one-time install command for this device." : "Create a new device and get an agent enrollment token for it."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor="externalId" className={fieldLabelClass}>
                  Device ID
                </Label>
                <Input
                  id="externalId"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="e.g. prod-server-1"
                  className={fieldClass}
                  autoFocus
                  required
                  minLength={3}
                  disabled={Boolean(existingDeviceId)}
                />
                <p className="text-[10px] text-muted-foreground">3–64 letters, numbers, dots, underscores or hyphens.</p>
              </div>

              {!existingDeviceId && <div className="space-y-2">
                <Label htmlFor="hostname" className={fieldLabelClass}>
                  Hostname <span className="text-muted-foreground/50">(optional)</span>
                </Label>
                <Input
                  id="hostname"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="e.g. my-server.local"
                  className={fieldClass}
                />
              </div>}

              {error && (
                <p role="alert" className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-[10px] text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className={primaryButtonClass}
                >
                  {loading ? "Preparing..." : existingDeviceId ? "Generate Command" : "Create Device"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader className="gap-0 text-left">
              <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Devices // Agent setup</span>
                <ShieldCheck className="h-3 w-3 text-primary" />
              </div>
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="border border-primary/30 bg-secondary p-2"><Check className="h-4 w-4 text-primary" /></div>
                <div>
                  <DialogTitle className="text-sm font-bold uppercase tracking-wider text-foreground">{existingDeviceId ? "Install Command Ready" : "Device Created"}</DialogTitle>
                  <DialogDescription className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Install the agent with one command on the machine you want to monitor.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[calc(100dvh-9rem)] space-y-5 overflow-y-auto p-5">
              <div className="space-y-3">
                <Label className={fieldLabelClass}>
                  <Rocket className="h-3 w-3 inline mr-1" />
                  Install Scope agent
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Linux or macOS. The pairing code expires in 10 minutes and works once. No repository clone or Go installation is needed.
                </p>
                <Label htmlFor="agent-api-url" className={fieldLabelClass}>Backend URL reachable from the target machine</Label>
                <Input id="agent-api-url" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} className={fieldClass} />
                <Label htmlFor="agent-grpc-address" className={fieldLabelClass}>Agent gRPC address</Label>
                <Input id="agent-grpc-address" value={agentAddress} onChange={e => setAgentAddress(e.target.value)} className={fieldClass} />
                <label className="flex items-center gap-2 border border-border bg-secondary/40 px-3 py-2 text-[10px] text-muted-foreground">
                  <input type="checkbox" checked={tlsDisable} onChange={e => setTlsDisable(e.target.checked)} className="accent-primary" />
                  Localhost plaintext gRPC (development only)
                </label>
                <div className="relative">
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-border bg-secondary/40 p-3 pr-10 font-mono text-[11px] text-foreground">
                    {installCommand}
                  </pre>
                  <button
                    onClick={() => copy(installCommand, "deploy")}
                    className="absolute right-2 top-2 border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    aria-label="Copy install command"
                  >
                    {copiedKey === "deploy" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">For another machine, replace localhost with the backend’s reachable HTTPS and gRPC addresses before copying.</p>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <Label className={fieldLabelClass}>
                  <Terminal className="h-3 w-3 inline mr-1" /> Manual configuration
                </Label>
                <p className="text-[10px] text-muted-foreground">The enrollment token is shown only here. Store it securely if you configure the agent manually.</p>
                <div className="relative">
                  <pre className="overflow-x-hidden whitespace-pre-wrap break-all border border-border bg-secondary/40 p-3 pr-10 font-mono text-[11px] text-foreground">
                    {envVars}
                  </pre>
                  <button
                    onClick={() => copy(envVars, "env")}
                    className="absolute right-2 top-2 border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    aria-label="Copy environment variables"
                  >
                    {copiedKey === "env" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The agent requires a trusted TLS certificate outside localhost.
                </p>
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className={primaryButtonClass}
                >
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
