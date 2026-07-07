package main

import (
	"context"
	"net"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/tiagomiguel29/project-orion-agent/internal/auth"
	"github.com/tiagomiguel29/project-orion-agent/internal/buffer"
	"github.com/tiagomiguel29/project-orion-agent/internal/ingest"
	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

// loopFake is an in-memory server whose IngestBatch walks a scripted sequence of
// (status, error) pairs, repeating the last entry once exhausted.
type loopFake struct {
	telemetry.UnimplementedTelemetryIngestServiceServer

	mu            sync.Mutex
	exchangeCalls int
	ingestCalls   int
	statuses      []telemetry.IngestStatus
	errs          []error
}

func (f *loopFake) ExchangeToken(_ context.Context, _ *telemetry.TokenExchangeRequest) (*telemetry.TokenExchangeResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.exchangeCalls++
	return &telemetry.TokenExchangeResponse{AccessToken: "access", ExpiresInSec: 900}, nil
}

func (f *loopFake) IngestBatch(_ context.Context, _ *telemetry.TelemetryBatch) (*telemetry.IngestAck, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	i := f.ingestCalls
	f.ingestCalls++
	pick := func(n int) int {
		if i < n {
			return i
		}
		return n - 1
	}
	if len(f.errs) > 0 {
		if err := f.errs[pick(len(f.errs))]; err != nil {
			return nil, err
		}
	}
	return &telemetry.IngestAck{Status: f.statuses[pick(len(f.statuses))]}, nil
}

func (f *loopFake) counts() (exchange, ingest int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.exchangeCalls, f.ingestCalls
}

func startLoopServer(t *testing.T, f *loopFake) *ingest.Client {
	t.Helper()
	lis := bufconn.Listen(1024 * 1024)
	s := grpc.NewServer()
	telemetry.RegisterTelemetryIngestServiceServer(s, f)
	go func() { _ = s.Serve(lis) }()
	t.Cleanup(s.Stop)

	conn, err := grpc.NewClient(
		"passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return ingest.NewWithConn(conn)
}

func seedWAL(t *testing.T, n int) *buffer.WAL {
	t.Helper()
	w, err := buffer.Open(filepath.Join(t.TempDir(), "wal.db"), 1000)
	if err != nil {
		t.Fatalf("open wal: %v", err)
	}
	t.Cleanup(func() { _ = w.Close() })
	for i := 0; i < n; i++ {
		payload, err := proto.Marshal(&telemetry.TelemetryBatch{BatchId: "b", Metrics: []*telemetry.MetricPoint{{Name: "cpu", Value: 1}}})
		if err != nil {
			t.Fatal(err)
		}
		if err := w.Append("b", payload); err != nil {
			t.Fatal(err)
		}
	}
	return w
}

func waitDrain(t *testing.T, w *buffer.WAL, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		n, err := w.Len()
		if err != nil {
			t.Fatalf("wal len: %v", err)
		}
		if n == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("WAL did not drain within %v", timeout)
}

func runLoop(client *ingest.Client, wal *buffer.WAL) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())
	tokens := auth.NewTokenManager(client, "enroll")
	go sendLoop(ctx, client, tokens, wal)
	return cancel
}

func TestSendLoopDrainsOnAccepted(t *testing.T) {
	f := &loopFake{statuses: []telemetry.IngestStatus{telemetry.IngestStatus_INGEST_STATUS_ACCEPTED}}
	client := startLoopServer(t, f)
	wal := seedWAL(t, 3)

	cancel := runLoop(client, wal)
	defer cancel()

	waitDrain(t, wal, 3*time.Second)
	if _, ingestCalls := f.counts(); ingestCalls < 3 {
		t.Fatalf("expected at least 3 ingest calls, got %d", ingestCalls)
	}
}

func TestSendLoopRetriesThenDrains(t *testing.T) {
	// First attempt says RETRY, subsequent attempts ACCEPTED.
	f := &loopFake{statuses: []telemetry.IngestStatus{
		telemetry.IngestStatus_INGEST_STATUS_RETRY,
		telemetry.IngestStatus_INGEST_STATUS_ACCEPTED,
	}}
	client := startLoopServer(t, f)
	wal := seedWAL(t, 1)

	cancel := runLoop(client, wal)
	defer cancel()

	waitDrain(t, wal, 3*time.Second)
	if _, ingestCalls := f.counts(); ingestCalls < 2 {
		t.Fatalf("expected a retry (>=2 ingest calls), got %d", ingestCalls)
	}
}

func TestSendLoopRefreshesTokenOnUnauthenticated(t *testing.T) {
	// First ingest is rejected as unauthenticated, then accepted. The loop must
	// invalidate the token and re-exchange before succeeding.
	f := &loopFake{
		statuses: []telemetry.IngestStatus{
			telemetry.IngestStatus_INGEST_STATUS_UNSPECIFIED,
			telemetry.IngestStatus_INGEST_STATUS_ACCEPTED,
		},
		errs: []error{status.Error(codes.Unauthenticated, "expired"), nil},
	}
	client := startLoopServer(t, f)
	wal := seedWAL(t, 1)

	cancel := runLoop(client, wal)
	defer cancel()

	waitDrain(t, wal, 3*time.Second)
	if exchangeCalls, _ := f.counts(); exchangeCalls < 2 {
		t.Fatalf("expected a token re-exchange (>=2), got %d", exchangeCalls)
	}
}
