package config

import "github.com/caarlos0/env/v11"

type Config struct {
	ServerAddress string `env:"AGENT_SERVER_ADDRESS,required"`

	DeviceID string `env:"AGENT_DEVICE_ID,required"`

	// Durable, revocable credential issued once at device creation. The agent
	// exchanges it for short-lived access tokens and never needs manual
	// re-provisioning, even after long downtime.
	EnrollmentToken string `env:"AGENT_ENROLLMENT_TOKEN,required"`

	// ── TLS ───────────────────────────────────────────────────────────────
	// TLS is on by default (public internet). Set skip-verify only for local
	// testing against a self-signed proxy; set CAFile to trust a private CA
	// (e.g. Caddy's internal CA) without disabling verification entirely.
	TLSInsecureSkipVerify bool   `env:"AGENT_TLS_INSECURE_SKIP_VERIFY" envDefault:"false"`
	TLSCAFile             string `env:"AGENT_TLS_CA_FILE" envDefault:""`

	// ── Buffering ─────────────────────────────────────────────────────────
	// Disk-backed write-ahead log so telemetry survives network blips, backend
	// restarts, and agent restarts. Point this at a persistent volume for
	// restart durability.
	WALPath        string `env:"AGENT_WAL_PATH" envDefault:"orion-agent.wal"`
	WALMaxBatches  int    `env:"AGENT_WAL_MAX_BATCHES" envDefault:"10000"`

	IntervalSec  int    `env:"AGENT_INTERVAL_SEC" envDefault:"5"`
	DiskPath     string `env:"AGENT_DISK_PATH" envDefault:"/"`
	TopProcesses int    `env:"AGENT_TOP_PROCESSES" envDefault:"10"`

	CloudflaredConfigDir string `env:"AGENT_CLOUDFLARED_CONFIG_DIR" envDefault:""`
}

func Load() (Config, error) {
	var cfg Config
	err := env.Parse(&cfg)
	return cfg, err
}
