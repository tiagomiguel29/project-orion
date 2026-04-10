package ingest

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

type Client struct {
	conn   *grpc.ClientConn
	client telemetry.TelemetryIngestServiceClient
	token  string
}

func New(serverAddr, token string) (*Client, error) {
	conn, err := grpc.NewClient(
		serverAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()), // dev/local
	)
	if err != nil {
		return nil, err
	}

	return &Client{
		conn:   conn,
		client: telemetry.NewTelemetryIngestServiceClient(conn),
		token:  token,
	}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

func (c *Client) IngestBatch(ctx context.Context, batch *telemetry.TelemetryBatch) (*telemetry.IngestAck, error) {
	// Attach AGENT_TOKEN as JWT bearer token
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"authorization", "Bearer "+c.token,
	))

	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	return c.client.IngestBatch(ctx, batch)
}
