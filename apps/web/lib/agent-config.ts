export function getAgentConnection(
  apiUrl: string,
  configuredAddress?: string,
  configuredTlsDisable?: string,
) {
  let hostname = "<your-backend-host>"
  let localPlaintext = false
  try {
    const url = new URL(apiUrl)
    hostname = url.hostname
    localPlaintext = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  } catch {
    // Keep the editable placeholder when an API URL is not configured.
  }
  return {
    address: configuredAddress || `${hostname}:${localPlaintext ? "50052" : "443"}`,
    tlsDisable: !configuredTlsDisable
      ? localPlaintext && !configuredAddress
      : configuredTlsDisable === "true",
  }
}

export function getAgentInstallCommand(input: {
  backendUrl: string
  grpcAddress: string
  deviceId: string
  pairingCode: string
  tlsDisable: boolean
}) {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  const installer = "https://github.com/tiagomiguel29/project-orion/releases/latest/download/install.sh"
  return `curl -fsSL ${installer} | sudo sh -s -- --server ${quote(input.backendUrl.trim().replace(/\/+$/, ""))} --grpc ${quote(input.grpcAddress.trim())} --device ${quote(input.deviceId.trim())} --pair ${quote(input.pairingCode)}${input.tlsDisable ? " --tls-disable" : ""}`
}
