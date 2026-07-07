package auth

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

type fakeExchanger struct {
	calls int
	ttl   int64
	err   error
}

func (f *fakeExchanger) ExchangeToken(_ context.Context, _ string) (string, int64, error) {
	f.calls++
	if f.err != nil {
		return "", 0, f.err
	}
	return fmt.Sprintf("access-%d", f.calls), f.ttl, nil
}

func TestTokenCachesUntilNearExpiry(t *testing.T) {
	ex := &fakeExchanger{ttl: 900}
	tm := NewTokenManager(ex, "enroll")

	tok, err := tm.Token(context.Background())
	if err != nil || tok != "access-1" {
		t.Fatalf("first token: %q err=%v", tok, err)
	}
	tok, _ = tm.Token(context.Background())
	if tok != "access-1" || ex.calls != 1 {
		t.Fatalf("expected cached token, got %q calls=%d", tok, ex.calls)
	}
}

func TestInvalidateForcesRefresh(t *testing.T) {
	ex := &fakeExchanger{ttl: 900}
	tm := NewTokenManager(ex, "enroll")

	_, _ = tm.Token(context.Background())
	tm.Invalidate()
	tok, _ := tm.Token(context.Background())
	if tok != "access-2" || ex.calls != 2 {
		t.Fatalf("expected refreshed token after invalidate, got %q calls=%d", tok, ex.calls)
	}
}

func TestRefreshesWhenWithinMargin(t *testing.T) {
	// TTL below the refresh margin → every call is considered stale and refreshes.
	ex := &fakeExchanger{ttl: 30}
	tm := NewTokenManager(ex, "enroll")

	_, _ = tm.Token(context.Background())
	_, _ = tm.Token(context.Background())
	if ex.calls != 2 {
		t.Fatalf("expected refresh within margin, calls=%d", ex.calls)
	}
}

func TestExchangeErrorPropagates(t *testing.T) {
	ex := &fakeExchanger{err: errors.New("boom")}
	tm := NewTokenManager(ex, "enroll")
	if _, err := tm.Token(context.Background()); err == nil {
		t.Fatal("expected error from failed exchange")
	}
}
