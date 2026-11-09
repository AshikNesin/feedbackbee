import FeedbackBeeCore
import UIKit

/// Device context sent with reports filed from this device (docs/CONTRACT.md).
@MainActor
func currentDevice() -> DeviceContext {
    DeviceContext(
        appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
        osVersion: UIDevice.current.systemVersion,
        deviceModel: hardwareModel()
    )
}

/// "iPhone17,1": the model identifier, as the Apple SDK reports it.
func hardwareModel() -> String {
    var info = utsname()
    uname(&info)
    return withUnsafePointer(to: &info.machine) {
        $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
    }
}

extension AppModel {
    /// The model the app and the Share Extension both use: session and cache in the App Group.
    @MainActor static func shared() -> AppModel {
        AppModel(
            store: SessionStore(defaults: AppGroup.defaults, secrets: KeychainSecrets(accessGroup: AppGroup.id)),
            cache: .standard(),
            device: currentDevice()
        )
    }
}
