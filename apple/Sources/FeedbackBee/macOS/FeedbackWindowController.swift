#if os(macOS)
import AppKit

/// Escape closes, like a sheet.
final class FeedbackWindow: NSWindow {
    override func cancelOperation(_ sender: Any?) {
        performClose(sender)
    }
}

/// The three screens (pick a kind, write the note, done) in one small window, rendered from `FeedbackState`.
@MainActor
final class FeedbackWindowController: NSWindowController, NSWindowDelegate, NSTextViewDelegate, NSTextFieldDelegate {
    var onClosed: (() -> Void)?

    private let controller = FeedbackController()
    private let config: FeedbackConfig
    private weak var host: NSWindow?
    private let recorder = VoiceRecorder()
    private var annotator: AnnotationWindowController?
    private var voiceTimer: Timer?
    private var lastRendered: FeedbackState?
    private var shownScreenshot: Screenshot?
    private var latestThumbnail: NSImage?
    private var micDenied = false
    private var issueURL: URL?
    private var screenshotInFlight = false

    // Chrome
    private let content = NSStackView()
    private lazy var backButton = symbolButton("chevron.left", label: "Back", action: #selector(back))
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(wrappingLabelWithString: "")

    // Screens
    private let chooseGroup = NSStackView()
    private let formGroup = NSStackView()
    private let doneGroup = NSStackView()

    // Form
    private let noteBox = BorderedBox()
    private let noteScroll = NSTextView.scrollableTextView()
    private var noteView: NSTextView { noteScroll.documentView as! NSTextView }
    private let notePlaceholder = NSTextField(labelWithString: "")
    private let emailLabel = NSTextField(labelWithString: "Email (optional)")
    private let emailField = NSTextField(string: "")
    private let screenshotBlock = BorderedBox()
    private let screenshotImage = NSImageView()
    private lazy var removeScreenshotButton = symbolButton("xmark.circle.fill", label: "Remove screenshot", action: #selector(removeScreenshot))
    private let recordingRow = FilledStack()
    private let recordingLabel = NSTextField(labelWithString: "")
    private lazy var stopButton = NSButton(title: "Stop", target: self, action: #selector(stopVoice))
    private let voiceRow = FilledStack()
    private let voiceLabel = NSTextField(labelWithString: "")
    private lazy var rerecordButton = NSButton(title: "Re-record", target: self, action: #selector(toggleVoice))
    private lazy var removeVoiceButton = symbolButton("xmark.circle.fill", label: "Remove voice note", action: #selector(removeVoice))
    private let voiceHint = NSTextField(wrappingLabelWithString: "")
    private let errorLabel = NSTextField(wrappingLabelWithString: "")
    private lazy var cameraButton = symbolButton("camera", label: "Attach screenshot", action: #selector(attachScreenshot), bordered: true)
    private lazy var micButton = symbolButton("mic", label: "Record voice note", action: #selector(toggleVoice), bordered: true)
    private lazy var sendButton = NSButton(title: "Send Feedback", target: self, action: #selector(send))
    private let spinner = NSProgressIndicator()

    // Done
    private lazy var githubButton = NSButton(title: "View on GitHub ↗", target: self, action: #selector(openIssue))

    private static let width: CGFloat = 400
    private static let inset: CGFloat = 20

    init(config: FeedbackConfig, options: OpenOptions, host: NSWindow?) {
        self.config = config
        self.host = host
        let window = FeedbackWindow(
            contentRect: NSRect(x: 0, y: 0, width: Self.width, height: 300),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Share Feedback"
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.adoptAppearance(of: host)
        super.init(window: window)
        window.delegate = self
        build(in: window)
        recorder.onFinish = { [weak self] result in self?.voiceFinished(result) }
        controller.apply(options)
        controller.onChange = { [weak self] state in self?.render(state) }
        render(controller.state)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func present() {
        guard let window else { return }
        window.layoutIfNeeded()
        if let host, host.isVisible {
            let frame = window.frame, hostFrame = host.frame
            window.setFrameTopLeftPoint(NSPoint(x: hostFrame.midX - frame.width / 2, y: hostFrame.maxY - 80))
        } else {
            window.center()
        }
        showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        if case .editing = controller.state { window.makeFirstResponder(noteView) }
    }

    // MARK: Rendering

    private func render(_ state: FeedbackState) {
        defer { lastRendered = state }
        if renderKeystroke(state) { return }
        switch state {
        case .choosing: renderChoose()
        case .sent(let url): renderDone(issueUrl: url)
        default: renderForm(state)
        }
    }

    /// Typing only changes the note or email, which the fields already show: update what depends on
    /// them instead of re-rendering the form on every keystroke.
    private func renderKeystroke(_ state: FeedbackState) -> Bool {
        guard case .editing(let next) = state, case .editing(var previous)? = lastRendered else { return false }
        previous.text = next.text
        previous.email = next.email
        guard previous == next else { return false }
        notePlaceholder.isHidden = !next.text.isEmpty
        if sendButton.isEnabled != next.canSend { sendButton.isEnabled = next.canSend }
        return true
    }

    private func renderChoose() {
        show(chooseGroup)
        titleLabel.stringValue = "Share feedback"
        subtitleLabel.stringValue = "A little feedback goes a long way."
        subtitleLabel.isHidden = false
        backButton.isHidden = true
    }

    private func renderDone(issueUrl: String?) {
        show(doneGroup)
        titleLabel.stringValue = "Feedback sent"
        subtitleLabel.stringValue = "Thanks for helping us make things better."
        subtitleLabel.isHidden = false
        backButton.isHidden = true
        issueURL = issueUrl.flatMap(URL.init(string:))
        githubButton.isHidden = issueURL == nil
        announce("Feedback sent")
    }

    private func renderForm(_ state: FeedbackState) {
        guard let draft = state.form else { return }
        let interactive = state.isInteractive
        let recording: Bool
        if case .recordingAudio = state { recording = true } else { recording = false }
        let uploading: Bool
        if case .uploading = state { uploading = true } else { uploading = false }
        let wasForm = !formGroup.isHidden
        show(formGroup)
        titleLabel.stringValue = draft.kind.formTitle
        subtitleLabel.stringValue = "We're listening. Tell us a little more."
        subtitleLabel.isHidden = false
        backButton.isHidden = draft.kindLocked
        backButton.isEnabled = interactive

        if noteView.string != draft.text { noteView.string = draft.text }
        notePlaceholder.stringValue = draft.kind.placeholder
        notePlaceholder.isHidden = !draft.text.isEmpty
        noteView.isEditable = interactive || recording
        if emailField.stringValue != draft.email { emailField.stringValue = draft.email }
        emailField.isEnabled = (interactive || recording) && !draft.emailLocked
        emailLabel.stringValue = draft.emailLocked ? "Email (from your account)" : "Email (optional)"

        if draft.screenshot != shownScreenshot {
            screenshotImage.image = draft.screenshot == nil ? nil : latestThumbnail
            shownScreenshot = draft.screenshot
        }
        screenshotBlock.isHidden = draft.screenshot == nil
        removeScreenshotButton.isEnabled = interactive
        let canCapture = host?.isVisible == true
        cameraButton.isEnabled = interactive && canCapture && annotator == nil && !screenshotInFlight
        cameraButton.toolTip = canCapture ? (draft.screenshot == nil ? "Attach a screenshot" : "Retake the screenshot") : "No window to capture"

        recordingRow.isHidden = !recording
        voiceRow.isHidden = draft.audio == nil || recording
        micButton.isHidden = !VoiceRecorder.isAvailable || draft.audio != nil || recording
        micButton.isEnabled = interactive && !micDenied && VoiceRecorder.permission != .denied
        voiceLabel.stringValue = draft.audio.map { "Voice note · \(formatVoiceDuration($0.seconds))" } ?? ""
        rerecordButton.isEnabled = interactive
        removeVoiceButton.isEnabled = interactive
        if case .recordingAudio(_, let startedAt) = state { startTimer(startedAt) } else { stopTimer() }

        if case .failed(let message, _) = state {
            errorLabel.stringValue = message
            errorLabel.isHidden = false
            announce(message)
        } else {
            errorLabel.isHidden = true
        }
        sendButton.title = uploading ? "Sending…" : "Send Feedback"
        sendButton.isEnabled = interactive && draft.canSend
        if uploading { spinner.startAnimation(nil) } else { spinner.stopAnimation(nil) }
        spinner.isHidden = !uploading
        if !wasForm, interactive { window?.makeFirstResponder(noteView) }
    }

    private func show(_ group: NSView) {
        for candidate in [chooseGroup, formGroup, doneGroup] { candidate.isHidden = candidate !== group }
    }

    private func announce(_ message: String) {
        guard let window else { return }
        NSAccessibility.post(element: window, notification: .announcementRequested, userInfo: [
            .announcement: message, .priority: NSAccessibilityPriorityLevel.high.rawValue,
        ])
    }

    // MARK: Actions

    @objc private func back() {
        controller.backToKindPicker()
    }

    @objc private func send() {
        guard controller.state.isInteractive else { return }
        window?.makeFirstResponder(nil)
        let device = DeviceInfo.currentMac(screen: window?.screen)
        let config = config
        Task { [controller] in
            await controller.send(device: device, config: config) { request in
                await FeedbackUploader.upload(config: config, request: request)
            }
        }
    }

    @objc private func attachScreenshot() {
        guard let host, host.isVisible, let image = WindowCapture.capture(host) else {
            controller.reportProblem("Couldn't capture the window. Please try again.")
            return
        }
        let annotator = AnnotationWindowController(image: image, pointScale: host.backingScaleFactor, over: host)
        annotator.onFinish = { [weak self] result in
            guard let self else { return }
            self.annotator = nil
            self.window?.makeKeyAndOrderFront(nil)
            if let result { self.storeScreenshot(result) } else { self.forceRender() }
        }
        self.annotator = annotator
        forceRender()
        annotator.showWindow(nil)
    }

    private func storeScreenshot(_ annotated: AnnotatedScreenshot) {
        screenshotInFlight = true
        forceRender()
        Task { [weak self] in
            let processed = await ScreenshotEncoder.process(annotated)
            guard let self else { return }
            self.screenshotInFlight = false
            guard let processed else {
                self.controller.reportProblem("The screenshot is too large to upload.")
                self.forceRender()
                return
            }
            self.latestThumbnail = processed.thumbnail.map { NSImage(cgImage: $0, size: .zero) }
            self.shownScreenshot = nil
            self.controller.attachScreenshot(processed.screenshot)
            self.forceRender()
        }
    }

    @objc private func removeScreenshot() {
        controller.removeScreenshot()
    }

    @objc private func toggleVoice() {
        switch VoiceRecorder.permission {
        case .granted: startRecording()
        case .denied: showMicDenied()
        case .undetermined:
            VoiceRecorder.requestPermission { [weak self] granted in
                if granted { self?.startRecording() } else { self?.showMicDenied() }
            }
        }
    }

    private func startRecording() {
        guard controller.state.isInteractive else { return }
        do {
            let startedAt = try recorder.start()
            controller.beginVoiceRecording(at: startedAt)
        } catch {
            controller.reportProblem("Couldn't start recording. Please try again.")
        }
    }

    @objc private func stopVoice() {
        recorder.stop()
    }

    @objc private func removeVoice() {
        controller.removeVoiceNote()
    }

    private func voiceFinished(_ result: Result<AudioAttachment, Error>) {
        switch result {
        case .success(let audio): controller.finishVoiceRecording(audio)
        case .failure: controller.failVoiceRecording("The recording failed. Please try again.")
        }
    }

    private func showMicDenied() {
        micDenied = true
        voiceHint.stringValue = "Microphone access is off. Turn it on in System Settings → Privacy & Security → Microphone."
        voiceHint.isHidden = false
        forceRender()
    }

    @objc private func openIssue() {
        if let issueURL { NSWorkspace.shared.open(issueURL) }
    }

    @objc private func done() {
        window?.performClose(nil)
    }

    /// Same state, new outside input (annotator, permission): render everything.
    private func forceRender() {
        lastRendered = nil
        render(controller.state)
    }

    private func startTimer(_ startedAt: Date) {
        let update = { [weak self] in
            let seconds = Int(Date().timeIntervalSince(startedAt))
            self?.recordingLabel.stringValue = "Voice note · \(formatVoiceDuration(seconds)) / 5:00"
        }
        update()
        guard voiceTimer == nil else { return }
        // Added to the main run loop, so the block always runs on the main thread.
        let timer = Timer(timeInterval: 1, repeats: true) { _ in MainActor.assumeIsolated { update() } }
        timer.tolerance = 0.2
        RunLoop.main.add(timer, forMode: .common)
        voiceTimer = timer
    }

    private func stopTimer() {
        voiceTimer?.invalidate()
        voiceTimer = nil
    }

    // MARK: Window

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if case .uploading = controller.state { return false }
        return true
    }

    func windowWillClose(_ notification: Notification) {
        recorder.cancel()
        stopTimer()
        annotator?.onFinish = nil
        annotator?.close()
        annotator = nil
        controller.discard()
        onClosed?()
    }

    // MARK: Text

    func textDidChange(_ notification: Notification) {
        let text = noteView.string
        notePlaceholder.isHidden = !text.isEmpty
        controller.editDraft { $0.text = text }
    }

    func textView(_ textView: NSTextView, shouldChangeTextIn range: NSRange, replacementString text: String?) -> Bool {
        // NSString length is UTF-16 units, which is what the server's 5000-character cap counts.
        let current = textView.string as NSString
        return current.length - range.length + ((text ?? "") as NSString).length <= FeedbackLimits.maxTextChars
    }

    func textView(_ textView: NSTextView, doCommandBy selector: Selector) -> Bool {
        // Tab moves focus, as in every other form field.
        switch selector {
        case #selector(NSResponder.insertTab(_:)):
            window?.selectNextKeyView(nil)
            return true
        case #selector(NSResponder.insertBacktab(_:)):
            window?.selectPreviousKeyView(nil)
            return true
        default:
            return false
        }
    }

    func textDidBeginEditing(_ notification: Notification) { noteBox.focused = true }
    func textDidEndEditing(_ notification: Notification) { noteBox.focused = false }

    func controlTextDidChange(_ notification: Notification) {
        let email = emailField.stringValue
        controller.editDraft { $0.email = email }
    }

    // MARK: Building

    private func build(in window: NSWindow) {
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        titleLabel.setAccessibilityRole(.staticText)
        subtitleLabel.font = .systemFont(ofSize: 12)
        subtitleLabel.textColor = .secondaryLabelColor
        let header = NSStackView(views: [backButton, titleLabel])
        header.spacing = 6

        let footer = NSTextField(labelWithAttributedString: {
            let text = NSMutableAttributedString(string: "Powered by ", attributes: [
                .font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.tertiaryLabelColor,
            ])
            text.append(NSAttributedString(string: "FeedbackBee", attributes: [
                .font: NSFont.systemFont(ofSize: 10, weight: .semibold), .foregroundColor: NSColor.secondaryLabelColor,
            ]))
            return text
        }())

        buildChoose()
        buildForm()
        buildDone()

        content.orientation = .vertical
        content.alignment = .leading
        content.spacing = 14
        content.edgeInsets = NSEdgeInsets(top: 16, left: Self.inset, bottom: 14, right: Self.inset)
        // Hug tightly, above the window's size-stay-put priority, so the window follows the content.
        content.setHuggingPriority(.defaultHigh, for: .vertical)
        for view in [header, subtitleLabel, chooseGroup, formGroup, doneGroup, footer] {
            content.addArrangedSubview(view)
        }
        content.setCustomSpacing(4, after: header)
        content.setCustomSpacing(16, after: subtitleLabel)
        window.contentView = content
        content.widthAnchor.constraint(equalToConstant: Self.width).isActive = true
        for view in [subtitleLabel, chooseGroup, formGroup, doneGroup] {
            fillWidth(view)
        }
        footer.centerXAnchor.constraint(equalTo: content.centerXAnchor).isActive = true
    }

    private func buildChoose() {
        chooseGroup.orientation = .vertical
        chooseGroup.spacing = 8
        let symbols: [FeedbackKind: String] = [.issue: "exclamationmark.bubble", .featureRequest: "lightbulb", .other: "ellipsis.bubble"]
        for kind in FeedbackKind.allCases {
            let tile = KindTile(kind: kind, symbol: symbols[kind] ?? "bubble.left")
            tile.onClick = { [weak self] in self?.controller.chooseKind(kind) }
            chooseGroup.addArrangedSubview(tile)
            tile.widthAnchor.constraint(equalTo: chooseGroup.widthAnchor).isActive = true
        }
    }

    private func buildForm() {
        formGroup.orientation = .vertical
        formGroup.alignment = .leading
        formGroup.spacing = 6

        let noteLabel = NSTextField(labelWithString: "Your feedback")
        noteLabel.font = .systemFont(ofSize: 12, weight: .medium)
        emailLabel.font = .systemFont(ofSize: 12, weight: .medium)

        noteView.delegate = self
        noteView.isRichText = false
        noteView.importsGraphics = false
        noteView.allowsUndo = true
        noteView.font = .systemFont(ofSize: 13)
        noteView.textColor = .labelColor
        noteView.textContainerInset = NSSize(width: 4, height: 7)
        noteView.drawsBackground = false
        noteView.setAccessibilityLabel("Your feedback")
        noteScroll.drawsBackground = false
        noteScroll.borderType = .noBorder
        noteScroll.autohidesScrollers = true
        notePlaceholder.textColor = .placeholderTextColor
        notePlaceholder.font = .systemFont(ofSize: 13)
        notePlaceholder.setAccessibilityElement(false)
        pin(noteScroll, in: noteBox, inset: 1)
        noteBox.addSubview(notePlaceholder)
        notePlaceholder.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            noteBox.heightAnchor.constraint(equalToConstant: 110),
            notePlaceholder.topAnchor.constraint(equalTo: noteBox.topAnchor, constant: 8),
            notePlaceholder.leadingAnchor.constraint(equalTo: noteBox.leadingAnchor, constant: 10),
        ])

        emailField.placeholderString = "you@example.com"
        emailField.bezelStyle = .roundedBezel
        emailField.delegate = self
        emailField.setAccessibilityLabel("Email")

        screenshotImage.imageScaling = .scaleProportionallyUpOrDown
        screenshotImage.setAccessibilityLabel("Annotated screenshot")
        pin(screenshotImage, in: screenshotBlock, inset: 4)
        screenshotBlock.addSubview(removeScreenshotButton)
        removeScreenshotButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            screenshotBlock.heightAnchor.constraint(equalToConstant: 140),
            removeScreenshotButton.topAnchor.constraint(equalTo: screenshotBlock.topAnchor, constant: 6),
            removeScreenshotButton.trailingAnchor.constraint(equalTo: screenshotBlock.trailingAnchor, constant: -6),
        ])

        // A symbol tinted with a system color follows the appearance on its own (a layer color would not).
        let dot = NSImageView(image: NSImage(systemSymbolName: "circle.fill", accessibilityDescription: nil) ?? NSImage())
        dot.symbolConfiguration = .init(pointSize: 8, weight: .regular)
        dot.contentTintColor = .systemRed
        recordingLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        stopButton.contentTintColor = .systemRed
        configureRow(recordingRow, [dot, recordingLabel, NSView(), stopButton])
        voiceLabel.font = .systemFont(ofSize: 12)
        configureRow(voiceRow, [voiceLabel, NSView(), rerecordButton, removeVoiceButton])

        for label in [voiceHint, errorLabel] {
            label.font = .systemFont(ofSize: 12)
            label.isHidden = true
        }
        voiceHint.textColor = .secondaryLabelColor
        errorLabel.textColor = .systemRed

        spinner.style = .spinning
        spinner.controlSize = .small
        spinner.isDisplayedWhenStopped = false
        spinner.isHidden = true
        sendButton.keyEquivalent = "\r"
        sendButton.bezelStyle = .rounded
        sendButton.controlSize = .large
        let toolbar = NSStackView(views: [cameraButton, micButton, NSView(), spinner, sendButton])
        toolbar.spacing = 8

        let rows: [(NSView, CGFloat)] = [
            (noteLabel, 4), (noteBox, 12), (emailLabel, 4), (emailField, 12), (screenshotBlock, 10),
            (recordingRow, 10), (voiceRow, 10), (voiceHint, 8), (errorLabel, 10), (toolbar, 0),
        ]
        for (row, spacing) in rows {
            formGroup.addArrangedSubview(row)
            formGroup.setCustomSpacing(spacing, after: row)
        }
        for row in [noteBox, emailField, screenshotBlock, recordingRow, voiceRow, voiceHint, errorLabel, toolbar] {
            row.widthAnchor.constraint(equalTo: formGroup.widthAnchor).isActive = true
        }
        for label in [voiceHint, errorLabel] {
            label.preferredMaxLayoutWidth = Self.width - Self.inset * 2
        }
        subtitleLabel.preferredMaxLayoutWidth = Self.width - Self.inset * 2
    }

    private func buildDone() {
        doneGroup.orientation = .horizontal
        doneGroup.spacing = 8
        let doneButton = NSButton(title: "Done", target: self, action: #selector(done))
        doneButton.keyEquivalent = "\r"
        doneGroup.addArrangedSubview(githubButton)
        doneGroup.addArrangedSubview(NSView())
        doneGroup.addArrangedSubview(doneButton)
    }

    private func configureRow(_ row: FilledStack, _ views: [NSView]) {
        row.orientation = .horizontal
        row.spacing = 8
        row.edgeInsets = NSEdgeInsets(top: 4, left: 10, bottom: 4, right: 6)
        views.forEach { row.addArrangedSubview($0) }
        row.isHidden = true
    }

    private func symbolButton(_ symbol: String, label: String, action: Selector, bordered: Bool = false) -> NSButton {
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: label) ?? NSImage()
        let button = NSButton(image: image, target: self, action: action)
        button.isBordered = bordered
        if bordered { button.bezelStyle = .rounded; button.controlSize = .large }
        button.setAccessibilityLabel(label)
        button.toolTip = label
        return button
    }

    private func fillWidth(_ view: NSView) {
        view.widthAnchor.constraint(equalTo: content.widthAnchor, constant: -Self.inset * 2).isActive = true
    }

    private func pin(_ child: NSView, in parent: NSView, inset: CGFloat) {
        child.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(child)
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: parent.topAnchor, constant: inset),
            child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -inset),
            child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: inset),
            child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -inset),
        ])
    }
}

