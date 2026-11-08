#if canImport(UIKit)
import UIKit
import XCTest
@testable import FeedbackBee

/// Renders the iOS sheet in light and dark mode, saves PNGs for review, and checks the panel colors
/// against the shared palette (white / #18181B, as on Android and the web widget).
final class IOSAppearanceTests: XCTestCase {
    private let config = try! FeedbackConfig.create(projectId: "demo", endpoint: "https://bee.example.dev")

    @MainActor func testSheetFollowsLightAndDark() throws {
        for (mode, style) in [("light", UIUserInterfaceStyle.light), ("dark", .dark)] {
            for (screen, options) in [("picker", OpenOptions()), ("form", OpenOptions(kind: .issue, text: "The export button does nothing"))] {
                let controller = FeedbackController(reporter: Reporter())
                controller.apply(options)
                let sheet = FeedbackSheetViewController(controller: controller, config: config, captureHost: { nil })
                let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 393, height: 852))
                window.overrideUserInterfaceStyle = style
                window.rootViewController = sheet
                window.makeKeyAndVisible()
                window.layoutIfNeeded()
                RunLoop.main.run(until: Date().addingTimeInterval(0.6))

                let format = UIGraphicsImageRendererFormat()
                format.scale = 2
                format.opaque = true
                let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { context in
                    UIColor(white: 0.5, alpha: 1).setFill() // stands in for the host app behind the dim
                    context.fill(window.bounds)
                    window.layer.render(in: context.cgContext)
                }
                let cgImage = try XCTUnwrap(image.cgImage)
                Snapshot.save(cgImage, "ios-\(screen)-\(mode)")

                // The panel spans the screen (below the 480pt cap); name the limiting constraints if not.
                let panel = try XCTUnwrap(sheet.view.subviews.first { $0.layer.cornerRadius == 20 })
                if abs(panel.frame.width - window.bounds.width) > 1 {
                    let limits = panel.constraintsAffectingLayout(for: .horizontal).map(\.description).joined(separator: "\n")
                    XCTFail("\(screen)/\(mode) panel is \(panel.frame.width)pt wide, expected \(window.bounds.width):\n\(limits)")
                }

                // Bottom-left corner of the panel, which runs to the bottom edge.
                let panel = Snapshot.pixel(cgImage, x: 12 * 2, y: cgImage.height - 6 * 2)
                if mode == "light" {
                    XCTAssertEqual([panel.r, panel.g, panel.b], [255, 255, 255], "\(screen) panel in light mode")
                } else {
                    XCTAssertEqual([panel.r, panel.g, panel.b], [24, 24, 27], "\(screen) panel in dark mode")
                }
                window.isHidden = true
            }
        }
    }
}
#endif
