package collector

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

// ── Socket discovery ────────────────────────────────────────────────

func discoverDockerSocket() string {
	candidates := []string{
		"/var/run/docker.sock",
	}

	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates,
			home+"/.docker/run/docker.sock",
			home+"/.docker/desktop/docker.sock",
			home+"/.colima/default/docker.sock",
			home+"/.colima/docker.sock",
		)
	}

	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && info.Mode().Type() == os.ModeSocket {
			return path
		}
	}
	return ""
}

func newDockerClient() (*http.Client, bool) {
	sock := discoverDockerSocket()
	if sock == "" {
		return nil, false
	}
	return &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.DialTimeout("unix", sock, 3*time.Second)
			},
			MaxIdleConnsPerHost: 20,
		},
	}, true
}

func dockerGet(client *http.Client, path string) (*http.Response, error) {
	return client.Get(fmt.Sprintf("http://docker%s", path))
}

// ── API types ───────────────────────────────────────────────────────

type dockerAPIContainer struct {
	ID     string   `json:"Id"`
	Names  []string `json:"Names"`
	Image  string   `json:"Image"`
	State  string   `json:"State"`
	Status string   `json:"Status"`
}

// dockerOneShot is the response from /containers/{id}/stats?stream=false&one-shot=true
// It returns memory and network instantly but only one CPU snapshot (no delta).
type dockerOneShot struct {
	CPUStats    dockerCPUStats               `json:"cpu_stats"`
	MemoryStats dockerMemoryStats            `json:"memory_stats"`
	Networks    map[string]dockerNetworkStats `json:"networks"`
}

type dockerCPUStats struct {
	CPUUsage    dockerCPUUsage `json:"cpu_usage"`
	SystemUsage uint64         `json:"system_cpu_usage"`
	OnlineCPUs  int            `json:"online_cpus"`
}

type dockerCPUUsage struct {
	TotalUsage uint64 `json:"total_usage"`
}

type dockerMemoryStats struct {
	Usage uint64 `json:"usage"`
	Limit uint64 `json:"limit"`
}

type dockerNetworkStats struct {
	RxBytes uint64 `json:"rx_bytes"`
	TxBytes uint64 `json:"tx_bytes"`
}

// prevCPU stores the previous CPU reading for delta-based CPU% calculation.
type prevCPU struct {
	totalUsage  uint64
	systemUsage uint64
	onlineCPUs  int
}

// ── Collector state (stored on the parent Collector) ────────────────

// DockerState holds state between collection cycles for CPU delta calculation.
type DockerState struct {
	prevCPUs map[string]prevCPU // keyed by container ID
}

// ── Core collection ─────────────────────────────────────────────────

type containerSnapshot struct {
	id      string
	name    string
	image   string
	health  string
	cpu     dockerCPUStats
	ramUsed int64
	ramLim  int64
	netRx   int64
	netTx   int64
}

func listRunningContainers(client *http.Client) ([]dockerAPIContainer, error) {
	resp, err := dockerGet(client, "/containers/json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("docker API returned %d", resp.StatusCode)
	}

	var containers []dockerAPIContainer
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, err
	}
	return containers, nil
}

// fetchSnapshots fetches one-shot stats for all containers concurrently.
// one-shot=true returns instantly (no ~1s wait for CPU delta).
func fetchSnapshots(client *http.Client, containers []dockerAPIContainer) []containerSnapshot {
	snapshots := make([]containerSnapshot, len(containers))
	var wg sync.WaitGroup

	for i, c := range containers {
		wg.Add(1)
		go func(idx int, ctr dockerAPIContainer) {
			defer wg.Done()

			name := ""
			if len(ctr.Names) > 0 {
				name = strings.TrimPrefix(ctr.Names[0], "/")
			}

			snap := containerSnapshot{
				id:     ctr.ID,
				name:   name,
				image:  ctr.Image,
				health: deriveHealth(ctr.State, ctr.Status),
			}

			resp, err := dockerGet(client, fmt.Sprintf("/containers/%s/stats?stream=false&one-shot=true", ctr.ID))
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var s dockerOneShot
					if json.NewDecoder(resp.Body).Decode(&s) == nil {
						snap.cpu = s.CPUStats
						snap.ramUsed = int64(s.MemoryStats.Usage)
						snap.ramLim = int64(s.MemoryStats.Limit)
						for _, n := range s.Networks {
							snap.netRx += int64(n.RxBytes)
							snap.netTx += int64(n.TxBytes)
						}
					}
				}
			}

			snapshots[idx] = snap
		}(i, c)
	}

	wg.Wait()
	return snapshots
}

