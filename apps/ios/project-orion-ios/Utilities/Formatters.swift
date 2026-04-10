import Foundation

enum Formatters {
    static func bytesToGB(_ bytes: Double) -> Double {
        (bytes / 1_073_741_824 * 10).rounded() / 10
    }

    static func bytesToMB(_ bytes: Double) -> Double {
        (bytes / 1_048_576 * 10).rounded() / 10
    }

    static func bpsToMBs(_ bps: Double) -> Double {
        (bps / 1_000_000 * 10).rounded() / 10
    }

    static func uptimeString(seconds: Double?) -> String {
        guard let sec = seconds, sec > 0 else { return "0d 0h 0m" }
        let d = Int(sec) / 86400
        let h = (Int(sec) % 86400) / 3600
        let m = (Int(sec) % 3600) / 60
        return "\(d)d \(h)h \(m)m"
    }

    static func percentage(_ value: Double) -> String {
        String(format: "%.1f%%", value)
    }

    static func temperature(_ value: Double?) -> String {
        guard let v = value else { return "N/A" }
        return "\(Int(v.rounded()))°C"
    }

    static func lastSeenString(_ isoString: String?) -> String {
        guard let isoString, !isoString.isEmpty else { return "Never" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: isoString) else { return isoString }

        let df = DateFormatter()
        df.dateFormat = "dd/MM/yyyy, HH:mm:ss"
        return df.string(from: date)
    }
}
