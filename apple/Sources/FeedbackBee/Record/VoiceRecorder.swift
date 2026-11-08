#if canImport(AVFoundation)
import AVFoundation
import Foundation

/// Records an AAC voice note in an `.m4a` file, at most five minutes. On iOS the host's audio session
/// category is restored afterwards; macOS has no audio session.
@MainActor
final class VoiceRecorder: NSObject {
    enum Permission { case granted, denied, undetermined }

    /// The OS terminates an app that asks for the microphone without the usage string (and a sandboxed
    /// Mac app can't record without the audio-input entitlement), so the mic button is hidden instead.
    static var isAvailable: Bool {
        guard Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil else { return false }
        #if os(macOS)
        return !Entitlements.isSandboxed || Entitlements.has("com.apple.security.device.audio-input")
        #else
        return true
        #endif
    }

    static var permission: Permission {
        #if os(macOS)
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return .granted
        case .notDetermined: return .undetermined
        default: return .denied
        }
        #else
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted: return .granted
            case .denied: return .denied
            default: return .undetermined
            }
        }
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return .granted
        case .denied: return .denied
        default: return .undetermined
        }
        #endif
    }

    static func requestPermission(_ done: @escaping @MainActor (Bool) -> Void) {
        let deliver: @Sendable (Bool) -> Void = { granted in
            DispatchQueue.main.async { MainActor.assumeIsolated { done(granted) } }
        }
        #if os(macOS)
        AVCaptureDevice.requestAccess(for: .audio, completionHandler: deliver)
        #else
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: deliver)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(deliver)
        }
        #endif
    }

    var onFinish: ((Result<AudioAttachment, Error>) -> Void)?

    private var recorder: AVAudioRecorder?
    private var startedAt: Date?
    private var discardOnFinish = false
    #if os(iOS)
    private var savedSession: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
    #endif

    var isRecording: Bool { recorder != nil }

    func start() throws -> Date {
        try activateSession()
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("feedbackbee-voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 64_000,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.delegate = self
            guard recorder.record(forDuration: TimeInterval(FeedbackLimits.maxAudioSeconds)) else {
                throw CocoaError(.fileWriteUnknown)
            }
            self.recorder = recorder
        } catch {
            restoreSession()
            throw error
        }
        let now = Date()
        startedAt = now
        discardOnFinish = false
        return now
    }

    /// Finishes the note; `onFinish` delivers it.
    func stop() {
        recorder?.stop()
    }

    /// Stops and deletes the file; `onFinish` is not called.
    func cancel() {
        guard let recorder else { return }
        discardOnFinish = true
        recorder.stop()
    }

    private func finish(successfully: Bool) {
        guard let recorder else { return }
        let url = recorder.url
        let elapsed = startedAt.map { Date().timeIntervalSince($0) } ?? 0
        self.recorder = nil
        startedAt = nil
        restoreSession()
        if discardOnFinish {
            try? FileManager.default.removeItem(at: url)
            return
        }
        guard successfully else {
            try? FileManager.default.removeItem(at: url)
            onFinish?(.failure(CocoaError(.fileWriteUnknown)))
            return
        }
        let seconds = min(max(Int(elapsed.rounded()), 0), FeedbackLimits.maxAudioSeconds)
        onFinish?(.success(AudioAttachment(fileURL: url, seconds: seconds)))
    }

    private func activateSession() throws {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        savedSession = (session.category, session.mode, session.categoryOptions)
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)
        #endif
    }

    private func restoreSession() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        if let saved = savedSession {
            try? session.setCategory(saved.0, mode: saved.1, options: saved.2)
        }
        savedSession = nil
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}

extension VoiceRecorder: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        DispatchQueue.main.async { MainActor.assumeIsolated { self.finish(successfully: flag) } }
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        DispatchQueue.main.async { MainActor.assumeIsolated { recorder.stop() } }
    }
}
#endif
