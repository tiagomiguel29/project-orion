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
import { createDevice } from "@/lib/dashboard-service"
import { cn } from "@/lib/utils"

interface AddDeviceDialogProps {
  onDeviceCreated?: () => void
}

export function AddDeviceDialog({ onDeviceCreated }: AddDeviceDialogProps) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"form" | "result">("form")

  // Form state
  const [externalId, setExternalId] = useState("")
  const [hostname, setHostname] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Result state
  const [agentToken, setAgentToken] = useState("")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function reset() {
    setStep("form")
    setExternalId("")
    setHostname("")
    setError("")
    setLoading(false)
    setAgentToken("")
    setCopiedKey(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const trimmedId = externalId.trim()
    if (trimmedId.length < 3) {
      setError("Device ID must be at least 3 characters")
      return
    }

    setError("")
    setLoading(true)

    try {
      const result = await createDevice(token, {
        externalId: trimmedId,
        hostname: hostname.trim() || undefined,
      })
      setAgentToken(result.token)
      setStep("result")
      onDeviceCreated?.()
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

  // Derive the ingestion endpoint from the API URL host (TLS via the reverse
  // proxy on 443). Falls back to a placeholder the operator can edit.
  const backendHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").hostname || "<your-backend-host>"
    } catch {
      return "<your-backend-host>"
    }
  })()
  const agentServerAddress = `${backendHost}:443`

  const envVars = [
    `AGENT_DEVICE_ID=${externalId.trim()}`,
    `AGENT_ENROLLMENT_TOKEN=${agentToken}`,
    `AGENT_SERVER_ADDRESS=${agentServerAddress}`,
    `AGENT_TLS_INSECURE_SKIP_VERIFY=true`,
  ].join("\n")

  // One-liner mirroring apps/agent/docker-compose.yaml — deploy the agent on a
  // target machine with a single copy-paste.
  const deployCommand = [
    "docker run -d --name project-orion-agent --restart unless-stopped",
    "  --privileged --network host --pid host --read-only --tmpfs /tmp",
    `  -e AGENT_DEVICE_ID=${externalId.trim()}`,
    `  -e AGENT_ENROLLMENT_TOKEN=${agentToken}`,
    `  -e AGENT_SERVER_ADDRESS=${agentServerAddress}`,
    "  -e AGENT_TLS_INSECURE_SKIP_VERIFY=true",
    "  -e HOST_PROC=/host/proc -e HOST_SYS=/host/sys -e HOST_ETC=/host/etc",
    "  -e AGENT_DISK_PATH=/host -e AGENT_WAL_PATH=/var/lib/orion-agent/wal.db",
    "  -v /var/run/docker.sock:/var/run/docker.sock:ro",
    "  -v /proc:/host/proc:ro -v /sys:/host/sys:ro -v /etc:/host/etc:ro -v /:/host:ro",
    "  -v orion-agent-wal:/var/lib/orion-agent",
    "  ghcr.io/tiagomiguel29/project-orion-agent:latest",
  ].join(" \\\n")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary border border-border hover:border-primary/50 bg-card/50 transition-colors"
          aria-label="Add device"
        >
          <Plus className="h-3 w-3" />
          Add Device
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md border-border bg-card overflow-hidden" showCloseButton={step === "form"}>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                <Monitor className="h-4 w-4 text-primary" />
                Register Device
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create a new device and get an agent enrollment token for it.
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
                />
                <p className="text-[10px] text-muted-foreground">
                  Unique identifier for the agent. Min 3 characters.
                </p>
              </div>

              <div className="space-y-2">
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
              </div>

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
                  {loading ? "Creating..." : "Create Device"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                <Check className="h-4 w-4 text-[#4ade80]" />
                Device Created
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Use this enrollment token to configure the agent. It will not be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Agent Enrollment Token
                </Label>
                <div className="relative">
                  <pre className="bg-background border border-border p-3 pr-10 text-[11px] font-mono text-foreground break-all whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {agentToken}
                  </pre>
                  <button
                    onClick={() => copy(agentToken, "token")}
                    className="absolute top-2 right-2 p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Copy enrollment token"
                  >
                    {copiedKey === "token" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Rocket className="h-3 w-3 inline mr-1" />
                  One-Click Deploy (Docker)
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Run on the target machine — Docker required. Buffers locally and reconnects on its own.
                </p>
                <div className="relative">
                  <pre className="bg-background border border-border p-3 pr-10 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {deployCommand}
                  </pre>
                  <button
                    onClick={() => copy(deployCommand, "deploy")}
                    className="absolute top-2 right-2 p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Copy deploy command"
                  >
                    {copiedKey === "deploy" ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Terminal className="h-3 w-3 inline mr-1" />
                  Or set environment variables
                </Label>
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
                  Drop <span className="font-mono">AGENT_TLS_INSECURE_SKIP_VERIFY</span> once the backend uses a trusted certificate.
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
