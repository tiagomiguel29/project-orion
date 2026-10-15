"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Bell, UserRound } from "lucide-react"
import { AuthGuard } from "@/components/guards/auth-guard"
import { useAuth } from "@/components/auth-provider"
import { DashboardHeader } from "@/components/dashboard-header"
import { ProfilePage } from "@/components/profile-page"
import { NotificationSettingsPanel } from "@/components/notification-settings-panel"

function SettingsContent() {
  const router = useRouter()
  const search = useSearchParams()
  const { user, logout } = useAuth()
  const tab = search.get("tab") === "notifications" && user?.role === "admin" ? "notifications" : "account"

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DashboardHeader section="Settings" name={user?.name} email={user?.email}
        onLogout={() => { logout(); router.push("/") }} onSettingsClick={() => router.push("/settings?tab=account")} />
      <div className="border-b border-border bg-card/50">
        <div className="border-b border-border/50 px-4 py-2 text-[9px] uppercase tracking-widest text-muted-foreground">
          <span>Settings // {tab}</span>
        </div>
        <nav aria-label="Settings sections" className="mx-auto flex max-w-5xl gap-1 px-4">
          <Link href="/settings?tab=account" aria-current={tab === "account" ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-[10px] uppercase tracking-widest transition-colors ${tab === "account" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><UserRound size={13} /> Account</Link>
          {user?.role === "admin" && <Link href="/settings?tab=notifications" aria-current={tab === "notifications" ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-[10px] uppercase tracking-widest transition-colors ${tab === "notifications" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Bell size={13} /> Notifications</Link>}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto grid-overlay">
        {tab === "account" ? <ProfilePage embedded onBack={() => router.push("/")} /> : <NotificationSettingsPanel />}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return <AuthGuard><Suspense fallback={<div className="min-h-screen bg-background p-6 text-muted-foreground">Loading settings…</div>}><SettingsContent /></Suspense></AuthGuard>
}
