import Foundation

/// The three feedback types, with the wire values from docs/CONTRACT.md.
public enum FeedbackKind: String, CaseIterable, Sendable {
    case issue = "issue"
    case featureRequest = "feature_request"
    case other = "other"

    var formTitle: String {
        switch self {
        case .issue: return "Report an issue"
        case .featureRequest: return "Request a feature"
        case .other: return "Tell us more"
        }
    }

    var pickerTitle: String { self == .other ? "Something else" : formTitle }

    var pickerDetail: String {
        switch self {
        case .issue: return "Something isn't working as expected"
        case .featureRequest: return "A small improvement or a big idea"
        case .other: return "Anything else on your mind"
        }
    }

    var placeholder: String {
        switch self {
        case .issue: return "What happened? What did you expect?"
        case .featureRequest: return "What would make this better for you?"
        case .other: return "What's on your mind?"
        }
    }
}

/// Client-side copies of the server caps, so an oversized attachment fails before it is uploaded.
enum FeedbackLimits {
    static let maxTextChars = 5000
    static let maxScreenshotBytes = 10 * 1024 * 1024
    static let maxRecordingBytes = 200 * 1024 * 1024
    static let maxAudioBytes = 25 * 1024 * 1024
    static let maxAudioSeconds = 300
    static let maxMetadataBytes = 4096
}

/// Per-open options for `FeedbackBee.open(_:)`.
public struct OpenOptions: Sendable, Equatable {
    /// Preselected feedback type. `nil` shows the picker, as a shake does.
    public var kind: FeedbackKind?
    /// Hides the type picker and its Back control: for a dedicated "Report a problem" button.
    public var lockKind: Bool
    /// Prefilled note; the user can edit it.
    public var text: String

    public init(kind: FeedbackKind? = nil, lockKind: Bool = false, text: String = "") {
        self.kind = kind
        self.lockKind = lockKind
        self.text = text
    }
}

func formatVoiceDuration(_ seconds: Int) -> String {
    let safe = min(max(seconds, 0), FeedbackLimits.maxAudioSeconds)
    return String(format: "%d:%02d", safe / 60, safe % 60)
}
