"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useAuth } from "./auth-provider"
import {
  Monitor,
  Lock,
  Mail,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCircle,
  Fingerprint,
  KeyRound,
} from "lucide-react"

interface LoginPageProps {
  mode: "login" | "setup"
}

export function LoginPage({ mode }: LoginPageProps) {
  const {
    authState,
    pendingMfa,
    login,
    registerFirst,
    verifyTotp,
    verifyPasskey,
    cancelMfa,
  } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false)
  const [time, setTime] = useState(new Date())

  const isSetup = mode === "setup"
  const isMfaStep = !isSetup && authState === "mfa" && pendingMfa !== null

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (isMfaStep) {
      if (totpCode.replace(/[\s-]/g, "").length < 6) {
        setError("Enter the 6-digit code from your authenticator app.")
        return
      }

      setIsSubmitting(true)

      try {
        await verifyTotp(totpCode)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred."
        setError(message)
      } finally {
        setIsSubmitting(false)
      }

      return
    }

    if (isSetup && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (isSetup && password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setIsSubmitting(true)

    try {
      if (isSetup) {
        await registerFirst(name, email, password)
      } else {
        await login(email, password)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasskeySubmit() {
    setError("")
    setIsPasskeySubmitting(true)

    try {
      await verifyPasskey()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setError(message)
    } finally {
      setIsPasskeySubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background grid-overlay relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline z-50 pointer-events-none" />

      {/* Ambient grid decorations */}
      <div className="absolute top-4 left-4 text-[9px] text-muted-foreground tracking-widest">
        <span>A1</span>
      </div>
      <div className="absolute top-4 right-4 text-[9px] text-muted-foreground tracking-widest tabular-nums">
        {time.toISOString().replace("T", " // ").split(".")[0]} UTC
      </div>
      <div className="absolute bottom-4 left-4 text-[9px] text-muted-foreground tracking-widest flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
        SCOPE v1.0.0
      </div>
      <div className="absolute bottom-4 right-4 text-[9px] text-muted-foreground tracking-widest">
        SECURE CHANNEL
      </div>

      {/* Decorative corner marks */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l border-t border-border/40" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r border-t border-border/40" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l border-b border-border/40" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-border/40" />

      {/* Login / Setup card */}
      <div className="relative w-full max-w-sm mx-4">
        {/* Card border glow */}
        <div className="absolute -inset-px bg-primary/5 blur-sm" />

        <div className="relative border border-border bg-card">
          {/* Card header bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                {isSetup
                  ? "Initial Setup Required"
                  : isMfaStep
                    ? "Second Factor Required"
                    : "Authentication Required"}
              </span>
            </div>
            {isSetup ? (
              <ShieldCheck className="h-3 w-3 text-primary" />
            ) : isMfaStep ? (
              <Fingerprint className="h-3 w-3 text-primary" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>

          {/* Card content */}
          <div className="p-6">
            {/* Logo / branding */}
            <div className="flex items-center gap-3 mb-6">
              <div className="border border-primary/30 p-2 bg-secondary">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-foreground">
                  [SCOPE]
                </h1>
                <p className="text-[9px] text-muted-foreground tracking-widest uppercase">
                  Infrastructure Monitor
                </p>
              </div>
            </div>

            {/* Setup notice */}
            {isSetup && (
              <div className="flex items-start gap-2 px-3 py-2.5 mb-5 border border-primary/20 bg-primary/5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-foreground leading-relaxed">
                    No admin account exists yet. Create the first administrator account to get started.
                  </p>
                </div>
              </div>
            )}

            {isMfaStep && (
              <div className="flex items-start gap-2 px-3 py-2.5 mb-5 border border-primary/20 bg-primary/5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] text-foreground leading-relaxed">
                    Password accepted. Complete sign-in with your registered second factor.
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    Methods // {pendingMfa.availableMethods.join(" // ").toUpperCase()}
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isMfaStep ? (
                <>
                  {pendingMfa.availableMethods.includes("passkey") && (
                    <button
                      type="button"
                      onClick={handlePasskeySubmit}
                      disabled={isSubmitting || isPasskeySubmitting}
                      className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPasskeySubmitting ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                          Waiting For Passkey
                        </>
                      ) : (
                        <>
                          Use Passkey
                          <Fingerprint className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  )}

                  {pendingMfa.availableMethods.includes("totp") && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="totp-code"
                        className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                      >
                        <KeyRound className="h-3 w-3" />
                        TOTP Code
                      </label>
                      <input
                        id="totp-code"
                        type="text"
                        value={totpCode}
                        onChange={(e) =>
                          setTotpCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                        }
                        placeholder="123456"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        required={pendingMfa.availableMethods.includes("totp")}
                        disabled={isSubmitting || isPasskeySubmitting}
                        className="w-full h-9 bg-secondary border border-border px-3 text-xs tracking-[0.35em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {isSetup && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="name"
                        className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                      >
                        <UserCircle className="h-3 w-3" />
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="admin name"
                        autoComplete="name"
                        required
                        disabled={isSubmitting}
                        className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                      />
                    </div>
                  )}

                  {/* Email field */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@scope.io"
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Password field */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Lock className="h-3 w-3" />
                      {isSetup ? "Password (min. 8 chars)" : "Access Key"}
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSetup ? "min. 8 characters" : "enter password"}
                      autoComplete={isSetup ? "new-password" : "current-password"}
                      required
                      minLength={isSetup ? 8 : undefined}
                      disabled={isSubmitting}
                      className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Confirm password (setup only) */}
                  {isSetup && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="confirm-password"
                        className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                      >
                        <Lock className="h-3 w-3" />
                        Confirm Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="re-enter password"
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting}
                        className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="text-[10px] text-destructive-foreground">
                    {error}
                  </span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isPasskeySubmitting ||
                  (isMfaStep
                    ? pendingMfa.availableMethods.includes("totp")
                      ? totpCode.length < 6
                      : true
                    : !email ||
                      !password ||
                      (isSetup && (!confirmPassword || !name)))
                }
                className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                    {isSetup ? "Registering" : isMfaStep ? "Verifying" : "Authenticating"}
                  </>
                ) : (
                  <>
                    {isSetup
                      ? "Create Admin Account"
                      : isMfaStep
                        ? "Verify Code"
                        : "Authenticate"}
                    {!isMfaStep && <ArrowRight className="h-3 w-3" />}
                  </>
                )}
              </button>

              {isMfaStep && (
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setTotpCode("")
                    cancelMfa()
                  }}
                  disabled={isSubmitting || isPasskeySubmitting}
                  className="w-full h-9 bg-secondary border border-border text-muted-foreground text-xs uppercase tracking-widest font-medium hover:text-foreground hover:border-primary/30 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Back To Login
                </button>
              )}
            </form>
          </div>

          {/* Card footer */}
          <div className="px-4 py-2 border-t border-border bg-secondary/30">
            <p className="text-[9px] text-muted-foreground/60 tracking-wider text-center">
              {isSetup
                ? "FIRST-TIME SETUP // ADMIN REGISTRATION"
                : isMfaStep
                  ? "ENCRYPTED SESSION // MFA VERIFICATION"
                  : "ENCRYPTED SESSION // JWT AUTH"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
