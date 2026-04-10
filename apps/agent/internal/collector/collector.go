package collector

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	gnet "github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
	"github.com/shirou/gopsutil/v4/sensors"
	telemetry "github.com/tiagomiguel29/project-orion-agent/telemetry/gen/proto"
)

type Metric struct {
	Name   string
	Value  float64
	Labels map[string]string
	Time   int64
}

type Collector struct {
	prevNet    *gnet.IOCountersStat
	prevNetTS  int64
	diskPath   string
	prevDiskIO map[string]disk.IOCountersStat
	prevDiskTS int64
	topProcs   int

	cloudflaredConfigDir string
	dockerState          DockerState
}

func New(diskPath string, topProcs int, cloudflaredConfigDir string) *Collector {
	if diskPath == "" {
		diskPath = "/"
	}
	if topProcs <= 0 {
		topProcs = 10
	}

	return &Collector{
		diskPath:             diskPath,
		topProcs:             topProcs,
		cloudflaredConfigDir: cloudflaredConfigDir,
	}
}

func (c *Collector) CollectAll() ([]Metric, *telemetry.SystemInfo, error) {
	ts := time.Now().UnixMilli()

	var out []Metric

	cpuMetrics, _ := collectCPU(ts)
	perCPUMetrics, _ := collectPerCPU(ts)
	memMetrics, _ := collectMemory(ts)
	swapMetrics, _ := collectSwap(ts)
	diskMetrics, _ := collectAllDisks(ts)
	diskIOMetrics, _ := c.collectDiskIO(ts)
	netMetrics, _ := c.collectNetworkRates(ts)
	loadMetrics, _ := collectLoadAvg(ts)
	uptimeMetrics, _ := collectUptime(ts)
	dockerMetrics, _ := collectDockerMetricsWithState(ts, &c.dockerState)
	procMetrics, _ := collectTopProcesses(ts, c.topProcs)
	tempMetrics, _ := collectTemperatures(ts)
	cfMetrics, _ := collectCloudflareTunnelMetrics(ts, c.cloudflaredConfigDir)
	systemInfo, _ := collectSystemInfo(ts)

	out = append(out, cpuMetrics...)
	out = append(out, perCPUMetrics...)
	out = append(out, memMetrics...)
	out = append(out, swapMetrics...)
	out = append(out, diskMetrics...)
	out = append(out, diskIOMetrics...)
	out = append(out, netMetrics...)
	out = append(out, loadMetrics...)
	out = append(out, uptimeMetrics...)
	out = append(out, dockerMetrics...)
	out = append(out, procMetrics...)
	out = append(out, tempMetrics...)
	out = append(out, cfMetrics...)

	return out, systemInfo, nil
}

func collectSystemInfo(ts int64) (*telemetry.SystemInfo, error) {
	cpuInfo, err := cpu.Info()
	if err != nil {
		return nil, err
	}
	memoryInfo, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	diskInfo, err := disk.Usage("/")
	if err != nil {
		return nil, err
	}

	osInfo, err := host.Info()
	if err != nil {
		return nil, err
	}

	res := &telemetry.SystemInfo{Hostname: osInfo.Hostname, CpuName: cpuInfo[0].ModelName, MemoryCapacity: int64(memoryInfo.Total), DiskCapacity: int64(diskInfo.Total)}
	if containers, err := collectDockerContainers(); err == nil {
		res.DockerContainers = containers
	}

	platform, _, version, _ := host.PlatformInformation()
	if platform == "darwin" {
		res.Os = platform
		res.OsName = fmt.Sprintf("macOS %s", version)
	} else if strings.Contains(platform, "indows") {
		res.Os = "Windows"
		res.OsName = strings.Replace(platform, "Microsoft ", "", 1)
		res.Kernel = version
	} else if platform == "freebsd" {
		res.Os = "FreeBSD"
		res.Kernel, _ = host.KernelVersion()
		if prettyName, err := getOsPrettyName(); err == nil {
			res.OsName = prettyName
		} else {
			res.OsName = "FreeBSD"
		}
	} else {
		res.Os = "Linux"
		res.OsName = osInfo.OS
		if res.OsName == "" {
			if prettyName, err := getOsPrettyName(); err == nil {
				res.OsName = prettyName
			} else {
				res.OsName = platform
			}
		}
		res.Kernel = osInfo.KernelVersion
		if res.Kernel == "" {
			res.Kernel, _ = host.KernelVersion()
		}
	}

	_ = ts
	return res, nil
}


func collectCPU(ts int64) ([]Metric, error) {
	percent, err := cpu.Percent(0, false)
	if err != nil {
		return nil, err
	}
	return []Metric{{Name: "cpu.percent", Value: percent[0], Time: ts}}, nil
}

