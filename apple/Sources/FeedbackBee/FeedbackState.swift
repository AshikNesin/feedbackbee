import Foundation

/// An annotated screenshot, encoded once when the annotator saves so Send doesn't re-encode it.
struct Screenshot: Equatable {
    let png: Data
    let pixelWidth: Int
    let pixelHeight: Int
    private let id = UUID()

    init(png: Data, pixelWidth: Int, pixelHeight: Int) {
        self.png = png
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
    }

    /// Identity, not bytes: state is compared on every keystroke, and this PNG can be megabytes.
    static func == (lhs: Screenshot, rhs: Screenshot) -> Bool { lhs.id == rhs.id }
}

struct Draft: Equatable {
    var text = ""
    var kind: FeedbackKind = .other
    var email = ""
    var screenshot: Screenshot?
    var audio: AudioAttachment?
    /// The host identified this reporter; the email ships with the report and can't be edited.
    var emailLocked = false
    /// Opened with `lockKind: true`: the Back-to-picker control stays hidden.
    var kindLocked = false

    var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// One submission's lifecycle. The sheet renders straight from this; there are no side flags.
enum FeedbackState: Equatable {
    /// The kind picker. `from` keeps the draft so Back from the form loses nothing.
    case choosing(from: Draft)
    case editing(Draft)
    case recordingAudio(from: Draft, startedAt: Date)
    case uploading(from: Draft)
    case sent(issueUrl: String?)
    /// `resume` is where the user lands to fix the problem and try again.
    case failed(error: String, resume: Draft)

    /// The form behind this state, or nil once the submission is done.
    var form: Draft? {
        switch self {
        case .choosing(let draft), .editing(let draft), .recordingAudio(let draft, _), .uploading(let draft),
             .failed(_, let draft):
            return draft
        case .sent:
            return nil
        }
    }

    /// The draft when the user may still change it.
    var editable: Draft? {
        switch self {
        case .editing(let draft), .recordingAudio(let draft, _), .failed(_, let draft): return draft
        default: return nil
        }
    }

    var isInteractive: Bool {
        switch self {
        case .editing, .failed: return true
        default: return false
        }
    }
}

/// Transitions and upload orchestration for one sheet. Main-actor isolated so `send` resumes on the
/// main thread after the upload and the sheet always renders there.
@MainActor
final class FeedbackController {
    typealias Uploader = (UploadRequest) async -> UploadOutcome

    private(set) var state: FeedbackState = .choosing(from: Draft()) {
        didSet { if state != oldValue { onChange?(state) } }
    }

    var onChange: ((FeedbackState) -> Void)?

    private let reporter: Reporter

    init(reporter: Reporter = .shared) {
        self.reporter = reporter
    }

    func apply(_ options: OpenOptions) {
        guard case .choosing(let from) = state, from == Draft() else { return }
        let identity = reporter.identityOrNil()
        let draft = Draft(
            text: options.text,
            kind: options.kind ?? from.kind,
            email: identity?.email ?? "",
            emailLocked: identity?.email != nil,
            kindLocked: options.lockKind
        )
        state = options.kind == nil && !options.lockKind ? .choosing(from: draft) : .editing(draft)
    }

    func chooseKind(_ kind: FeedbackKind) {
        guard case .choosing(var draft) = state else { return }
        draft.kind = kind
        state = .editing(draft)
    }

    func backToKindPicker() {
        guard let draft = state.editable, !draft.kindLocked, !isRecording else { return }
        state = .choosing(from: draft)
    }

    func editDraft(_ transform: (inout Draft) -> Void) {
        guard var draft = state.editable else { return }
        transform(&draft)
        replaceDraft(draft)
    }

    func attachScreenshot(_ screenshot: Screenshot) {
        editDraft { $0.screenshot = screenshot }
    }

    func removeScreenshot() {
        editDraft { $0.screenshot = nil }
    }

    func beginVoiceRecording(at startedAt: Date) {
        guard let draft = state.editable, !isRecording else { return }
        state = .recordingAudio(from: draft, startedAt: startedAt)
    }

    func finishVoiceRecording(_ audio: AudioAttachment) {
        guard case .recordingAudio(var draft, _) = state else {
            try? FileManager.default.removeItem(at: audio.fileURL)
            return
        }
        if let previous = draft.audio, previous.fileURL != audio.fileURL {
            try? FileManager.default.removeItem(at: previous.fileURL)
        }
        draft.audio = audio
        state = .editing(draft)
    }

    func cancelVoiceRecording() {
        guard case .recordingAudio(let draft, _) = state else { return }
        state = .editing(draft)
    }

    func failVoiceRecording(_ message: String) {
        guard case .recordingAudio(let draft, _) = state else { return }
        state = .failed(error: message, resume: draft)
    }

    func removeVoiceNote() {
        guard let audio = state.editable?.audio else { return }
        editDraft { $0.audio = nil }
        try? FileManager.default.removeItem(at: audio.fileURL)
    }

    func reportProblem(_ message: String) {
        guard let draft = state.editable else { return }
        state = .failed(error: message, resume: draft)
    }

    func send(device: DeviceInfo, config: FeedbackConfig, upload: Uploader) async {
        guard state.isInteractive, let draft = state.editable, draft.canSend else { return }
        state = .uploading(from: draft)
        let identity = reporter.identityOrNil()
        let email = identity?.email ?? draft.email
        let request = UploadRequest(
            project: config.projectId,
            kind: draft.kind,
            text: draft.text,
            email: email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : email,
            device: device,
            screenshotPNG: draft.screenshot?.png,
            audio: draft.audio,
            reporterName: identity?.name,
            reporterId: identity?.id,
            metadata: reporter.context()
        )
        switch await upload(request) {
        case .accepted(let issueUrl):
            if let audio = draft.audio { try? FileManager.default.removeItem(at: audio.fileURL) }
            state = .sent(issueUrl: issueUrl)
        case .rejected(let message):
            state = .failed(error: message, resume: draft)
        }
    }

    /// Called when the sheet closes: deletes a voice note that was never sent.
    func discard() {
        if case .uploading = state { return }
        if let audio = state.form?.audio { try? FileManager.default.removeItem(at: audio.fileURL) }
        state = .choosing(from: Draft())
    }

    var isRecording: Bool {
        if case .recordingAudio = state { return true }
        return false
    }

    private func replaceDraft(_ draft: Draft) {
        switch state {
        case .editing, .failed: state = .editing(draft)
        case .recordingAudio(_, let startedAt): state = .recordingAudio(from: draft, startedAt: startedAt)
        default: break
        }
    }
}
