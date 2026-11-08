import Foundation

/// The server answers in groot's envelope: `{"success":true,"data":{"id","state","issueUrl"}}`
/// or `{"success":false,"error":{"code","message"}}` (docs/CONTRACT.md).
func parseUploadResponse(status: Int, body: Data) -> UploadOutcome {
    switch status {
    case 201: return .accepted(issueUrl: jsonField(body, "data", "issueUrl"))
    case 202: return .accepted(issueUrl: nil)
    case 429: return .rejected(message: "Too many submissions. Please try again in a little while.")
    case 400, 403, 404, 413, 415:
        return .rejected(message: jsonField(body, "error", "message") ?? "The server rejected this feedback.")
    case 300...399: return .rejected(message: "The endpoint redirected (HTTP \(status)). Use the final URL, including https.")
    default: return .rejected(message: "Server error (HTTP \(status)). Please try again later.")
    }
}

private func jsonField(_ body: Data, _ object: String, _ name: String) -> String? {
    guard let root = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
          let nested = root[object] as? [String: Any],
          let value = nested[name] as? String,
          !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else { return nil }
    return value
}
