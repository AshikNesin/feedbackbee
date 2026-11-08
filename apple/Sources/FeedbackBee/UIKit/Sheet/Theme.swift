#if canImport(UIKit)
import UIKit

/// Base palette shared with the web widget and the Android sheet; dynamic for dark mode.
enum Theme {
    static let ink = dynamic(light: 0x18181B, dark: 0xF4F4F5)
    static let muted = dynamic(light: 0x71717A, dark: 0xA1A1AA)
    static let tile = dynamic(light: 0xF4F4F5, dark: 0x27272A)
    static let border = dynamic(light: 0xE4E4E7, dark: 0x3F3F46)
    static let tileInk = dynamic(light: 0x52525B, dark: 0xD4D4D8)
    static let focus = dynamic(light: 0x2563EB, dark: 0x60A5FA)
    static let error = dynamic(light: 0xDC2626, dark: 0xF87171)
    static let panel = dynamic(light: 0xFFFFFF, dark: 0x18181B)
    static let onPrimary = dynamic(light: 0xFFFFFF, dark: 0x18181B)
    /// The annotation overlay keeps fixed colors in both modes.
    static let overlay = UIColor(hex: 0x18181B)
    static let annotation = UIColor(hex: 0xFF3B30)

    private static func dynamic(light: UInt32, dark: UInt32) -> UIColor {
        let lightColor = UIColor(hex: light), darkColor = UIColor(hex: dark)
        return UIColor { $0.userInterfaceStyle == .dark ? darkColor : lightColor }
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

/// A rounded box whose border color follows light/dark mode (CALayer colors don't on their own).
class RoundedView: UIView {
    var strokeColor: UIColor? { didSet { applyStroke() } }

    init(fill: UIColor?, radius: CGFloat, stroke: UIColor? = nil, strokeWidth: CGFloat = 1) {
        super.init(frame: .zero)
        backgroundColor = fill
        layer.cornerRadius = radius
        layer.cornerCurve = .continuous
        layer.borderWidth = stroke == nil ? 0 : strokeWidth
        strokeColor = stroke
        applyStroke()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyStroke()
    }

    private func applyStroke() {
        layer.borderColor = strokeColor?.resolvedColor(with: traitCollection).cgColor
    }
}

enum ButtonStyle { case primary, secondary, selected, plain }

@MainActor
func makeButton(_ title: String?, image: String? = nil, style: ButtonStyle, size: CGFloat = 15) -> UIButton {
    var configuration: UIButton.Configuration
    switch style {
    case .primary:
        configuration = .filled()
        configuration.baseBackgroundColor = Theme.ink
        configuration.baseForegroundColor = Theme.onPrimary
    case .secondary:
        configuration = .plain()
        configuration.baseForegroundColor = Theme.tileInk
        configuration.background.strokeColor = Theme.border
        configuration.background.strokeWidth = 1
        configuration.background.backgroundColor = Theme.panel
    case .selected:
        configuration = .filled()
        configuration.baseBackgroundColor = Theme.border
        configuration.baseForegroundColor = Theme.ink
    case .plain:
        configuration = .plain()
        configuration.baseForegroundColor = Theme.muted
    }
    configuration.cornerStyle = .fixed
    configuration.background.cornerRadius = 10
    if let title {
        var attributes = AttributeContainer()
        attributes.font = UIFont.systemFont(ofSize: size, weight: .semibold)
        configuration.attributedTitle = AttributedString(title, attributes: attributes)
    }
    if let image {
        configuration.image = UIImage(systemName: image, withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium))
        configuration.imagePadding = 6
    }
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)
    let button = UIButton(configuration: configuration)
    return button
}

@MainActor
func makeLabel(_ text: String = "", size: CGFloat, color: UIColor, weight: UIFont.Weight = .regular) -> UILabel {
    let label = UILabel()
    label.text = text
    label.font = UIFontMetrics.default.scaledFont(for: UIFont.systemFont(ofSize: size, weight: weight))
    label.adjustsFontForContentSizeCategory = true
    label.textColor = color
    label.numberOfLines = 0
    return label
}
#endif
