import Foundation
import Observation

@Observable
final class DeviceDetailViewModel {
    var device: DeviceCard?
    var isLoading = false
    var errorMessage: String?
    var selectedRange: String = "5m"

    let ranges = ["1m", "5m", "1h", "2h", "5h", "12h", "1d", "1w", "1mo", "1y", "all"]
    let rangeLabels: [String: String] = [
        "1m": "1 Min", "5m": "5 Min", "1h": "1 Hour", "2h": "2 Hours",
        "5h": "5 Hours", "12h": "12 Hours", "1d": "1 Day", "1w": "1 Week",
        "1mo": "1 Month", "1y": "1 Year", "all": "All",
    ]

    private let externalId: String

    init(externalId: String) {
        self.externalId = externalId
    }

    @MainActor
    func loadDevice(token: String) async {
        isLoading = device == nil
        errorMessage = nil

        do {
            device = try await APIClient.shared.getDevice(
                token: token,
                externalId: externalId,
                range: selectedRange
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    @MainActor
    func changeRange(_ range: String, token: String) async {
        selectedRange = range
        await loadDevice(token: token)
    }

    // MARK: - WS Updates (merge summary only, keep sparklines for selected range)

    @MainActor
    func applyLiveUpdate(_ updatedCard: DeviceCard) {
        guard updatedCard.externalId == externalId, let current = device else { return }
        device = DeviceCard(
            externalId: current.externalId,
            hostname: updatedCard.hostname ?? current.hostname,
            ipAddress: updatedCard.ipAddress ?? current.ipAddress,
            status: updatedCard.status,
            os: current.os,
            osName: current.osName,
            kernel: current.kernel,
            cpuName: current.cpuName,
            memoryCapacity: current.memoryCapacity,
            diskCapacity: current.diskCapacity,
            lastSeenAt: updatedCard.lastSeenAt ?? current.lastSeenAt,
            summary: updatedCard.summary,
            sparklines: current.sparklines, // keep current range sparklines
            containers: updatedCard.containers ?? current.containers,
            tunnels: updatedCard.tunnels ?? current.tunnels
        )
    }

    @MainActor
    func applyStatusUpdate(status: DeviceStatus, lastSeenAt: String?) {
        guard let current = device else { return }
        device = DeviceCard(
            externalId: current.externalId,
            hostname: current.hostname,
            ipAddress: current.ipAddress,
            status: status,
            os: current.os,
            osName: current.osName,
            kernel: current.kernel,
            cpuName: current.cpuName,
            memoryCapacity: current.memoryCapacity,
            diskCapacity: current.diskCapacity,
            lastSeenAt: lastSeenAt ?? current.lastSeenAt,
            summary: current.summary,
            sparklines: current.sparklines,
            containers: current.containers,
            tunnels: current.tunnels
        )
    }

    // MARK: - Sparkline Helpers

    func sparklineValues(named name: String) -> [Double] {
        guard let spark = device?.sparklines.first(where: { $0.name == name }) else { return [] }
        return spark.points.compactMap { $0.value }
    }

    func sparklineChartPoints(named name: String) -> [(date: Date, value: Double)] {
        guard let spark = device?.sparklines.first(where: { $0.name == name }) else { return [] }
        return spark.points.compactMap { point in
            guard let value = point.value else { return nil }
            let date = Date(timeIntervalSince1970: point.tsUnixMs / 1000)
            return (date: date, value: value)
        }
    }
}
