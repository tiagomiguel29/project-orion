import Foundation

// MARK: - Base Response Wrapper

struct BaseResponse<T: Codable>: Codable {
    let success: Bool
    let message: String
    let data: T?
}

// MARK: - Auth Models

struct SetupRequired: Codable {
    let setupRequired: Bool
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let mfaRequired: Bool
    let token: String?
    let user: UserInfo?
    let pendingToken: String?
    let availableMethods: [String]?
}

struct SuccessLogin: Codable {
    let token: String
    let user: UserInfo
}

struct UserInfo: Codable, Equatable {
    let id: String
    let name: String
    let email: String
    let role: String
}

struct RegisterFirstRequest: Codable {
    let name: String
    let email: String
    let password: String
}

struct VerifyTotpRequest: Codable {
    let code: String
}

// MARK: - Dashboard Models

struct DashboardPayload: Codable {
    let totals: DashboardTotals
    let devices: [DeviceCard]
}

struct DashboardTotals: Codable, Equatable {
    let total: Int
    let online: Int
    let offline: Int
    let warning: Int
}

enum DeviceStatus: String, Codable {
    case online
    case offline
    case unknown
}

struct DeviceCard: Codable, Identifiable, Equatable {
    let externalId: String
    let hostname: String?
    let ipAddress: String?
    let status: DeviceStatus
    let os: String
    let osName: String
    let kernel: String
    let cpuName: String
    let memoryCapacity: Int64
    let diskCapacity: Int64
    let lastSeenAt: String?
    let summary: DeviceSummary
    let sparklines: [SparklineData]
    let containers: [DockerContainer]?
    let tunnels: [CloudflareTunnel]?

    var id: String { externalId }

    static func == (lhs: DeviceCard, rhs: DeviceCard) -> Bool {
        lhs.externalId == rhs.externalId && lhs.lastSeenAt == rhs.lastSeenAt
    }
}

struct DeviceSummary: Codable {
    let cpuPct: Double
    let ramPct: Double
    let ramUsedBytes: Double
    let ramTotalBytes: Double
    let disk: DiskSummary
    let network: NetworkSummary
    let cpuTempC: Double?
    let gpuPct: Double?
    let gpuTempC: Double?
    let uptimeSec: Double?
}

struct DiskSummary: Codable {
    let usedBytes: Double
    let totalBytes: Double
    let usedPct: Double
}

struct NetworkSummary: Codable {
    let inBps: Double
    let outBps: Double
}

struct SparklineData: Codable {
    let name: String
    let unit: String
    let points: [MetricPoint]
}

struct MetricPoint: Codable {
    let tsUnixMs: Double
    let value: Double?
}

struct DockerContainer: Codable, Identifiable {
    let name: String
    let image: String
    let health: String
    let cpuPercent: Double
    let ramUsageBytes: Double
    let ramLimitBytes: Double
    let netRxBytes: Double
    let netTxBytes: Double

    var id: String { name }
}

struct CloudflareTunnel: Codable, Identifiable {
    let tunnelId: String
    let tunnelName: String
    let status: String
    let haConnections: Int
    let totalRequests: Int
    let requestErrors: Int

    var id: String { tunnelId }
}

// MARK: - Device Status WS Event

struct DeviceStatusEvent: Codable {
    let deviceId: String
    let status: DeviceStatus
    let lastSeenAt: String?
}
