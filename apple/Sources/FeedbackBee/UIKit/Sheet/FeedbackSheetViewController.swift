#if canImport(UIKit)
import UIKit

/// Pure projection of `FeedbackState`: three screens (pick a kind, write the note, done) in one panel.
final class FeedbackSheetViewController: UIViewController, UITextViewDelegate, UITextFieldDelegate {
    var onClosed: (() -> Void)?

    private let controller: FeedbackController
    private let config: FeedbackConfig
    private let captureHost: () -> UIImage?
    private let recorder = VoiceRecorder()
    private var voiceTimer: Timer?
    private var shownScreenshot: Screenshot?
    private var latestThumbnail: UIImage?
    private var closing = false

    // Chrome
    private let dim = UIView()
    private let panel = UIView()
    private let scrollView = UIScrollView()
    private let content = UIStackView()
    private lazy var backButton = iconButton("chevron.left", label: "Back") { [weak self] in self?.controller.backToKindPicker() }
    private lazy var closeButton = iconButton("xmark", label: "Close") { [weak self] in self?.close() }
    private let titleLabel = makeLabel(size: 18, color: Theme.ink, weight: .semibold)
    private let subtitleLabel = makeLabel(size: 13, color: Theme.muted)

    // Screens
    private let chooseGroup = UIStackView()
    private let formGroup = UIStackView()
    private let doneGroup = UIStackView()

    // Form
    private let noteBox = RoundedView(fill: Theme.panel, radius: 10, stroke: Theme.border)
    private let noteView = UITextView()
    private let notePlaceholder = makeLabel(size: 16, color: Theme.muted)
    private let emailLabel = makeLabel("Email (optional)", size: 13, color: Theme.ink, weight: .medium)
    private let emailBox = RoundedView(fill: Theme.panel, radius: 10, stroke: Theme.border)
    private let emailField = UITextField()
    private let screenshotBlock = RoundedView(fill: Theme.tile, radius: 10, stroke: Theme.border)
    private let screenshotImage = UIImageView()
    private lazy var removeScreenshotButton = iconButton("xmark", label: "Remove screenshot") { [weak self] in
        self?.controller.removeScreenshot()
    }
    private let recordingBlock = RoundedView(fill: Theme.tile, radius: 10)
    private let recordingLabel = makeLabel(size: 12, color: Theme.tileInk)
    private let stopButton = makeButton("Stop", style: .plain, size: 14)
    private let voiceBlock = RoundedView(fill: Theme.tile, radius: 10)
    private let voiceLabel = makeLabel(size: 12, color: Theme.tileInk)
    private let rerecordButton = makeButton("Re-record", style: .plain, size: 14)
    private lazy var removeVoiceButton = iconButton("xmark", label: "Remove voice note") { [weak self] in
        self?.controller.removeVoiceNote()
    }
    private let voiceHint = makeLabel(size: 12, color: Theme.tileInk)
    private let errorLabel = makeLabel(size: 13, color: Theme.error)
    private let cameraButton = makeButton(nil, image: "camera", style: .secondary)
    private let micButton = makeButton(nil, image: "mic", style: .secondary)
    private let sendButton = makeButton("Send feedback", style: .primary)

    // Done
    private let doneDetail = makeLabel("Thanks for helping us make things better.", size: 13, color: Theme.muted)
    private let githubButton = makeButton("View on GitHub ↗", style: .plain, size: 14)
    private var issueURL: URL?

    init(controller: FeedbackController, config: FeedbackConfig, captureHost: @escaping () -> UIImage?) {
        self.controller = controller
        self.config = config
        self.captureHost = captureHost
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        buildChrome()
        buildChoose()
        buildForm()
        buildDone()
        recorder.onFinish = { [weak self] result in self?.voiceFinished(result) }
        controller.onChange = { [weak self] state in self?.render(state) }
        render(controller.state)
    }

