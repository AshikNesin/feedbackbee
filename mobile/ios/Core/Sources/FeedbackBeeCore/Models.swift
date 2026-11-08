import Foundation

// The dashboard API's shapes (apps/web/src/server/wire-types.ts). Unknown
// fields are ignored and unknown enum values fall back, so a newer server
// never breaks an older app.

public enum Kind: String, Codable, CaseIterable, Identifiable, Sendable {
    case issue
    case featureRequest = "feature_request"
    case other

    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .issue: "Issue"
        case .featureRequest: "Feature request"
        case .other: "Other"
        }
    }
    /// Chip label: Issue / Idea / Other.
    public var short: String { self == .featureRequest ? "Idea" : label }

    public init(from decoder: Decoder) throws {
        self = Kind(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .other
    }
}

public enum Status: String, Codable, CaseIterable, Identifiable, Sendable {
    case open
    case inProgress = "in_progress"
    case done
    case wontFix = "wont_fix"

    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .open: "Open"
        case .inProgress: "In progress"
        case .done: "Done"
        case .wontFix: "Won't fix"
        }
    }

    public init(from decoder: Decoder) throws {
        self = Status(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .open
    }
}

public struct Project: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public let slug: String
    public var githubRepo: String

    public init(id: String, name: String, slug: String, githubRepo: String) {
        self.id = id
        self.name = name
        self.slug = slug
        self.githubRepo = githubRepo
    }
}

/// A reporter metadata value: string, number or boolean.
public enum Scalar: Codable, Hashable, Sendable, CustomStringConvertible {
    case string(String)
    case number(Double)
    case bool(Bool)

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else { self = .string(try c.decode(String.self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        }
    }

    public var description: String {
        switch self {
        case .string(let s): s
        case .number(let n): n.rounded() == n && abs(n) < 1e15 ? String(Int64(n)) : String(n)
        case .bool(let b): b ? "true" : "false"
        }
    }
}

public struct FeedbackItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let projectId: String
    public var kind: Kind
    public var text: String
    public var status: Status
    public var state: String
    public var reporterEmail: String?
    public var reporterName: String?
    public var reporterId: String?
    public var metadata: [String: Scalar]?
    public var url: String?
    public var userAgent: String?
    public var screenW: Int?
    public var screenH: Int?
    public var appVersion: String?
    public var osName: String?
    public var osVersion: String?
    public var deviceModel: String?
    public var recordingKey: String?
    public var recordingSeconds: Double?
    public var audioKey: String?
    public var audioSeconds: Double?
    public var issueNumber: Int?
    public var issueUrl: String?
    public var issueError: String?
    public let createdAt: Date
    public var images: [String]

    /// `createdAt` in epoch ms: the paging cursor.
    public var createdAtMs: Int64 { Int64((createdAt.timeIntervalSince1970 * 1000).rounded()) }
    public var isReplay: Bool { recordingKey?.hasSuffix(".rrweb.gz") == true }
    public var issueFailed: Bool { state == "issue_error" }

    public init(
        id: String, projectId: String, kind: Kind, text: String, status: Status = .open, state: String = "created",
        reporterEmail: String? = nil, reporterName: String? = nil, reporterId: String? = nil,
        metadata: [String: Scalar]? = nil, url: String? = nil, userAgent: String? = nil,
        screenW: Int? = nil, screenH: Int? = nil, appVersion: String? = nil, osName: String? = nil,
        osVersion: String? = nil, deviceModel: String? = nil, recordingKey: String? = nil,
        recordingSeconds: Double? = nil, audioKey: String? = nil, audioSeconds: Double? = nil,
        issueNumber: Int? = nil, issueUrl: String? = nil, issueError: String? = nil,
        createdAt: Date, images: [String] = []
    ) {
        self.id = id; self.projectId = projectId; self.kind = kind; self.text = text; self.status = status
        self.state = state; self.reporterEmail = reporterEmail; self.reporterName = reporterName
        self.reporterId = reporterId; self.metadata = metadata; self.url = url; self.userAgent = userAgent
        self.screenW = screenW; self.screenH = screenH; self.appVersion = appVersion; self.osName = osName
        self.osVersion = osVersion; self.deviceModel = deviceModel; self.recordingKey = recordingKey
        self.recordingSeconds = recordingSeconds; self.audioKey = audioKey; self.audioSeconds = audioSeconds
        self.issueNumber = issueNumber; self.issueUrl = issueUrl; self.issueError = issueError
        self.createdAt = createdAt; self.images = images
    }

