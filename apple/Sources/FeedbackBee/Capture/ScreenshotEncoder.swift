#if canImport(CoreGraphics) && canImport(ImageIO)
import CoreGraphics
import Foundation
import ImageIO

/// The annotator's result: the untouched capture plus the shapes, flattened later off the main thread.
struct AnnotatedScreenshot: @unchecked Sendable {
    let base: CGImage
    let shapes: [Shape]
    let strokeWidth: CGFloat

    init(base: CGImage, shapes: [Shape]) {
        self.base = base
        self.shapes = shapes
        strokeWidth = CGFloat(annotationStrokeWidth(width: Double(base.width), height: Double(base.height)))
    }

    /// The capture with every shape drawn at full resolution. Thread-safe (Core Graphics only);
    /// with no shapes it is the capture itself, so Save costs nothing extra.
    func flattened() -> CGImage? {
        guard !shapes.isEmpty else { return base }
        guard let context = ScreenshotEncoder.bitmapContext(width: base.width, height: base.height) else { return nil }
        let height = CGFloat(base.height)
        context.draw(base, in: CGRect(x: 0, y: 0, width: CGFloat(base.width), height: height))
        // Shapes use top-left pixel coordinates; Core Graphics contexts are bottom-left.
        context.translateBy(x: 0, y: height)
        context.scaleBy(x: 1, y: -1)
        context.setStrokeColor(annotationColor)
        context.setLineWidth(strokeWidth)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for shape in shapes {
            context.addPath(shapePath(shape, strokeWidth: strokeWidth))
            context.strokePath()
        }
        return context.makeImage()
    }
}

/// #FF3B30, shared by both annotators and the exported PNG.
let annotationColor = CGColor(srgbRed: 1, green: 59 / 255, blue: 48 / 255, alpha: 1)

/// A shape's outline in image pixel coordinates (top-left origin).
func shapePath(_ shape: Shape, strokeWidth: CGFloat) -> CGPath {
    let path = CGMutablePath()
    func cg(_ point: Pt) -> CGPoint { CGPoint(x: point.x, y: point.y) }
    switch shape {
    case .pen(let points):
        guard let first = points.first else { break }
        path.move(to: cg(first))
        if points.count == 1 { path.addLine(to: CGPoint(x: first.x + 0.01, y: first.y)) }
        for index in points.indices.dropFirst() {
            let previous = points[index - 1], current = points[index]
            path.addQuadCurve(to: CGPoint(x: (previous.x + current.x) / 2, y: (previous.y + current.y) / 2), control: cg(previous))
        }
    case .box(let from, let to):
        path.addRect(CGRect(x: min(from.x, to.x), y: min(from.y, to.y), width: abs(to.x - from.x), height: abs(to.y - from.y)))
    case .arrow(let from, let to):
        let (left, right) = arrowBarbs(from: from, to: to, length: Double(strokeWidth) * 5)
        path.move(to: cg(from))
        path.addLine(to: cg(to))
        path.move(to: cg(left))
        path.addLine(to: cg(to))
        path.addLine(to: cg(right))
    }
    return path
}

/// A pen stroke that grows in place: no array copy and no path rebuild per input event.
final class PenStroke {
    private(set) var points: [Pt]
    let path = CGMutablePath()

    init(start: Pt) {
        points = [start]
        path.move(to: CGPoint(x: start.x, y: start.y))
        path.addLine(to: CGPoint(x: start.x + 0.01, y: start.y))
    }

    func add(_ point: Pt) {
        guard let previous = points.last else { return }
        path.addQuadCurve(
            to: CGPoint(x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2),
            control: CGPoint(x: previous.x, y: previous.y)
        )
        points.append(point)
    }
}

/// Platform-independent screenshot processing for the iOS and macOS sheets.
enum ScreenshotEncoder {
    struct Processed: @unchecked Sendable {
        let screenshot: Screenshot
        /// About 720 px on the long side, for the sheet's preview.
        let thumbnail: CGImage?
    }

    /// Flattens the annotations, PNG-encodes with ImageIO (shrinking until it fits the 10 MB contract
    /// cap) and decodes a small preview, all in one background task: the main thread never handles a
    /// full-resolution bitmap after capture.
    static func process(_ annotated: AnnotatedScreenshot) async -> Processed? {
        await Task.detached(priority: .userInitiated) { processSync(annotated) }.value
    }

    static func processSync(_ annotated: AnnotatedScreenshot, maxBytes: Int = FeedbackLimits.maxScreenshotBytes) -> Processed? {
        guard var current = annotated.flattened() else { return nil }
        for _ in 0..<4 {
            guard let png = pngData(current) else { return nil }
            if png.count <= maxBytes {
                return Processed(
                    screenshot: Screenshot(png: png, pixelWidth: current.width, pixelHeight: current.height),
                    thumbnail: thumbnail(png, maxPixels: 720)
                )
            }
            guard let smaller = scaled(current, by: 0.75) else { return nil }
            current = smaller
        }
        return nil
    }

    static func pngData(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.png" as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    /// ImageIO decodes straight to the small size instead of inflating the full bitmap first.
    private static func thumbnail(_ png: Data, maxPixels: Int) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(png as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    static func scaled(_ image: CGImage, by factor: CGFloat) -> CGImage? {
        let width = max(1, Int(CGFloat(image.width) * factor)), height = max(1, Int(CGFloat(image.height) * factor))
        guard let context = bitmapContext(width: width, height: height) else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return context.makeImage()
    }

    static func bitmapContext(width: Int, height: Int) -> CGContext? {
        CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )
    }
}
#endif
