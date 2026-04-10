import Foundation

enum ServerConfig {
    private static let serverURLKey = "serverURL"

    static var serverURL: String? {
        get { UserDefaults.standard.string(forKey: serverURLKey) }
        set { UserDefaults.standard.set(newValue, forKey: serverURLKey) }
    }

    static var isConfigured: Bool {
        guard let url = serverURL, !url.isEmpty else { return false }
        return true
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: serverURLKey)
    }

    /// Normalize URL: remove trailing slash, ensure http(s) prefix
    static func normalize(_ url: String) -> String {
        var trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        // Remove trailing slash
        while trimmed.hasSuffix("/") {
            trimmed = String(trimmed.dropLast())
        }
        // Add https:// if no scheme provided
        if !trimmed.hasPrefix("http://") && !trimmed.hasPrefix("https://") {
            trimmed = "https://\(trimmed)"
        }
        return trimmed
    }
}
