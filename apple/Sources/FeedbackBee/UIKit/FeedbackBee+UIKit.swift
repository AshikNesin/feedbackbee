#if canImport(UIKit)
import UIKit

extension FeedbackBee {
    /// Starts FeedbackBee. Call it once at launch (`application(_:didFinishLaunchingWithOptions:)` or your
    /// SwiftUI `App.init`). Calling it again replaces the previous setup. Safe from any thread.
    ///
    /// The sheet opens in its own window above your UI, so there is no view controller to present or dismiss.
    ///
    /// - Parameters:
    ///   - projectId: the project id from your FeedbackBee dashboard.
    ///   - endpoint: base URL of your FeedbackBee website or Worker. There is no default server.
    ///   - shake: when true (the default), the system shake gesture opens the sheet.
    /// - Throws: `FeedbackBeeConfigurationError` if `projectId` is blank or `endpoint` is not an http(s) base URL.
    public static func configure(projectId: String, endpoint: String, shake: Bool = true) throws {
        let config = try FeedbackConfig.create(projectId: projectId, endpoint: endpoint)
        onMain { Installation.shared.install(config: config, shake: shake) }
    }

    /// Opens the feedback sheet, for example from a "Send feedback" button. Does nothing while a sheet
    /// is already open. Safe from any thread.
    ///
    /// ```swift
    /// FeedbackBee.open()                                               // the picker, like a shake
    /// FeedbackBee.open(OpenOptions(kind: .issue, lockKind: true))      // a "Report a problem" button
    /// ```
    public static func open(_ options: OpenOptions = OpenOptions()) {
        onMain { Installation.shared.open(options) }
    }
}

/// The current configuration plus the open sheet, if any. Main thread only.
@MainActor
final class Installation {
    static let shared = Installation()

    private(set) var config: FeedbackConfig?
    private var shakeEnabled = false
    private var presenter: SheetPresenter?

    func install(config: FeedbackConfig, shake: Bool) {
        self.config = config
        shakeEnabled = shake
        if shake {
            ShakeDetector.installIfNeeded { [weak self] in self?.openFromShake() }
        }
    }

    func open(_ options: OpenOptions) {
        guard let config else {
            Log.warn("open() ignored: call FeedbackBee.configure() first.")
            return
        }
        guard presenter == nil else { return }
        let presenter = SheetPresenter(config: config, options: options)
        guard presenter.present(onDismiss: { [weak self] in self?.presenter = nil }) else {
            Log.warn("open() ignored: no foreground window scene.")
            return
        }
        self.presenter = presenter
    }

    private func openFromShake() {
        guard shakeEnabled, presenter == nil else { return }
        open(OpenOptions())
    }
}
#endif
