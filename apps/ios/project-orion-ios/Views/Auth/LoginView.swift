import SwiftUI

struct LoginView: View {
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
                    .font(.geist(.bold, size: 28))
                    .tracking(2)

                Text("SIGN IN")
                    .font(.geist(size: 11))
                    .tracking(3)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 48)

            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("EMAIL")
                        .font(.geist(size: 11))
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
                        .font(.geist(size: 11))
                        .tracking(2)
                        .foregroundStyle(.secondary)

                    ScopeTextField(placeholder: "Password", text: $viewModel.password, isSecure: true)
                        .textContentType(.password)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.geist(size: 12))
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
                        .font(.geist(.bold, size: 15))
                        .tracking(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .clipShape(Rectangle())
            .padding(.horizontal, 32)
            .padding(.top, 24)
            .disabled(viewModel.isLoading)

            Spacer()

            Button {
                appState.resetServer()
            } label: {
                Text("Change server")
                    .font(.geist(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 16)
        }
    }
}
