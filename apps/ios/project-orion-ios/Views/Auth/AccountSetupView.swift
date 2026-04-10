import SwiftUI

struct AccountSetupView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 8) {
                Image(systemName: "server.rack")
                    .font(.system(size: 48))
                    .foregroundStyle(.green)

                Text("[SCOPE]")
                    .font(.title.bold())
                    .tracking(2)

                Text("INITIAL SETUP")
                    .font(.caption2)
                    .tracking(3)
                    .foregroundStyle(.secondary)

                Text("Create your admin account")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            .padding(.bottom, 36)

            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("NAME")
                        .font(.caption2).tracking(2).foregroundStyle(.secondary)
                    ScopeTextField(placeholder: "Admin", text: $viewModel.setupName)
                        .textContentType(.name)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("EMAIL")
                        .font(.caption2).tracking(2).foregroundStyle(.secondary)
                    ScopeTextField(placeholder: "admin@example.com", text: $viewModel.setupEmail)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("PASSWORD")
                        .font(.caption2).tracking(2).foregroundStyle(.secondary)
                    ScopeTextField(placeholder: "Password", text: $viewModel.setupPassword, isSecure: true)
                        .textContentType(.newPassword)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("CONFIRM PASSWORD")
                        .font(.caption2).tracking(2).foregroundStyle(.secondary)
                    ScopeTextField(placeholder: "Confirm", text: $viewModel.setupConfirmPassword, isSecure: true)
                        .textContentType(.newPassword)
                }

                if let error = viewModel.setupError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 32)

            Button {
                Task { await viewModel.registerFirst(appState: appState) }
            } label: {
                HStack {
                    if viewModel.isSetupLoading {
                        ProgressView()
                            .tint(.black)
                    }
                    Text("CREATE ACCOUNT")
                        .font(.subheadline.bold())
                        .tracking(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .padding(.horizontal, 32)
            .padding(.top, 24)
            .disabled(viewModel.isSetupLoading)

            Spacer()

            Button {
                appState.resetServer()
            } label: {
                Text("Change server")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 16)
        }
    }
}
