import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import FeedbackBeeCore

/// The stores against the fake server: cache-first paint, optimistic status
/// with rollback, delete, submit, and sign-out on an expired session.
@MainActor
final class StoresTests: XCTestCase {
    var cacheDir: URL!
    var defaults: UserDefaults!

    override func setUp() async throws {
        FakeServer.requests = []
        cacheDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defaults = UserDefaults(suiteName: UUID().uuidString)!
    }

    func model(signedIn: Bool = true) -> AppModel {
        let store = SessionStore(defaults: defaults, secrets: MemorySecrets())
        if signedIn { store.save(Session(host: URL(string: "https://bee.test")!, email: "me@x.dev", token: "tok")) }
        return AppModel(
            store: store,
            cache: DiskCache(directory: cacheDir),
            urlSession: FakeServer.session(),
            device: DeviceContext(appVersion: "0.1.0", osVersion: "18", deviceModel: "iPhone")
        )
    }

    func testInboxLoadsCachesAndPaintsFromCacheNextTime() async {
        FakeServer.respond = { _ in ok(#"{"items":[\#(itemJSON)],"hasMore":false}"#) }
        let first = model().inbox("p1")
        await first.start()
        XCTAssertEqual(first.items.map(\.id), ["f1"])

        FakeServer.respond = { _ in (500, "{}") }
        let second = model().inbox("p1")
        await second.start()
        XCTAssertEqual(second.items.map(\.id), ["f1"], "cached page shows when the server fails")
        XCTAssertEqual(second.error, "Request failed (500)")
    }

    func testStatusChangeRollsBackOnFailure() async {
        FakeServer.respond = { _ in ok(#"{"items":[\#(itemJSON)],"hasMore":false}"#) }
        let inbox = model().inbox("p1")
        await inbox.start()
        let item = inbox.items[0]

        FakeServer.respond = { _ in fail(503, "SERVICE_UNAVAILABLE", "Couldn't update the GitHub issue: GitHub 500") }
        await inbox.setStatus(item, .done)
        XCTAssertEqual(inbox.items[0].status, .inProgress)
        XCTAssertEqual(inbox.message, "Couldn't update the GitHub issue: GitHub 500")

        FakeServer.respond = { _ in ok(itemJSON.replacingOccurrences(of: "\"in_progress\"", with: "\"done\"")) }
        await inbox.setStatus(item, .done)
        XCTAssertEqual(inbox.items[0].status, .done)
    }

    func testDeleteRemovesAndSubmitInsertsAtTop() async throws {
        FakeServer.respond = { _ in ok(#"{"items":[\#(itemJSON)],"hasMore":false}"#) }
        let inbox = model().inbox("p1")
        await inbox.start()

        FakeServer.respond = { _ in ok(#"{"id":"f1"}"#) }
        await inbox.delete(inbox.items[0])
        XCTAssertTrue(inbox.items.isEmpty)
        XCTAssertEqual(inbox.message, "Report deleted")

        let filed = itemJSON.replacingOccurrences(of: "\"f1\"", with: "\"f2\"")
        FakeServer.respond = { req in
            req.url!.path == "/api/v1/feedback"
                ? (201, #"{"success":true,"data":{"id":"f2","state":"created"}}"#)
                : ok(filed)
        }
        let project = Project(id: "p1", name: "Web", slug: "web", githubRepo: "o/r")
        try await inbox.submit(project: project, kind: .issue, text: "New", images: [])
        XCTAssertEqual(inbox.items.map(\.id), ["f2"])
        XCTAssertEqual(inbox.message, "Filed")
    }

    func testExpiredSessionSignsOutAndKeepsTheHostForNextTime() async throws {
        let app = model()
        FakeServer.respond = { _ in fail(401, "SESSION_INVALID", "Invalid or expired token") }
        await app.projects.refresh()
        for _ in 0..<20 where app.session != nil { try await Task.sleep(nanoseconds: 10_000_000) }
        XCTAssertNil(app.session)
        XCTAssertEqual(app.lastHost, "https://bee.test")
    }

    func testSignInNormalizesTheHost() async throws {
        let app = model(signedIn: false)
        FakeServer.respond = { _ in ok(#"{"token":"jwt","user":{"id":1,"email":"me@x.dev","name":null}}"#) }
        try await app.signIn(host: "Bee.Test/app", email: " me@x.dev ", password: "pw")
        XCTAssertEqual(app.session?.host.absoluteString, "https://bee.test")
        XCTAssertEqual(app.session?.token, "jwt")
        XCTAssertEqual(FakeServer.requests[0].request.url?.absoluteString, "https://bee.test/api/v1/auth/login")
    }
}