    private var presentedOnce = false

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !presentedOnce else { return }
        presentedOnce = true
        view.layoutIfNeeded()
        dim.alpha = 0
        let offset = panel.bounds.height
        if UIAccessibility.isReduceMotionEnabled {
            panel.alpha = 0
            UIView.animate(withDuration: 0.2) { self.dim.alpha = 1; self.panel.alpha = 1 }
        } else {
            panel.transform = CGAffineTransform(translationX: 0, y: offset)
            UIView.animate(
                withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.9, initialSpringVelocity: 0, options: [],
                animations: {
                    self.dim.alpha = 1
                    self.panel.transform = .identity
                },
                completion: nil
            )
        }
        UIAccessibility.post(notification: .screenChanged, argument: titleLabel)
    }

    override func accessibilityPerformEscape() -> Bool {
        close()
        return true
    }

    // MARK: Rendering

    private var lastRendered: FeedbackState?

    private func render(_ state: FeedbackState) {
        defer { lastRendered = state }
        if renderKeystroke(state) { return }
        switch state {
        case .choosing: renderChoose()
        case .sent(let url): renderDone(issueUrl: url)
        default: renderForm(state)
        }
        let uploading: Bool
        if case .uploading = state { uploading = true } else { uploading = false }
        closeButton.isEnabled = !uploading
    }

    /// Typing only changes the note or email, which the text views already show: update the two
    /// controls that depend on them instead of re-rendering the whole form on every keystroke.
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
        titleLabel.text = "Share feedback"
        subtitleLabel.text = "A little feedback goes a long way."
        subtitleLabel.isHidden = false
        backButton.isHidden = true
        view.endEditing(true)
    }

    private func renderDone(issueUrl: String?) {
        show(doneGroup)
        titleLabel.text = "Share feedback"
        subtitleLabel.isHidden = true
        backButton.isHidden = true
        view.endEditing(true)
        issueURL = issueUrl.flatMap(URL.init(string:))
        githubButton.isHidden = issueURL == nil
        UIAccessibility.post(notification: .announcement, argument: "Feedback sent")
    }

    private func renderForm(_ state: FeedbackState) {
        guard let draft = state.form else { return }
        let interactive = state.isInteractive
        let recording: Bool
        if case .recordingAudio = state { recording = true } else { recording = false }
        show(formGroup)
        titleLabel.text = draft.kind.formTitle
        subtitleLabel.text = "We're listening. Tell us a little more."
        subtitleLabel.isHidden = false
        backButton.isHidden = draft.kindLocked
        backButton.isEnabled = interactive

        if noteView.text != draft.text { noteView.text = draft.text }
        notePlaceholder.text = draft.kind.placeholder
        notePlaceholder.isHidden = !draft.text.isEmpty
        noteView.isEditable = interactive || recording
        if emailField.text != draft.email { emailField.text = draft.email }
        emailField.isEnabled = (interactive || recording) && !draft.emailLocked
        emailLabel.text = draft.emailLocked ? "Email (from your account)" : "Email (optional)"

        if draft.screenshot != shownScreenshot {
            screenshotImage.image = draft.screenshot == nil ? nil : latestThumbnail
            shownScreenshot = draft.screenshot
        }
        screenshotBlock.isHidden = draft.screenshot == nil
        removeScreenshotButton.isEnabled = interactive
        cameraButton.isEnabled = interactive
        cameraButton.accessibilityLabel = draft.screenshot == nil ? "Attach screenshot" : "Retake screenshot"

        recordingBlock.isHidden = !recording
        voiceBlock.isHidden = draft.audio == nil || recording
        micButton.isHidden = !VoiceRecorder.isAvailable || draft.audio != nil || recording
        micButton.isEnabled = interactive && VoiceRecorder.permission != .denied
        voiceLabel.text = draft.audio.map { "Voice note · \(formatVoiceDuration($0.seconds))" }
        rerecordButton.isEnabled = interactive
        removeVoiceButton.isEnabled = interactive
        if case .recordingAudio(_, let startedAt) = state { startTimer(startedAt) } else { stopTimer() }

        if case .failed(let message, _) = state {
            errorLabel.text = message
            errorLabel.isHidden = false
            UIAccessibility.post(notification: .announcement, argument: message)
        } else {
            errorLabel.isHidden = true
        }
        let uploading: Bool
        if case .uploading = state { uploading = true } else { uploading = false }
        var configuration = sendButton.configuration
        var attributes = AttributeContainer()
        attributes.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        configuration?.attributedTitle = AttributedString(uploading ? "Sending…" : "Send feedback", attributes: attributes)
        configuration?.showsActivityIndicator = uploading
        sendButton.configuration = configuration
        sendButton.isEnabled = interactive && draft.canSend
    }

    private func show(_ group: UIView) {
        for candidate in [chooseGroup, formGroup, doneGroup] { candidate.isHidden = candidate !== group }
    }

    // MARK: Actions

    private func send() {
        view.endEditing(true)
        let device = DeviceInfo.current(screen: view.window?.windowScene?.screen)
        let config = config
        Task { [controller] in
            await controller.send(device: device, config: config) { request in
                await FeedbackUploader.upload(config: config, request: request)
            }
        }
    }

    private func attachScreenshot() {
        view.endEditing(true)
        guard let image = captureHost(), let cgImage = image.cgImage else {
            controller.reportProblem("Couldn't capture the screen. Please try again.")
            return
        }
        let annotator = AnnotationViewController(image: cgImage, pointScale: image.scale)
        annotator.onCancel = { [weak annotator] in annotator?.dismiss(animated: true) }
        annotator.onSave = { [weak self, weak annotator] annotated in
            annotator?.dismiss(animated: true)
            self?.storeScreenshot(annotated)
        }
        present(annotator, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    private func storeScreenshot(_ annotated: AnnotatedScreenshot) {
        Task { [weak self] in
            guard let processed = await ScreenshotEncoder.process(annotated) else {
                self?.controller.reportProblem("The screenshot is too large to upload.")
                return
            }
            guard let self else { return }
            self.latestThumbnail = processed.thumbnail.map { UIImage(cgImage: $0) }
            self.shownScreenshot = nil
            self.controller.attachScreenshot(processed.screenshot)
        }
    }

    private func toggleVoice() {
        view.endEditing(true)
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

    private func voiceFinished(_ result: Result<AudioAttachment, Error>) {
        switch result {
        case .success(let audio): controller.finishVoiceRecording(audio)
        case .failure: controller.failVoiceRecording("The recording failed. Please try again.")
        }
    }

    private func showMicDenied() {
        voiceHint.text = "Microphone access is off. Enable it in Settings to record a voice note."
        voiceHint.isHidden = false
        lastRendered = nil // same state, new permission: force a full render
        render(controller.state)
    }

    private func startTimer(_ startedAt: Date) {
        let update = { [weak self] in
            let seconds = Int(Date().timeIntervalSince(startedAt))
            self?.recordingLabel.text = "Voice note · \(formatVoiceDuration(seconds)) / 5:00"
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

    private func close() {
        if case .uploading = controller.state { return }
        guard !closing else { return }
        closing = true
        view.endEditing(true)
        recorder.cancel()
        stopTimer()
        controller.discard()
        let finish = { [weak self] in self?.onClosed?() }
        if UIAccessibility.isReduceMotionEnabled {
            UIView.animate(withDuration: 0.15, animations: { self.view.alpha = 0 }, completion: { _ in finish() })
        } else {
            UIView.animate(withDuration: 0.22, delay: 0, options: .curveEaseIn, animations: {
                self.dim.alpha = 0
                self.panel.transform = CGAffineTransform(translationX: 0, y: self.panel.bounds.height)
            }, completion: { _ in finish() })
        }
    }

    // MARK: Text

    func textViewDidChange(_ textView: UITextView) {
        notePlaceholder.isHidden = !textView.text.isEmpty
        let text = textView.text ?? ""
        controller.editDraft { $0.text = text }
    }

    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        // NSString length is UTF-16 units, which is what the server's 5000-character cap counts.
        let current = (textView.text ?? "") as NSString
        return current.length - range.length + (text as NSString).length <= FeedbackLimits.maxTextChars
    }

    func textViewDidBeginEditing(_ textView: UITextView) {
        noteBox.strokeColor = Theme.focus
        noteBox.layer.borderWidth = 2
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        noteBox.strokeColor = Theme.border
        noteBox.layer.borderWidth = 1
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {
        emailBox.strokeColor = Theme.focus
        emailBox.layer.borderWidth = 2
        DispatchQueue.main.async { [weak self] in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.scrollView.scrollRectToVisible(self.emailBox.convert(self.emailBox.bounds, to: self.scrollView), animated: true)
            }
        }
    }

    func textFieldDidEndEditing(_ textField: UITextField) {
        emailBox.strokeColor = Theme.border
        emailBox.layer.borderWidth = 1
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }

    @objc private func emailChanged() {
        let email = emailField.text ?? ""
        controller.editDraft { $0.email = email }
    }

    // MARK: Building

    private func buildChrome() {
        dim.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        dim.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dimTapped)))
        dim.isAccessibilityElement = true
        dim.accessibilityLabel = "Close feedback"
        dim.accessibilityTraits = .button

        panel.backgroundColor = Theme.panel
        panel.layer.cornerRadius = 20
        panel.layer.cornerCurve = .continuous
        panel.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        panel.accessibilityViewIsModal = true

        scrollView.alwaysBounceVertical = false
        scrollView.keyboardDismissMode = .interactive

        content.axis = .vertical
        content.isLayoutMarginsRelativeArrangement = true
        content.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 12, leading: 20, bottom: 22, trailing: 20)

        titleLabel.accessibilityTraits = .header
        titleLabel.numberOfLines = 2
        let header = UIStackView(arrangedSubviews: [backButton, titleLabel, closeButton])
        header.alignment = .center
        header.spacing = 4
        titleLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let footer = UILabel()
        let footerText = NSMutableAttributedString(
            string: "Powered by ",
            attributes: [.font: UIFont.systemFont(ofSize: 11), .foregroundColor: Theme.muted]
        )
        footerText.append(NSAttributedString(
            string: "FeedbackBee",
            attributes: [.font: UIFont.systemFont(ofSize: 11, weight: .bold), .foregroundColor: Theme.tileInk]
        ))
        footer.attributedText = footerText
        footer.textAlignment = .center

        content.addArrangedSubview(header)
        content.addArrangedSubview(subtitleLabel)
        content.setCustomSpacing(20, after: subtitleLabel)
        for group in [chooseGroup, formGroup, doneGroup] { content.addArrangedSubview(group) }
        content.addArrangedSubview(footer)
        content.setCustomSpacing(18, after: chooseGroup)
        content.setCustomSpacing(18, after: formGroup)
        content.setCustomSpacing(18, after: doneGroup)

        for subview in [dim, panel] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        content.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(scrollView)
        scrollView.addSubview(content)

        let fullWidth = panel.widthAnchor.constraint(equalTo: view.widthAnchor)
        fullWidth.priority = .defaultHigh
        let hugContent = scrollView.heightAnchor.constraint(equalTo: content.heightAnchor)
        hugContent.priority = .defaultLow
        NSLayoutConstraint.activate([
            dim.topAnchor.constraint(equalTo: view.topAnchor),
            dim.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            dim.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dim.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            panel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            panel.widthAnchor.constraint(lessThanOrEqualToConstant: 480),
            panel.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor),
            fullWidth,
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),

            scrollView.topAnchor.constraint(equalTo: panel.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: panel.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: panel.trailingAnchor),
            // Follows the keyboard; with it hidden this is the bottom safe area.
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            hugContent,

            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            content.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])
    }

    private func buildChoose() {
        chooseGroup.axis = .vertical
        chooseGroup.spacing = 8
        let icons: [FeedbackKind: String] = [.issue: "exclamationmark.bubble", .featureRequest: "lightbulb", .other: "ellipsis.bubble"]
        for kind in FeedbackKind.allCases {
            chooseGroup.addArrangedSubview(kindTile(kind, icon: icons[kind] ?? "bubble.left"))
        }
    }

    private func kindTile(_ kind: FeedbackKind, icon: String) -> UIView {
        let tile = UIControl()
        let box = RoundedView(fill: Theme.panel, radius: 12, stroke: Theme.border)
        box.isUserInteractionEnabled = false
        let iconView = UIImageView(image: UIImage(systemName: icon))
        iconView.tintColor = Theme.ink
        iconView.contentMode = .center
        let iconBox = RoundedView(fill: Theme.tile, radius: 9)
        iconBox.addSubview(iconView)
        let heading = makeLabel(kind.pickerTitle, size: 14, color: Theme.ink, weight: .semibold)
        let detail = makeLabel(kind.pickerDetail, size: 12, color: Theme.muted)
        let texts = UIStackView(arrangedSubviews: [heading, detail])
        texts.axis = .vertical
        texts.spacing = 2
        let chevron = UIImageView(image: UIImage(systemName: "chevron.right"))
        chevron.tintColor = Theme.muted
        chevron.setContentHuggingPriority(.required, for: .horizontal)
        let row = UIStackView(arrangedSubviews: [iconBox, texts, chevron])
        row.alignment = .center
        row.spacing = 12
        row.isUserInteractionEnabled = false

        for subview in [box, row] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            tile.addSubview(subview)
        }
        iconView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            box.topAnchor.constraint(equalTo: tile.topAnchor),
            box.bottomAnchor.constraint(equalTo: tile.bottomAnchor),
            box.leadingAnchor.constraint(equalTo: tile.leadingAnchor),
            box.trailingAnchor.constraint(equalTo: tile.trailingAnchor),
            row.topAnchor.constraint(equalTo: tile.topAnchor, constant: 12),
            row.bottomAnchor.constraint(equalTo: tile.bottomAnchor, constant: -12),
            row.leadingAnchor.constraint(equalTo: tile.leadingAnchor, constant: 12),
            row.trailingAnchor.constraint(equalTo: tile.trailingAnchor, constant: -12),
            tile.heightAnchor.constraint(greaterThanOrEqualToConstant: 72),
            iconBox.widthAnchor.constraint(equalToConstant: 36),
            iconBox.heightAnchor.constraint(equalToConstant: 36),
            iconView.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),
        ])
        tile.isAccessibilityElement = true
        tile.accessibilityLabel = "\(kind.pickerTitle). \(kind.pickerDetail)"
        tile.accessibilityTraits = .button
        tile.addAction(UIAction { [weak self] _ in self?.controller.chooseKind(kind) }, for: .touchUpInside)
        tile.addAction(UIAction { [weak box] _ in box?.backgroundColor = Theme.tile }, for: [.touchDown, .touchDragEnter])
        tile.addAction(UIAction { [weak box] _ in box?.backgroundColor = Theme.panel }, for: [.touchUpInside, .touchUpOutside, .touchDragExit, .touchCancel])
        return tile
    }

    private func buildForm() {
        formGroup.axis = .vertical

        noteView.delegate = self
        noteView.font = UIFont.preferredFont(forTextStyle: .body)
        noteView.adjustsFontForContentSizeCategory = true
        noteView.textColor = Theme.ink
        noteView.backgroundColor = .clear
        noteView.textContainerInset = UIEdgeInsets(top: 11, left: 8, bottom: 11, right: 8)
        noteView.accessibilityLabel = "Your feedback"
        notePlaceholder.isAccessibilityElement = false
        pin(noteView, in: noteBox)
        notePlaceholder.translatesAutoresizingMaskIntoConstraints = false
        noteBox.addSubview(notePlaceholder)
        NSLayoutConstraint.activate([
            noteBox.heightAnchor.constraint(equalToConstant: 128),
            notePlaceholder.topAnchor.constraint(equalTo: noteBox.topAnchor, constant: 11),
            notePlaceholder.leadingAnchor.constraint(equalTo: noteBox.leadingAnchor, constant: 13),
            notePlaceholder.trailingAnchor.constraint(equalTo: noteBox.trailingAnchor, constant: -13),
        ])

        emailField.delegate = self
        emailField.placeholder = "you@example.com"
        emailField.keyboardType = .emailAddress
        emailField.textContentType = .emailAddress
        emailField.autocapitalizationType = .none
        emailField.autocorrectionType = .no
        emailField.returnKeyType = .done
        emailField.font = UIFont.preferredFont(forTextStyle: .body)
        emailField.adjustsFontForContentSizeCategory = true
        emailField.textColor = Theme.ink
        emailField.accessibilityLabel = "Email"
        emailField.addTarget(self, action: #selector(emailChanged), for: .editingChanged)
        pin(emailField, in: emailBox, insets: UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12))
        emailBox.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true

        screenshotImage.contentMode = .scaleAspectFit
        screenshotImage.accessibilityLabel = "Annotated screenshot"
        screenshotImage.isAccessibilityElement = true
        screenshotBlock.clipsToBounds = true
        pin(screenshotImage, in: screenshotBlock)
        removeScreenshotButton.translatesAutoresizingMaskIntoConstraints = false
        screenshotBlock.addSubview(removeScreenshotButton)
        NSLayoutConstraint.activate([
            screenshotBlock.heightAnchor.constraint(equalToConstant: 160),
            removeScreenshotButton.topAnchor.constraint(equalTo: screenshotBlock.topAnchor, constant: 4),
            removeScreenshotButton.trailingAnchor.constraint(equalTo: screenshotBlock.trailingAnchor, constant: -4),
        ])

        let dot = RoundedView(fill: Theme.error, radius: 3.5)
        dot.widthAnchor.constraint(equalToConstant: 7).isActive = true
        dot.heightAnchor.constraint(equalToConstant: 7).isActive = true
        var stopConfiguration = stopButton.configuration
        stopConfiguration?.baseForegroundColor = Theme.error
        stopButton.configuration = stopConfiguration
        stopButton.addAction(UIAction { [weak self] _ in self?.recorder.stop() }, for: .touchUpInside)
        recordingLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        attachmentRow([dot, recordingLabel, stopButton], in: recordingBlock)

        rerecordButton.addAction(UIAction { [weak self] _ in self?.toggleVoice() }, for: .touchUpInside)
        attachmentRow([voiceLabel, rerecordButton, removeVoiceButton], in: voiceBlock)
        voiceHint.isHidden = true

        cameraButton.accessibilityLabel = "Attach screenshot"
        cameraButton.addAction(UIAction { [weak self] _ in self?.attachScreenshot() }, for: .touchUpInside)
        micButton.accessibilityLabel = "Record voice note"
        micButton.addAction(UIAction { [weak self] _ in self?.toggleVoice() }, for: .touchUpInside)
        for button in [cameraButton, micButton] {
            button.widthAnchor.constraint(equalToConstant: 48).isActive = true
            button.heightAnchor.constraint(equalToConstant: 48).isActive = true
        }
        let toolbar = UIStackView(arrangedSubviews: [cameraButton, micButton, UIView()])
        toolbar.spacing = 8

        sendButton.addAction(UIAction { [weak self] _ in self?.send() }, for: .touchUpInside)
        sendButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        errorLabel.isHidden = true

        let noteLabel = makeLabel("Your feedback", size: 13, color: Theme.ink, weight: .medium)
        let rows: [(UIView, CGFloat)] = [
            (noteLabel, 7), (noteBox, 14), (emailLabel, 7), (emailBox, 12), (screenshotBlock, 12),
            (recordingBlock, 12), (voiceBlock, 12), (voiceHint, 10), (errorLabel, 10), (toolbar, 12), (sendButton, 0),
        ]
        for (row, spacing) in rows {
            formGroup.addArrangedSubview(row)
            formGroup.setCustomSpacing(spacing, after: row)
        }
    }

    private func buildDone() {
        doneGroup.axis = .vertical
        doneGroup.alignment = .center
        doneGroup.spacing = 6
        doneGroup.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 8, leading: 0, bottom: 16, trailing: 0)
        doneGroup.isLayoutMarginsRelativeArrangement = true
        let check = UIImageView(image: UIImage(systemName: "checkmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)))
        check.tintColor = Theme.ink
        check.contentMode = .center
        let checkBox = RoundedView(fill: Theme.tile, radius: 24)
        pin(check, in: checkBox)
        checkBox.widthAnchor.constraint(equalToConstant: 48).isActive = true
        checkBox.heightAnchor.constraint(equalToConstant: 48).isActive = true
        let headline = makeLabel("Feedback sent", size: 18, color: Theme.ink, weight: .semibold)
        headline.accessibilityTraits = .header
        headline.textAlignment = .center
        doneDetail.textAlignment = .center
        githubButton.addAction(UIAction { [weak self] _ in
            guard let url = self?.issueURL else { return }
            UIApplication.shared.open(url)
        }, for: .touchUpInside)
        for subview in [checkBox, headline, doneDetail, githubButton] { doneGroup.addArrangedSubview(subview) }
        doneGroup.setCustomSpacing(16, after: checkBox)
    }

    @objc private func dimTapped() { close() }

    private func iconButton(_ symbol: String, label: String, action: @escaping () -> Void) -> UIButton {
        let button = makeButton(nil, image: symbol, style: .plain)
        button.accessibilityLabel = label
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        button.widthAnchor.constraint(equalToConstant: 48).isActive = true
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
        return button
    }

    private func attachmentRow(_ views: [UIView], in container: UIView) {
        let row = UIStackView(arrangedSubviews: views)
        row.alignment = .center
        row.spacing = 8
        // Only the controls hug; the label stretches. A row where nothing can stretch caps the width of the
        // whole panel, even while hidden (a stack view still aligns hidden subviews on its cross axis).
        views.filter { $0 is UIButton }.forEach { $0.setContentHuggingPriority(.required, for: .horizontal) }
        pin(row, in: container, insets: UIEdgeInsets(top: 4, left: 12, bottom: 4, right: 4))
        container.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
    }

    private func pin(_ child: UIView, in parent: UIView, insets: UIEdgeInsets = .zero) {
        child.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(child)
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: parent.topAnchor, constant: insets.top),
            child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -insets.bottom),
            child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: insets.left),
            child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -insets.right),
        ])
    }
}
#endif
