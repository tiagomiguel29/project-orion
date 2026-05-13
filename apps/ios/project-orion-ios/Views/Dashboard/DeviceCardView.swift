import SwiftUI

struct DeviceCardView: View {
    let device: DeviceCard

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(device.externalId)
                        .font(.geist(.bold, size: 15))
                        .lineLimit(1)

                    Text(device.ipAddress ?? device.hostname ?? "N/A")
                        .font(.geist(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                StatusBadge(status: device.status)
            }

            HStack(spacing: 12) {
                MetricPill(
                    label: "CPU",
                    value: Formatters.percentage(device.summary.cpuPct),
                    color: metricColor(device.summary.cpuPct)
                )

                MetricPill(
                    label: "RAM",
                    value: Formatters.percentage(device.summary.ramPct),
                    color: metricColor(device.summary.ramPct)
                )

                MetricPill(
                    label: "DISK",
                    value: Formatters.percentage(device.summary.disk.usedPct),
                    color: metricColor(device.summary.disk.usedPct)
                )
            }

            SparklineView(
                values: sparklineValues(named: "cpuPct"),
                color: .green,
                height: 28
            )
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
    }

    private func sparklineValues(named name: String) -> [Double] {
        guard let spark = device.sparklines.first(where: { $0.name == name }) else { return [] }
        return spark.points.compactMap { $0.value }
    }

    private func metricColor(_ value: Double) -> Color {
        if value >= 90 { return .red }
        if value >= 70 { return .orange }
        return .green
    }
}

struct MetricPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.geist(.medium, size: 8))
                .tracking(1)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.geistMono(.bold, size: 12))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }
}
