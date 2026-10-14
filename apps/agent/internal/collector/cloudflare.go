package collector

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/process"
)

// cloudflaredCredentials matches the JSON structure of ~/.cloudflared/<UUID>.json
type cloudflaredCredentials struct {
	TunnelID   string `json:"TunnelID"`
	TunnelName string `json:"TunnelName"`
}

// discoverCloudflaredMetricsURLs checks running cloudflared processes and returns
// their metrics URLs. Separate processes may serve separate tunnels.
func discoverCloudflaredMetricsURLs() []string {
	procs, err := process.Processes()
	if err != nil {
		return nil
	}

	urls := make(map[string]struct{})
	needsDefaultProbe := false
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name != "cloudflared" {
			continue
		}

		cmdline, err := p.CmdlineSlice()
		if err != nil {
			needsDefaultProbe = true
			continue
		}

		found := false
		for i, arg := range cmdline {
			// Handles: --metrics localhost:3456 or --metrics=localhost:3456
			if arg == "--metrics" && i+1 < len(cmdline) {
				urls[fmt.Sprintf("http://%s/metrics", cmdline[i+1])] = struct{}{}
				found = true
				break
			}
			if strings.HasPrefix(arg, "--metrics=") {
				addr := strings.TrimPrefix(arg, "--metrics=")
				urls[fmt.Sprintf("http://%s/metrics", addr)] = struct{}{}
				found = true
				break
			}
		}
		if !found {
			needsDefaultProbe = true
		}
	}

	if needsDefaultProbe {
		for _, url := range defaultCloudflaredMetricsURLs() {
			urls[url] = struct{}{}
		}
	}
	result := make([]string, 0, len(urls))
	for url := range urls {
		result = append(result, url)
	}
	return result
}

func defaultCloudflaredMetricsURLs() []string {
	client := &http.Client{Timeout: 300 * time.Millisecond}
	var urls []string
	for port := 20241; port <= 20245; port++ {
		url := fmt.Sprintf("http://127.0.0.1:%d/metrics", port)
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			urls = append(urls, url)
		}
	}
	return urls
}

// collectCloudflareTunnelMetrics auto-discovers cloudflared, scrapes its
// Prometheus metrics endpoint, and emits per-tunnel metrics with labels.
// Returns nil, nil when cloudflared is not running or unreachable.
func collectCloudflareTunnelMetrics(ts int64, configDir string) ([]Metric, error) {
	var all []Metric
	for _, metricsURL := range discoverCloudflaredMetricsURLs() {
		metrics, err := collectCloudflareTunnelMetricsFromURL(ts, configDir, metricsURL)
		if err == nil {
			all = append(all, metrics...)
		}
	}
	return all, nil
}

func collectCloudflareTunnelMetricsFromURL(ts int64, configDir, metricsURL string) ([]Metric, error) {
	// Build tunnel ID → name map from credential files
	nameMap := buildTunnelNameMap(configDir)

	// Scrape Prometheus endpoint
	client := &http.Client{Timeout: 3 * time.Second}
	// Current cloudflared metrics usually have no tunnel_id label. Its local
	// diagnostic endpoint identifies the tunnel served by this process.
	diagnosticURL := strings.TrimSuffix(metricsURL, "/metrics") + "/diag/tunnel"
	diagnosticID := ""
	if diagResp, err := client.Get(diagnosticURL); err == nil {
		if diagResp.StatusCode == http.StatusOK {
			var diagnostic struct {
				TunnelID string `json:"tunnelID"`
			}
			if json.NewDecoder(diagResp.Body).Decode(&diagnostic) == nil {
				diagnosticID = diagnostic.TunnelID
			}
		}
		_ = diagResp.Body.Close()
	}
	if diagnosticID == "" && len(nameMap) == 1 {
		for id := range nameMap {
			diagnosticID = id
		}
	}

	resp, err := client.Get(metricsURL)
	if err != nil {
		return nil, nil // endpoint unreachable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}

	// Parse Prometheus text format and group by tunnel_id
	type tunnelData struct {
		haConnections float64
		totalRequests float64
		requestErrors float64
	}

	tunnels := make(map[string]*tunnelData)

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" || line[0] == '#' {
			continue
		}

		name, labels, value := parsePrometheusLine(line)
		if name != "cloudflared_tunnel_ha_connections" &&
			name != "cloudflared_tunnel_total_requests" &&
			name != "cloudflared_tunnel_request_errors" {
			continue
		}

		tunnelID := labels["tunnel_id"]
		if tunnelID == "" {
			tunnelID = diagnosticID
		}
		if tunnelID == "" {
			continue
		}

		td, ok := tunnels[tunnelID]
		if !ok {
			td = &tunnelData{}
			tunnels[tunnelID] = td
		}

		switch name {
		case "cloudflared_tunnel_ha_connections":
			td.haConnections += value
		case "cloudflared_tunnel_total_requests":
			td.totalRequests += value
		case "cloudflared_tunnel_request_errors":
			td.requestErrors += value
		}
	}

	// Convert to metrics
	var metrics []Metric
	for tunnelID, td := range tunnels {
		tunnelName := nameMap[tunnelID]
		if tunnelName == "" {
			tunnelName = tunnelID
		}

		status := "down"
		switch {
		case td.haConnections >= 4:
			status = "healthy"
		case td.haConnections >= 1:
			status = "degraded"
		}

		labels := map[string]string{
			"tunnel_id":   tunnelID,
			"tunnel_name": tunnelName,
			"status":      status,
		}

		metrics = append(metrics,
			Metric{Name: "cloudflare.tunnel.ha_connections", Value: td.haConnections, Labels: labels, Time: ts},
			Metric{Name: "cloudflare.tunnel.total_requests", Value: td.totalRequests, Labels: labels, Time: ts},
			Metric{Name: "cloudflare.tunnel.request_errors", Value: td.requestErrors, Labels: labels, Time: ts},
		)
	}

	return metrics, nil
}

