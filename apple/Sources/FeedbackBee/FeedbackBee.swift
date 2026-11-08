import Foundation

/// Feedback for iOS and macOS: a panel with an optional annotated screenshot and voice note, sent to
/// your FeedbackBee Worker, which files it as a GitHub issue.
///
/// Configure it once at launch, then open the panel from a shake (iOS), a menu item or your own button:
///
/// ```swift
/// try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")
/// FeedbackBee.open()
/// ```
///
/// `configure` and `open` live in the platform files (`UIKit/`, `macOS/`). Privacy: the SDK only reads
/// its host app's own window, and only when the user takes a screenshot. Audio is recorded only after
/// the user taps the microphone. Nothing leaves the device until the user presses Send.
public enum FeedbackBee {
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
