import SwiftUI

struct ServerSetupView: View {
    @Environment(AppState.self) private var appState
    @State private var serverURL = ""
    @State private var isValidating = false
    @State private var errorMessage: String?

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

                Text("INFRASTRUCTURE MONITOR")
                    .font(.geist(size: 11))
                    .tracking(3)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 48)

            VStack(alignment: .leading, spacing: 12) {
                Text("SERVER URL")
                    .font(.geist(size: 11))
                    .tracking(2)
                    .foregroundStyle(.secondary)

                ScopeTextField(placeholder: "https://your-server.com", text: $serverURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.geist(size: 12))
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 32)

            Button {
                Task { await validateAndSave() }
            } label: {
                HStack {
                    if isValidating {
                        ProgressView()
                            .tint(.black)
                    }
                    Text("CONNECT")
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
            .disabled(serverURL.trimmingCharacters(in: .whitespaces).isEmpty || isValidating)

            Spacer()
        }
        .onAppear {
            if let saved = ServerConfig.serverURL {
                serverURL = saved
            }
        }
    }

    private func validateAndSave() async {
        isValidating = true
        errorMessage = nil

        let normalized = ServerConfig.normalize(serverURL)
        ServerConfig.serverURL = normalized

        do {
            _ = try await APIClient.shared.checkSetup()
            await appState.bootstrap()
        } catch {
            errorMessage = "Could not connect to server. Check the URL and try again."
            ServerConfig.clear()
        }

        isValidating = false
    }
}
