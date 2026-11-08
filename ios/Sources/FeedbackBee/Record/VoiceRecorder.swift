#if canImport(UIKit)
import AVFoundation
import UIKit

/// Records an AAC voice note in an `.m4a` file, at most five minutes. The host's audio session
/// category is restored afterwards.
@MainActor
final class VoiceRecorder: NSObject {
    enum Permission { case granted, denied, undetermined }

    /// iOS terminates an app that asks for the microphone without this key, so the mic button is hidden instead.
    static var isAvailable: Bool {
        Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil
    }

    static var permission: Permission {
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
    }

    static func requestPermission(_ done: @escaping @MainActor (Bool) -> Void) {
        let deliver: @Sendable (Bool) -> Void = { granted in
            DispatchQueue.main.async { MainActor.assumeIsolated { done(granted) } }
        }
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: deliver)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(deliver)
        }
    }

    var onFinish: ((Result<AudioAttachment, Error>) -> Void)?

    private var recorder: AVAudioRecorder?
    private var startedAt: Date?
    private var savedSession: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
    private var discardOnFinish = false

    var isRecording: Bool { recorder != nil }

    func start() throws -> Date {
        let session = AVAudioSession.sharedInstance()
        savedSession = (session.category, session.mode, session.categoryOptions)
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)

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

    private func restoreSession() {
        let session = AVAudioSession.sharedInstance()
        if let saved = savedSession {
            try? session.setCategory(saved.0, mode: saved.1, options: saved.2)
        }
        savedSession = nil
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
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
