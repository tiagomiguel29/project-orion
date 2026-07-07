// Package auth manages the agent's short-lived access token. The agent holds a
// durable enrollment token and exchanges it for access tokens on demand,
// refreshing before expiry and re-exchanging automatically after the server
// reports an expired/invalid token. A machine offline for days simply performs
// one exchange on reconnect — no manual token provisioning.
package auth

import (
	"context"
	"sync"
	"time"
)

// Exchanger swaps a durable enrollment token for a short-lived access token.
// Implemented by the gRPC client (kept as an interface to avoid an import cycle).
type Exchanger interface {
	ExchangeToken(ctx context.Context, enrollmentToken string) (accessToken string, expiresInSec int64, err error)
}

// refreshMargin refreshes a token this long before it actually expires, so a
// batch is never sent with an already-expired token.
const refreshMargin = 60 * time.Second

type TokenManager struct {
	exchanger       Exchanger
	enrollmentToken string

	mu          sync.Mutex
	accessToken string
	expiresAt   time.Time
}

func NewTokenManager(ex Exchanger, enrollmentToken string) *TokenManager {
	return &TokenManager{exchanger: ex, enrollmentToken: enrollmentToken}
}

// Token returns a currently-valid access token, exchanging the enrollment token
// if the cached one is missing or within the refresh margin of expiry.
func (t *TokenManager) Token(ctx context.Context) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.accessToken != "" && time.Now().Before(t.expiresAt.Add(-refreshMargin)) {
		return t.accessToken, nil
	}
	return t.refreshLocked(ctx)
}

// Invalidate discards the cached token so the next Token call re-exchanges.
// Called after the server rejects a token as expired/invalid.
func (t *TokenManager) Invalidate() {
	t.mu.Lock()
	t.accessToken = ""
	t.expiresAt = time.Time{}
	t.mu.Unlock()
}

func (t *TokenManager) refreshLocked(ctx context.Context) (string, error) {
	token, expiresInSec, err := t.exchanger.ExchangeToken(ctx, t.enrollmentToken)
	if err != nil {
		return "", err
	}
	t.accessToken = token
	t.expiresAt = time.Now().Add(time.Duration(expiresInSec) * time.Second)
	return token, nil
}
