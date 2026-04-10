import axios, { type AxiosError } from "axios";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ── Types matching NestJS DTOs ──────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SuccessLoginResponse {
  token: string;
  user: AuthUser;
}

export type MfaMethod = "passkey" | "totp";

export interface LoginMfaRequiredResponse {
  mfaRequired: true;
  pendingToken: string;
  availableMethods: MfaMethod[];
}

export interface LoginSuccessResponse extends SuccessLoginResponse {
  mfaRequired: false;
}

export type LoginResponse = LoginSuccessResponse | LoginMfaRequiredResponse;

export interface SetupRequiredResponse {
  setupRequired: boolean;
}

export interface PasskeySummary {
  id: string;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface MfaStatusResponse {
  totpEnabled: boolean;
  availableMethods: MfaMethod[];
  passkeys: PasskeySummary[];
}

export interface TotpSetupResponse {
  secret: string;
  uri: string;
  issuer: string;
  accountName: string;
}

interface BaseResponse<T> {
  success: boolean;
  message: string | string[];
  data?: T;
}

// ── Axios instance ──────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

function extractError(err: unknown): string {
  const axiosErr = err as AxiosError<BaseResponse<unknown>>;
  const message = axiosErr.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join(", ");
  }

  return (
    message ??
    axiosErr.message ??
    "An unexpected error occurred"
  );
}

function getResponseMessage(
  message: string | string[] | undefined,
  fallback: string,
): string {
  if (Array.isArray(message)) {
    return message.join(", ");
  }

  return message ?? fallback;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * GET /auth/setup — check if a first-time registration is required.
 */
export async function checkSetup(): Promise<boolean> {
  try {
    const { data } =
      await api.get<BaseResponse<SetupRequiredResponse>>("/auth/setup");
    return data.data?.setupRequired ?? false;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/register-first — register the first admin account.
 */
export async function registerFirst(
  name: string,
  email: string,
  password: string,
): Promise<SuccessLoginResponse> {
  try {
    const { data } = await api.post<BaseResponse<SuccessLoginResponse>>(
      "/auth/register-first",
      { name, email, password },
    );
    if (!data.data) throw new Error("Registration failed: no data returned");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/login
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const { data } = await api.post<BaseResponse<LoginResponse>>(
      "/auth/login",
      { email, password },
    );
    if (!data.data) throw new Error("Login failed: no data returned");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/totp/verify
 */
export async function verifyTotpLogin(
  pendingToken: string,
  code: string,
): Promise<SuccessLoginResponse> {
  try {
    const { data } = await api.post<BaseResponse<SuccessLoginResponse>>(
      "/auth/mfa/totp/verify",
      { code },
      { headers: { Authorization: `Bearer ${pendingToken}` } },
    );
    if (!data.data) throw new Error("TOTP verification failed");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/passkeys/authentication-options
 */
export async function getPasskeyAuthenticationOptions(
  pendingToken: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  try {
    const { data } = await api.post<
      BaseResponse<PublicKeyCredentialRequestOptionsJSON>
    >(
      "/auth/mfa/passkeys/authentication-options",
      {},
      { headers: { Authorization: `Bearer ${pendingToken}` } },
    );
    if (!data.data) {
      throw new Error("Failed to get passkey authentication options");
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/passkeys/authenticate
 */
export async function verifyPasskeyAuthentication(
  pendingToken: string,
  response: AuthenticationResponseJSON,
): Promise<SuccessLoginResponse> {
  try {
    const { data } = await api.post<BaseResponse<SuccessLoginResponse>>(
      "/auth/mfa/passkeys/authenticate",
      { response },
      { headers: { Authorization: `Bearer ${pendingToken}` } },
    );
    if (!data.data) throw new Error("Passkey verification failed");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/change-password — change the current user's password.
 */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  try {
    const { data } = await api.post<BaseResponse<null>>(
      "/auth/change-password",
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.success)
      throw new Error(getResponseMessage(data.message, "Password change failed"));
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/change-name — change the current user's name.
 */
export async function changeName(
  token: string,
  newName: string,
): Promise<void> {
  try {
    const { data } = await api.post<BaseResponse<null>>(
      "/auth/change-name",
      { newName },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!data.success) {
      throw new Error(getResponseMessage(data.message, "Name change failed"));
    }
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/change-emai — change the current user's email.
 */
export async function changeEmail(
  token: string,
  newEmail: string,
): Promise<void> {
  try {
    const { data } = await api.post<BaseResponse<null>>(
      "/auth/change-email",
      { newEmail },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!data.success) {
      throw new Error(getResponseMessage(data.message, "Email change failed"));
    }
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * GET /auth/me — validate token and get current user.
 */
export async function getMe(token: string): Promise<AuthUser> {
  try {
    const { data } = await api.get<BaseResponse<AuthUser>>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!data.data) throw new Error("Failed to get user info");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * GET /auth/mfa/status
 */
export async function getMfaStatus(token: string): Promise<MfaStatusResponse> {
  try {
    const { data } = await api.get<BaseResponse<MfaStatusResponse>>(
      "/auth/mfa/status",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to get MFA status");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/totp/setup
 */
export async function startTotpSetup(token: string): Promise<TotpSetupResponse> {
  try {
    const { data } = await api.post<BaseResponse<TotpSetupResponse>>(
      "/auth/mfa/totp/setup",
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to start TOTP setup");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/totp/confirm
 */
export async function confirmTotpSetup(
  token: string,
  code: string,
): Promise<MfaStatusResponse> {
  try {
    const { data } = await api.post<BaseResponse<MfaStatusResponse>>(
      "/auth/mfa/totp/confirm",
      { code },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to enable TOTP");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * DELETE /auth/mfa/totp
 */
export async function disableTotp(
  token: string,
): Promise<MfaStatusResponse> {
  try {
    const { data } = await api.delete<BaseResponse<MfaStatusResponse>>(
      "/auth/mfa/totp",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to disable TOTP");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/passkeys/registration-options
 */
export async function getPasskeyRegistrationOptions(
  token: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  try {
    const { data } = await api.post<
      BaseResponse<PublicKeyCredentialCreationOptionsJSON>
    >(
      "/auth/mfa/passkeys/registration-options",
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) {
      throw new Error("Failed to get passkey registration options");
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * POST /auth/mfa/passkeys/register
 */
export async function verifyPasskeyRegistration(
  token: string,
  response: RegistrationResponseJSON,
  name?: string,
): Promise<MfaStatusResponse> {
  try {
    const { data } = await api.post<BaseResponse<MfaStatusResponse>>(
      "/auth/mfa/passkeys/register",
      { response, name },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to register passkey");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * DELETE /auth/mfa/passkeys/:passkeyId
 */
export async function deletePasskey(
  token: string,
  passkeyId: string,
): Promise<MfaStatusResponse> {
  try {
    const { data } = await api.delete<BaseResponse<MfaStatusResponse>>(
      `/auth/mfa/passkeys/${passkeyId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!data.data) throw new Error("Failed to delete passkey");
    return data.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}
