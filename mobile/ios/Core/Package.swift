// swift-tools-version: 5.10
import PackageDescription

// The iOS app's core: models, the API client, session storage, the disk cache
// and the observable stores. No UIKit or SwiftUI, so it builds and tests on
// Linux too (`swift test`); the app target (../FeedbackBee) adds the views.
let package = Package(
    name: "FeedbackBeeCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "FeedbackBeeCore", targets: ["FeedbackBeeCore"])],
    targets: [
        .target(name: "FeedbackBeeCore"),
        .testTarget(name: "FeedbackBeeCoreTests", dependencies: ["FeedbackBeeCore"]),
    ]
)
