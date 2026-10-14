# Scope agent installation

In the dashboard, choose **Add Device**, or open an existing device and choose
**Install agent**. Set the backend URL and gRPC address to endpoints reachable
from the target machine, then copy the generated command. It downloads the
matching release binary without cloning the repository or installing Go.

The installer supports Linux and macOS on x64 and ARM64. It checks the release
SHA-256 checksum, redeems a single-use pairing code (valid for ten minutes),
stores the durable enrollment token in `/etc/scope/.env` with mode `0600`, and
starts the agent under systemd or launchd. Buffered telemetry is stored in
`/var/lib/scope/wal.db`. Running the command again with a fresh code updates the
binary and restarts the service. To get a fresh code, open the device and choose
**Install agent** again; the previous code becomes invalid.

For local development, use `http://localhost:4000` and `localhost:50052` with
the local plaintext option, only when the agent runs on the backend machine.
For another machine, use a reachable HTTPS backend URL and TLS-enabled gRPC
endpoint with a trusted certificate. The installer rejects plaintext outside
localhost.

The one-line command requires a published agent release. A `v*` tag runs the
agent release workflow to publish the four platform archives, checksums, and
the installer script. Run `FLOW_PASSWORD=… node scripts/verify-agent-install.mjs`
against a disposable local stack to test the entire install and telemetry path
without touching system services.
