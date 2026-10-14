// A local cloudflared-shaped metrics server for the end-to-end smoke test.
// It never contacts Cloudflare.
package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
)

func main() {
	address := flag.String("metrics", "127.0.0.1:20241", "local metrics address")
	tunnelID := flag.String("tunnel-id", "scope-e2e-tunnel", "simulated tunnel ID")
	connections := flag.Int("connections", 4, "simulated HA connections")
	flag.Parse()
	listener, err := net.Listen("tcp", *address)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	http.HandleFunc("/diag/tunnel", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"tunnelID":%q}`, *tunnelID)
	})
	http.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		_, _ = fmt.Fprintf(w, "cloudflared_tunnel_ha_connections %d\ncloudflared_tunnel_total_requests 27\ncloudflared_tunnel_request_errors 2\n", *connections)
	})
	fmt.Println("READY")
	if err := http.Serve(listener, nil); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
