package config

import "github.com/caarlos0/env/v11"

type Config struct {
	ServerAddress string `env:"AGENT_SERVER_ADDRESS,required"`

	DeviceID string `env:"AGENT_DEVICE_ID,required"`
	Token    string `env:"AGENT_TOKEN,required"`

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
