package collector

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCloudflareMetricsWithoutTunnelLabels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/diag/tunnel":
			_, _ = w.Write([]byte(`{"tunnelID":"tunnel-123"}`))
		case "/metrics":
			_, _ = w.Write([]byte("cloudflared_tunnel_ha_connections 4\ncloudflared_tunnel_total_requests 27\ncloudflared_tunnel_request_errors 2\n"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	metrics, err := collectCloudflareTunnelMetricsFromURL(123, t.TempDir(), server.URL+"/metrics")
	if err != nil {
		t.Fatal(err)
	}
	if len(metrics) != 3 {
		t.Fatalf("got %d metrics, want 3", len(metrics))
	}
	want := map[string]float64{
		"cloudflare.tunnel.ha_connections": 4,
		"cloudflare.tunnel.total_requests": 27,
		"cloudflare.tunnel.request_errors": 2,
	}
	for _, metric := range metrics {
		if metric.Value != want[metric.Name] {
			t.Errorf("%s = %v, want %v", metric.Name, metric.Value, want[metric.Name])
		}
		if metric.Labels["tunnel_id"] != "tunnel-123" {
			t.Errorf("missing tunnel ID on %s", metric.Name)
		}
		if metric.Labels["status"] != "healthy" {
			t.Errorf("wrong status on %s", metric.Name)
		}
	}
}
