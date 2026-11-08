import XCTest
@testable import FeedbackBee

final class FeedbackControllerTests: XCTestCase {
    private let device = DeviceInfo(appVersion: nil, osVersion: "18.1", deviceModel: "iPhone16,1", screenWidth: 1, screenHeight: 1)
    private let config = try! FeedbackConfig.create(projectId: "myapp", endpoint: "https://bee.example.dev")

    @MainActor func testPickerThenFormKeepsDraftOnBack() async {
        let controller = FeedbackController(reporter: Reporter())
        controller.apply(OpenOptions())
        controller.chooseKind(.issue)
        controller.editDraft { $0.text = "Broken" }
        controller.backToKindPicker()
        XCTAssertEqual(controller.state, .choosing(from: Draft(text: "Broken", kind: .issue)))
        controller.chooseKind(.featureRequest)
        XCTAssertEqual(controller.state, .editing(Draft(text: "Broken", kind: .featureRequest)))
    }

    @MainActor func testLockedKindSkipsPickerAndPrefillsIdentity() async {
        let reporter = Reporter()
        reporter.identify(email: "jane@acme.com", name: nil, id: nil)
        let controller = FeedbackController(reporter: reporter)
        controller.apply(OpenOptions(kind: .issue, lockKind: true, text: "Checkout fails"))
        let expected = Draft(text: "Checkout fails", kind: .issue, email: "jane@acme.com", emailLocked: true, kindLocked: true)
        XCTAssertEqual(controller.state, .editing(expected))
        controller.backToKindPicker()
        XCTAssertEqual(controller.state, .editing(expected))
    }

    @MainActor func testSendSuccess() async {
        let reporter = Reporter()
        reporter.identify(email: nil, name: "Jane", id: "u_1")
        reporter.setContext(["plan": "pro"])
        let controller = FeedbackController(reporter: reporter)
        controller.apply(OpenOptions(kind: .other))
        controller.editDraft { $0.text = "Hello"; $0.email = "me@x.dev" }

        var seen: UploadRequest?
        var statesDuringUpload: [FeedbackState] = []
        await controller.send(device: device, config: config) { request in
            seen = request
            statesDuringUpload.append(controller.state)
            return .accepted(issueUrl: "https://github.com/o/r/issues/2")
        }
        XCTAssertEqual(controller.state, .sent(issueUrl: "https://github.com/o/r/issues/2"))
        XCTAssertEqual(statesDuringUpload, [.uploading(from: Draft(text: "Hello", kind: .other, email: "me@x.dev"))])
        XCTAssertEqual(seen?.project, "myapp")
        XCTAssertEqual(seen?.email, "me@x.dev")
        XCTAssertEqual(seen?.reporterName, "Jane")
        XCTAssertEqual(seen?.reporterId, "u_1")
        XCTAssertEqual(seen?.metadata.first?.0, "plan")
    }

    @MainActor func testSendFailureKeepsDraftAndBlankNoteNeverSends() async {
        let controller = FeedbackController(reporter: Reporter())
        controller.apply(OpenOptions(kind: .issue))
        var calls = 0
        await controller.send(device: device, config: config) { _ in calls += 1; return .accepted(issueUrl: nil) }
        XCTAssertEqual(calls, 0)

        controller.editDraft { $0.text = "Broken" }
        await controller.send(device: device, config: config) { _ in .rejected(message: "text is required") }
        XCTAssertEqual(controller.state, .failed(error: "text is required", resume: Draft(text: "Broken", kind: .issue)))
        controller.editDraft { $0.text = "Broken again" }
        XCTAssertEqual(controller.state, .editing(Draft(text: "Broken again", kind: .issue)))
    }

    @MainActor func testVoiceNoteLifecycleDeletesReplacedFiles() async throws {
        let controller = FeedbackController(reporter: Reporter())
        controller.apply(OpenOptions(kind: .issue))
        let first = try tempFile(), second = try tempFile()

        controller.beginVoiceRecording(at: Date())
        XCTAssertTrue(controller.isRecording)
        controller.finishVoiceRecording(AudioAttachment(fileURL: first, seconds: 3))
        XCTAssertEqual(controller.state.form?.audio?.seconds, 3)

        controller.beginVoiceRecording(at: Date())
        controller.finishVoiceRecording(AudioAttachment(fileURL: second, seconds: 5))
        XCTAssertFalse(FileManager.default.fileExists(atPath: first.path))
        XCTAssertEqual(controller.state.form?.audio?.fileURL, second)

        controller.removeVoiceNote()
        XCTAssertNil(controller.state.form?.audio)
        XCTAssertFalse(FileManager.default.fileExists(atPath: second.path))

        let stray = try tempFile()
        controller.finishVoiceRecording(AudioAttachment(fileURL: stray, seconds: 1))
        XCTAssertFalse(FileManager.default.fileExists(atPath: stray.path), "a recording that finishes outside RecordingAudio is deleted")
    }

    @MainActor func testScreenshotAttachAndRemove() async {
        let controller = FeedbackController(reporter: Reporter())
        controller.apply(OpenOptions(kind: .issue))
        let shot = Screenshot(png: Data("PNG".utf8), pixelWidth: 10, pixelHeight: 20)
        controller.attachScreenshot(shot)
        XCTAssertEqual(controller.state.form?.screenshot, shot)
        controller.removeScreenshot()
        XCTAssertNil(controller.state.form?.screenshot)
    }

    @MainActor func testOnChangeFiresOncePerTransition() async {
        let controller = FeedbackController(reporter: Reporter())
        var count = 0
        controller.onChange = { _ in count += 1 }
        controller.apply(OpenOptions(kind: .issue))
        controller.editDraft { $0.text = "" }
        XCTAssertEqual(count, 1)
    }

    @MainActor func testShapesAndFormatting() async {
        XCTAssertFalse(Shape.pen([Pt(x: 0, y: 0)]).isVisible(minSize: 4))
        XCTAssertTrue(Shape.box(from: Pt(x: 0, y: 0), to: Pt(x: 10, y: 10)).isVisible(minSize: 4))
        XCTAssertFalse(Shape.arrow(from: Pt(x: 0, y: 0), to: Pt(x: 1, y: 1)).isVisible(minSize: 4))
        let (left, right) = arrowBarbs(from: Pt(x: 0, y: 0), to: Pt(x: 10, y: 0), length: 5)
        XCTAssertLessThan(left.x, 10)
        XCTAssertEqual(left.x, right.x, accuracy: 1e-9)
        XCTAssertEqual(left.y, -right.y, accuracy: 1e-9)
        XCTAssertEqual(formatVoiceDuration(65), "1:05")
        XCTAssertEqual(formatVoiceDuration(999), "5:00")
    }

    private func tempFile() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("fbb-\(UUID().uuidString).m4a")
        try Data("m4a".utf8).write(to: url)
        return url
    }
}
