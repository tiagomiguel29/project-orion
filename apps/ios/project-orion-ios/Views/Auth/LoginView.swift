import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo
            VStack(spacing: 8) {
                Image(systemName: "server.rack")
                    .font(.system(size: 48))
                    .foregroundStyle(.green)

                Text("[SCOPE]")
                    .font(.title.bold())
                    .tracking(2)

                Text("SIGN IN")
                    .font(.caption2)
                    .tracking(3)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 48)

            // Form
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("EMAIL")
                        .font(.caption2)
                        .tracking(2)
                        .foregroundStyle(.secondary)

                    ScopeTextField(placeholder: "admin@example.com", text: $viewModel.email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("PASSWORD")
                        .font(.caption2)
                        .tracking(2)
                        .foregroundStyle(.secondary)

                    ScopeTextField(placeholder: "Password", text: $viewModel.password, isSecure: true)
                        .textContentType(.password)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 32)

            Button {
                Task { await viewModel.login(appState: appState) }
            } label: {
                HStack {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.black)
                    }
                    Text("LOGIN")
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
            .disabled(viewModel.isLoading)

            Spacer()

            // Change server
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
