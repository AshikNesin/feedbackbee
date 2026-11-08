#if os(macOS)
import AppKit

/// A window for pen / box / arrow markup over a screenshot. Return saves, Escape cancels, ⌘Z undoes.
@MainActor
final class AnnotationWindowController: NSWindowController, NSWindowDelegate {
    var onFinish: ((AnnotatedScreenshot?) -> Void)?

    private let canvas: MacAnnotationCanvas
    private let tools = NSSegmentedControl(labels: Tool.allCases.map(\.label), trackingMode: .selectOne, target: nil, action: nil)
    private let undoButton = NSButton(title: "Undo", target: nil, action: nil)
    private var finished = false

    init(image: CGImage, pointScale: CGFloat, over parent: NSWindow?) {
        canvas = MacAnnotationCanvas(image: image)
        let pointSize = NSSize(width: CGFloat(image.width) / pointScale, height: CGFloat(image.height) / pointScale)
        let visible = (parent?.screen ?? NSScreen.main)?.visibleFrame.size ?? NSSize(width: 1200, height: 800)
        let fit = min(1, (visible.width * 0.85) / pointSize.width, (visible.height * 0.85 - 60) / pointSize.height)
        let canvasSize = NSSize(width: max(320, pointSize.width * fit), height: max(200, pointSize.height * fit))

        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: NSSize(width: canvasSize.width, height: canvasSize.height + 52)),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Mark Up Screenshot"
        window.isReleasedWhenClosed = false
        window.contentMinSize = NSSize(width: 480, height: 320)
        window.adoptAppearance(of: parent)
        super.init(window: window)
        window.delegate = self
        build(in: window)
        window.center()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func build(in window: NSWindow) {
        tools.selectedSegment = 0
        tools.target = self
        tools.action = #selector(toolChanged)
        tools.setAccessibilityLabel("Drawing tool")

        undoButton.target = self
        undoButton.action = #selector(undo)
        undoButton.keyEquivalent = "z"
        undoButton.keyEquivalentModifierMask = .command
        undoButton.isEnabled = false
        canvas.onShapesChanged = { [weak self] count in self?.undoButton.isEnabled = count > 0 }

        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancel))
        cancel.keyEquivalent = "\u{1b}"
        let save = NSButton(title: "Save", target: self, action: #selector(save))
        save.keyEquivalent = "\r"

        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        let bar = NSStackView(views: [tools, undoButton, spacer, cancel, save])
        bar.orientation = .horizontal
        bar.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)

        let root = NSStackView(views: [canvas, bar])
        root.orientation = .vertical
        root.spacing = 0
        root.alignment = .leading
        // The window's size comes from its frame; the stack fills it rather than hugging its content.
        root.setHuggingPriority(.defaultLow, for: .vertical)
        canvas.setContentHuggingPriority(.defaultLow, for: .vertical)
        window.contentView = root
        NSLayoutConstraint.activate([
            canvas.widthAnchor.constraint(equalTo: root.widthAnchor),
            bar.widthAnchor.constraint(equalTo: root.widthAnchor),
            canvas.heightAnchor.constraint(greaterThanOrEqualToConstant: 200),
        ])
    }

    @objc private func toolChanged() {
        canvas.tool = Tool.allCases[max(0, tools.selectedSegment)]
    }

    @objc private func undo() { canvas.undo() }

    @objc private func cancel() { finish(nil) }

    @objc private func save() { finish(canvas.result) }

    func windowWillClose(_ notification: Notification) {
        finish(nil)
    }

    private func finish(_ result: AnnotatedScreenshot?) {
        guard !finished else { return }
        finished = true
        window?.delegate = nil
        window?.close()
        onFinish?(result)
    }
}

/// The screenshot in an image view, with strokes on top as `CAShapeLayer`s in image pixel space under
/// one scaled container. A drag extends only the stroke under the pointer; resizing changes one transform.
final class MacAnnotationCanvas: NSView {
    var tool: Tool = .pen
    var onShapesChanged: ((Int) -> Void)?

    private let image: CGImage
    private let pixelSize: CGSize
    private let strokeWidth: CGFloat
    private let imageView = NSImageView()
    private let overlay = NSView()
    private let drawing = CALayer()
    private let activeLayer = CAShapeLayer()
    private var shapes: [Shape] = []
    private var shapeLayers: [CAShapeLayer] = []
    private var active: Shape?
    private var activePen: PenStroke?

    var result: AnnotatedScreenshot { AnnotatedScreenshot(base: image, shapes: shapes) }

