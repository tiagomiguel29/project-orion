import Foundation
import Observation

@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var isLoading = false
    var errorMessage: String?

    // MFA
    var totpCode = ""
    var isMfaLoading = false
    var mfaError: String?

    // Setup (first-time registration)
    var setupName = ""
    var setupEmail = ""
    var setupPassword = ""
    var setupConfirmPassword = ""
    var isSetupLoading = false
    var setupError: String?

    @MainActor
    func login(appState: AppState) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Email and password are required"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.login(email: email, password: password)

            if response.mfaRequired {
                appState.onMfaRequired(
                    pendingToken: response.pendingToken ?? "",
                    methods: response.availableMethods ?? []
                )
            } else if let token = response.token, let user = response.user {
                appState.onLoginSuccess(token: token, user: user)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    @MainActor
    func verifyTotp(pendingToken: String, appState: AppState) async {
        guard !totpCode.isEmpty else {
            mfaError = "Enter your 6-digit code"
            return
        }

        isMfaLoading = true
        mfaError = nil

        do {
            let result = try await APIClient.shared.verifyTotp(
                code: totpCode,
                pendingToken: pendingToken
            )
            appState.onLoginSuccess(token: result.token, user: result.user)
        } catch {
            mfaError = error.localizedDescription
        }

        isMfaLoading = false
    }

    @MainActor
    func registerFirst(appState: AppState) async {
        guard !setupName.isEmpty, !setupEmail.isEmpty, !setupPassword.isEmpty else {
            setupError = "All fields are required"
            return
        }
        guard setupPassword == setupConfirmPassword else {
            setupError = "Passwords do not match"
            return
        }

        isSetupLoading = true
        setupError = nil

        do {
            let result = try await APIClient.shared.registerFirst(
                name: setupName,
                email: setupEmail,
                password: setupPassword
            )
            appState.onLoginSuccess(token: result.token, user: result.user)
        } catch {
            setupError = error.localizedDescription
        }

        isSetupLoading = false
    }
}
