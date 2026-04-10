"use client"

import { startAuthentication } from "@simplewebauthn/browser"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import {
  getPasskeyAuthenticationOptions,
  login as authLogin,
  registerFirst as authRegisterFirst,
  getMe,
  checkSetup,
  verifyPasskeyAuthentication,
  verifyTotpLogin,
  type AuthUser,
  type MfaMethod,
} from "@/lib/auth-service"

type AuthState = "loading" | "setup" | "login" | "mfa" | "authenticated"

interface PendingMfaState {
  token: string
  availableMethods: MfaMethod[]
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  authState: AuthState
  pendingMfa: PendingMfaState | null
  isAuthenticated: boolean
  setUser: (user: AuthUser) => void
  login: (email: string, password: string) => Promise<void>
  registerFirst: (name: string, email: string, password: string) => Promise<void>
  verifyTotp: (code: string) => Promise<void>
  verifyPasskey: () => Promise<void>
  cancelMfa: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "scope_auth_token"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [pendingMfa, setPendingMfa] = useState<PendingMfaState | null>(null)
  const [authState, setAuthState] = useState<AuthState>("loading")

  // On mount: check for existing token, then check if setup is needed
  useEffect(() => {
    async function init() {
      const storedToken = localStorage.getItem(TOKEN_KEY)

      // If we have a stored token, validate it with /auth/me
      if (storedToken) {
        try {
          const me = await getMe(storedToken)
          setToken(storedToken)
          setUser(me)
          setAuthState("authenticated")
          return
        } catch {
          // Token is invalid or expired — clear it and continue
          localStorage.removeItem(TOKEN_KEY)
          setPendingMfa(null)
        }
      }

      // No valid token — check if first-time setup is needed
      try {
        const setupRequired = await checkSetup()
        setAuthState(setupRequired ? "setup" : "login")
      } catch {
        // If setup check fails (API unreachable), default to login
        setAuthState("login")
      }
    }

    init()
  }, [])

  const handleAuthSuccess = useCallback(
    (responseToken: string, responseUser: AuthUser) => {
      localStorage.setItem(TOKEN_KEY, responseToken)
      setToken(responseToken)
      setUser(responseUser)
      setPendingMfa(null)
      setAuthState("authenticated")
    },
    []
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authLogin(email, password)

      if (response.mfaRequired) {
        setPendingMfa({
          token: response.pendingToken,
          availableMethods: response.availableMethods,
        })
        setAuthState("mfa")
        return
      }

      handleAuthSuccess(response.token, response.user)
    },
    [handleAuthSuccess]
  )

  const registerFirst = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await authRegisterFirst(name, email, password)
      handleAuthSuccess(response.token, response.user)
    },
    [handleAuthSuccess]
  )

  const verifyTotp = useCallback(
    async (code: string) => {
      if (!pendingMfa) {
        throw new Error("No pending MFA challenge")
      }

      const response = await verifyTotpLogin(pendingMfa.token, code)
      handleAuthSuccess(response.token, response.user)
    },
    [handleAuthSuccess, pendingMfa]
  )

  const verifyPasskey = useCallback(async () => {
    if (!pendingMfa) {
      throw new Error("No pending MFA challenge")
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      throw new Error("Passkeys are not supported in this browser.")
    }

    const options = await getPasskeyAuthenticationOptions(pendingMfa.token)
    const response = await startAuthentication({ optionsJSON: options })
    const result = await verifyPasskeyAuthentication(pendingMfa.token, response)

    handleAuthSuccess(result.token, result.user)
  }, [handleAuthSuccess, pendingMfa])

  const cancelMfa = useCallback(() => {
    setPendingMfa(null)
    setAuthState("login")
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setPendingMfa(null)
    setAuthState("login")
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authState,
        pendingMfa,
        isAuthenticated: authState === "authenticated",
        setUser,
        login,
        registerFirst,
        verifyTotp,
        verifyPasskey,
        cancelMfa,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
