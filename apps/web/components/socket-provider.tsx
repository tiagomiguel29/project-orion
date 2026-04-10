"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Socket } from "socket.io-client"
import { createSocket } from "@/lib/socket"
import { useAuth } from "./auth-provider"

interface SocketContextType {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
})

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Tear down existing socket if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
      return
    }

    const socket = createSocket(token)
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      // Auto-subscribe to dashboard updates
      socket.emit("subscribeDashboard")
    })

    socket.on("disconnect", () => {
      setConnected(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [isAuthenticated, token])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}