// computeCPUPercent calculates CPU% using delta between current and previous readings.
func computeCPUPercent(cur dockerCPUStats, prev prevCPU) float64 {
	cpuDelta := float64(cur.CPUUsage.TotalUsage) - float64(prev.totalUsage)
	sysDelta := float64(cur.SystemUsage) - float64(prev.systemUsage)

	if sysDelta <= 0 || cpuDelta < 0 {
		return 0
	}

	numCPUs := cur.OnlineCPUs
	if numCPUs == 0 {
		numCPUs = 1
	}

	return (cpuDelta / sysDelta) * float64(numCPUs) * 100.0
}

// ── Public API ──────────────────────────────────────────────────────

func collectDockerMetricsWithState(ts int64, state *DockerState) ([]Metric, error) {
	client, ok := newDockerClient()
	if !ok {
		return nil, nil
	}

	containers, err := listRunningContainers(client)
	if err != nil {
		return nil, nil
	}

	snapshots := fetchSnapshots(client, containers)

	if state.prevCPUs == nil {
		state.prevCPUs = make(map[string]prevCPU)
	}

	var metrics []Metric
	newPrevCPUs := make(map[string]prevCPU, len(snapshots))

	for _, s := range snapshots {
		// Store current CPU for next cycle
		newPrevCPUs[s.id] = prevCPU{
			totalUsage:  s.cpu.CPUUsage.TotalUsage,
			systemUsage: s.cpu.SystemUsage,
			onlineCPUs:  s.cpu.OnlineCPUs,
		}

		// Calculate CPU% from delta (0 on first cycle — same as network rates)
		cpuPct := 0.0
		if prev, ok := state.prevCPUs[s.id]; ok {
			cpuPct = computeCPUPercent(s.cpu, prev)
		}

		labels := map[string]string{"container": s.name, "image": s.image, "health": s.health}
		metrics = append(metrics,
			Metric{Name: "docker.container.cpu_percent", Value: cpuPct, Labels: labels, Time: ts},
			Metric{Name: "docker.container.ram_usage_bytes", Value: float64(s.ramUsed), Labels: labels, Time: ts},
			Metric{Name: "docker.container.ram_limit_bytes", Value: float64(s.ramLim), Labels: labels, Time: ts},
			Metric{Name: "docker.container.net_rx_bytes", Value: float64(s.netRx), Labels: labels, Time: ts},
			Metric{Name: "docker.container.net_tx_bytes", Value: float64(s.netTx), Labels: labels, Time: ts},
		)
	}

	state.prevCPUs = newPrevCPUs
	return metrics, nil
}

func collectDockerContainers() ([]*telemetry.DockerContainer, error) {
	client, ok := newDockerClient()
	if !ok {
		return nil, nil
	}

	containers, err := listRunningContainers(client)
	if err != nil {
		return nil, nil
	}

	snapshots := fetchSnapshots(client, containers)

	out := make([]*telemetry.DockerContainer, 0, len(snapshots))
	for _, s := range snapshots {
		out = append(out, &telemetry.DockerContainer{
			Name:          s.name,
			Image:         s.image,
			Health:        s.health,
			CpuPercent:    0, // no delta available for SystemInfo
			RamUsageBytes: s.ramUsed,
			RamLimitBytes: s.ramLim,
			NetRxBytes:    s.netRx,
			NetTxBytes:    s.netTx,
		})
	}

	return out, nil
}

// ── Helpers ─────────────────────────────────────────────────────────

func deriveHealth(state, status string) string {
	statusLower := strings.ToLower(status)
	switch {
	case strings.Contains(statusLower, "healthy"):
		return "healthy"
	case strings.Contains(statusLower, "unhealthy"):
		return "unhealthy"
	case strings.Contains(statusLower, "starting"):
		return "starting"
	case state == "running":
		return "running"
	case state == "exited":
		return "exited"
	default:
		return "unknown"
	}
}
