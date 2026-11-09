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
        let dir = cacheDir!
        return AppModel(
            store: store,
            cache: DiskCache(directory: dir),
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
        for _ in 0..<500 where app.session != nil { try await Task.sleep(nanoseconds: 10_000_000) }
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

    func testALate401FromAnEarlierSessionDoesNotSignOutTheNewOne() async throws {
        let app = model()
        let old = app.api
        FakeServer.respond = { _ in ok(#"{"token":"fresh","user":{"id":1,"email":"me@x.dev","name":null}}"#) }
        try await app.signIn(host: "bee.test", email: "me@x.dev", password: "pw")
        FakeServer.respond = { _ in fail(401, "SESSION_INVALID", "Invalid or expired token") }
        _ = try? await old.projects()
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(app.session?.token, "fresh")
    }

    func testSignedOutCallsFailInsteadOfCrashing() async {
        let app = model(signedIn: false)
        await app.projects.refresh()
        XCTAssertNotNil(app.projects.error)
    }

    func testAnOlderPageIsDroppedAfterARefresh() async throws {
        var page = 0
        FakeServer.respond = { req in
            page += 1
            if req.url!.query?.contains("before") == true {
                return ok(#"{"items":[\#(itemJSON.replacingOccurrences(of: "\"f1\"", with: "\"old\""))],"hasMore":false}"#)
            }
            return ok(#"{"items":[\#(itemJSON)],"hasMore":true}"#)
        }
        let inbox = model().inbox("p1")
        await inbox.start()
        async let more: Void = inbox.loadMore()
        await inbox.setStatusFilter(.done)
        await more
        XCTAssertFalse(inbox.items.contains { $0.id == "old" }, "a page from before the filter change must not be appended")
    }

    func testFractionalScreenSizesDecode() throws {
        let json = itemJSON.replacingOccurrences(of: "\"screenW\":390", with: "\"screenW\":390.5")
        let item = try Wire.decoder.decode(FeedbackItem.self, from: Data(json.utf8))
        XCTAssertEqual(item.screenW, 391)
    }
}
