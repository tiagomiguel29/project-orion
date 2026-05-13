import SwiftUI

struct MfaView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()

    let pendingToken: String
    let methods: [String]

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 8) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 48))
                    .foregroundStyle(.green)

                Text("TWO-FACTOR AUTH")
                    .font(.geist(.bold, size: 20))
                    .tracking(2)

                Text("Enter your authentication code")
                    .font(.geist(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 48)

            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AUTHENTICATOR CODE")
                        .font(.geist(size: 11))
                        .tracking(2)
                        .foregroundStyle(.secondary)

                    TextField("000000", text: $viewModel.totpCode)
                        .padding(12)
                        .background(Color(.systemGray6))
                        .overlay(
                            Rectangle()
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .multilineTextAlignment(.center)
                        .font(.geistMono(size: 22))
                }

                if let error = viewModel.mfaError {
                    Text(error)
                        .font(.geist(size: 12))
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 32)

            Button {
                Task { await viewModel.verifyTotp(pendingToken: pendingToken, appState: appState) }
            } label: {
                HStack {
                    if viewModel.isMfaLoading {
                        ProgressView()
                            .tint(.black)
                    }
                    Text("VERIFY")
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
            .disabled(viewModel.isMfaLoading || viewModel.totpCode.isEmpty)

            Spacer()

            Button {
                appState.logout()
            } label: {
                Text("Cancel")
                    .font(.geist(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 16)
        }
    }
}
