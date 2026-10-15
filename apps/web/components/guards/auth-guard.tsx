"use client";

import { ScopeLoadingScreen } from "@/components/scope-loading-screen";
import { useAuth } from "../auth-provider";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, authState } = useAuth();


  const router = useRouter();

  useEffect(() => {
    if ((authState !== "loading") && !isAuthenticated) {
        router.push("/auth/login");
    }

  }, [isAuthenticated, authState, router])

  if (authState === "loading") {
    return <ScopeLoadingScreen message="Initializing…" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
