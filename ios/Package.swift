// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FeedbackBee",
    // macOS only so `swift test` can run the platform-independent core on a Mac; the SDK is for iOS.
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "FeedbackBee", targets: ["FeedbackBee"]),
    ],
    targets: [
        // UIKit files are wrapped in `#if canImport(UIKit)`, so the contract, state machine and
        // geometry also build (and their tests run) with a plain Swift toolchain on macOS or Linux.
        .target(name: "FeedbackBee", path: "Sources/FeedbackBee"),
        .testTarget(name: "FeedbackBeeTests", dependencies: ["FeedbackBee"], path: "Tests/FeedbackBeeTests"),
    ]
)
