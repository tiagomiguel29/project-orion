#!/bin/sh
# Scope agent bootstrap. Published as install.sh with each agent release.
set -eu

usage() {
  echo 'Usage: install.sh --server https://scope.example.com --grpc scope.example.com:443 --device DEVICE_ID --pair CODE [--version vX.Y.Z] [--tls-disable]' >&2
  exit 2
}

server= grpc= device= pair= version=latest tls_disable=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --server|--grpc|--device|--pair|--version)
      [ "$#" -ge 2 ] || usage
      case "$1" in
        --server) server=$2 ;; --grpc) grpc=$2 ;; --device) device=$2 ;;
        --pair) pair=$2 ;; --version) version=$2 ;;
      esac
      shift 2 ;;
    --tls-disable) tls_disable=true; shift ;;
    *) usage ;;
  esac
done

[ -n "$server" ] && [ -n "$grpc" ] && [ -n "$device" ] && [ -n "$pair" ] || usage
printf '%s' "$device" | LC_ALL=C grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$' || usage
printf '%s' "$pair" | LC_ALL=C grep -Eq '^[A-Za-z0-9_-]{32}$' || usage
printf '%s' "$grpc" | LC_ALL=C grep -Eq '^[A-Za-z0-9.:-]+:[0-9]+$' || usage
printf '%s' "$server" | LC_ALL=C grep -Eq '^https?://[A-Za-z0-9.:-]+$' || usage

case "$server" in
  https://*) ;;
  http://localhost:*|http://127.0.0.1:*) ;;
  *) echo 'The pairing API must use HTTPS outside localhost.' >&2; exit 2 ;;
esac
if [ "$tls_disable" = true ]; then
  case "$grpc" in
    localhost:*|127.0.0.1:*) ;;
    *) echo 'Plaintext gRPC is allowed only on localhost.' >&2; exit 2 ;;
  esac
fi
if [ "$version" != latest ]; then
  printf '%s' "$version" | LC_ALL=C grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || usage
fi

for tool in curl tar mktemp install; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing required tool: $tool" >&2; exit 1; }
done
if [ "$(id -u)" -ne 0 ] && [ "${SCOPE_INSTALL_TEST_MODE:-}" != 1 ]; then
  echo 'Run the installer as root (for example, through sudo).' >&2
  exit 1
fi

case "$(uname -s)" in Linux) os=linux ;; Darwin) os=darwin ;; *) echo 'Unsupported operating system.' >&2; exit 1 ;; esac
case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;; esac
asset="scope-agent_${os}_${arch}.tar.gz"
if [ -n "${SCOPE_RELEASE_BASE:-}" ]; then
  release_base=${SCOPE_RELEASE_BASE%/}
  case "$release_base" in
    https://*|http://localhost:*|http://127.0.0.1:*) ;;
    *) echo 'Release downloads must use HTTPS outside localhost.' >&2; exit 2 ;;
  esac
elif [ "$version" = latest ]; then
  release_base=https://github.com/tiagomiguel29/project-orion/releases/latest/download
else
  release_base="https://github.com/tiagomiguel29/project-orion/releases/download/$version"
fi

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM
curl -fsSL --retry 3 "$release_base/$asset" -o "$temp_dir/$asset"
curl -fsSL --retry 3 "$release_base/SHA256SUMS" -o "$temp_dir/SHA256SUMS"
expected=$(awk -v asset="$asset" '$2 == asset {print $1}' "$temp_dir/SHA256SUMS")
[ -n "$expected" ] || { echo 'Release checksum is missing.' >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$temp_dir/$asset" | awk '{print $1}')
else
  actual=$(shasum -a 256 "$temp_dir/$asset" | awk '{print $1}')
fi
[ "$actual" = "$expected" ] || { echo 'Agent checksum mismatch.' >&2; exit 1; }
tar -xzf "$temp_dir/$asset" -C "$temp_dir" scope-agent
[ -x "$temp_dir/scope-agent" ] || { echo 'Release archive has no executable agent.' >&2; exit 1; }

# The endpoint returns only the enrollment JWT as text. A successful exchange
# consumes the short-lived pairing code atomically across backend replicas.
token=$(curl -fsSL --retry 0 -X POST "$server/devices/pair/redeem" \
  -H 'Content-Type: application/json' \
  --data "{\"code\":\"$pair\",\"deviceId\":\"$device\"}")
printf '%s' "$token" | LC_ALL=C grep -Eq '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' || {
  echo 'Pairing did not return an enrollment token.' >&2; exit 1;
}

root=${SCOPE_INSTALL_ROOT:-}
binary_dir="$root/usr/local/bin"
config_dir="$root/etc/scope"
state_dir="$root/var/lib/scope"
install -d -m 755 "$binary_dir"
install -d -m 700 "$state_dir"
install -d -m 700 "$config_dir"
install -m 755 "$temp_dir/scope-agent" "$binary_dir/.scope-agent-new-$$"
mv -f "$binary_dir/.scope-agent-new-$$" "$binary_dir/scope-agent"
umask 077
{
  printf 'AGENT_DEVICE_ID=%s\n' "$device"
  printf 'AGENT_ENROLLMENT_TOKEN=%s\n' "$token"
  printf 'AGENT_SERVER_ADDRESS=%s\n' "$grpc"
  printf 'AGENT_WAL_PATH=%s\n' "$state_dir/wal.db"
  printf 'AGENT_TLS_DISABLE=%s\n' "$tls_disable"
} > "$config_dir/.env-new-$$"
chmod 600 "$config_dir/.env-new-$$"
mv -f "$config_dir/.env-new-$$" "$config_dir/.env"

if [ "${SCOPE_INSTALL_TEST_MODE:-}" = 1 ]; then
  echo "Scope agent installed in $root (test mode; service not started)."
  exit 0
fi

if [ "$os" = linux ]; then
  command -v systemctl >/dev/null 2>&1 || { echo 'systemd is required for automatic startup.' >&2; exit 1; }
  cat > /etc/systemd/system/scope-agent.service <<'SERVICE'
[Unit]
Description=Scope host monitoring agent
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/scope/.env
ExecStart=/usr/local/bin/scope-agent
Restart=always
RestartSec=5s
StateDirectory=scope
StateDirectoryMode=0700
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/var/lib/scope

[Install]
WantedBy=multi-user.target
SERVICE
  systemctl daemon-reload
  systemctl enable scope-agent.service
  systemctl restart scope-agent.service
else
  plist=/Library/LaunchDaemons/dev.scope.agent.plist
  cat > "$plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.scope.agent</string>
  <key>ProgramArguments</key><array><string>/usr/local/bin/scope-agent</string></array>
  <key>WorkingDirectory</key><string>/etc/scope</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/var/log/scope-agent.log</string>
  <key>StandardErrorPath</key><string>/var/log/scope-agent.log</string>
</dict></plist>
PLIST
  chmod 644 "$plist"
  launchctl bootout system/dev.scope.agent 2>/dev/null || true
  launchctl bootstrap system "$plist"
fi
echo "Scope agent installed and started for $device."
