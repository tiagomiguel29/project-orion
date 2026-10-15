"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Bell, Settings2, UserRound } from "lucide-react"
import { AuthGuard } from "@/components/guards/auth-guard"
import { useAuth } from "@/components/auth-provider"
import { ProfilePage } from "@/components/profile-page"
import { NotificationSettingsPanel } from "@/components/notification-settings-panel"

function SettingsContent() {
  const router = useRouter()
  const search = useSearchParams()
  const { user } = useAuth()
  const tab = search.get("tab") === "notifications" && user?.role === "admin" ? "notifications" : "account"

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/95">
        <div className="flex items-center gap-3 px-5 py-4">
          <button type="button" onClick={() => router.push("/")} aria-label="Back to dashboard" className="text-muted-foreground hover:text-primary"><ArrowLeft size={17} /></button>
          <Settings2 size={17} className="text-primary" />
          <div><h1 className="text-sm font-bold uppercase tracking-[.2em]">Settings</h1><p className="text-[11px] text-muted-foreground">Account and notification preferences</p></div>
        </div>
        <nav aria-label="Settings sections" className="flex gap-1 px-5">
          <Link href="/settings?tab=account" aria-current={tab === "account" ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${tab === "account" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><UserRound size={14} /> Account</Link>
          {user?.role === "admin" && <Link href="/settings?tab=notifications" aria-current={tab === "notifications" ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${tab === "notifications" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Bell size={14} /> Notifications</Link>}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto grid-overlay">
        {tab === "account" ? <ProfilePage embedded onBack={() => router.push("/")} /> : <NotificationSettingsPanel />}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return <AuthGuard><Suspense fallback={<div className="min-h-screen bg-background p-6 text-muted-foreground">Loading settings…</div>}><SettingsContent /></Suspense></AuthGuard>
}
