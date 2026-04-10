"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { toDataURL } from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./auth-provider";
import {
  changeEmail,
  changeName,
  changePassword,
  confirmTotpSetup,
  deletePasskey,
  disableTotp,
  getMfaStatus,
  getPasskeyRegistrationOptions,
  startTotpSetup,
  verifyPasskeyRegistration,
  type MfaStatusResponse,
  type TotpSetupResponse,
} from "@/lib/auth-service";
import {
  Lock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  User,
  Mail,
  ShieldCheck,
  Fingerprint,
  KeyRound,
  Trash2,
} from "lucide-react";

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, setUser, token } = useAuth();
  const [mfaStatus, setMfaStatus] = useState<MfaStatusResponse | null>(null);
  const [isMfaLoading, setIsMfaLoading] = useState(true);
  const [mfaError, setMfaError] = useState("");

  const [totpSetup, setTotpSetup] = useState<TotpSetupResponse | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [totpSuccess, setTotpSuccess] = useState("");
  const [totpQrCode, setTotpQrCode] = useState("");
  const [totpQrError, setTotpQrError] = useState("");
  const [isTotpStarting, setIsTotpStarting] = useState(false);
  const [isTotpSubmitting, setIsTotpSubmitting] = useState(false);
  const [isTotpDisabling, setIsTotpDisabling] = useState(false);

  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeySuccess, setPasskeySuccess] = useState("");
  const [isPasskeyRegistering, setIsPasskeyRegistering] = useState(false);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isPasswordSubmitting, setPasswordIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Name change
  const [newName, setNewName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [isNameSubmitting, setIsNameSubmitting] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  useEffect(() => {
    async function loadMfa() {
      if (!token) return;

      setIsMfaLoading(true);
      setMfaError("");

      try {
        const status = await getMfaStatus(token);
        setMfaStatus(status);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setMfaError(message);
      } finally {
        setIsMfaLoading(false);
      }
    }

    void loadMfa();
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function buildTotpQrCode() {
      if (!totpSetup?.uri) {
        setTotpQrCode("");
        setTotpQrError("");
        return;
      }

      try {
        const dataUrl = await toDataURL(totpSetup.uri, {
          width: 224,
          margin: 1,
          color: {
            dark: "#4ade80",
            light: "#0a0f0a",
          },
        });

        if (!cancelled) {
          setTotpQrCode(dataUrl);
          setTotpQrError("");
        }
      } catch {
        if (!cancelled) {
          setTotpQrCode("");
          setTotpQrError("QR code could not be generated. Manual setup still works.");
        }
      }
    }

    void buildTotpQrCode();

    return () => {
      cancelled = true;
    };
  }, [totpSetup]);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password.");
      return;
    }

    setPasswordIsSubmitting(true);

    try {
      await changePassword(token!, currentPassword, newPassword);
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPasswordError(message);
    } finally {
      setPasswordIsSubmitting(false);
    }
  }

  async function handleChangeName(e: FormEvent) {
    if (!user) return null;

    e.preventDefault();
    setNameError("");
    setNameSuccess("");

    if (newName.length < 1) {
      setNameError("New name can't be empty.");
      return;
    }

    if (newName === user?.name) {
      setNameError("New name must be different from current one.");
      return;
    }

    setIsNameSubmitting(true);

    try {
      const normalizedName = newName.trim();
      await changeName(token!, newName);
      setNameSuccess("Name changed successfully.");
      setNewName(normalizedName);
      setUser({ ...user, name: normalizedName });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setNameError(message);
    } finally {
      setIsNameSubmitting(false);
    }
  }

  async function handleChangeEmail(e: FormEvent) {
    if (!user) return null;

    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");

    if (newEmail.length < 1) {
      setEmailError("New email can't be empty.");
      return;
    }

    if (newEmail === user?.email) {
      setEmailError("New email must be different from current one.");
      return;
    }

    // TODO: Validate email

    setIsEmailSubmitting(true);

    try {
      const normalizedEmail = newEmail.trim().toLowerCase();
      await changeEmail(token!, newEmail);
      setEmailSuccess("Email changed successfully.");
      setNewEmail(normalizedEmail);
      setUser({ ...user, email: normalizedEmail });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setEmailError(message);
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  async function handleStartTotpSetup() {
    if (!token) return;

    setTotpError("");
    setTotpSuccess("");
    setIsTotpStarting(true);

    try {
      const setup = await startTotpSetup(token);
      setTotpSetup(setup);
      setTotpCode("");
      const status = await getMfaStatus(token);
      setMfaStatus(status);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setTotpError(message);
    } finally {
      setIsTotpStarting(false);
    }
  }

  async function handleConfirmTotpSetup(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setTotpError("");
    setTotpSuccess("");

    if (totpCode.replace(/[^\d]/g, "").length < 6) {
      setTotpError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setIsTotpSubmitting(true);

    try {
      const status = await confirmTotpSetup(token, totpCode);
      setMfaStatus(status);
      setTotpSetup(null);
      setTotpCode("");
      setTotpQrCode("");
      setTotpQrError("");
      setTotpSuccess("TOTP enabled successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setTotpError(message);
    } finally {
      setIsTotpSubmitting(false);
    }
  }

  async function handleDisableTotp() {
    if (!token) return;

    setTotpError("");
    setTotpSuccess("");
    setIsTotpDisabling(true);

    try {
      const status = await disableTotp(token);
      setMfaStatus(status);
      setTotpSetup(null);
      setTotpCode("");
      setTotpQrCode("");
      setTotpQrError("");
      setTotpSuccess("TOTP disabled successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setTotpError(message);
    } finally {
      setIsTotpDisabling(false);
    }
  }

  async function handleRegisterPasskey(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setPasskeyError("");
    setPasskeySuccess("");

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setPasskeyError("Passkeys are not supported in this browser.");
      return;
    }

    setIsPasskeyRegistering(true);

    try {
      const options = await getPasskeyRegistrationOptions(token);
      const response = await startRegistration({ optionsJSON: options });
      const status = await verifyPasskeyRegistration(token, response, passkeyName);
      setMfaStatus(status);
      setPasskeyName("");
      setPasskeySuccess("Passkey added successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPasskeyError(message);
    } finally {
      setIsPasskeyRegistering(false);
    }
  }

  async function handleDeletePasskey(passkeyId: string) {
    if (!token) return;

    setPasskeyError("");
    setPasskeySuccess("");
    setRemovingPasskeyId(passkeyId);

    try {
      const status = await deletePasskey(token, passkeyId);
      setMfaStatus(status);
      setPasskeySuccess("Passkey removed successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPasskeyError(message);
    } finally {
      setRemovingPasskeyId(null);
    }
  }

  function formatTimestamp(value: string | null) {
    if (!value) {
      return "Never";
    }

    return new Date(value).toLocaleString();
  }

  return (
    <div className="flex flex-col h-full bg-background grid-overlay">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline z-50 pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Profile // Settings
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Secure Channel
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 h-7 px-2.5 border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="text-[9px] uppercase tracking-widest">
              Dashboard
            </span>
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-bold tracking-wider text-foreground">
            Profile
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">

          {/* ── Account ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em]">Account</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* User info card */}
          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Account Information
              </span>
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="border border-primary/30 p-2 bg-secondary">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground font-medium">
                    {user?.name || "---"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user?.email || "---"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider border border-border px-1.5 py-0.5 bg-secondary">
                    {user?.role || "---"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em]">Security</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Multi-Factor Authentication
              </span>
              <ShieldCheck className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 border border-border bg-secondary/40 px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Active Methods
                  </p>
                  <p className="text-sm text-foreground">
                    {isMfaLoading
                      ? "Loading..."
                      : (mfaStatus?.availableMethods.length ?? 0) > 0
                        ? mfaStatus?.availableMethods.join(" + ").toUpperCase()
                        : "Password only"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Passkeys
                  </p>
                  <p className="text-sm text-foreground">
                    {isMfaLoading ? "--" : mfaStatus?.passkeys.length ?? 0}
                  </p>
                </div>
              </div>

              {mfaError && (
                <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="text-[10px] text-destructive-foreground">
                    {mfaError}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                TOTP Authenticator
              </span>
              <KeyRound className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 border border-border bg-secondary/40 px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Status
                  </p>
                  <p className="text-sm text-foreground">
                    {mfaStatus?.totpEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                {mfaStatus?.totpEnabled ? (
                  <button
                    type="button"
                    onClick={handleDisableTotp}
                    disabled={isTotpDisabling}
                    className="h-8 px-3 border border-border bg-secondary text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isTotpDisabling ? "Disabling" : "Disable"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartTotpSetup}
                    disabled={isTotpStarting}
                    className="h-8 px-3 bg-primary/10 border border-primary/30 text-primary text-[10px] uppercase tracking-widest hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isTotpStarting ? "Generating" : "Generate Setup Key"}
                  </button>
                )}
              </div>

              {!mfaStatus?.totpEnabled && totpSetup && (
                <form onSubmit={handleConfirmTotpSetup} className="space-y-4">
                  <div className="space-y-4 border border-primary/20 bg-primary/5 px-3 py-3">
                    <div className="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
                      <div className="mx-auto w-full max-w-[224px] border border-primary/30 bg-black/40 p-3">
                        {totpQrCode ? (
                          <img
                            src={totpQrCode}
                            alt="TOTP setup QR code"
                            className="h-auto w-full"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center border border-dashed border-border text-[9px] uppercase tracking-widest text-muted-foreground">
                            Generating QR
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] text-foreground leading-relaxed">
                          Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
                        </p>

                        {totpQrError && (
                          <div className="flex items-center gap-2 px-3 py-2 border border-border bg-secondary/40">
                            <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground">
                              {totpQrError}
                            </span>
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                            Issuer
                          </p>
                          <p className="text-xs text-foreground">{totpSetup.issuer}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                            Account
                          </p>
                          <p className="text-xs text-foreground">{totpSetup.accountName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                            Secret Key
                          </p>
                          <p className="break-all font-mono text-xs text-primary">
                            {totpSetup.secret}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="totp-confirm-code"
                      className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <KeyRound className="h-3 w-3" />
                      Verification Code
                    </label>
                    <input
                      id="totp-confirm-code"
                      type="text"
                      value={totpCode}
                      onChange={(e) =>
                        setTotpCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      required
                      disabled={isTotpSubmitting}
                      className="w-full h-9 bg-secondary border border-border px-3 text-xs tracking-[0.35em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTotpSubmitting || totpCode.length < 6}
                    className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isTotpSubmitting ? "Enabling TOTP" : "Confirm TOTP"}
                  </button>
                </form>
              )}

              {totpError && (
                <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="text-[10px] text-destructive-foreground">
                    {totpError}
                  </span>
                </div>
              )}

              {totpSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[10px] text-primary">
                    {totpSuccess}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Passkeys
              </span>
              <Fingerprint className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-4">
              <form onSubmit={handleRegisterPasskey} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="passkey-name"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Fingerprint className="h-3 w-3" />
                    Passkey Name (optional)
                  </label>
                  <input
                    id="passkey-name"
                    type="text"
                    value={passkeyName}
                    onChange={(e) => setPasskeyName(e.target.value)}
                    placeholder="MacBook Pro"
                    autoComplete="off"
                    disabled={isPasskeyRegistering}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPasskeyRegistering}
                  className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPasskeyRegistering ? "Waiting For Passkey" : "Add Passkey"}
                </button>
              </form>

              {passkeyError && (
                <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="text-[10px] text-destructive-foreground">
                    {passkeyError}
                  </span>
                </div>
              )}

              {passkeySuccess && (
                <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[10px] text-primary">
                    {passkeySuccess}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {(mfaStatus?.passkeys.length ?? 0) === 0 ? (
                  <div className="border border-border bg-secondary/40 px-3 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      No passkeys registered
                    </p>
                  </div>
                ) : (
                  mfaStatus?.passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-start justify-between gap-3 border border-border bg-secondary/40 px-3 py-3"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-foreground font-medium">
                          {passkey.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          {passkey.deviceType ?? "Unknown device"}
                          {passkey.backedUp ? " // synced" : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Added: {formatTimestamp(passkey.createdAt)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Last used: {formatTimestamp(passkey.lastUsedAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePasskey(passkey.id)}
                        disabled={removingPasskeyId === passkey.id}
                        className="flex items-center gap-1.5 h-8 px-2.5 border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="text-[9px] uppercase tracking-widest">
                          {removingPasskeyId === passkey.id ? "Removing" : "Remove"}
                        </span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          </div>

          {/* Right column */}
          <div className="space-y-6">

          {/* ── Profile Settings ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em]">Profile Settings</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Change name card */}
          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Change Name
              </span>
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4">
              <form onSubmit={handleChangeName} className="space-y-4">
                {/* Current name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-name"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    Name
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={newName}
                    autoComplete="name"
                    required
                    disabled={isNameSubmitting}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Error message */}
                {nameError && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-[10px] text-destructive-foreground">
                      {nameError}
                    </span>
                  </div>
                )}

                {/* Success message */}
                {nameSuccess && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] text-primary">
                      {nameSuccess}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isNameSubmitting || !newName}
                  className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isNameSubmitting ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                      Updating
                    </>
                  ) : (
                    "Update Name"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Change email card */}
          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Change Email
              </span>
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4">
              <form onSubmit={handleChangeEmail} className="space-y-4">
                {/* Current name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-email"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    Email
                  </label>
                  <input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={newEmail}
                    autoComplete="email"
                    required
                    disabled={isEmailSubmitting}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Error message */}
                {emailError && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-[10px] text-destructive-foreground">
                      {emailError}
                    </span>
                  </div>
                )}

                {/* Success message */}
                {emailSuccess && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] text-primary">
                      {emailSuccess}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isEmailSubmitting || !newEmail}
                  className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isEmailSubmitting ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                      Updating
                    </>
                  ) : (
                    "Update Email"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Change password card */}
          <div className="relative border border-border bg-card corner-marks">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Change Password
              </span>
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-4">
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="current-password"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="enter current password"
                    autoComplete="current-password"
                    required
                    disabled={isPasswordSubmitting}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* New password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-password"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    New Password (min. 8 chars)
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="min. 8 characters"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    disabled={isPasswordSubmitting}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Confirm new password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-new-password"
                    className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="re-enter new password"
                    autoComplete="new-password"
                    required
                    disabled={isPasswordSubmitting}
                    className="w-full h-9 bg-secondary border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Error message */}
                {passwordError && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-[10px] text-destructive-foreground">
                      {passwordError}
                    </span>
                  </div>
                )}

                {/* Success message */}
                {passwordSuccess && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] text-primary">
                      {passwordSuccess}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={
                    isPasswordSubmitting ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="w-full h-9 bg-primary/10 border border-primary/30 text-primary text-xs uppercase tracking-widest font-medium hover:bg-primary/20 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPasswordSubmitting ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
                      Updating
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
