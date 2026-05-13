import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isLoading {
                loadingView
            } else {
                switch appState.currentScreen {
                case .serverSetup:
                    ServerSetupView()
                case .accountSetup:
                    AccountSetupView()
                case .login:
                    LoginView()
                case .mfa(let pendingToken, let methods):
                    MfaView(pendingToken: pendingToken, methods: methods)
                case .dashboard:
                    DashboardView()
                }
            }
        }
        .task {
            await appState.bootstrap()
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            Image(systemName: "server.rack")
                .font(.system(size: 48))
                .foregroundStyle(.green)

            ProgressView()
                .tint(.green)

            Text("INITIALIZING")
                .font(.geist(size: 11))
                .tracking(3)
                .foregroundStyle(.secondary)
        }
    }
}
