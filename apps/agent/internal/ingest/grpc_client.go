package ingest

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

// TLSConfig controls how the agent trusts the ingestion endpoint.
type TLSConfig struct {
	// Disable turns off TLS entirely and dials over plaintext. Local dev only.
	Disable bool
	// InsecureSkipVerify disables certificate verification (local testing only).
	InsecureSkipVerify bool
	// CAFile, if set, is a PEM bundle of extra roots to trust (e.g. a private CA).
	CAFile string
}

type Client struct {
	conn   *grpc.ClientConn
	client telemetry.TelemetryIngestServiceClient
}

// New dials the ingestion endpoint over TLS. The connection is lazy (grpc keeps
// the HTTP/2 channel warm and reconnects transparently), so a backend that is
// briefly down does not require re-dialing here.
func New(serverAddr string, tlsCfg TLSConfig) (*Client, error) {
	creds, err := buildTransportCreds(tlsCfg)
	if err != nil {
		return nil, err
	}

	conn, err := grpc.NewClient(serverAddr, grpc.WithTransportCredentials(creds))
	if err != nil {
		return nil, err
	}

	return NewWithConn(conn), nil
}

// NewWithConn builds a Client over an already-established connection. Primarily
// a seam for tests (e.g. in-memory bufconn) and advanced custom dialing.
func NewWithConn(conn *grpc.ClientConn) *Client {
	return &Client{
		conn:   conn,
		client: telemetry.NewTelemetryIngestServiceClient(conn),
	}
}

func buildTransportCreds(tlsCfg TLSConfig) (credentials.TransportCredentials, error) {
	if tlsCfg.Disable {
		return insecure.NewCredentials(), nil
	}
	conf := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: tlsCfg.InsecureSkipVerify,
	}
	if tlsCfg.CAFile != "" {
		pem, err := os.ReadFile(tlsCfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read TLS CA file: %w", err)
		}
		pool, err := x509.SystemCertPool()
		if err != nil || pool == nil {
			pool = x509.NewCertPool()
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("no certificates found in %s", tlsCfg.CAFile)
		}
		conf.RootCAs = pool
	}
	return credentials.NewTLS(conf), nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// ExchangeToken swaps a durable enrollment token for a short-lived access token.
// It is unauthenticated at the transport level (auth is the enrollment token
// itself), so it works even when the agent has no valid access token.
func (c *Client) ExchangeToken(ctx context.Context, enrollmentToken string) (string, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	resp, err := c.client.ExchangeToken(ctx, &telemetry.TokenExchangeRequest{
		EnrollmentToken: enrollmentToken,
	})
	if err != nil {
		return "", 0, err
	}
	return resp.GetAccessToken(), resp.GetExpiresInSec(), nil
}

// IngestBatch sends a batch using the given access token and returns the
// server's ingest status. Transport-level errors are mapped to a status so the
// caller has a single value to branch on:
//   - UNAUTHENTICATED when the token was rejected (refresh and retry)
//   - RETRY for any other transport failure (keep buffered, back off)
func (c *Client) IngestBatch(
	ctx context.Context,
	accessToken string,
	batch *telemetry.TelemetryBatch,
) (telemetry.IngestStatus, error) {
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"authorization", "Bearer "+accessToken,
	))
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	ack, err := c.client.IngestBatch(ctx, batch)
	if err != nil {
		if status.Code(err) == codes.Unauthenticated {
			return telemetry.IngestStatus_INGEST_STATUS_UNAUTHENTICATED, err
		}
		return telemetry.IngestStatus_INGEST_STATUS_RETRY, err
	}
	return ack.GetStatus(), nil
}
