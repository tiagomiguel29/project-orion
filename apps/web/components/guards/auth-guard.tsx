"use client";

import { Monitor } from "lucide-react";
import { useAuth } from "../auth-provider";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, authState, user, token, logout } = useAuth();


  const router = useRouter();

  useEffect(() => {
    if ((authState !== "loading") && !isAuthenticated) {
        router.push("/auth/login");
    }

  }, [isAuthenticated, authState, router])

  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background grid-overlay">
        <div className="fixed inset-0 scanline z-50 pointer-events-none" />
        <div className="flex flex-col items-center gap-4">
          <div className="border border-primary/30 p-3 bg-secondary">
            <Monitor className="h-6 w-6 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              Initializing
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