func collectMemory(ts int64) ([]Metric, error) {
	vm, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}
	return []Metric{{Name: "mem.total_bytes", Value: float64(vm.Total), Time: ts}, {Name: "mem.used_bytes", Value: float64(vm.Used), Time: ts}, {Name: "mem.free_bytes", Value: float64(vm.Free), Time: ts}, {Name: "mem.percent", Value: vm.UsedPercent, Time: ts}}, nil
}

func collectDisk(path string, ts int64) ([]Metric, error) {
	usage, err := disk.Usage(path)
	if err != nil {
		return nil, err
	}
	return []Metric{{Name: "disk.total_bytes", Value: float64(usage.Total), Time: ts, Labels: map[string]string{"mount": path}}, {Name: "disk.used_bytes", Value: float64(usage.Used), Time: ts, Labels: map[string]string{"mount": path}}, {Name: "disk.free_bytes", Value: float64(usage.Free), Time: ts, Labels: map[string]string{"mount": path}}, {Name: "disk.used_percent", Value: usage.UsedPercent, Time: ts, Labels: map[string]string{"mount": path}}}, nil
}

func (c *Collector) collectNetworkRates(ts int64) ([]Metric, error) {
	stats, err := gnet.IOCounters(false)
	if err != nil || len(stats) == 0 {
		return nil, err
	}
	cur := stats[0]
	if c.prevNet == nil {
		c.prevNet = &cur
		c.prevNetTS = ts
		return nil, nil
	}
	dtSec := float64(ts-c.prevNetTS) / 1000.0
	if dtSec <= 0 {
		c.prevNet = &cur
		c.prevNetTS = ts
		return nil, nil
	}
	dBytesSent := float64(cur.BytesSent) - float64(c.prevNet.BytesSent)
	dBytesRecv := float64(cur.BytesRecv) - float64(c.prevNet.BytesRecv)
	if dBytesSent < 0 {
		dBytesSent = 0
	}
	if dBytesRecv < 0 {
		dBytesRecv = 0
	}
	txPerSec := dBytesSent / dtSec
	rxPerSec := dBytesRecv / dtSec
	c.prevNet = &cur
	c.prevNetTS = ts
	return []Metric{{Name: "net.tx_bytes_per_sec", Value: txPerSec, Time: ts}, {Name: "net.rx_bytes_per_sec", Value: rxPerSec, Time: ts}}, nil
}

func collectPerCPU(ts int64) ([]Metric, error) {
	percents, err := cpu.Percent(0, true)
	if err != nil {
		return nil, err
	}
	metrics := make([]Metric, 0, len(percents))
	for i, p := range percents {
		metrics = append(metrics, Metric{
			Name:   "cpu.core.percent",
			Value:  p,
			Labels: map[string]string{"core": strconv.Itoa(i)},
			Time:   ts,
		})
	}
	return metrics, nil
}

func collectAllDisks(ts int64) ([]Metric, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}
	var metrics []Metric
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil || usage.Total == 0 {
			continue
		}
		labels := map[string]string{"mount": p.Mountpoint, "device": p.Device, "fstype": p.Fstype}
		metrics = append(metrics,
			Metric{Name: "disk.total_bytes", Value: float64(usage.Total), Labels: labels, Time: ts},
			Metric{Name: "disk.used_bytes", Value: float64(usage.Used), Labels: labels, Time: ts},
			Metric{Name: "disk.free_bytes", Value: float64(usage.Free), Labels: labels, Time: ts},
			Metric{Name: "disk.used_percent", Value: usage.UsedPercent, Labels: labels, Time: ts},
		)
	}
	return metrics, nil
}

func (c *Collector) collectDiskIO(ts int64) ([]Metric, error) {
	counters, err := disk.IOCounters()
	if err != nil {
		return nil, err
	}
	if c.prevDiskIO == nil {
		c.prevDiskIO = counters
		c.prevDiskTS = ts
		return nil, nil
	}
	dtSec := float64(ts-c.prevDiskTS) / 1000.0
	if dtSec <= 0 {
		c.prevDiskIO = counters
		c.prevDiskTS = ts
		return nil, nil
	}

	var metrics []Metric
	for name, cur := range counters {
		prev, ok := c.prevDiskIO[name]
		if !ok {
			continue
		}
		labels := map[string]string{"device": name}

		readBytes := safeDelta(cur.ReadBytes, prev.ReadBytes)
		writeBytes := safeDelta(cur.WriteBytes, prev.WriteBytes)
		readOps := safeDelta(cur.ReadCount, prev.ReadCount)
		writeOps := safeDelta(cur.WriteCount, prev.WriteCount)

		metrics = append(metrics,
			Metric{Name: "disk.read_bytes_per_sec", Value: float64(readBytes) / dtSec, Labels: labels, Time: ts},
			Metric{Name: "disk.write_bytes_per_sec", Value: float64(writeBytes) / dtSec, Labels: labels, Time: ts},
			Metric{Name: "disk.iops_read", Value: float64(readOps) / dtSec, Labels: labels, Time: ts},
			Metric{Name: "disk.iops_write", Value: float64(writeOps) / dtSec, Labels: labels, Time: ts},
		)
	}
	c.prevDiskIO = counters
	c.prevDiskTS = ts
	return metrics, nil
}

