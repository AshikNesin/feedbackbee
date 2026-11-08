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

    struct Processed: @unchecked Sendable {
        let screenshot: Screenshot
        let thumbnail: UIImage?
    }

    /// Flattens the annotations, PNG-encodes with ImageIO (shrinking until it fits the 10 MB contract
    /// cap) and downsamples a preview, all in one background task: the main thread never touches a
    /// full-resolution bitmap after capture.
    static func process(_ annotated: AnnotatedScreenshot) async -> Processed? {
        await Task.detached(priority: .userInitiated) { () -> Processed? in
            guard var current = annotated.flattened() else { return nil }
            for _ in 0..<4 {
                guard let png = pngData(current) else { return nil }
                if png.count <= FeedbackLimits.maxScreenshotBytes {
                    let preview = UIImage(cgImage: current)
                    let width: CGFloat = 720
                    let size = CGSize(width: width, height: width * CGFloat(current.height) / CGFloat(max(current.width, 1)))
                    return Processed(
                        screenshot: Screenshot(png: png, pixelWidth: current.width, pixelHeight: current.height),
                        thumbnail: preview.preparingThumbnail(of: size) ?? preview
                    )
                }
                guard let smaller = scaled(current, by: 0.75) else { return nil }
                current = smaller
            }
            return nil
        }.value
    }

    private static func pngData(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.png" as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    private static func scaled(_ image: CGImage, by factor: CGFloat) -> CGImage? {
        let width = max(1, Int(CGFloat(image.width) * factor)), height = max(1, Int(CGFloat(image.height) * factor))
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return context.makeImage()
    }
}

extension DeviceInfo {
    @MainActor
    static func current(screen: UIScreen?) -> DeviceInfo {
        let pixels = (screen ?? UIScreen.main).nativeBounds.size
        return DeviceInfo(
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
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
