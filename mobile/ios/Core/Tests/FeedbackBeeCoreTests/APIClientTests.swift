import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import FeedbackBeeCore

/// A fake FeedbackBee server: each test sets `respond`; requests are recorded.
final class FakeServer: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var respond: (URLRequest) -> (Int, String) = { _ in (404, "{}") }
    nonisolated(unsafe) static var requests: [(request: URLRequest, body: Data)] = []

    static func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [FakeServer.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let n = stream.read(&buffer, maxLength: buffer.count)
                if n <= 0 { break }
                body.append(buffer, count: n)
            }
            stream.close()
        }
        FakeServer.requests.append((request, body))
        let (status, json) = FakeServer.respond(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(json.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

func ok(_ data: String) -> (Int, String) { (200, #"{"success":true,"data":\#(data)}"#) }
func fail(_ status: Int, _ code: String, _ message: String) -> (Int, String) {
    (status, #"{"success":false,"error":{"code":"\#(code)","message":"\#(message)"}}"#)
}

let itemJSON = """
{"id":"f1","projectId":"p1","kind":"feature_request","text":"Dark mode","reporterEmail":"a@b.co",
 "metadata":{"plan":"pro","seats":3,"beta":true},"url":"https://x.dev/a","userAgent":null,
 "screenW":390,"screenH":844,"recordingKey":"p/p1/f/r.rrweb.gz","recordingSeconds":12.5,
 "state":"created","issueNumber":42,"issueUrl":"https://github.com/o/r/issues/42","issueError":null,
 "status":"in_progress","createdAt":"2026-11-08T10:00:00.000Z","images":["p/p1/f/a.png"],"somethingNew":1}
"""

final class APIClientTests: XCTestCase {
    var expired = 0
    let host = URL(string: "https://bee.test")!

    override func setUp() {
        FakeServer.requests = []
        expired = 0
    }

    func api(token: String? = "tok") -> APIClient {
        APIClient(host: host, token: token, session: FakeServer.session()) { [weak self] in self?.expired += 1 }
    }

    func testSignInPostsCredentialsWithoutAToken() async throws {
        FakeServer.respond = { _ in ok(#"{"token":"jwt","user":{"id":1,"email":"me@x.dev","name":null}}"#) }
        let result = try await api(token: nil).signIn(email: "me@x.dev", password: "pw")
        XCTAssertEqual(result.token, "jwt")
        let sent = FakeServer.requests[0]
        XCTAssertEqual(sent.request.url?.path, "/api/v1/auth/login")
        XCTAssertNil(sent.request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(String(decoding: sent.body, as: UTF8.self), #"{"email":"me@x.dev","password":"pw"}"#)
    }

    func testWrongPasswordShowsTheServerMessage() async {
        FakeServer.respond = { _ in fail(401, "UNAUTHORIZED", "Invalid email or password") }
        do {
            _ = try await api(token: nil).signIn(email: "me@x.dev", password: "nope")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(userMessage(error), "Invalid email or password")
        }
        XCTAssertEqual(expired, 0)
    }

    func testExpiredSessionSignsOut() async {
        FakeServer.respond = { _ in fail(401, "SESSION_INVALID", "Invalid or expired token") }
        _ = try? await api().projects()
        XCTAssertEqual(expired, 1)
        XCTAssertEqual(FakeServer.requests[0].request.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
    }

    func testFeedbackPageDecodesAndSendsCursorAndFilter() async throws {
        FakeServer.respond = { _ in ok(#"{"items":[\#(itemJSON)],"hasMore":true}"#) }
        let page = try await api().feedback(projectId: "p1", before: 1_700_000_000_000, status: .inProgress)
        let f = try XCTUnwrap(page.items.first)
        XCTAssertTrue(page.hasMore)
        XCTAssertEqual(f.kind, .featureRequest)
        XCTAssertEqual(f.status, .inProgress)
        XCTAssertEqual(f.issueNumber, 42)
        XCTAssertEqual(f.metadata?["plan"]?.description, "pro")
        XCTAssertEqual(f.metadata?["seats"]?.description, "3")
        XCTAssertEqual(f.metadata?["beta"]?.description, "true")
        XCTAssertTrue(f.isReplay)
        XCTAssertEqual(f.createdAtMs, 1_794_132_000_000)
        let url = FakeServer.requests[0].request.url!
        XCTAssertEqual(url.path, "/api/v1/projects/p1/feedback")
        XCTAssertEqual(url.query, "before=1700000000000&status=in_progress")
    }

    func testUnknownEnumValuesFallBack() throws {
        let json = itemJSON.replacingOccurrences(of: "\"in_progress\"", with: "\"triaged\"")
            .replacingOccurrences(of: "\"feature_request\"", with: "\"praise\"")
        let item = try Wire.decoder.decode(FeedbackItem.self, from: Data(json.utf8))
        XCTAssertEqual(item.status, .open)
        XCTAssertEqual(item.kind, .other)
    }

    func testEditSendsOnlyChangedFields() async throws {
        FakeServer.respond = { _ in ok(itemJSON) }
        _ = try await api().updateFeedback(projectId: "p1", id: "f1", text: "Dark mode, please")
        let sent = FakeServer.requests[0]
        XCTAssertEqual(sent.request.httpMethod, "PATCH")
        XCTAssertEqual(sent.request.url?.path, "/api/v1/projects/p1/feedback/f1")
        XCTAssertEqual(String(decoding: sent.body, as: UTF8.self), #"{"text":"Dark mode, please"}"#)
    }

    func testDeleteAndSync() async throws {
        FakeServer.respond = { req in
            req.httpMethod == "DELETE" ? ok(#"{"id":"f1"}"#) : ok(#"{"checked":3,"updated":1}"#)
        }
        try await api().deleteFeedback(projectId: "p1", id: "f1")
        let synced = try await api().sync(projectId: "p1")
        XCTAssertEqual(synced.updated, 1)
        XCTAssertEqual(FakeServer.requests[1].request.url?.path, "/api/v1/projects/p1/sync")
    }

    func testSubmitIsMultipartWithDeviceContextAndToken() async throws {
        FakeServer.respond = { _ in (201, #"{"success":true,"data":{"id":"f9","state":"created","issueUrl":null}}"#) }
        let result = try await api().submit(
            projectSlug: "myapp", kind: .issue, text: "Crash on save",
            images: [Upload(data: Data([0xFF, 0xD8, 0xFF]), mime: "image/jpeg", fileName: "image-1.jpg")],
            device: DeviceContext(appVersion: "0.1.0", osVersion: "18.1", deviceModel: "iPhone17,1")
        )
        XCTAssertEqual(result.id, "f9")
        let sent = FakeServer.requests[0]
        XCTAssertEqual(sent.request.url?.path, "/api/v1/feedback")
        XCTAssertEqual(sent.request.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
        XCTAssertTrue(sent.request.value(forHTTPHeaderField: "Content-Type")!.hasPrefix("multipart/form-data; boundary="))
        let body = String(decoding: sent.body, as: UTF8.self)
        for part in ["project", "kind", "text", "os_name", "os_version", "device_model", "app_version", "image"] {
            XCTAssertTrue(body.contains("name=\"\(part)\""), "missing \(part)")
        }
        XCTAssertTrue(body.contains("filename=\"image-1.jpg\""))
        XCTAssertTrue(body.contains("\r\nios\r\n"))
    }

    func testLinks() {
        let client = api()
        XCTAssertEqual(client.mediaURL("p/p1/f/a.png").absoluteString, "https://bee.test/f/p/p1/f/a.png")
        XCTAssertEqual(client.dashboardURL(projectSlug: "web", feedbackId: "f1").absoluteString, "https://bee.test/app/projects/web?feedback=f1")
    }
}
