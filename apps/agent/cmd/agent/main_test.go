package main

import (
	"context"
	"testing"
	"time"

	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		name string
		st   telemetry.IngestStatus
		want sendAction
	}{
		{"accepted → drop", telemetry.IngestStatus_INGEST_STATUS_ACCEPTED, actionDrop},
		{"duplicate → drop", telemetry.IngestStatus_INGEST_STATUS_DUPLICATE, actionDrop},
		{"unauthenticated → refresh", telemetry.IngestStatus_INGEST_STATUS_UNAUTHENTICATED, actionRefresh},
		{"retry → retry", telemetry.IngestStatus_INGEST_STATUS_RETRY, actionRetry},
		{"unspecified → retry", telemetry.IngestStatus_INGEST_STATUS_UNSPECIFIED, actionRetry},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classify(tc.st); got != tc.want {
				t.Fatalf("classify(%v) = %v, want %v", tc.st, got, tc.want)
			}
		})
	}
}

func TestBackoffGrowsAndCaps(t *testing.T) {
	b := newBackoff()
	// Full jitter means each value is in [0, cur]; assert the ceiling grows and
	// is capped, by sampling the max many times per step.
	prevCeil := baseBackoff
	for i := 0; i < 20; i++ {
		var maxSeen time.Duration
		ceil := b.cur
		for j := 0; j < 500; j++ {
			bb := &backoff{cur: ceil}
			if d := bb.next(); d > maxSeen {
				maxSeen = d
			}
		}
		if maxSeen > ceil {
			t.Fatalf("jitter exceeded ceiling: %v > %v", maxSeen, ceil)
		}
		b.next() // advance the real backoff
		if b.cur < prevCeil && b.cur != maxBackoff {
			t.Fatalf("backoff ceiling shrank: %v < %v", b.cur, prevCeil)
		}
		prevCeil = b.cur
	}
	if b.cur != maxBackoff {
		t.Fatalf("backoff did not cap at %v, got %v", maxBackoff, b.cur)
	}
}

func TestBackoffReset(t *testing.T) {
	b := newBackoff()
	for i := 0; i < 5; i++ {
		b.next()
	}
	b.reset()
	if b.cur != baseBackoff {
		t.Fatalf("reset did not restore base: got %v want %v", b.cur, baseBackoff)
	}
}

func TestNewBatchIDUniqueAndFormat(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		id := newBatchID()
		if len(id) != 32 { // 16 random bytes as hex
			t.Fatalf("unexpected batch id length %d: %q", len(id), id)
		}
		if seen[id] {
			t.Fatalf("duplicate batch id generated: %q", id)
		}
		seen[id] = true
	}
}

func TestSleepCtxCancels(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if !sleepCtx(ctx, time.Hour) {
		t.Fatal("sleepCtx should report cancellation immediately")
	}
	if sleepCtx(context.Background(), time.Millisecond) {
		t.Fatal("sleepCtx should return false when the timer fires")
	}
}
