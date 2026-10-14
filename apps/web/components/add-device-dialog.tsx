"use client"

import { useState } from "react"
import { Plus, Copy, Check, Monitor, Terminal, Rocket } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { getAgentConnection, getAgentInstallCommand } from "@/lib/agent-config"
import { getRuntimeConfig } from "@/lib/runtime-config"

interface AddDeviceDialogProps {
  onDeviceCreated?: () => void
  existingDeviceId?: string
}

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

      <DialogContent className="sm:max-w-md border-border bg-card overflow-hidden" showCloseButton={step === "form"}>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                <Monitor className="h-4 w-4 text-primary" />
                {existingDeviceId ? "Install Agent" : "Register Device"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {existingDeviceId ? "Generate a fresh one-time install command for this device." : "Create a new device and get an agent enrollment token for it."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="externalId" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Device ID
                </Label>
                <Input
                  id="externalId"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="e.g. prod-server-1"
                  className="bg-background border-border text-sm font-mono"
                  autoFocus
                  required
                  minLength={3}
                  disabled={Boolean(existingDeviceId)}
                />
                <p className="text-[10px] text-muted-foreground">3–64 letters, numbers, dots, underscores or hyphens.</p>
              </div>

              {!existingDeviceId && <div className="space-y-2">
                <Label htmlFor="hostname" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Hostname <span className="text-muted-foreground/50">(optional)</span>
                </Label>
                <Input
                  id="hostname"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="e.g. my-server.local"
                  className="bg-background border-border text-sm font-mono"
                />
              </div>}

              {error && (
                <p className="text-[10px] text-destructive uppercase tracking-wider">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className="text-[10px] uppercase tracking-widest"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="text-[10px] uppercase tracking-widest"
                >
                  {loading ? "Preparing..." : existingDeviceId ? "Generate Command" : "Create Device"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                <Check className="h-4 w-4 text-[#4ade80]" />
                {existingDeviceId ? "Install Command Ready" : "Device Created"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Install the agent with one command on the machine you want to monitor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Rocket className="h-3 w-3 inline mr-1" />
                  Install Scope agent
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Linux or macOS. The pairing code expires in 10 minutes and works once. No repository clone or Go installation is needed.
                </p>
                <Label htmlFor="agent-api-url" className="text-[10px] uppercase tracking-widest text-muted-foreground">Backend URL reachable from the target machine</Label>
                <Input id="agent-api-url" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} className="bg-background border-border text-xs font-mono" />
                <Label htmlFor="agent-grpc-address" className="text-[10px] uppercase tracking-widest text-muted-foreground">Agent gRPC address</Label>
                <Input id="agent-grpc-address" value={agentAddress} onChange={e => setAgentAddress(e.target.value)} className="bg-background border-border text-xs font-mono" />
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <input type="checkbox" checked={tlsDisable} onChange={e => setTlsDisable(e.target.checked)} />
                  Localhost plaintext gRPC (development only)
                </label>
                <div className="relative">
                  <pre className="bg-background border border-border p-3 pr-10 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {installCommand}
                  </pre>
                  <button
                    onClick={() => copy(installCommand, "deploy")}
                    className="absolute top-2 right-2 p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Copy install command"
                  >
                    {copiedKey === "deploy" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">For another machine, replace localhost with the backend’s reachable HTTPS and gRPC addresses before copying.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Terminal className="h-3 w-3 inline mr-1" /> Manual configuration
                </Label>
                <p className="text-[10px] text-muted-foreground">The enrollment token is shown only here. Store it securely if you configure the agent manually.</p>
                <div className="relative">
                  <pre className={cn(
                    "bg-background border border-border p-3 pr-10 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all overflow-x-hidden"
                  )}>
                    {envVars}
                  </pre>
                  <button
                    onClick={() => copy(envVars, "env")}
                    className="absolute top-2 right-2 p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Copy environment variables"
                  >
                    {copiedKey === "env" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">
                  The agent requires a trusted TLS certificate outside localhost.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className="text-[10px] uppercase tracking-widest"
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
