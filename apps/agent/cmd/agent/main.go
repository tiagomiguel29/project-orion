package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/joho/godotenv"

	"github.com/tiagomiguel29/project-orion-agent/internal/collector"
	"github.com/tiagomiguel29/project-orion-agent/internal/config"
	"github.com/tiagomiguel29/project-orion-agent/internal/ingest"
	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	log.Printf("agent started device=%s server=%s interval=%ds disk_path=%s",
		cfg.DeviceID,
		cfg.ServerAddress,
		cfg.IntervalSec,
		cfg.DiskPath,
	)

	grpcClient, err := ingest.New(cfg.ServerAddress, cfg.Token)
	if err != nil {
		log.Fatalf("grpc client error: %v", err)
	}
	defer func() {
		_ = grpcClient.Close()
	}()

	c := collector.New(cfg.DiskPath, cfg.TopProcesses, cfg.CloudflaredConfigDir)

	ticker := time.NewTicker(time.Duration(cfg.IntervalSec) * time.Second)
	defer ticker.Stop()

	for {
		metrics, systemInfo, err := c.CollectAll()
		if err != nil {
			log.Println("collect error:", err)
			<-ticker.C
			continue
		}

		//printMetrics(metrics)

		batch := toProtoBatch(cfg.DeviceID, cfg.IntervalSec, metrics, systemInfo)

		ack, err := grpcClient.IngestBatch(context.Background(), batch)
		if err != nil {
			log.Printf("ingest error: %v", err)
		} else {
			log.Printf("ingest ack: ok=%v msg=%s", ack.Ok, ack.Message)
		}

		<-ticker.C
	}
}

func toProtoBatch(deviceID string, intervalSec int, metrics []collector.Metric, systemInfo *telemetry.SystemInfo) *telemetry.TelemetryBatch {
	now := time.Now().UnixMilli()

	out := make([]*telemetry.MetricPoint, 0, len(metrics))
	for _, m := range metrics {
		labels := m.Labels
		if labels == nil {
			labels = map[string]string{}
		}

		out = append(out, &telemetry.MetricPoint{
			Name:     m.Name,
			Value:    m.Value,
			Labels:   labels,
			TsUnixMs: m.Time,
		})
	}

	return &telemetry.TelemetryBatch{
		DeviceId:     deviceID,
		SentAtUnixMs: now,
		IntervalSec:  uint32(intervalSec),
		Metrics:      out,
		SystemInfo:   systemInfo,
	}
}

func printMetrics(metrics []collector.Metric) {
	fmt.Println("---- metrics ----")
	for _, m := range metrics {
		fmt.Printf("%s = %.2f", m.Name, m.Value)
		if len(m.Labels) > 0 {
			fmt.Printf(" %v", m.Labels)
		}
		fmt.Println()
	}
}
