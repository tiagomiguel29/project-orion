import SwiftUI

struct DeviceDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: DeviceDetailViewModel

    let externalId: String

    init(externalId: String) {
        self.externalId = externalId
        _viewModel = State(initialValue: DeviceDetailViewModel(externalId: externalId))
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView("Loading device...")
            } else if let error = viewModel.errorMessage, viewModel.device == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await loadData() }
                    }
                }
            } else if let device = viewModel.device {
                deviceContent(device)
            }
        }
        .navigationTitle(externalId)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let device = viewModel.device {
                    StatusBadge(status: device.status)
                }
            }
        }
        .task {
            await loadData()
        }
    }

    // MARK: - Content

    @ViewBuilder
    private func deviceContent(_ device: DeviceCard) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                rangePicker

                summaryRow(device)

                systemInfoSection(device)

                MetricChartView(
                    title: "CPU Usage",
                    points: viewModel.sparklineChartPoints(named: "cpuPct"),
                    color: .green,
                    maxY: 100
                )

                MetricChartView(
                    title: "Memory Usage",
                    points: viewModel.sparklineChartPoints(named: "ramPct"),
                    color: .orange,
                    maxY: 100
                )

                MetricChartView(
                    title: "CPU Temperature",
                    unit: "°C",
                    points: viewModel.sparklineChartPoints(named: "cpuTempC"),
                    color: .red,
                    maxY: 100
                )

                HStack(spacing: 8) {
                    MetricChartView(
                        title: "Net In",
                        unit: " MB/s",
                        points: viewModel.sparklineChartPoints(named: "netIn").map {
                            (date: $0.date, value: Formatters.bpsToMBs($0.value))
                        },
                        color: .cyan
                    )

                    MetricChartView(
                        title: "Net Out",
                        unit: " MB/s",
                        points: viewModel.sparklineChartPoints(named: "netOut").map {
                            (date: $0.date, value: Formatters.bpsToMBs($0.value))
                        },
                        color: .blue
                    )
                }

                if let containers = device.containers, !containers.isEmpty {
                    containersSection(containers)
                }

                if let tunnels = device.tunnels, !tunnels.isEmpty {
                    tunnelsSection(tunnels)
                }
            }
            .padding()
        }
        .refreshable {
            await loadData()
        }
    }

    // MARK: - Range Picker

    private var rangePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(viewModel.ranges, id: \.self) { range in
                    Button {
                        Task {
                            guard let token = appState.token else { return }
                            await viewModel.changeRange(range, token: token)
                        }
                    } label: {
                        Text(viewModel.rangeLabels[range] ?? range)
                            .font(.geist(.bold, size: 11))
                            .tracking(0.5)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(
                                viewModel.selectedRange == range
                                    ? Color.green : Color(.tertiarySystemGroupedBackground)
                            )
                            .foregroundStyle(
                                viewModel.selectedRange == range ? .black : .secondary
                            )
                    }
                }
            }
        }
    }

    // MARK: - Summary Row

    private func summaryRow(_ device: DeviceCard) -> some View {
        HStack(spacing: 8) {
            SummaryCard(title: "CPU", value: Formatters.percentage(device.summary.cpuPct), color: .green)
            SummaryCard(
                title: "RAM",
                value: Formatters.percentage(device.summary.ramPct),
                subtitle: "\(Formatters.bytesToGB(device.summary.ramUsedBytes)) / \(Formatters.bytesToGB(device.summary.ramTotalBytes)) GB",
                color: .orange
            )
            SummaryCard(
                title: "DISK",
                value: Formatters.percentage(device.summary.disk.usedPct),
                subtitle: "\(Formatters.bytesToGB(device.summary.disk.usedBytes)) / \(Formatters.bytesToGB(device.summary.disk.totalBytes)) GB",
                color: .blue
            )
        }
    }

    // MARK: - System Info

    private func systemInfoSection(_ device: DeviceCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SYSTEM INFORMATION")
                .font(.geist(.bold, size: 11))
                .tracking(1)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 8) {
                InfoField(label: "HOSTNAME", value: device.hostname ?? "N/A")
                InfoField(label: "IP ADDRESS", value: device.ipAddress ?? "N/A")
                InfoField(label: "OS", value: device.osName)
                InfoField(label: "KERNEL", value: device.kernel.isEmpty ? "N/A" : device.kernel)
                InfoField(label: "CPU", value: device.cpuName.isEmpty ? "N/A" : device.cpuName)
                InfoField(label: "UPTIME", value: Formatters.uptimeString(seconds: device.summary.uptimeSec))
                InfoField(label: "MEMORY", value: "\(Formatters.bytesToGB(Double(device.memoryCapacity))) GB")
                InfoField(label: "LAST SEEN", value: Formatters.lastSeenString(device.lastSeenAt))
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - Containers

    private func containersSection(_ containers: [DockerContainer]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DOCKER CONTAINERS")
                .font(.geist(.bold, size: 11))
                .tracking(1)
                .foregroundStyle(.secondary)

            ForEach(containers) { container in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(container.name)
                            .font(.geist(.bold, size: 12))
                        Text(container.image)
                            .font(.geist(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    HStack(spacing: 8) {
                        Text(container.health.uppercased())
                            .font(.geist(.bold, size: 8))
                            .tracking(0.5)
                            .foregroundStyle(container.health == "healthy" ? .green : .orange)

                        Text("\(container.cpuPercent, specifier: "%.1f")%")
                            .font(.geistMono(.bold, size: 11))
                            .foregroundStyle(.secondary)

                        Text("\(Formatters.bytesToMB(container.ramUsageBytes), specifier: "%.0f") MB")
                            .font(.geistMono(.bold, size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)

                if container.id != containers.last?.id {
                    Divider()
                }
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - Tunnels

    private func tunnelsSection(_ tunnels: [CloudflareTunnel]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CLOUDFLARE TUNNELS")
                .font(.geist(.bold, size: 11))
                .tracking(1)
                .foregroundStyle(.secondary)

            ForEach(tunnels) { tunnel in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tunnel.tunnelName)
                            .font(.geist(.bold, size: 12))
                        Text(tunnel.tunnelId)
                            .font(.geist(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    Text(tunnel.status.uppercased())
                        .font(.geist(.bold, size: 8))
                        .tracking(0.5)
                        .foregroundStyle(tunnel.status == "healthy" ? .green : .red)
                }
                .padding(.vertical, 4)

                if tunnel.id != tunnels.last?.id {
                    Divider()
                }
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - Load

    private func loadData() async {
        guard let token = appState.token else { return }
        await viewModel.loadDevice(token: token)
    }
}

// MARK: - Helper Views

struct SummaryCard: View {
    let title: String
    let value: String
    var subtitle: String?
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.geist(.bold, size: 8))
                .tracking(1)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.geistMono(.bold, size: 20))
                .foregroundStyle(color)
            if let subtitle {
                Text(subtitle)
                    .font(.geistMono(size: 8))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground))
    }
}

struct InfoField: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.geist(.medium, size: 8))
                .tracking(1)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.geist(size: 12))
                .lineLimit(1)
        }
    }
}
