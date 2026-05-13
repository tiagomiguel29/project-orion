import SwiftUI

// MARK: - Geist Font
// Matches web --font-sans (Geist) and --font-mono (Geist Mono).
// Font files must be added to the Xcode target and registered in Info.plist
// under UIAppFonts: Geist-Regular.ttf, Geist-Medium.ttf, Geist-SemiBold.ttf,
// Geist-Bold.ttf, GeistMono-Regular.ttf, GeistMono-Medium.ttf, GeistMono-Bold.ttf

extension Font {
    static func geist(_ weight: Font.Weight = .regular, size: CGFloat) -> Font {
        .custom(geistPostscript(weight), size: size)
    }

    static func geistMono(_ weight: Font.Weight = .regular, size: CGFloat) -> Font {
        .custom(geistMonoPostscript(weight), size: size)
    }

    private static func geistPostscript(_ weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black: "Geist-Bold"
        case .semibold: "Geist-SemiBold"
        case .medium: "Geist-Medium"
        case .light: "Geist-Light"
        case .thin: "Geist-Thin"
        case .ultraLight: "Geist-UltraLight"
        default: "Geist-Regular"
        }
    }

    private static func geistMonoPostscript(_ weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black: "GeistMono-Bold"
        case .medium: "GeistMono-Medium"
        default: "GeistMono-Regular"
        }
    }
}

// MARK: - Primary Button Style

/// Flat, sharp-cornered primary button — no border radius, matches web design.
struct ScopePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}
