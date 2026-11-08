#if DEBUG
import FeedbackBeeCore
import UIKit

/// Debug builds only: `-demoScreen <name>` launches straight into one screen,
/// signed in to a built-in fake server with sample reports. Used by
/// `screenshots.sh` (simulator screenshots of every screen, light and dark).
enum DemoScreen: String {
    case signIn, projects, inbox, compose, report, edit, newProject, settings, share
}

enum DemoMode {
    static let screen: DemoScreen? = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-demoScreen"), i + 1 < args.count else { return nil }
        return DemoScreen(rawValue: args[i + 1])
    }()

    @MainActor static func model(_ screen: DemoScreen) -> AppModel {
        let defaults = UserDefaults(suiteName: "demo")!
        defaults.removePersistentDomain(forName: "demo")
        let store = SessionStore(defaults: defaults, secrets: MemorySecrets())
        store.save(Session(host: URL(string: "https://bee.acme.dev")!, email: "ashik@nesin.io", token: "demo"))
        if screen == .signIn { store.clear() }
        if [.inbox, .compose, .report, .edit].contains(screen) { store.lastProjectId = "p1" }
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [DemoServer.self]
        let cache = FileManager.default.temporaryDirectory.appendingPathComponent("demo-\(UUID().uuidString)")
        return AppModel(
            store: store,
            cache: DiskCache(directory: cache),
            urlSession: URLSession(configuration: config),
            device: DeviceContext(appVersion: "0.1.0", osVersion: "18.1", deviceModel: "iPhone17,1")
        )
    }
}

/// The fake FeedbackBee server behind demo mode.
final class DemoServer: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        let path = request.url?.path ?? ""
        let (type, body): (String, Data) = {
            if path.hasPrefix("/f/") { return ("image/png", Self.screenshot) }
            switch path {
            case "/api/v1/projects": return ("application/json", Self.ok(Self.projects))
            case "/api/v1/github/repositories": return ("application/json", Self.ok(Self.repos))
            case "/api/v1/projects/p1/feedback": return ("application/json", Self.ok(#"{"items":[\#(Self.items.joined(separator: ","))],"hasMore":false}"#))
            default:
                if path.hasPrefix("/api/v1/projects/p1/feedback/") {
                    let id = (path as NSString).lastPathComponent
                    return ("application/json", Self.ok(Self.items.first { $0.contains(#""id":"\#(id)""#) } ?? Self.items[0]))
                }
                return ("application/json", Data(#"{"success":false,"error":{"code":"NOT_FOUND","message":"Not found"}}"#.utf8))
            }
        }()
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func ok(_ data: String) -> Data { Data(#"{"success":true,"data":\#(data)}"#.utf8) }

    private static func ago(_ minutes: Double) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date().addingTimeInterval(-minutes * 60))
    }

    private static let projects = """
    [{"id":"p1","name":"Acme Web","slug":"acme-web","githubRepo":"acme/web"},
     {"id":"p2","name":"Acme iOS","slug":"acme-ios","githubRepo":"acme/ios"},
     {"id":"p3","name":"Docs site","slug":"docs","githubRepo":"acme/docs"}]
    """

    private static let repos = """
    [{"id":1,"fullName":"acme/android"},{"id":2,"fullName":"acme/docs"},{"id":3,"fullName":"acme/ios"},{"id":4,"fullName":"acme/web"}]
    """

    private static func item(_ id: String, _ kind: String, _ text: String, _ minutes: Double, status: String = "open", issue: Int? = nil,
                             images: Int = 0, email: String? = nil, replay: Bool = false, audio: Bool = false,
                             os: String = "web", device: String? = nil, failed: Bool = false) -> String {
        let q: (String?) -> String = { $0.map { "\"\($0.replacingOccurrences(of: "\"", with: "\\\""))\"" } ?? "null" }
        let imageKeys = (0..<images).map { "\"p/p1/f/shot-\(id)-\($0).png\"" }.joined(separator: ",")
        return """
        {"id":"\(id)","projectId":"p1","kind":"\(kind)","text":\(q(text)),"status":"\(status)","state":"\(failed ? "issue_error" : "created")",
         "reporterEmail":\(q(email)),"url":"https://acme.dev/checkout","osName":"\(os)","osVersion":"18.1","deviceModel":\(q(device)),
         "appVersion":"2.4.0","screenW":1512,"screenH":982,"metadata":\(email != nil ? #"{"plan":"pro","seats":12}"# : "null"),
         "userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
         "recordingKey":\(replay ? "\"p/p1/f/r1.rrweb.gz\"" : "null"),"recordingSeconds":\(replay ? "48" : "null"),
         "audioKey":\(audio ? "\"p/p1/f/voice.webm\"" : "null"),"audioSeconds":\(audio ? "14" : "null"),
         "issueNumber":\(issue.map(String.init) ?? "null"),"issueUrl":\(issue.map { "\"https://github.com/acme/web/issues/\($0)\"" } ?? "null"),
         "issueError":\(failed ? "\"GitHub 403: Resource not accessible by integration\"" : "null"),
         "createdAt":"\(ago(minutes))","images":[\(imageKeys)]}
        """
    }

    private static let items: [String] = [
        item("f1", "issue", "Checkout total doesn't update after removing a coupon. It still shows the discounted price until I refresh the page.", 4, issue: 128, images: 2, email: "maya@customer.dev", replay: true),
        item("f2", "feature_request", "Dark mode for the dashboard please, I use it at night a lot", 38, status: "in_progress", issue: 127, email: "leo@studio.io"),
        item("f3", "issue", "Upload button does nothing on Safari 18 when the file is larger than 5 MB", 170, issue: 126, images: 1, audio: true, os: "ios", device: "iPhone 16 Pro"),
        item("f4", "other", "Love the new onboarding, took me two minutes to set up.", 600, status: "done", issue: 125),
        item("f5", "issue", "Login link in the reset email points to the staging domain", 1500, status: "done", issue: 124),
        item("f6", "feature_request", "Export reports as CSV", 3000, status: "wont_fix", issue: 123, email: "ops@bigco.com"),
        item("f7", "issue", "Charts flicker when switching tabs", 5000, failed: true),
        item("f8", "other", "Typo on the pricing page: \"anual\"", 9000, status: "done", issue: 121),
    ]

    /// A stand-in app screenshot with an annotation, like reporters attach.
    static let screenshot: Data = UIGraphicsImageRenderer(size: CGSize(width: 390, height: 520)).pngData { ctx in
        UIColor(hex: 0xF8FAFC).setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 390, height: 520))
        UIColor(hex: 0x1E293B).setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 390, height: 56))
        UIColor(hex: 0xE2E8F0).setFill()
        for i in 0..<5 { UIBezierPath(roundedRect: CGRect(x: 20, y: 80 + i * 64, width: 350, height: 48), cornerRadius: 10).fill() }
        UIColor(hex: 0x6366F1).setFill(); UIBezierPath(roundedRect: CGRect(x: 20, y: 420, width: 350, height: 50), cornerRadius: 12).fill()
        UIColor(hex: 0xFF3B30).setStroke()
        let ring = UIBezierPath(ovalIn: CGRect(x: 200, y: 330, width: 180, height: 70)); ring.lineWidth = 5; ring.stroke()
    }
}
#endif
