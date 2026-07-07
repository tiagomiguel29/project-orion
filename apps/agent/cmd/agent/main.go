package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	mrand "math/rand"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"google.golang.org/protobuf/proto"

	"github.com/tiagomiguel29/project-orion-agent/internal/auth"
	"github.com/tiagomiguel29/project-orion-agent/internal/buffer"
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

	log.Printf("agent started device=%s server=%s interval=%ds disk_path=%s tls_skip_verify=%v wal=%s",
		cfg.DeviceID, cfg.ServerAddress, cfg.IntervalSec, cfg.DiskPath,
		cfg.TLSInsecureSkipVerify, cfg.WALPath,
	)

	// Graceful shutdown: cancel the context on SIGINT/SIGTERM so both loops
	// exit and the WAL is closed cleanly. Undrained batches persist for the
	// next start.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	wal, err := buffer.Open(cfg.WALPath, cfg.WALMaxBatches)
	if err != nil {
		log.Fatalf("wal open error: %v", err)
	}
	defer func() { _ = wal.Close() }()

	client, err := ingest.New(cfg.ServerAddress, ingest.TLSConfig{
		InsecureSkipVerify: cfg.TLSInsecureSkipVerify,
		CAFile:             cfg.TLSCAFile,
	})
	if err != nil {
		log.Fatalf("grpc client error: %v", err)
	}
	defer func() { _ = client.Close() }()

	tokens := auth.NewTokenManager(client, cfg.EnrollmentToken)
	c := collector.New(cfg.DiskPath, cfg.TopProcesses, cfg.CloudflaredConfigDir)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); collectLoop(ctx, cfg, c, wal) }()
	go func() { defer wg.Done(); sendLoop(ctx, client, tokens, wal) }()

	<-ctx.Done()
	log.Println("shutdown signal received, stopping...")
	wg.Wait()
	log.Println("agent stopped")
}

// collectLoop samples metrics on the interval and appends each batch to the WAL.
// Persistence is decoupled from delivery — the send loop drains independently.
func collectLoop(ctx context.Context, cfg config.Config, c *collector.Collector, wal *buffer.WAL) {
	ticker := time.NewTicker(time.Duration(cfg.IntervalSec) * time.Second)
	defer ticker.Stop()

	for {
		metrics, systemInfo, err := c.CollectAll()
		if err != nil {
			log.Println("collect error:", err)
		} else {
			batch := toProtoBatch(cfg.DeviceID, cfg.IntervalSec, metrics, systemInfo)
			payload, err := proto.Marshal(batch)
			if err != nil {
				log.Println("marshal error:", err)
			} else if err := wal.Append(batch.BatchId, payload); err != nil {
				log.Println("wal append error:", err)
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// sendLoop drains the WAL oldest-first with at-least-once semantics: a batch is
// deleted only once the server confirms it was persisted (or is a duplicate).
func sendLoop(ctx context.Context, client *ingest.Client, tokens *auth.TokenManager, wal *buffer.WAL) {
	b := newBackoff()

	for {
		if ctx.Err() != nil {
			return
		}

		item, err := wal.Oldest()
		if err != nil {
			log.Println("wal read error:", err)
			if sleepCtx(ctx, b.next()) {
				return
			}
			continue
		}
		if item == nil {
			// Nothing buffered — poll again shortly.
			if sleepCtx(ctx, 200*time.Millisecond) {
				return
			}
			continue
		}

		var batch telemetry.TelemetryBatch
		if err := proto.Unmarshal(item.Payload, &batch); err != nil {
			log.Printf("dropping corrupt WAL item %x: %v", item.Key, err)
			_ = wal.Delete(item.Key)
			continue
		}

		token, err := tokens.Token(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("token exchange failed: %v", err)
			if sleepCtx(ctx, b.next()) {
				return
			}
			continue
		}

		st, err := client.IngestBatch(ctx, token, &batch)
		switch classify(st) {
		case actionDrop:
			// Durably accepted (or duplicate) — remove from the WAL.
			_ = wal.Delete(item.Key)
			b.reset()

		case actionRefresh:
			log.Println("access token rejected — refreshing")
			tokens.Invalidate()
			if sleepCtx(ctx, 250*time.Millisecond) {
				return
			}

		case actionRetry: // keep buffered, back off.
			if err != nil {
				log.Printf("ingest retry: %v", err)
			} else {
				log.Println("ingest retry: server asked to retry")
			}
			if sleepCtx(ctx, b.next()) {
				return
			}
		}
	}
}

// sendAction is the decision the send loop takes for a given ingest status.
type sendAction int

const (
	// actionDrop: durably accepted or duplicate — delete from the WAL.
	actionDrop sendAction = iota
	// actionRefresh: token expired/invalid — refresh and retry.
	actionRefresh
	// actionRetry: transient failure — keep buffered and back off.
	actionRetry
)

// classify maps an ingest status to the send loop's next action. Pure function
// so the delivery-critical decision matrix is unit-testable.
func classify(st telemetry.IngestStatus) sendAction {
	switch st {
	case telemetry.IngestStatus_INGEST_STATUS_ACCEPTED,
		telemetry.IngestStatus_INGEST_STATUS_DUPLICATE:
		return actionDrop
	case telemetry.IngestStatus_INGEST_STATUS_UNAUTHENTICATED:
		return actionRefresh
	default: // RETRY / UNSPECIFIED / transport error — keep buffered.
		return actionRetry
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
		BatchId:      newBatchID(),
	}
}

// newBatchID returns a random 128-bit idempotency key as hex. Generated once
// per batch and reused across retries so the server can dedupe.
func newBatchID() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// crypto/rand should never fail; fall back to a timestamp-based id.
		return hex.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(buf[:])
}

// sleepCtx sleeps for d or until ctx is cancelled. Returns true if cancelled.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return true
	case <-t.C:
		return false
	}
}

// backoff is exponential with full jitter, capped at maxBackoff.
type backoff struct {
	cur time.Duration
}

const (
	baseBackoff = 500 * time.Millisecond
	maxBackoff  = 30 * time.Second
)

func newBackoff() *backoff { return &backoff{cur: baseBackoff} }

func (b *backoff) reset() { b.cur = baseBackoff }

func (b *backoff) next() time.Duration {
	d := b.cur
	// Full jitter: sleep a random duration in [0, d].
	jittered := time.Duration(mrand.Int63n(int64(d) + 1))
	if b.cur < maxBackoff {
		b.cur *= 2
		if b.cur > maxBackoff {
			b.cur = maxBackoff
		}
	}
	return jittered
}
