import SwiftUI

struct StatusBadge: View {
    let status: DeviceStatus

    var color: Color {
        switch status {
        case .online: .green
        case .offline: .red
        case .unknown: .orange
        }
    }

    var label: String {
        switch status {
        case .online: "ONLINE"
        case .offline: "OFFLINE"
        case .unknown: "UNKNOWN"
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.caption2.bold())
                .tracking(1)
                .foregroundStyle(color)
        }
    }
}