func safeDelta(cur, prev uint64) uint64 {
	if cur >= prev {
		return cur - prev
	}
	return 0
}

func collectLoadAvg(ts int64) ([]Metric, error) {
	avg, err := load.Avg()
	if err != nil {
		return nil, err
	}
	return []Metric{
		{Name: "system.load1", Value: avg.Load1, Time: ts},
		{Name: "system.load5", Value: avg.Load5, Time: ts},
		{Name: "system.load15", Value: avg.Load15, Time: ts},
	}, nil
}

func collectUptime(ts int64) ([]Metric, error) {
	uptime, err := host.Uptime()
	if err != nil {
		return nil, err
	}
	return []Metric{
		{Name: "system.uptime_seconds", Value: float64(uptime), Time: ts},
	}, nil
}

func collectSwap(ts int64) ([]Metric, error) {
	swap, err := mem.SwapMemory()
	if err != nil {
		return nil, err
	}
	return []Metric{
		{Name: "swap.total_bytes", Value: float64(swap.Total), Time: ts},
		{Name: "swap.used_bytes", Value: float64(swap.Used), Time: ts},
		{Name: "swap.percent", Value: swap.UsedPercent, Time: ts},
	}, nil
}

type procInfo struct {
	pid    int32
	name   string
	cpu    float64
	memRSS uint64
}

func collectTopProcesses(ts int64, topN int) ([]Metric, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	infos := make([]procInfo, 0, len(procs))
	for _, p := range procs {
		cpuPct, err := p.CPUPercent()
		if err != nil {
			continue
		}
		memInfo, err := p.MemoryInfo()
		if err != nil {
			continue
		}
		name, _ := p.Name()
		infos = append(infos, procInfo{
			pid:    p.Pid,
			name:   name,
			cpu:    cpuPct,
			memRSS: memInfo.RSS,
		})
	}

	// Sort by CPU descending to get top CPU consumers
	sort.Slice(infos, func(i, j int) bool { return infos[i].cpu > infos[j].cpu })

	seen := make(map[int32]bool)
	var metrics []Metric

	limit := topN
	if limit > len(infos) {
		limit = len(infos)
	}
	for _, info := range infos[:limit] {
		seen[info.pid] = true
		labels := map[string]string{"pid": strconv.Itoa(int(info.pid)), "name": info.name}
		metrics = append(metrics,
			Metric{Name: "process.cpu_percent", Value: info.cpu, Labels: labels, Time: ts},
			Metric{Name: "process.mem_bytes", Value: float64(info.memRSS), Labels: labels, Time: ts},
		)
	}

	// Also add top memory consumers not already included
	sort.Slice(infos, func(i, j int) bool { return infos[i].memRSS > infos[j].memRSS })
	for _, info := range infos {
		if seen[info.pid] {
			continue
		}
		if len(metrics)/2-topN >= topN {
			break
		}
		labels := map[string]string{"pid": strconv.Itoa(int(info.pid)), "name": info.name}
		metrics = append(metrics,
			Metric{Name: "process.cpu_percent", Value: info.cpu, Labels: labels, Time: ts},
			Metric{Name: "process.mem_bytes", Value: float64(info.memRSS), Labels: labels, Time: ts},
		)
	}

	return metrics, nil
}

func collectTemperatures(ts int64) ([]Metric, error) {
	temps, err := sensors.SensorsTemperatures()
	if err != nil {
		// On unsupported platforms this returns ErrNotImplementedError — just skip
		return nil, nil
	}
	metrics := make([]Metric, 0, len(temps))
	for _, t := range temps {
		if t.Temperature == 0 {
			continue
		}
		metrics = append(metrics, Metric{
			Name:   "sensor.temperature_celsius",
			Value:  t.Temperature,
			Labels: map[string]string{"sensor": t.SensorKey},
			Time:   ts,
		})
	}
	return metrics, nil
}

func getOsPrettyName() (string, error) {
	file, err := os.Open("/etc/os-release")
	if err != nil {
		return "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if after, ok := strings.CutPrefix(line, "PRETTY_NAME="); ok {
			value := strings.Trim(after, `"`)
			return value, nil
		}
	}

	return "", errors.New("pretty name not found")
}
