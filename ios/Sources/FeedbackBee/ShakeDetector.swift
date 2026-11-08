#if canImport(UIKit)
import ObjectiveC
import UIKit

/// Listens for the system shake gesture. UIKit already detects it and routes `motionEnded` up the
/// responder chain to the window, so this costs nothing until a shake happens: no accelerometer polling.
@MainActor
enum ShakeDetector {
    private static var installed = false
    private static var handler: (() -> Void)?

    static func installIfNeeded(_ onShake: @escaping () -> Void) {
        handler = onShake
        guard !installed else { return }
        installed = true
        let cls: AnyClass = UIWindow.self
        let original = #selector(UIResponder.motionEnded(_:with:))
        let replacement = #selector(UIWindow.fbb_motionEnded(_:with:))
        guard let originalMethod = class_getInstanceMethod(cls, original),
              let replacementMethod = class_getInstanceMethod(cls, replacement)
        else { return }
        // UIWindow inherits motionEnded from UIResponder: add an override first so the swap never
        // changes UIResponder itself. Chains with other swizzlers (React Native's dev menu does the same).
        if class_addMethod(cls, original, method_getImplementation(replacementMethod), method_getTypeEncoding(replacementMethod)) {
            class_replaceMethod(cls, replacement, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod))
        } else {
            method_exchangeImplementations(originalMethod, replacementMethod)
        }
    }

    static func shakeDetected() {
        handler?()
    }
}

extension UIWindow {
    @objc func fbb_motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        fbb_motionEnded(motion, with: event) // the original implementation, after the swap
        if motion == .motionShake { ShakeDetector.shakeDetected() }
    }
}
#endif
