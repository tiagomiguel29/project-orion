import { io, type Socket } from "socket.io-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function createSocket(token: string, url = API_URL): Socket {
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
