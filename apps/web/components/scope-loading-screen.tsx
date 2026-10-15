import { Monitor, RefreshCw } from "lucide-react"

interface ScopeLoadingScreenProps {
  message: string
  detail?: string
  onRetry?: () => void
}

export function ScopeLoadingScreen({ message, detail, onRetry }: ScopeLoadingScreenProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background grid-overlay px-5 text-foreground">
      <div className="pointer-events-none absolute inset-0 scanline" />
      <div className="absolute left-5 top-5 text-[9px] uppercase tracking-widest text-muted-foreground">A1</div>
      <div className="absolute bottom-5 left-5 text-[9px] uppercase tracking-widest text-muted-foreground">Scope v1.0.0</div>

      <div className="relative w-full max-w-sm border border-border bg-card corner-marks" role={onRetry ? "alert" : "status"}>
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">System startup</span>
          <span className={`h-1.5 w-1.5 rounded-full ${onRetry ? "bg-destructive" : "bg-primary animate-ping-slow"}`} />
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="border border-primary/30 bg-secondary p-2.5"><Monitor className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs font-bold tracking-wider">[SCOPE]</p>
            <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">Infrastructure monitor</p>
          </div>
        </div>
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-foreground">{message}</p>
          {detail && <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="mt-4 flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/20">
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          ) : <div className="mt-4 h-px overflow-hidden bg-border"><div className="h-full w-1/3 animate-pulse bg-primary" /></div>}
        </div>
      </div>
    </main>
  )
}
