#if canImport(CoreGraphics) && canImport(ImageIO)
import CoreGraphics
import ImageIO
import XCTest
@testable import FeedbackBee

final class ScreenshotEncoderTests: XCTestCase {
    private func whiteImage(_ width: Int, _ height: Int) throws -> CGImage {
        let context = try XCTUnwrap(ScreenshotEncoder.bitmapContext(width: width, height: height))
        context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        return try XCTUnwrap(context.makeImage())
    }

    /// RGBA of the pixel at (x, y), measured from the top-left like the shape coordinates.
    private func pixel(_ image: CGImage, _ x: Int, _ y: Int) -> (r: UInt8, g: UInt8, b: UInt8) {
        var data = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let context = CGContext(
            data: &data, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )!
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let offset = (y * image.width + x) * 4 // bitmap memory starts at the top row
        return (data[offset], data[offset + 1], data[offset + 2])
    }

    func testFlattenDrawsShapesTopLeftOriginInRed() throws {
        let base = try whiteImage(1000, 1000)
        let annotated = AnnotatedScreenshot(base: base, shapes: [.box(from: Pt(x: 100, y: 100), to: Pt(x: 400, y: 400))])
        XCTAssertEqual(annotated.strokeWidth, 5)
        let flat = try XCTUnwrap(annotated.flattened())

        let edge = pixel(flat, 100, 250) // left edge of the box, near the top of the image
        XCTAssertGreaterThan(edge.r, 200)
        XCTAssertLessThan(edge.g, 120)
        let mirrored = pixel(flat, 100, 750) // where it would be if the y axis were flipped
        XCTAssertEqual(mirrored.g, 255)
        let inside = pixel(flat, 250, 250)
        XCTAssertEqual(inside.g, 255)
    }

    func testNoShapesReturnsTheCaptureUntouched() throws {
        let base = try whiteImage(10, 10)
        XCTAssertTrue(AnnotatedScreenshot(base: base, shapes: []).flattened() === base)
    }

    func testShrinksToFitTheByteCapAndMakesASmallThumbnail() throws {
        let base = try whiteImage(1000, 600)
        let full = try XCTUnwrap(ScreenshotEncoder.processSync(AnnotatedScreenshot(base: base, shapes: [])))
        XCTAssertEqual(full.screenshot.pixelWidth, 1000)
        let thumbnail = try XCTUnwrap(full.thumbnail)
        XCTAssertEqual(max(thumbnail.width, thumbnail.height), 720)

        let capped = try XCTUnwrap(ScreenshotEncoder.processSync(
            AnnotatedScreenshot(base: base, shapes: []), maxBytes: full.screenshot.png.count - 1
        ))
        XCTAssertEqual(capped.screenshot.pixelWidth, 750)
        XCTAssertLessThan(capped.screenshot.png.count, full.screenshot.png.count)

        XCTAssertNil(ScreenshotEncoder.processSync(AnnotatedScreenshot(base: base, shapes: []), maxBytes: 1))
    }

    func testEncodesAValidPNG() throws {
        let processed = try XCTUnwrap(ScreenshotEncoder.processSync(AnnotatedScreenshot(base: try whiteImage(20, 10), shapes: [])))
        XCTAssertEqual(Array(processed.screenshot.png.prefix(4)), [0x89, 0x50, 0x4E, 0x47])
        let source = try XCTUnwrap(CGImageSourceCreateWithData(processed.screenshot.png as CFData, nil))
        let decoded = try XCTUnwrap(CGImageSourceCreateImageAtIndex(source, 0, nil))
        XCTAssertEqual(decoded.width, 20)
        XCTAssertEqual(decoded.height, 10)
    }
}
#endif
