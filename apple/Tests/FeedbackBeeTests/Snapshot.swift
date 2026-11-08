#if canImport(CoreGraphics) && canImport(ImageIO)
import CoreGraphics
import Foundation
import ImageIO
import XCTest

/// Writes PNGs to `$FEEDBACKBEE_SNAPSHOT_DIR` (CI uploads them) and reads pixels back for assertions.
enum Snapshot {
    static func save(_ image: CGImage, _ name: String) {
        guard let dir = ProcessInfo.processInfo.environment["FEEDBACKBEE_SNAPSHOT_DIR"], !dir.isEmpty else { return }
        let folder = URL(fileURLWithPath: dir, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        guard let destination = CGImageDestinationCreateWithURL(
            folder.appendingPathComponent("\(name).png") as CFURL, "public.png" as CFString, 1, nil
        ) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }

    /// The pixel at (x, y) in image pixels, measured from the top-left.
    static func pixel(_ image: CGImage, x: Int, y: Int) -> (r: Int, g: Int, b: Int) {
        var data = [UInt8](repeating: 0, count: 4)
        let context = CGContext(
            data: &data, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        // Shift the image so the wanted pixel lands on the 1×1 context (CG's origin is bottom-left).
        context.draw(image, in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height))
        return (Int(data[0]), Int(data[1]), Int(data[2]))
    }

    static func brightness(_ image: CGImage, x: Int, y: Int) -> Int {
        let p = pixel(image, x: x, y: y)
        return (p.r + p.g + p.b) / 3
    }
}
#endif
