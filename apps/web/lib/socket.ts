import { io, type Socket } from "socket.io-client"
import { getRuntimeConfig } from "@/lib/runtime-config"

export function createSocket(token: string, url = getRuntimeConfig().apiUrl): Socket {
  const socket = io(url, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  })
  // Socket.IO treats an intentional server disconnect as final. During a
  // rolling shutdown we still need to reconnect and rejoin rooms. Client-side
  // logout uses "io client disconnect" and must remain disconnected.
  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") socket.connect()
  })
  return socket
}
