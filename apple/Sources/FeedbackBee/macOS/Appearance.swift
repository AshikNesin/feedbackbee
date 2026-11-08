#if os(macOS)
import AppKit

extension NSView {
    /// `NSColor.cgColor` resolves against whatever appearance happens to be current, which is not
    /// necessarily this view's. Resolve inside the view's own effective appearance instead.
    func resolvedCGColor(_ color: NSColor) -> CGColor {
        var resolved = color.cgColor
        effectiveAppearance.performAsCurrentDrawingAppearance { resolved = color.cgColor }
        return resolved
    }
}

/// A layer-backed view whose layer colors follow light and dark mode: `applyColors` runs on first
/// display and again whenever the effective appearance changes (a system switch, or the host forcing
/// one with `NSApp.appearance` / `window.appearance`).
class AppearanceAwareView: NSView {
    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        applyColors()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }

    func applyColors() {}
}

extension NSWindow {
    /// Matches the window the user was looking at when it forces an appearance; otherwise inherits the app's.
    func adoptAppearance(of host: NSWindow?) {
        appearance = host?.appearance
    }
}
#endif
