import Foundation
import Observation

enum AppScreen {
    case serverSetup
    case login
    case accountSetup // first-time registration
    case mfa(pendingToken: String, methods: [String])
    case dashboard
}

@Observable
final class AppState {
    var currentScreen: AppScreen = .serverSetup
    var token: String?
    var user: UserInfo?
    var isLoading = true
    var errorMessage: String?

    private let tokenKey = "jwt_token"

    init() {
        // Restore saved token
        token = KeychainService.load(key: tokenKey)
    }

    // MARK: - Bootstrap

    @MainActor
    func bootstrap() async {
        isLoading = true
        errorMessage = nil

        // Step 1: Need server URL?
        guard ServerConfig.isConfigured else {
            currentScreen = .serverSetup
            isLoading = false
            return
        }

        // Step 2: Have a saved token? Validate it.
        if let token {
            do {
                let me = try await APIClient.shared.getMe(token: token)
                self.user = me
                currentScreen = .dashboard
                isLoading = false
                return
            } catch {
                // Token expired or invalid — clear and go to login
                clearAuth()
            }
        }

        // Step 3: Check if backend needs first-time setup
        do {
            let setup = try await APIClient.shared.checkSetup()
            currentScreen = setup.setupRequired ? .accountSetup : .login
        } catch {
            errorMessage = "Cannot connect to server: \(error.localizedDescription)"
            currentScreen = .serverSetup
        }

        isLoading = false
    }

    // MARK: - Auth Actions

    @MainActor
    func onLoginSuccess(token: String, user: UserInfo) {
        self.token = token
        self.user = user
        KeychainService.save(key: tokenKey, value: token)
        currentScreen = .dashboard
    }

    @MainActor
    func onMfaRequired(pendingToken: String, methods: [String]) {
        currentScreen = .mfa(pendingToken: pendingToken, methods: methods)
    }

    @MainActor
    func logout() {
        clearAuth()
        currentScreen = .login
    }

    @MainActor
    func resetServer() {
        clearAuth()
        ServerConfig.clear()
        currentScreen = .serverSetup
    }

    private func clearAuth() {
        token = nil
        user = nil
        KeychainService.delete(key: tokenKey)
    }
}
