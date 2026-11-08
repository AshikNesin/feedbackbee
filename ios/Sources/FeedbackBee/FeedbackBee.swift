#if canImport(UIKit)
import UIKit

/// Feedback for iOS: a bottom sheet with an optional annotated screenshot and voice note,
/// sent to your FeedbackBee Worker, which files it as a GitHub issue.
///
/// Configure it once, in `application(_:didFinishLaunchingWithOptions:)` or your SwiftUI `App.init`:
///
/// ```swift
/// try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")
/// ```
///
/// The sheet opens in its own window above your UI, so there is no view controller to present or dismiss.
///
/// Privacy: the SDK only reads its host app's own window, and only when the user taps the camera button.
/// Audio is recorded only after the user taps the microphone. Nothing leaves the device until the user presses Send.
public enum FeedbackBee {
    /// Starts FeedbackBee. Calling it again replaces the previous setup. Safe from any thread.
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

    /// Reporter details the host already knows. Sticky: applied to every `open` until `reset()` or the next call.
    /// Dashboard-only: never sent to the GitHub issue.
    public static func identify(email: String? = nil, name: String? = nil, id: String? = nil) {
        Reporter.shared.identify(email: email, name: name, id: id)
    }

    /// Extra key/value context for every report (plan, build, feature flag…). Merge semantics; a `nil`
    /// value removes a key. Sticky until `reset()`. Dashboard-only.
    ///
    /// ```swift
    /// FeedbackBee.setContext(["plan": "pro", "build": 4211, "beta": true])
    /// ```
    public static func setContext(_ metadata: [String: ContextValue?]) {
        Reporter.shared.setContext(metadata)
    }

    /// Clears `identify` and `setContext` state, e.g. on logout.
    public static func reset() {
        Reporter.shared.reset()
    }

    static func onMain(_ work: @escaping @MainActor () -> Void) {
        if Thread.isMainThread {
            MainActor.assumeIsolated { work() }
        } else {
            DispatchQueue.main.async { MainActor.assumeIsolated { work() } }
        }
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
