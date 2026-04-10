import { io, type Socket } from "socket.io-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function createSocket(token: string): Socket {
  return io(API_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  })
}
