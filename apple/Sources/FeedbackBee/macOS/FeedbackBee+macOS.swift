#if os(macOS)
import AppKit
import Security

extension FeedbackBee {
    /// Starts FeedbackBee. Call it once at launch (`applicationDidFinishLaunching` or your SwiftUI `App.init`).
    /// Calling it again replaces the previous setup. Safe from any thread.
    ///
    /// Macs don't shake: open the panel from a menu item (`FeedbackBee.menuItem()`, or a SwiftUI
    /// `CommandGroup`) or your own button.
    ///
    /// - Throws: `FeedbackBeeConfigurationError` if `projectId` is blank or `endpoint` is not an http(s) base URL.
    public static func configure(projectId: String, endpoint: String) throws {
        let config = try FeedbackConfig.create(projectId: projectId, endpoint: endpoint)
        if Entitlements.isSandboxed, !Entitlements.has("com.apple.security.network.client") {
            Log.warn("This sandboxed app lacks the com.apple.security.network.client entitlement, so reports can't be sent.")
        }
        onMain { MacInstallation.shared.config = config }
    }

    /// Opens the feedback window over the frontmost window, or brings it forward if it is already open.
    /// Safe from any thread.
    ///
    /// ```swift
    /// FeedbackBee.open()                                               // the picker
    /// FeedbackBee.open(OpenOptions(kind: .issue, lockKind: true))      // a "Report a problem" button
    /// ```
    public static func open(_ options: OpenOptions = OpenOptions()) {
        onMain { MacInstallation.shared.open(options) }
    }

    /// A "Send Feedback…" item that opens the picker, for an AppKit app's Help menu:
    ///
    /// ```swift
    /// NSApp.helpMenu?.addItem(FeedbackBee.menuItem())
    /// ```
    @MainActor
    public static func menuItem(title: String = "Send Feedback…") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(MenuTarget.openFeedback(_:)), keyEquivalent: "")
        item.target = MenuTarget.shared
        return item
    }
}

/// NSMenuItem holds its target weakly, so the target lives here.
@MainActor
private final class MenuTarget: NSObject {
    static let shared = MenuTarget()

    @objc func openFeedback(_ sender: Any?) {
        FeedbackBee.open()
    }
}

@MainActor
final class MacInstallation {
    static let shared = MacInstallation()

    var config: FeedbackConfig?
    private var window: FeedbackWindowController?

    func open(_ options: OpenOptions) {
        guard let config else {
            Log.warn("open() ignored: call FeedbackBee.configure() first.")
            return
        }
        NSApp.activate(ignoringOtherApps: true)
        if let window {
            window.showWindow(nil)
            return
        }
        // Remember the window the user was looking at: that's what the screenshot button captures.
        let host = [NSApp.keyWindow, NSApp.mainWindow].compactMap { $0 }.first { $0.isVisible && !($0 is NSPanel) }
        let controller = FeedbackWindowController(config: config, options: options, host: host)
        controller.onClosed = { [weak self] in self?.window = nil }
        window = controller
        controller.present()
    }
}

enum Entitlements {
    static var isSandboxed: Bool {
        ProcessInfo.processInfo.environment["APP_SANDBOX_CONTAINER_ID"] != nil
    }

    static func has(_ entitlement: String) -> Bool {
        guard let task = SecTaskCreateFromSelf(nil) else { return false }
        let value = SecTaskCopyValueForEntitlement(task, entitlement as CFString, nil)
        return (value as? Bool) == true
    }
}

enum WindowCapture {
    /// Renders the window's own views, title bar included, at its backing scale. No screen-recording
    /// permission is involved because nothing outside this app's view hierarchy is read. Content drawn
    /// outside AppKit's layer tree (Metal, video) may come out blank.
    @MainActor
    static func capture(_ window: NSWindow) -> CGImage? {
        guard let view = window.contentView?.superview ?? window.contentView else { return nil }
        let bounds = view.bounds
        guard bounds.width > 0, bounds.height > 0, let rep = view.bitmapImageRepForCachingDisplay(in: bounds) else { return nil }
        view.cacheDisplay(in: bounds, to: rep)
        return rep.cgImage
    }
}

extension DeviceInfo {
    @MainActor
    static func currentMac(screen: NSScreen?) -> DeviceInfo {
        let version = ProcessInfo.processInfo.operatingSystemVersion
        let screen = screen ?? NSScreen.main
        let scale = screen?.backingScaleFactor ?? 1
        let size = screen?.frame.size ?? .zero
        return DeviceInfo(
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            osName: "macos",
            osVersion: "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)",
            deviceModel: hardwareModel(),
            screenWidth: Int(size.width * scale),
            screenHeight: Int(size.height * scale)
        )
    }

    /// The hardware identifier, like "Mac14,2".
    private static func hardwareModel() -> String {
        var size = 0
        guard sysctlbyname("hw.model", nil, &size, nil, 0) == 0, size > 0 else { return "Mac" }
        var buffer = [CChar](repeating: 0, count: size)
        guard sysctlbyname("hw.model", &buffer, &size, nil, 0) == 0 else { return "Mac" }
        return String(cString: buffer)
    }
}
#endif
