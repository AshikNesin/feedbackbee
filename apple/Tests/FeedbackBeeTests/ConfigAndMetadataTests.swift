import XCTest
@testable import FeedbackBee

final class FeedbackConfigTests: XCTestCase {
    func testTrimsIdAndTrailingSlashes() throws {
        let config = try FeedbackConfig.create(projectId: "  myapp ", endpoint: " https://bee.example.dev// ")
        XCTAssertEqual(config.projectId, "myapp")
        XCTAssertEqual(config.endpoint, "https://bee.example.dev")
        XCTAssertEqual(config.feedbackURL.absoluteString, "https://bee.example.dev/api/v1/feedback")
    }

    func testKeepsPortAndPath() throws {
        XCTAssertEqual(try FeedbackConfig.normalizeEndpoint("http://10.0.2.2:8787"), "http://10.0.2.2:8787")
        XCTAssertEqual(try FeedbackConfig.normalizeEndpoint("https://example.com/bee/"), "https://example.com/bee")
    }

    func testRejectsBadInput() {
        let bad = [
            "", "   ", "bee.example.dev", "ftp://bee.example.dev", "https://", "https://user:pw@bee.example.dev",
            "https://bee.example.dev?x=1", "https://bee.example.dev#top", "https://bee.example.dev:70000",
        ]
        for endpoint in bad {
            XCTAssertThrowsError(try FeedbackConfig.normalizeEndpoint(endpoint), endpoint)
        }
        XCTAssertThrowsError(try FeedbackConfig.create(projectId: "  ", endpoint: "https://bee.example.dev"))
    }
}

final class MetadataJSONTests: XCTestCase {
    func testEncodesScalarsInOrder() {
        let json = MetadataJSON.encode([("plan", "pro"), ("build", 4211), ("ratio", 0.5), ("whole", .double(3)), ("beta", true)])
        XCTAssertEqual(json, #"{"plan":"pro","build":4211,"ratio":0.5,"whole":3,"beta":true}"#)
    }

    func testDropsInvalidKeysAndValues() {
        let long = String(repeating: "a", count: 501)
        let json = MetadataJSON.encode([
            ("bad key", "x"), ("ok", "y"), ("long", .string(long)), ("nan", .double(.nan)),
            (String(repeating: "k", count: 41), "z"),
        ])
        XCTAssertEqual(json, #"{"ok":"y"}"#)
        XCTAssertNil(MetadataJSON.encode([]))
    }

    func testCapsKeysAndBytes() throws {
        let many = (0..<30).map { ("k\($0)", ContextValue.int($0)) }
        let parsed = try XCTUnwrap(MetadataJSON.encode(many)).data(using: .utf8)!
        XCTAssertEqual((try JSONSerialization.jsonObject(with: parsed) as? [String: Any])?.count, 20)

        let big = (0..<20).map { ("key\($0)", ContextValue.string(String(repeating: "x", count: 400))) }
        let encoded = try XCTUnwrap(MetadataJSON.encode(big))
        XCTAssertLessThanOrEqual(encoded.utf8.count, 4096)
        XCTAssertNotNil(try JSONSerialization.jsonObject(with: Data(encoded.utf8)))
    }

    func testEscapesStrings() throws {
        let json = try XCTUnwrap(MetadataJSON.encode([("note", "a \"quote\"\n\\ \u{1}é")]))
        let object = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String]
        XCTAssertEqual(object?["note"], "a \"quote\"\n\\ \u{1}é")
    }
}

final class ReporterTests: XCTestCase {
    func testContextMergesAndRemoves() {
        let reporter = Reporter()
        reporter.setContext(["plan": "pro", "build": 1])
        reporter.setContext(["plan": "team", "build": nil, "beta": true])
        XCTAssertEqual(reporter.context().map(\.0), ["plan", "beta"])
        XCTAssertEqual(reporter.context().first?.1, .string("team"))
        reporter.reset()
        XCTAssertTrue(reporter.context().isEmpty)
    }

    func testBlankIdentityIsNil() {
        let reporter = Reporter()
        reporter.identify(email: "  ", name: nil, id: "")
        XCTAssertNil(reporter.identityOrNil())
        reporter.identify(email: " jane@acme.com ", name: "Jane", id: nil)
        XCTAssertEqual(reporter.identityOrNil(), ReporterIdentity(email: "jane@acme.com", name: "Jane", id: nil))
    }
}
