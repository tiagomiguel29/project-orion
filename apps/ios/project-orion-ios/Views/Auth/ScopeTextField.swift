import SwiftUI

struct ScopeTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false

    var body: some View {
        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .padding(12)
        .font(.geist(size: 15))
        .background(Color(.systemGray6))
        .overlay(
            Rectangle()
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
    }
}