/// A tinted, rounded row (recording in progress, attached voice note) that follows light and dark mode.
final class FilledStack: NSStackView {
    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        layer?.cornerRadius = 8
        layer?.backgroundColor = resolvedCGColor(.quaternaryLabelColor)
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }
}

/// A rounded box with a separator-colored border, accent-colored while focused.
final class BorderedBox: AppearanceAwareView {
    var focused = false { didSet { needsDisplay = true } }

    override func applyColors() {
        layer?.cornerRadius = 8
        layer?.backgroundColor = resolvedCGColor(.textBackgroundColor)
        layer?.borderWidth = focused ? 2 : 1
        layer?.borderColor = resolvedCGColor(focused ? .keyboardFocusIndicatorColor : .separatorColor)
    }
}

/// One row of the kind picker: icon, heading, detail. Clickable, hoverable, keyboard-focusable.
final class KindTile: AppearanceAwareView {
    var onClick: (() -> Void)?

    private var hovering = false { didSet { needsDisplay = true } }
    private var pressed = false { didSet { needsDisplay = true } }

    init(kind: FeedbackKind, symbol: String) {
        super.init(frame: .zero)
        layer?.cornerRadius = 10
        let icon = NSImageView(image: NSImage(systemSymbolName: symbol, accessibilityDescription: nil) ?? NSImage())
        icon.symbolConfiguration = .init(pointSize: 15, weight: .medium)
        icon.contentTintColor = .labelColor
        icon.widthAnchor.constraint(equalToConstant: 28).isActive = true
        let heading = NSTextField(labelWithString: kind.pickerTitle)
        heading.font = .systemFont(ofSize: 13, weight: .semibold)
        let detail = NSTextField(labelWithString: kind.pickerDetail)
        detail.font = .systemFont(ofSize: 11)
        detail.textColor = .secondaryLabelColor
        let texts = NSStackView(views: [heading, detail])
        texts.orientation = .vertical
        texts.alignment = .leading
        texts.spacing = 2
        let chevron = NSImageView(image: NSImage(systemSymbolName: "chevron.right", accessibilityDescription: nil) ?? NSImage())
        chevron.contentTintColor = .tertiaryLabelColor
        let row = NSStackView(views: [icon, texts, NSView(), chevron])
        row.spacing = 10
        row.edgeInsets = NSEdgeInsets(top: 10, left: 10, bottom: 10, right: 12)
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
        ])
        setAccessibilityElement(true)
        setAccessibilityRole(.button)
        setAccessibilityLabel("\(kind.pickerTitle). \(kind.pickerDetail)")
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var acceptsFirstResponder: Bool { true }
    override var canBecomeKeyView: Bool { true }
    override var focusRingMaskBounds: NSRect { bounds }
    override func drawFocusRingMask() { NSBezierPath(roundedRect: bounds, xRadius: 10, yRadius: 10).fill() }

    /// Labels and icons are display-only; the tile takes the click.
    override func hitTest(_ point: NSPoint) -> NSView? {
        frame.contains(point) ? self : nil
    }

    override func applyColors() {
        let fill: NSColor = pressed ? .tertiaryLabelColor : hovering ? .quaternaryLabelColor : .clear
        layer?.backgroundColor = resolvedCGColor(fill)
        layer?.borderWidth = 1
        layer?.borderColor = resolvedCGColor(.separatorColor)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: self))
    }

    override func mouseEntered(with event: NSEvent) { hovering = true }
    override func mouseExited(with event: NSEvent) { hovering = false }
    override func mouseDown(with event: NSEvent) { pressed = true }

    override func mouseUp(with event: NSEvent) {
        pressed = false
        if bounds.contains(convert(event.locationInWindow, from: nil)) { onClick?() }
    }

    override func keyDown(with event: NSEvent) {
        if event.charactersIgnoringModifiers == " " || event.keyCode == 36 { onClick?() } else { super.keyDown(with: event) }
    }

    override func accessibilityPerformPress() -> Bool {
        onClick?()
        return true
    }
}
#endif
