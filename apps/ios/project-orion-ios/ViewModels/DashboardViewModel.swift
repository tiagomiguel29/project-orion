import Foundation
import Observation

@Observable
final class DashboardViewModel {
    var devices: [DeviceCard] = []
    var totals: DashboardTotals?
    var isLoading = false
    var errorMessage: String?
    var searchQuery = ""

    var filteredDevices: [DeviceCard] {
        guard !searchQuery.isEmpty else { return devices }
        let query = searchQuery.lowercased()
        return devices.filter { device in
            device.externalId.lowercased().contains(query) ||
            (device.hostname?.lowercased().contains(query) ?? false) ||
            (device.ipAddress?.lowercased().contains(query) ?? false)
        }
    }

    var onlineCount: Int { totals?.online ?? devices.filter { $0.status == .online }.count }
    var offlineCount: Int { totals?.offline ?? devices.filter { $0.status == .offline }.count }
    var totalCount: Int { totals?.total ?? devices.count }

    @MainActor
    func loadDashboard(token: String) async {
        isLoading = devices.isEmpty
        errorMessage = nil

        do {
            let payload = try await APIClient.shared.getDashboard(token: token)
            devices = payload.devices
            totals = payload.totals
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - WebSocket Live Updates

    @MainActor
    func applyDeviceUpdate(_ updatedCard: DeviceCard) {
        if let index = devices.firstIndex(where: { $0.externalId == updatedCard.externalId }) {
            devices[index] = updatedCard
        } else {
            devices.append(updatedCard)
        }
        recomputeTotals()
    }

    @MainActor
    func applyStatusUpdate(deviceId: String, status: DeviceStatus, lastSeenAt: String?) {
        guard let index = devices.firstIndex(where: { $0.externalId == deviceId }) else { return }
        let old = devices[index]
        // Rebuild the card with updated status
        let updated = DeviceCard(
            externalId: old.externalId,
            hostname: old.hostname,
            ipAddress: old.ipAddress,
            status: status,
            os: old.os,
            osName: old.osName,
            kernel: old.kernel,
            cpuName: old.cpuName,
            memoryCapacity: old.memoryCapacity,
            diskCapacity: old.diskCapacity,
            lastSeenAt: lastSeenAt ?? old.lastSeenAt,
            summary: old.summary,
            sparklines: old.sparklines,
            containers: old.containers,
            tunnels: old.tunnels
        )
        devices[index] = updated
        recomputeTotals()
    }

    private func recomputeTotals() {
        let online = devices.filter { $0.status == .online }.count
        let offline = devices.filter { $0.status == .offline }.count
        let warning = devices.filter { $0.status == .unknown }.count
        totals = DashboardTotals(
            total: devices.count,
            online: online,
            offline: offline,
            warning: warning
        )
    }
}
