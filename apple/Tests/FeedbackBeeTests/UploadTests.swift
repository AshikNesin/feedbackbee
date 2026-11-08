import XCTest
@testable import FeedbackBee

final class UploadTests: XCTestCase {
    private let device = DeviceInfo(appVersion: "1.2.3", osName: "ios", osVersion: "18.1", deviceModel: "iPhone16,1", screenWidth: 1179, screenHeight: 2556)

    private func render(_ body: MultipartBody) throws -> String {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("fbb-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: url) }
        try body.write(to: url)
        return String(decoding: try Data(contentsOf: url), as: UTF8.self)
    }

    func testMultipartLayout() throws {
        var body = MultipartBody(parts: [
            .text(name: "project", value: "myapp"),
            .file(name: "image", filename: "a\"b.png", mimeType: "image/png", source: .data(Data("PNG".utf8))),
        ])
        body.boundary = "B"
        XCTAssertEqual(body.contentType, "multipart/form-data; boundary=B")
        XCTAssertEqual(
            try render(body),
            "--B\r\nContent-Disposition: form-data; name=\"project\"\r\n\r\nmyapp\r\n" +
                "--B\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a%22b.png\"\r\nContent-Type: image/png\r\n\r\nPNG\r\n" +
                "--B--\r\n"
        )
    }

    func testStreamsFileParts() throws {
        let audioURL = FileManager.default.temporaryDirectory.appendingPathComponent("fbb-voice-\(UUID().uuidString).m4a")
        let payload = Data((0..<200_000).map { UInt8($0 % 251) })
        try payload.write(to: audioURL)
        defer { try? FileManager.default.removeItem(at: audioURL) }

        var body = MultipartBody(parts: [.file(name: "audio", filename: "v.m4a", mimeType: "audio/mp4", source: .file(audioURL))])
        body.boundary = "B"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("fbb-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: url) }
        try body.write(to: url)
        let written = try Data(contentsOf: url)
        XCTAssertNotNil(written.range(of: payload))
    }

    func testRequestFields() throws {
        let request = UploadRequest(
            project: "myapp", kind: .featureRequest, text: "  Dark mode please  ", email: " jane@acme.com ",
            device: device, screenshotPNG: Data("PNG".utf8), audio: nil,
            reporterName: "Jane", reporterId: "u_1", metadata: [("plan", "pro")]
        )
        let text = try render(UploadRequestBuilder.body(for: request))
        func field(_ name: String) -> String? {
            guard let range = text.range(of: "name=\"\(name)\"\r\n\r\n") else { return nil }
            return text[range.upperBound...].components(separatedBy: "\r\n").first
        }
        XCTAssertEqual(field("project"), "myapp")
        XCTAssertEqual(field("kind"), "feature_request")
        XCTAssertEqual(field("text"), "Dark mode please")
        XCTAssertEqual(field("email"), "jane@acme.com")
        XCTAssertEqual(field("os_name"), "ios")
        XCTAssertEqual(field("os_version"), "18.1")
        XCTAssertEqual(field("device_model"), "iPhone16,1")
        XCTAssertEqual(field("app_version"), "1.2.3")
        XCTAssertEqual(field("screen_w"), "1179")
        XCTAssertEqual(field("screen_h"), "2556")
        XCTAssertEqual(field("reporter_name"), "Jane")
        XCTAssertEqual(field("reporter_id"), "u_1")
        XCTAssertEqual(field("metadata"), #"{"plan":"pro"}"#)
        XCTAssertTrue(text.contains("name=\"image\"; filename=\"screenshot.png\"\r\nContent-Type: image/png"))
        XCTAssertNil(field("audio_seconds"))
    }

    func testMacReportsItsOwnOSName() throws {
        let mac = DeviceInfo(appVersion: nil, osName: "macos", osVersion: "15.1.0", deviceModel: "Mac14,2", screenWidth: 3024, screenHeight: 1964)
        let request = UploadRequest(project: "p", kind: .issue, text: "x", email: nil, device: mac, screenshotPNG: nil, audio: nil)
        XCTAssertTrue(try render(UploadRequestBuilder.body(for: request)).contains("name=\"os_name\"\r\n\r\nmacos\r\n"))
    }

    func testPreflightRejectsOversizedAttachments() {
        let big = UploadRequest(
            project: "p", kind: .issue, text: "x", email: nil, device: device,
            screenshotPNG: Data(count: FeedbackLimits.maxScreenshotBytes + 1), audio: nil
        )
        XCTAssertEqual(UploadRequestBuilder.preflight(big), "The screenshot is too large to upload.")

        let long = UploadRequest(
            project: "p", kind: .issue, text: "x", email: nil, device: device, screenshotPNG: nil,
            audio: AudioAttachment(fileURL: URL(fileURLWithPath: "/nonexistent.m4a"), seconds: 301)
        )
        XCTAssertEqual(UploadRequestBuilder.preflight(long), "Audio duration must be between 0 and 300 seconds.")
    }

    func testTextIsCutInUTF16UnitsOnCharacterBoundaries() {
        XCTAssertEqual(UploadRequestBuilder.truncated("hello", utf16: 5), "hello")
        // "👍" is two UTF-16 units: four of them fit in 9 units, never half of the fifth.
        let cut = UploadRequestBuilder.truncated(String(repeating: "👍", count: 5), utf16: 9)
        XCTAssertEqual(cut, String(repeating: "👍", count: 4))
    }

    func testParsesResponses() {
        let created = Data(#"{"success":true,"data":{"id":"1","state":"created","issueUrl":"https://github.com/o/r/issues/1"}}"#.utf8)
        XCTAssertEqual(parseUploadResponse(status: 201, body: created), .accepted(issueUrl: "https://github.com/o/r/issues/1"))
        XCTAssertEqual(parseUploadResponse(status: 202, body: Data()), .accepted(issueUrl: nil))
        let invalid = Data(#"{"success":false,"error":{"code":"VALIDATION_ERROR","message":"text is required"}}"#.utf8)
        XCTAssertEqual(parseUploadResponse(status: 400, body: invalid), .rejected(message: "text is required"))
        XCTAssertEqual(parseUploadResponse(status: 404, body: Data("nope".utf8)), .rejected(message: "The server rejected this feedback."))
        XCTAssertEqual(
            parseUploadResponse(status: 429, body: Data()),
            .rejected(message: "Too many submissions. Please try again in a little while.")
        )
        XCTAssertEqual(
            parseUploadResponse(status: 301, body: Data()),
            .rejected(message: "The endpoint redirected (HTTP 301). Use the final URL, including https.")
        )
        XCTAssertEqual(parseUploadResponse(status: 500, body: Data()), .rejected(message: "Server error (HTTP 500). Please try again later."))
    }
}
