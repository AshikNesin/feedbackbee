import Foundation

/// Thrown by `FeedbackBee.configure` for a blank project id or an unusable endpoint.
public struct FeedbackBeeConfigurationError: Error, Equatable, CustomStringConvertible {
    public let message: String
    public var description: String { message }
}

struct FeedbackConfig: Equatable, Sendable {
    let projectId: String
    let endpoint: String

    var feedbackURL: URL { URL(string: "\(endpoint)/api/v1/feedback")! }

    static func create(projectId: String, endpoint: String) throws -> FeedbackConfig {
        let id = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else { throw FeedbackBeeConfigurationError(message: "FeedbackBee: projectId must not be blank") }
        return FeedbackConfig(projectId: id, endpoint: try normalizeEndpoint(endpoint))
    }

    /// Same rules as the Android SDK: an http(s) base URL with a host, no credentials, query or fragment.
    static func normalizeEndpoint(_ raw: String) throws -> String {
        let url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else { throw FeedbackBeeConfigurationError(message: "FeedbackBee: endpoint must not be blank") }
        let invalid = FeedbackBeeConfigurationError(message: "FeedbackBee: endpoint must be a valid http:// or https:// URL with a host")
        guard let components = URLComponents(string: url),
              let scheme = components.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = components.host, !host.isEmpty
        else { throw invalid }
        guard components.user == nil, components.password == nil, components.query == nil, components.fragment == nil else {
            throw FeedbackBeeConfigurationError(message: "FeedbackBee: endpoint must not include credentials, query parameters, or a fragment")
        }
        if let port = components.port, !(1...65535).contains(port) {
            throw FeedbackBeeConfigurationError(message: "FeedbackBee: endpoint port must be between 1 and 65535")
        }
        var trimmed = Substring(url)
        while trimmed.hasSuffix("/") { trimmed = trimmed.dropLast() }
        return String(trimmed)
    }
}
