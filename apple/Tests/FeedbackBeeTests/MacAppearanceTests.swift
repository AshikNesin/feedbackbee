#if os(macOS)
import AppKit
import XCTest
@testable import FeedbackBee

/// Renders the macOS feedback window in light and dark mode, saves PNGs for review, and checks that the
/// window background and the custom-drawn boxes follow the appearance.
final class MacAppearanceTests: XCTestCase {
    private let config = try! FeedbackConfig.create(projectId: "demo", endpoint: "https://bee.example.dev")

    @MainActor func testFeedbackWindowFollowsLightAndDark() throws {
        _ = NSApplication.shared
        for (mode, name) in [("light", NSAppearance.Name.aqua), ("dark", .darkAqua)] {
            let host = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 800, height: 600), styleMask: [.titled], backing: .buffered, defer: false)
            host.appearance = NSAppearance(named: name)
            for (screen, options) in [("picker", OpenOptions()), ("form", OpenOptions(kind: .issue, text: "The export button does nothing"))] {
                let controller = FeedbackWindowController(config: config, options: options, host: host)
                let window = try XCTUnwrap(controller.window)
                XCTAssertEqual(window.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]), name, "adopts the host's appearance")
                window.orderFrontRegardless()
                settle(window)

                let captured = try XCTUnwrap(WindowCapture.capture(window), "WindowCapture")
                Snapshot.save(captured, "macos-\(screen)-\(mode)")
                if let layered = layerRender(window) { Snapshot.save(layered, "macos-\(screen)-\(mode)-layer") }
                let scale = Int(window.backingScaleFactor)
                // Near the bottom-left corner, inside the window: plain window background.
                let background = Snapshot.brightness(captured, x: 16 * scale, y: captured.height - 16 * scale)
                if mode == "light" {
                    XCTAssertGreaterThan(background, 200, "\(screen) background in light mode")
                } else {
                    XCTAssertLessThan(background, 90, "\(screen) background in dark mode")
                }
                window.orderOut(nil)
                controller.close()
            }
        }
    }

    /// Switching the system/app appearance while the window is open re-resolves the layer colors.
    @MainActor func testLayerColorsUpdateOnAppearanceChange() throws {
        _ = NSApplication.shared
        let box = BorderedBox(frame: NSRect(x: 0, y: 0, width: 100, height: 40))
        let window = NSWindow(contentRect: box.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = box
        window.appearance = NSAppearance(named: .aqua)
        box.displayIfNeeded()
        box.layer?.display()
        box.updateLayer()
        let light = try XCTUnwrap(box.layer?.backgroundColor)

        window.appearance = NSAppearance(named: .darkAqua)
        box.updateLayer()
        let dark = try XCTUnwrap(box.layer?.backgroundColor)
        XCTAssertNotEqual(light, dark)
        XCTAssertGreaterThan(light.components?.first ?? 0, 0.8)
        XCTAssertLessThan(dark.components?.first ?? 1, 0.3)
    }

    @MainActor private func settle(_ window: NSWindow) {
        window.layoutIfNeeded()
        window.displayIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.4))
    }

    /// For comparison with WindowCapture: Core Animation's own render of the window's layer tree.
    @MainActor private func layerRender(_ window: NSWindow) -> CGImage? {
        guard let view = window.contentView?.superview, let layer = view.layer else { return nil }
        let scale = window.backingScaleFactor
        guard let context = ScreenshotEncoder.bitmapContext(width: Int(view.bounds.width * scale), height: Int(view.bounds.height * scale)) else { return nil }
        context.scaleBy(x: scale, y: scale)
        layer.render(in: context)
        return context.makeImage()
    }
}
#endif
