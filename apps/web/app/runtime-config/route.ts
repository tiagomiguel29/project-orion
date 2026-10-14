import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    {
      apiUrl: process.env.SCOPE_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
      agentServerAddress: process.env.SCOPE_PUBLIC_AGENT_SERVER_ADDRESS ?? process.env.NEXT_PUBLIC_AGENT_SERVER_ADDRESS,
      agentTlsDisable: process.env.SCOPE_PUBLIC_AGENT_TLS_DISABLE ?? process.env.NEXT_PUBLIC_AGENT_TLS_DISABLE,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
