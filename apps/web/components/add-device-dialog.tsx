"use client"

import { useState } from "react"
import { Plus, Copy, Check, Monitor, Terminal } from "lucide-react"
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
  const [copied, setCopied] = useState(false)

  function reset() {
    setStep("form")
    setExternalId("")
    setHostname("")
    setError("")
    setLoading(false)
    setAgentToken("")
    setCopied(false)
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

  async function handleCopy() {
    await navigator.clipboard.writeText(agentToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
                Create a new device and get an agent token for it.
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
                Use this token to configure the agent. It will not be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Agent Token
                </Label>
                <div className="relative">
                  <pre className="bg-background border border-border p-3 pr-10 text-[11px] font-mono text-foreground break-all whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {agentToken}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Copy token"
                  >
                    {copied ? (
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
                  Agent Environment Variables
                </Label>
                <pre className={cn(
                  "bg-background border border-border p-3 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all overflow-x-hidden"
                )}>
{`AGENT_DEVICE_ID=${externalId.trim()}
AGENT_TOKEN=${agentToken}
AGENT_SERVER_ADDRESS=<your-backend-url>:50051`}
                </pre>
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
