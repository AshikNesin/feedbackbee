// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FeedbackBee",
    platforms: [.iOS(.v15)],
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
