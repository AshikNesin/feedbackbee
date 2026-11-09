import FeedbackBeeCore
import SwiftUI
import UIKit

/// FeedbackBee mobile design tokens (mobile/DESIGN.md §2): the web dashboard's
/// palette in sRGB, light and dark. Views read from here, never hardcode.
/// DESIGN.md and this file change together.
enum Bee {
    static let paper = dynamic(0xFBFAF7, 0x0E0D0B)
    static let card = dynamic(0xFEFDFC, 0x171613)
    static let muted = dynamic(0xF4F1ED, 0x211F1C)
    static let rule = dynamic(0xE2DFDA, 0x282623)
    static let ink = dynamic(0x181612, 0xEDEBE7)
    static let inkMuted = dynamic(0x605D57, 0xA19E99)
    static let honey = Color(hex: 0xF4B306)
    static let onHoney = Color(hex: 0x18181B)
    static let danger = dynamic(0xDC2626, 0xF87171)

    static func status(_ status: Status) -> Color {
        switch status {
        case .open: dynamic(0x2563EB, 0x60A5FA)
        case .inProgress: dynamic(0xB45309, 0xF4B93C)
        case .done: dynamic(0x15803D, 0x4ADE80)
        case .wontFix: dynamic(0x71717A, 0xA1A1AA)
        }
    }

    static func kind(_ kind: Kind) -> Color {
        switch kind {
        case .issue: danger
        case .featureRequest: honey
        case .other: inkMuted
        }
    }

    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }
}

/// A colored dot.
struct Dot: View {
    let color: Color
    var size: CGFloat = 8
    var body: some View { Circle().fill(color).frame(width: size, height: size) }
}

/// A status: dot plus word, never color alone (DESIGN.md §2).
struct StatusLabel: View {
    let status: Status
    var body: some View {
        HStack(spacing: 5) {
            Dot(color: Bee.status(status))
            Text(status.label).font(.caption).foregroundStyle(Bee.inkMuted)
        }
    }
}

/// A selectable capsule, used for filters and the kind picker.
struct Chip: View {
    let label: String
    var dot: Color?
    var selected: Bool
    var selectedFill: Color = Bee.honey
    var selectedInk: Color = Bee.onHoney
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let dot { Dot(color: selected && selectedFill == Bee.honey ? selectedInk : dot) }
                Text(label).font(.subheadline.weight(.medium))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .foregroundStyle(selected ? selectedInk : Bee.ink)
            .background(selected ? selectedFill : Color.clear, in: Capsule())
            .overlay(Capsule().strokeBorder(selected ? Color.clear : Bee.rule))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A short-lived message at the bottom of a screen.
struct Toast: ViewModifier {
    @Binding var message: String?

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Bee.paper)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Bee.ink, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 16)
                    .padding(.bottom, 88)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: message) {
                        // Cancelled when a newer message replaces this one: then leave it be.
                        guard (try? await Task.sleep(for: .seconds(3))) != nil else { return }
                        withAnimation { self.message = nil }
                    }
            }
        }
        .animation(.snappy, value: message)
    }
}

extension View {
    func toast(_ message: Binding<String?>) -> some View { modifier(Toast(message: message)) }
}
