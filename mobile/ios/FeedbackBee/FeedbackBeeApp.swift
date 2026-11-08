import FeedbackBeeCore
import SwiftUI
import UIKit

@main
struct FeedbackBeeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppDelegate.model

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Bee.ink)
        }
    }
}

/// Owns the app model (so quick actions reach it before SwiftUI does) and the
/// "New issue" home-screen quick action.
final class AppDelegate: NSObject, UIApplicationDelegate {
    @MainActor static let model: AppModel = {
        #if DEBUG
        if let screen = DemoMode.screen { return DemoMode.model(screen) }
        #endif
        return AppModel.shared()
    }()

    static let newIssueAction = "io.nesin.feedbackbee.new-issue"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        application.shortcutItems = [
            UIApplicationShortcutItem(
                type: Self.newIssueAction,
                localizedTitle: "New issue",
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(systemImageName: "square.and.pencil")
            ),
        ]
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        if options.shortcutItem?.type == Self.newIssueAction {
            Task { @MainActor in Self.model.newIssueRequests += 1 }
        }
        let config = UISceneConfiguration(name: nil, sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        let handled = shortcutItem.type == AppDelegate.newIssueAction
        if handled { Task { @MainActor in AppDelegate.model.newIssueRequests += 1 } }
        completionHandler(handled)
    }
}