// buildTunnelNameMap reads credential JSON files from configDir to build
// a tunnel ID → tunnel name mapping.
func buildTunnelNameMap(configDir string) map[string]string {
	nameMap := make(map[string]string)
	if configDir == "" {
		// Default to ~/.cloudflared
		home, err := os.UserHomeDir()
		if err != nil {
			return nameMap
		}
		configDir = filepath.Join(home, ".cloudflared")
	}

	matches, err := filepath.Glob(filepath.Join(configDir, "*.json"))
	if err != nil {
		return nameMap
	}

	for _, path := range matches {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var creds cloudflaredCredentials
		if err := json.Unmarshal(data, &creds); err != nil {
			continue
		}
		if creds.TunnelID != "" && creds.TunnelName != "" {
			nameMap[creds.TunnelID] = creds.TunnelName
		}
	}

	return nameMap
}

// parsePrometheusLine parses a single Prometheus exposition line.
// Returns metric name, labels map, and value.
// Example line: cloudflared_tunnel_ha_connections{tunnel_id="abc-123"} 4
func parsePrometheusLine(line string) (string, map[string]string, float64) {
	labels := make(map[string]string)

	// Split off value (last space-separated token)
	braceEnd := strings.LastIndex(line, "}")
	var nameAndLabels, valueStr string

	if braceEnd >= 0 {
		nameAndLabels = line[:braceEnd+1]
		valueStr = strings.TrimSpace(line[braceEnd+1:])
	} else {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			return "", nil, 0
		}
		nameAndLabels = parts[0]
		valueStr = parts[1]
	}

	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return "", nil, 0
	}

	// Split name from labels
	braceStart := strings.Index(nameAndLabels, "{")
	var name string
	if braceStart >= 0 {
		name = nameAndLabels[:braceStart]
		labelsStr := nameAndLabels[braceStart+1:]
		labelsStr = strings.TrimSuffix(labelsStr, "}")

		// Parse key="value" pairs
		for _, pair := range splitLabels(labelsStr) {
			pair = strings.TrimSpace(pair)
			eqIdx := strings.Index(pair, "=")
			if eqIdx < 0 {
				continue
			}
			key := pair[:eqIdx]
			val := strings.Trim(pair[eqIdx+1:], `"`)
			labels[key] = val
		}
	} else {
		name = nameAndLabels
	}

	return name, labels, value
}

// splitLabels splits a Prometheus label string by commas, respecting quoted values.
func splitLabels(s string) []string {
	var parts []string
	var current strings.Builder
	inQuote := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch == '"' && (i == 0 || s[i-1] != '\\'):
			inQuote = !inQuote
			current.WriteByte(ch)
		case ch == ',' && !inQuote:
			parts = append(parts, current.String())
			current.Reset()
		default:
			current.WriteByte(ch)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}