    enum CodingKeys: String, CodingKey {
        case id, projectId, kind, text, status, state, reporterEmail, reporterName, reporterId, metadata, url
        case userAgent, screenW, screenH, appVersion, osName, osVersion, deviceModel, recordingKey
        case recordingSeconds, audioKey, audioSeconds, issueNumber, issueUrl, issueError, createdAt, images
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        projectId = try c.decode(String.self, forKey: .projectId)
        kind = try c.decode(Kind.self, forKey: .kind)
        text = try c.decode(String.self, forKey: .text)
        status = try c.decodeIfPresent(Status.self, forKey: .status) ?? .open
        state = try c.decodeIfPresent(String.self, forKey: .state) ?? "pending"
        reporterEmail = try c.decodeIfPresent(String.self, forKey: .reporterEmail)
        reporterName = try c.decodeIfPresent(String.self, forKey: .reporterName)
        reporterId = try c.decodeIfPresent(String.self, forKey: .reporterId)
        metadata = try c.decodeIfPresent([String: Scalar].self, forKey: .metadata)
        url = try c.decodeIfPresent(String.self, forKey: .url)
        userAgent = try c.decodeIfPresent(String.self, forKey: .userAgent)
        screenW = try c.decodeIfPresent(Int.self, forKey: .screenW)
        screenH = try c.decodeIfPresent(Int.self, forKey: .screenH)
        appVersion = try c.decodeIfPresent(String.self, forKey: .appVersion)
        osName = try c.decodeIfPresent(String.self, forKey: .osName)
        osVersion = try c.decodeIfPresent(String.self, forKey: .osVersion)
        deviceModel = try c.decodeIfPresent(String.self, forKey: .deviceModel)
        recordingKey = try c.decodeIfPresent(String.self, forKey: .recordingKey)
        recordingSeconds = try c.decodeIfPresent(Double.self, forKey: .recordingSeconds)
        audioKey = try c.decodeIfPresent(String.self, forKey: .audioKey)
        audioSeconds = try c.decodeIfPresent(Double.self, forKey: .audioSeconds)
        issueNumber = try c.decodeIfPresent(Int.self, forKey: .issueNumber)
        issueUrl = try c.decodeIfPresent(String.self, forKey: .issueUrl)
        issueError = try c.decodeIfPresent(String.self, forKey: .issueError)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        images = try c.decodeIfPresent([String].self, forKey: .images) ?? []
    }
}

public struct FeedbackPage: Codable, Sendable {
    public var items: [FeedbackItem]
    public var hasMore: Bool
    public init(items: [FeedbackItem], hasMore: Bool) { self.items = items; self.hasMore = hasMore }
}

public struct SessionUser: Codable, Sendable { public let id: Int; public let email: String; public let name: String? }
public struct SignIn: Codable, Sendable { public let token: String; public let user: SessionUser }
public struct GithubRepository: Codable, Identifiable, Hashable, Sendable { public let id: Int64; public let fullName: String }
public struct SubmitResult: Codable, Sendable { public let id: String; public let state: String; public let issueUrl: String?; public let error: String? }
public struct SyncResult: Codable, Sendable { public let checked: Int; public let updated: Int }

/// Who is signed in where. The token lives in the Keychain (see `SessionStore`).
public struct Session: Equatable, Sendable {
    public let host: URL
    public let email: String
    public let token: String
    public init(host: URL, email: String, token: String) { self.host = host; self.email = email; self.token = token }
}

/// An image to attach to a new report, already encoded by the app (JPEG).
public struct Upload: Sendable {
    public let data: Data
    public let mime: String
    public let fileName: String
    public init(data: Data, mime: String, fileName: String) { self.data = data; self.mime = mime; self.fileName = fileName }
}

/// Device context sent with reports filed from the app (docs/CONTRACT.md).
public struct DeviceContext: Sendable {
    public let appVersion: String
    public let osVersion: String
    public let deviceModel: String
    public init(appVersion: String, osVersion: String, deviceModel: String) {
        self.appVersion = appVersion; self.osVersion = osVersion; self.deviceModel = deviceModel
    }
}
