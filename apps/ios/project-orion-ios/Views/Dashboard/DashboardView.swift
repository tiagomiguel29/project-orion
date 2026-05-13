import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()
    @State private var selectedDeviceId: String?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading systems...")
                } else if let error = viewModel.errorMessage, viewModel.devices.isEmpty {
                    ContentUnavailableView {
                        Label("Connection Error", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") {
                            Task { await loadData() }
                        }
                    }
                } else if viewModel.devices.isEmpty {
                    ContentUnavailableView {
                        Label("No Devices", systemImage: "server.rack")
                    } description: {
                        Text("No devices registered yet.")
                    }
                } else {
                    deviceList
                }
            }
            .navigationTitle("[SCOPE]")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    statusSummary
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            appState.logout()
                        } label: {
                            Label("Disconnect", systemImage: "power")
                        }

                        Button(role: .destructive) {
                            appState.resetServer()
                        } label: {
                            Label("Change Server", systemImage: "server.rack")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .foregroundStyle(.green)
                    }
                }
            }
            .searchable(text: $viewModel.searchQuery, prompt: "Search systems")
            .refreshable {
                await loadData()
            }
            .navigationDestination(for: String.self) { externalId in
                DeviceDetailView(externalId: externalId)
            }
        }
        .task {
            await loadData()
        }
    }

    // MARK: - Subviews

    private var statusSummary: some View {
        HStack(spacing: 8) {
            HStack(spacing: 3) {
                Circle().fill(.green).frame(width: 5, height: 5)
                Text("\(viewModel.onlineCount)")
                    .font(.geistMono(.bold, size: 11))
                    .foregroundStyle(.green)
            }

            if viewModel.offlineCount > 0 {
                HStack(spacing: 3) {
                    Circle().fill(.red).frame(width: 5, height: 5)
                    Text("\(viewModel.offlineCount)")
                        .font(.geistMono(.bold, size: 11))
                        .foregroundStyle(.red)
                }
            }

            Text("/ \(viewModel.totalCount)")
                .font(.geistMono(size: 11))
                .foregroundStyle(.secondary)
        }
    }

    private var deviceList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(viewModel.filteredDevices) { device in
                    NavigationLink(value: device.externalId) {
                        DeviceCardView(device: device)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        guard let token = appState.token else { return }
        await viewModel.loadDashboard(token: token)
    }
}
