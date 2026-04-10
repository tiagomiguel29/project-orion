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
                    .font(.title3.bold())
                    .tracking(2)

                Text("Enter your authentication code")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 48)

            // Always show TOTP input (primary MFA method)
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AUTHENTICATOR CODE")
                        .font(.caption2)
                        .tracking(2)
                        .foregroundStyle(.secondary)

                    TextField("000000", text: $viewModel.totpCode)
                        .padding(12)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .multilineTextAlignment(.center)
                        .font(.title2.monospaced())
                }

                if let error = viewModel.mfaError {
                    Text(error)
                        .font(.caption)
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
            .disabled(viewModel.isMfaLoading || viewModel.totpCode.isEmpty)

            Spacer()

            Button {
                appState.logout()
            } label: {
                Text("Cancel")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 16)
        }
    }
}
