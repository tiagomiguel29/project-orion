"use client"

import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/components/auth-provider"
import { deleteDevice } from "@/lib/dashboard-service"

interface DeleteDeviceDialogProps {
  externalId: string
  hostname?: string
  onDeleted?: () => void
}

export function DeleteDeviceDialog({ externalId, hostname, onDeleted }: DeleteDeviceDialogProps) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const displayName = hostname || externalId

  async function handleDelete() {
    if (!token) return

    setError("")
    setLoading(true)

    try {
      await deleteDevice(token, externalId)
      setOpen(false)
      onDeleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete device")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Delete ${displayName}`}
          title="Delete device"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Delete Device
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-xs text-muted-foreground">
              <p>
                The agent will no longer be able to connect.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-destructive font-medium">
                  The following will be permanently deleted:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-destructive/80 text-[11px]">
                  <li>Device registration and agent token</li>
                  <li>All metric history and event logs</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-[10px] text-destructive uppercase tracking-wider">{error}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="text-[10px] uppercase tracking-widest"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/90 text-[10px] uppercase tracking-widest"
          >
            {loading ? "Deleting..." : "Delete Device"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
