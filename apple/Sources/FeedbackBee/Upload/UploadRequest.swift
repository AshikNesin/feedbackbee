import Foundation

struct DeviceInfo: Equatable, Sendable {
    let appVersion: String?
    /// `ios` or `macos` (the contract's `os_name`).
    let osName: String
    let osVersion: String
    let deviceModel: String
    let screenWidth: Int
    let screenHeight: Int
}

struct AudioAttachment: Equatable, Sendable {
    let fileURL: URL
    let seconds: Int

    var byteCount: Int {
        (try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    }
}

struct UploadRequest {
    let project: String
    let kind: FeedbackKind
    let text: String
    let email: String?
    let device: DeviceInfo
    /// An annotated screenshot, already PNG-encoded.
    let screenshotPNG: Data?
    let audio: AudioAttachment?
    var reporterName: String? = nil
    var reporterId: String? = nil
    var metadata: [(String, ContextValue)] = []
}

enum UploadOutcome: Equatable {
    /// `issueUrl` is nil on a 202: the server stored the feedback but could not create the issue yet.
    case accepted(issueUrl: String?)
    case rejected(message: String)
}

enum UploadRequestBuilder {
    /// A reason to refuse the request before touching the network, or nil when it is within the caps.
    static func preflight(_ request: UploadRequest) -> String? {
        if let png = request.screenshotPNG, png.count > FeedbackLimits.maxScreenshotBytes {
            return "The screenshot is too large to upload."
        }
        if let audio = request.audio {
            if audio.byteCount > FeedbackLimits.maxAudioBytes { return "That audio is over the 25 MB limit." }
            if !(0...FeedbackLimits.maxAudioSeconds).contains(audio.seconds) {
                return "Audio duration must be between 0 and 300 seconds."
            }
        }
        return nil
    }

    /// Field for field the same parts the Android SDK sends (docs/CONTRACT.md), with `os_name` `ios` or `macos`.
    static func body(for request: UploadRequest) -> MultipartBody {
        let device = request.device
        var parts: [Part] = [
            .text(name: "project", value: request.project),
            .text(name: "kind", value: request.kind.rawValue),
            .text(name: "text", value: truncated(request.text.trimmingCharacters(in: .whitespacesAndNewlines), utf16: FeedbackLimits.maxTextChars)),
        ]
        if let email = request.email?.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty {
            parts.append(.text(name: "email", value: email))
        }
        if let version = device.appVersion { parts.append(.text(name: "app_version", value: version)) }
        parts.append(.text(name: "os_name", value: device.osName))
        parts.append(.text(name: "os_version", value: device.osVersion))
        parts.append(.text(name: "device_model", value: device.deviceModel))
        parts.append(.text(name: "screen_w", value: String(device.screenWidth)))
        parts.append(.text(name: "screen_h", value: String(device.screenHeight)))
        if let name = request.reporterName { parts.append(.text(name: "reporter_name", value: name)) }
        if let id = request.reporterId { parts.append(.text(name: "reporter_id", value: id)) }
        if let json = MetadataJSON.encode(request.metadata) { parts.append(.text(name: "metadata", value: json)) }
        if let png = request.screenshotPNG {
            parts.append(.file(name: "image", filename: "screenshot.png", mimeType: "image/png", source: .data(png)))
        }
        if let audio = request.audio {
            parts.append(.text(name: "audio_seconds", value: String(audio.seconds)))
            parts.append(.file(name: "audio", filename: audio.fileURL.lastPathComponent, mimeType: "audio/mp4", source: .file(audio.fileURL)))
        }
        return MultipartBody(parts: parts)
    }

    /// The server caps `text` in UTF-16 units (JavaScript length); cut on a character boundary under it.
    static func truncated(_ text: String, utf16 limit: Int) -> String {
        guard text.utf16.count > limit else { return text }
        var count = 0
        var end = text.startIndex
        for index in text.indices {
            let next = text.index(after: index)
            count += text[index..<next].utf16.count
            if count > limit { break }
            end = next
        }
        return String(text[..<end])
    }
}
