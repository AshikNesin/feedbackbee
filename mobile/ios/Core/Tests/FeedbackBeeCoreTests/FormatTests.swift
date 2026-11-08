import XCTest
@testable import FeedbackBeeCore

final class FormatTests: XCTestCase {
    func testHostGetsHttpsAndLosesPaths() {
        XCTAssertEqual(normalizeHost("bee.example.com")?.absoluteString, "https://bee.example.com")
        XCTAssertEqual(normalizeHost("  https://Bee.Example.com/  ")?.absoluteString, "https://bee.example.com")
        XCTAssertEqual(normalizeHost("https://bee.example.com/app/projects/x?feedback=1")?.absoluteString, "https://bee.example.com")
        XCTAssertEqual(normalizeHost("http://localhost:8787")?.absoluteString, "http://localhost:8787")
        XCTAssertEqual(normalizeHost("my-bee.workers.dev/app")?.absoluteString, "https://my-bee.workers.dev")
    }

    func testHostRejectsNonWebAddresses() {
        XCTAssertNil(normalizeHost(""))
        XCTAssertNil(normalizeHost("not a host"))
        XCTAssertNil(normalizeHost("ftp://bee.example.com"))
        XCTAssertNil(normalizeHost("https://"))
    }

    func testSlugFollowsTheServerRule() {
        XCTAssertEqual(slugify("My App.dev"), "my-app-dev")
        XCTAssertTrue(isValidSlug(slugify("Hello World")))
        XCTAssertFalse(isValidSlug("ab"))
        XCTAssertFalse(isValidSlug("-abc"))
        XCTAssertEqual(slugify(String(repeating: "x", count: 60)).count, 40)
    }

    func testRelativeTime() {
        let now = Date(timeIntervalSince1970: 1_794_132_000) // 2026-11-08T10:00:00Z
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let en = Locale(identifier: "en_US")
        XCTAssertEqual(relativeTime(now.addingTimeInterval(-30), now: now, calendar: calendar, locale: en), "now")
        XCTAssertEqual(relativeTime(now.addingTimeInterval(-300), now: now, calendar: calendar, locale: en), "5m")
        XCTAssertEqual(relativeTime(now.addingTimeInterval(-3 * 3600), now: now, calendar: calendar, locale: en), "3h")
        XCTAssertEqual(relativeTime(now.addingTimeInterval(-2 * 86_400), now: now, calendar: calendar, locale: en), "2d")
        XCTAssertEqual(relativeTime(now.addingTimeInterval(-20 * 86_400), now: now, calendar: calendar, locale: en), "Oct 19")
        XCTAssertTrue(relativeTime(now.addingTimeInterval(-400 * 86_400), now: now, calendar: calendar, locale: en).hasSuffix("2025"))
    }

    func testClockAndPagePath() {
        XCTAssertEqual(clock(nil), "0:00")
        XCTAssertEqual(clock(65.4), "1:05")
        XCTAssertEqual(pagePath("https://example.com/checkout?x=1"), "example.com/checkout")
        XCTAssertEqual(pagePath("https://example.com/"), "example.com")
        XCTAssertNil(pagePath(nil))
    }
}
