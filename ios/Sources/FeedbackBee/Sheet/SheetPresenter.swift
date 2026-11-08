#if canImport(UIKit)
import UIKit

/// Shows the sheet in a dedicated window above the host's UI: nothing is pushed onto the host's view
/// controller hierarchy, so it works the same over UIKit, SwiftUI and React Native screens.
@MainActor
final class SheetPresenter {
    private let config: FeedbackConfig
    private let options: OpenOptions
    private var window: UIWindow?
    private weak var hostWindow: UIWindow?

    init(config: FeedbackConfig, options: OpenOptions) {
        self.config = config
        self.options = options
    }

    func present(onDismiss: @escaping () -> Void) -> Bool {
        guard let scene = Self.foregroundScene() else { return false }
        let host = scene.windows.first { $0.isKeyWindow } ?? scene.windows.first { !$0.isHidden }
        hostWindow = host

        let controller = FeedbackController()
        controller.apply(options)
        let sheet = FeedbackSheetViewController(
            controller: controller,
            config: config,
            captureHost: { [weak self] in
                guard let host = self?.hostWindow else { return nil }
                return ScreenshotCapture.capture(host)
            }
        )
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert - 1
        window.backgroundColor = .clear
        window.rootViewController = sheet
        sheet.onClosed = { [weak self] in
            self?.tearDown()
            onDismiss()
        }
        self.window = window
        window.makeKeyAndVisible()
        return true
    }

    private func tearDown() {
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
        if let hostWindow, !hostWindow.isHidden { hostWindow.makeKey() }
    }

    private static func foregroundScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive }
            ?? scenes.first { $0.activationState == .foregroundInactive }
    }
}
#endif
