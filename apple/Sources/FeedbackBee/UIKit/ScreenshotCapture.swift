#if canImport(UIKit)
import ImageIO
import UIKit

enum ScreenshotCapture {
    /// Renders the host window as it is on screen now. The sheet lives in its own window, so it is
    /// never part of the capture.
    @MainActor
    static func capture(_ window: UIWindow) -> UIImage? {
        let bounds = window.bounds
        guard bounds.width > 0, bounds.height > 0 else { return nil }
        let format = UIGraphicsImageRendererFormat(for: window.traitCollection)
        format.opaque = true
        return UIGraphicsImageRenderer(bounds: bounds, format: format).image { _ in
            _ = window.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
    }
}

extension DeviceInfo {
    @MainActor
    static func current(screen: UIScreen?) -> DeviceInfo {
        let pixels = (screen ?? UIScreen.main).nativeBounds.size
        return DeviceInfo(
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            osName: "ios",
            osVersion: UIDevice.current.systemVersion,
            deviceModel: modelIdentifier(),
            screenWidth: Int(pixels.width),
            screenHeight: Int(pixels.height)
        )
    }

    /// The hardware identifier ("iPhone16,1"); on the simulator, the simulated device's.
    private static func modelIdentifier() -> String {
        if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] { return simulated }
        var info = utsname()
        uname(&info)
        let machine = withUnsafeBytes(of: &info.machine) { raw in
            String(decoding: raw.prefix { $0 != 0 }, as: UTF8.self)
        }
        return machine.isEmpty ? UIDevice.current.model : machine
    }
}

#endif
