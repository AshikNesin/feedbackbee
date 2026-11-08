// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FeedbackBee",
    // One SDK for both: UIKit/ and macOS/ hold the platform UI; everything else is shared.
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "FeedbackBee", targets: ["FeedbackBee"]),
    ],
    targets: [
        // Platform files are wrapped in `#if canImport(UIKit)` / `#if os(macOS)`, so the contract, state machine and
        // geometry also build (and their tests run) with a plain Swift toolchain on macOS or Linux.
        .target(name: "FeedbackBee", path: "Sources/FeedbackBee"),
        .testTarget(name: "FeedbackBeeTests", dependencies: ["FeedbackBee"], path: "Tests/FeedbackBeeTests"),
    ]
)
