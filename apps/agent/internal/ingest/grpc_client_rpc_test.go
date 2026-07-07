package ingest

import (
	"context"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

// fakeServer is a configurable in-memory TelemetryIngestService.
type fakeServer struct {
	telemetry.UnimplementedTelemetryIngestServiceServer

	exchangeResp *telemetry.TokenExchangeResponse
	exchangeErr  error

	ingestStatus telemetry.IngestStatus
	ingestErr    error

	ingestCalls int
	lastAuth    string
}

func (f *fakeServer) ExchangeToken(_ context.Context, _ *telemetry.TokenExchangeRequest) (*telemetry.TokenExchangeResponse, error) {
	if f.exchangeErr != nil {
		return nil, f.exchangeErr
	}
	return f.exchangeResp, nil
}

func (f *fakeServer) IngestBatch(ctx context.Context, _ *telemetry.TelemetryBatch) (*telemetry.IngestAck, error) {
	f.ingestCalls++
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if v := md.Get("authorization"); len(v) > 0 {
			f.lastAuth = v[0]
		}
	}
	if f.ingestErr != nil {
		return nil, f.ingestErr
	}
	return &telemetry.IngestAck{Status: f.ingestStatus}, nil
}

func startFake(t *testing.T, f *fakeServer) *Client {
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
		t.Fatalf("dial bufconn: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return NewWithConn(conn)
}

func TestExchangeToken_Success(t *testing.T) {
	c := startFake(t, &fakeServer{
		exchangeResp: &telemetry.TokenExchangeResponse{AccessToken: "tok", ExpiresInSec: 900},
	})
	access, ttl, err := c.ExchangeToken(context.Background(), "enroll")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if access != "tok" || ttl != 900 {
		t.Fatalf("got access=%q ttl=%d", access, ttl)
	}
}

func TestExchangeToken_Error(t *testing.T) {
	c := startFake(t, &fakeServer{
		exchangeErr: status.Error(codes.Unauthenticated, "revoked"),
	})
	if _, _, err := c.ExchangeToken(context.Background(), "enroll"); err == nil {
		t.Fatal("expected an error")
	}
}

func TestIngestBatch_AcceptedForwardsBearerToken(t *testing.T) {
	f := &fakeServer{ingestStatus: telemetry.IngestStatus_INGEST_STATUS_ACCEPTED}
	c := startFake(t, f)

	st, err := c.IngestBatch(context.Background(), "mytoken", &telemetry.TelemetryBatch{BatchId: "b1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if st != telemetry.IngestStatus_INGEST_STATUS_ACCEPTED {
		t.Fatalf("got status %v", st)
	}
	if f.lastAuth != "Bearer mytoken" {
		t.Fatalf("access token not forwarded, got %q", f.lastAuth)
	}
}

func TestIngestBatch_UnauthenticatedMapping(t *testing.T) {
	c := startFake(t, &fakeServer{ingestErr: status.Error(codes.Unauthenticated, "expired")})
	st, err := c.IngestBatch(context.Background(), "tok", &telemetry.TelemetryBatch{})
	if err == nil {
		t.Fatal("expected transport error")
	}
	if st != telemetry.IngestStatus_INGEST_STATUS_UNAUTHENTICATED {
		t.Fatalf("expected UNAUTHENTICATED mapping, got %v", st)
	}
}

func TestIngestBatch_OtherErrorMapsToRetry(t *testing.T) {
	c := startFake(t, &fakeServer{ingestErr: status.Error(codes.Unavailable, "down")})
	st, err := c.IngestBatch(context.Background(), "tok", &telemetry.TelemetryBatch{})
	if err == nil {
		t.Fatal("expected transport error")
	}
	if st != telemetry.IngestStatus_INGEST_STATUS_RETRY {
		t.Fatalf("expected RETRY mapping, got %v", st)
	}
}