    init(image: CGImage) {
        self.image = image
        pixelSize = CGSize(width: image.width, height: image.height)
        strokeWidth = CGFloat(annotationStrokeWidth(width: Double(image.width), height: Double(image.height)))
        super.init(frame: .zero)
        wantsLayer = true

        imageView.image = NSImage(cgImage: image, size: .zero)
        imageView.imageScaling = .scaleAxesIndependently
        addSubview(imageView)

        // Layer-hosting with a flipped root, so shape coordinates are top-left like the shared model.
        let root = CALayer()
        root.isGeometryFlipped = true
        overlay.layer = root
        overlay.wantsLayer = true
        drawing.anchorPoint = .zero
        drawing.bounds = CGRect(origin: .zero, size: pixelSize)
        root.addSublayer(drawing)
        style(activeLayer)
        drawing.addSublayer(activeLayer)
        addSubview(overlay)

        setAccessibilityElement(true)
        setAccessibilityRole(.image)
        setAccessibilityLabel("Screenshot. Drag to draw.")
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    /// The image and stroke subviews are display-only; the canvas takes every click and drag.
    override func hitTest(_ point: NSPoint) -> NSView? {
        frame.contains(point) ? self : nil
    }

    private var imageRect: CGRect {
        guard pixelSize.width > 0, pixelSize.height > 0, bounds.width > 0, bounds.height > 0 else { return .zero }
        let inset = bounds.insetBy(dx: 12, dy: 12)
        let scale = min(inset.width / pixelSize.width, inset.height / pixelSize.height)
        let size = CGSize(width: pixelSize.width * scale, height: pixelSize.height * scale)
        return CGRect(x: inset.midX - size.width / 2, y: inset.midY - size.height / 2, width: size.width, height: size.height)
    }

    override func layout() {
        super.layout()
        let rect = imageRect
        imageView.frame = rect
        overlay.frame = bounds
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        overlay.layer?.frame = bounds
        drawing.position = rect.origin
        let scale = pixelSize.width > 0 ? rect.width / pixelSize.width : 1
        drawing.setAffineTransform(CGAffineTransform(scaleX: scale, y: scale))
        CATransaction.commit()
    }

    func undo() {
        guard !shapes.isEmpty else { return }
        shapes.removeLast()
        shapeLayers.removeLast().removeFromSuperlayer()
        onShapesChanged?(shapes.count)
    }

    // MARK: Mouse

    override func mouseDown(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        guard imageRect.insetBy(dx: -20, dy: -20).contains(location) else { return }
        let point = imagePoint(location)
        if tool == .pen { activePen = PenStroke(start: point) } else { active = Shape(tool: tool, start: point) }
        redrawActive()
    }

    override func mouseDragged(with event: NSEvent) {
        let point = imagePoint(convert(event.locationInWindow, from: nil))
        if let pen = activePen {
            pen.add(point)
        } else if let current = active {
            active = current.extended(to: point)
        } else {
            return
        }
        redrawActive()
    }

    override func mouseUp(with event: NSEvent) {
        let shape = activePen.map { Shape.pen($0.points) } ?? active
        active = nil
        activePen = nil
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        activeLayer.path = nil
        defer { CATransaction.commit() }
        let minSize = Double(max(pixelSize.width, pixelSize.height)) * 0.01
        guard let shape, shape.isVisible(minSize: minSize) else { return }
        shapes.append(shape)
        let shapeLayer = CAShapeLayer()
        style(shapeLayer)
        shapeLayer.path = shapePath(shape, strokeWidth: strokeWidth)
        drawing.insertSublayer(shapeLayer, below: activeLayer)
        shapeLayers.append(shapeLayer)
        onShapesChanged?(shapes.count)
    }

    override func resetCursorRects() {
        addCursorRect(imageRect, cursor: .crosshair)
    }

    private func redrawActive() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        if let pen = activePen {
            activeLayer.path = pen.path
        } else if let active {
            activeLayer.path = shapePath(active, strokeWidth: strokeWidth)
        }
        CATransaction.commit()
    }

    private func imagePoint(_ location: CGPoint) -> Pt {
        let rect = imageRect
        guard rect.width > 0 else { return Pt(x: 0, y: 0) }
        let scale = pixelSize.width / rect.width
        let x = (location.x - rect.minX) * scale, y = (location.y - rect.minY) * scale
        return Pt(x: Double(min(max(x, 0), pixelSize.width)), y: Double(min(max(y, 0), pixelSize.height)))
    }

    private func style(_ shapeLayer: CAShapeLayer) {
        shapeLayer.frame = CGRect(origin: .zero, size: pixelSize)
        shapeLayer.strokeColor = annotationColor
        shapeLayer.fillColor = nil
        shapeLayer.lineWidth = strokeWidth
        shapeLayer.lineCap = .round
        shapeLayer.lineJoin = .round
    }
}
#endif
