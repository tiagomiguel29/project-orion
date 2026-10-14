export interface RuntimeConfig {
  apiUrl: string
  agentServerAddress?: string
  agentTlsDisable?: string
}

let config: RuntimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  agentServerAddress: process.env.NEXT_PUBLIC_AGENT_SERVER_ADDRESS,
  agentTlsDisable: process.env.NEXT_PUBLIC_AGENT_TLS_DISABLE,
}

export function setRuntimeConfig(value: RuntimeConfig) {
  config = value
}

export function getRuntimeConfig(): RuntimeConfig {
  return config
}
