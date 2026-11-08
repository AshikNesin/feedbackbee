import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// A failed call, with the server's message when it sent one (groot's error envelope).
public struct APIError: LocalizedError, Equatable, Sendable {
    public let status: Int
    public let code: String?
    public let message: String

    public var errorDescription: String? { message }
    /// The session guard's 401: the token expired or the account is gone.
    public var sessionInvalid: Bool { status == 401 && (code == "SESSION_INVALID" || code == nil) }

    static let network = APIError(status: 0, code: "NETWORK", message: "Can't reach the server. Check your connection")
}

/// JSON with the server's ISO dates (with or without milliseconds).
enum Wire {
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { d in
            let raw = try d.singleValueContainer().decode(String.self)
            if let date = parseDate(raw) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: d.codingPath, debugDescription: "Bad date \(raw)"))
        }
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, e in
            var c = e.singleValueContainer()
            try c.encode(formatDate(date))
        }
        return encoder
    }()

    static func parseDate(_ raw: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    static func formatDate(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }
}

/// The FeedbackBee HTTP API for one server. Not main-actor bound: requests
/// and JSON decoding run off the main thread.
public struct APIClient: Sendable {
    public let host: URL
    private let token: String?
    private let session: URLSession
    private let onSessionInvalid: @Sendable () -> Void

    public init(host: URL, token: String?, session: URLSession = .shared, onSessionInvalid: @escaping @Sendable () -> Void = {}) {
        self.host = host
        self.token = token
        self.session = session
        self.onSessionInvalid = onSessionInvalid
    }

    // MARK: Auth

    public func signIn(email: String, password: String) async throws -> SignIn {
        try await send(request("POST", "/api/v1/auth/login", json: ["email": email, "password": password]), authed: false)
    }

    // MARK: Projects

    public func projects() async throws -> [Project] { try await send(request("GET", "/api/v1/projects")) }

    public func createProject(name: String, slug: String, githubRepo: String) async throws -> Project {
        try await send(request("POST", "/api/v1/projects", json: ["name": name, "slug": slug, "githubRepo": githubRepo]))
    }

    public func deleteProject(_ projectId: String) async throws {
        let _: Ignored = try await send(request("DELETE", "/api/v1/projects/\(projectId)"))
    }

    public func repositories() async throws -> [GithubRepository] {
        try await send(request("GET", "/api/v1/github/repositories"))
    }

    // MARK: Feedback

    public func feedback(projectId: String, before: Int64? = nil, status: Status? = nil) async throws -> FeedbackPage {
        var query: [URLQueryItem] = []
        if let before { query.append(URLQueryItem(name: "before", value: String(before))) }
        if let status { query.append(URLQueryItem(name: "status", value: status.rawValue)) }
        return try await send(request("GET", "/api/v1/projects/\(projectId)/feedback", query: query))
    }

    public func feedbackItem(projectId: String, id: String) async throws -> FeedbackItem {
        try await send(request("GET", "/api/v1/projects/\(projectId)/feedback/\(id)"))
    }

    /// Edit status, kind or text; only the given fields are sent.
    public func updateFeedback(projectId: String, id: String, status: Status? = nil, kind: Kind? = nil, text: String? = nil) async throws -> FeedbackItem {
        var body: [String: String] = [:]
        if let status { body["status"] = status.rawValue }
        if let kind { body["kind"] = kind.rawValue }
        if let text { body["text"] = text }
        return try await send(request("PATCH", "/api/v1/projects/\(projectId)/feedback/\(id)", json: body))
    }

    public func deleteFeedback(projectId: String, id: String) async throws {
        let _: Ignored = try await send(request("DELETE", "/api/v1/projects/\(projectId)/feedback/\(id)"))
    }

    public func sync(projectId: String) async throws -> SyncResult {
        try await send(request("POST", "/api/v1/projects/\(projectId)/sync"))
    }

    /// File a report through the public submit endpoint, as the owner (no rate limit).
    public func submit(projectSlug: String, kind: Kind, text: String, images: [Upload], device: DeviceContext) async throws -> SubmitResult {
        var form = Multipart()
        form.field("project", projectSlug)
        form.field("kind", kind.rawValue)
        form.field("text", text)
        form.field("os_name", "ios")
        form.field("os_version", device.osVersion)
        form.field("device_model", device.deviceModel)
        form.field("app_version", device.appVersion)
        for image in images { form.file("image", fileName: image.fileName, mime: image.mime, data: image.data) }
        var req = request("POST", "/api/v1/feedback")
        req.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        req.httpBody = form.finished()
        req.timeoutInterval = 120
        return try await send(req)
    }

    // MARK: Links

    /// Public media (`/f/<key>`): immutable, cached forever by the image loader.
    public func mediaURL(_ key: String) -> URL { host.appendingPathComponent("f").appendingPathComponent(key) }
    public func replayURL(_ key: String) -> URL { host.appendingPathComponent("replay").appendingPathComponent(key) }

    public func dashboardURL(projectSlug: String? = nil, feedbackId: String? = nil) -> URL {
        var parts = URLComponents(url: host, resolvingAgainstBaseURL: false)!
        parts.path = projectSlug.map { "/app/projects/\($0)" } ?? "/app/projects"
        if let feedbackId { parts.queryItems = [URLQueryItem(name: "feedback", value: feedbackId)] }
        return parts.url!
    }

    // MARK: Plumbing

    private struct Ignored: Decodable {}

    private struct Failure: Decodable {
        struct Body: Decodable { let code: String?; let message: String? }
        let success: Bool?
        let error: Body?
    }

    private struct Envelope<T: Decodable>: Decodable { let data: T }

    private func request(_ method: String, _ path: String, query: [URLQueryItem] = [], json: [String: String]? = nil) -> URLRequest {
        var parts = URLComponents(url: host, resolvingAgainstBaseURL: false)!
        parts.path = path
        if !query.isEmpty { parts.queryItems = query }
        var req = URLRequest(url: parts.url!)
        req.httpMethod = method
        req.timeoutInterval = 30
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
        }
        return req
    }

    private func send<T: Decodable>(_ request: URLRequest, authed: Bool = true) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            if (error as? URLError)?.code == .cancelled { throw CancellationError() }
            throw APIError.network
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let failure = try? Wire.decoder.decode(Failure.self, from: data)
        if (200..<300).contains(status), failure?.success == true {
            do {
                return try Wire.decoder.decode(Envelope<T>.self, from: data).data
            } catch {
                throw APIError(status: status, code: "DECODE", message: "The server sent an unexpected response")
            }
        }
        let error = APIError(
            status: status,
            code: failure?.error?.code,
            message: failure?.error?.message ?? ((200..<300).contains(status) ? "The server sent an unexpected response" : "Request failed (\(status))")
        )
        if authed, error.sessionInvalid { onSessionInvalid() }
        throw error
    }
}

/// A message fit for a banner.
public func userMessage(_ error: Error) -> String {
    (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
}
