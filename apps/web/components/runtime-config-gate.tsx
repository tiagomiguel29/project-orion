"use client"

import { useEffect, useState, type ReactNode } from "react"
import { setRuntimeConfig, type RuntimeConfig } from "@/lib/runtime-config"

export function RuntimeConfigGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/runtime-config", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Runtime configuration unavailable")
        return response.json() as Promise<RuntimeConfig>
      })
      .then((config) => {
        if (!config.apiUrl) throw new Error("API URL is missing")
        setRuntimeConfig(config)
        setReady(true)
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== "AbortError") setError(true)
      })
    return () => controller.abort()
  }, [])

  if (error) return <p role="alert">Scope could not load its connection settings. Refresh the page or check the web container.</p>
  if (!ready) return <p role="status">Connecting to Scope…</p>
  return children
}
