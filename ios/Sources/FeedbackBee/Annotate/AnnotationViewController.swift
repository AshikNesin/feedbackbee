#if canImport(UIKit)
import UIKit

/// Full-screen pen / box / arrow markup over a screenshot. Each stroke is its own `CAShapeLayer`,
/// so drawing only rebuilds the stroke under the finger and the GPU composites the rest.
final class AnnotationViewController: UIViewController {
    var onSave: ((UIImage) -> Void)?
    var onCancel: (() -> Void)?

    private let image: UIImage
    private let canvas: AnnotationCanvas
    private var toolButtons: [Tool: UIButton] = [:]
    private let undoButton = makeButton("Undo", style: .secondary, size: 14)

    init(image: UIImage) {
        self.image = image
        canvas = AnnotationCanvas(image: image)
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.overlay
        overrideUserInterfaceStyle = .dark

        let cancel = makeButton("Cancel", style: .secondary, size: 14)
        cancel.addAction(UIAction { [weak self] _ in self?.onCancel?() }, for: .touchUpInside)
        let save = makeButton("Save", style: .primary, size: 14)
        save.addAction(UIAction { [weak self] _ in self?.save() }, for: .touchUpInside)
        let hint = makeLabel("Mark up the screenshot", size: 14, color: .white, weight: .semibold)
        hint.textAlignment = .center
        let top = UIStackView(arrangedSubviews: [cancel, hint, save])
        top.alignment = .center
        top.distribution = .equalCentering

        var tools: [UIView] = []
        for tool in Tool.allCases {
            let button = makeButton(tool.label, style: .secondary, size: 14)
            button.addAction(UIAction { [weak self] _ in self?.select(tool) }, for: .touchUpInside)
            toolButtons[tool] = button
            tools.append(button)
        }
        undoButton.addAction(UIAction { [weak self] _ in self?.canvas.undo() }, for: .touchUpInside)
        let bottom = UIStackView(arrangedSubviews: tools + [UIView(), undoButton])
        bottom.spacing = 8
        bottom.alignment = .center

        canvas.onShapesChanged = { [weak self] count in self?.undoButton.isEnabled = count > 0 }
        undoButton.isEnabled = false

        for subview in [top, canvas, bottom] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            top.topAnchor.constraint(equalTo: guide.topAnchor, constant: 8),
            top.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            top.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            canvas.topAnchor.constraint(equalTo: top.bottomAnchor, constant: 12),
            canvas.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            canvas.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            canvas.bottomAnchor.constraint(equalTo: bottom.topAnchor, constant: -12),
            bottom.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            bottom.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            bottom.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -8),
        ])
        select(.pen)
    }

    private func select(_ tool: Tool) {
        canvas.tool = tool
        for (candidate, button) in toolButtons {
            let selected = candidate == tool
            var configuration = button.configuration
            configuration?.background.backgroundColor = selected ? .white : .clear
            configuration?.baseForegroundColor = selected ? Theme.overlay : .white
            button.configuration = configuration
            button.accessibilityTraits = selected ? [.button, .selected] : .button
        }
    }

    private func save() {
        onSave?(canvas.render())
    }
}

final class AnnotationCanvas: UIView {
    var tool: Tool = .pen
    var onShapesChanged: ((Int) -> Void)?

    private let image: UIImage
    private let pixelSize: CGSize
    private let strokeWidth: CGFloat
    private let imageView = UIImageView()
    private var shapes: [Shape] = []
    private var shapeLayers: [CAShapeLayer] = []
    private let activeLayer = CAShapeLayer()
    private var active: Shape?
    /// The pen stroke in progress, appended per touch instead of rebuilding the whole path.
    private var activePen: (points: [Pt], path: CGMutablePath)?

    init(image: UIImage) {
        self.image = image
        pixelSize = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        strokeWidth = CGFloat(annotationStrokeWidth(width: Double(pixelSize.width), height: Double(pixelSize.height)))
        super.init(frame: .zero)
        isMultipleTouchEnabled = false
        imageView.image = image
        imageView.contentMode = .scaleToFill
        addSubview(imageView)
        style(activeLayer)
        layer.addSublayer(activeLayer)
        isAccessibilityElement = true
        accessibilityLabel = "Screenshot. Drag to draw."
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// Where the aspect-fitted image sits inside the canvas.
    private var imageRect: CGRect {
        guard pixelSize.width > 0, pixelSize.height > 0, bounds.width > 0, bounds.height > 0 else { return .zero }
        let scale = min(bounds.width / pixelSize.width, bounds.height / pixelSize.height)
        let size = CGSize(width: pixelSize.width * scale, height: pixelSize.height * scale)
        return CGRect(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, width: size.width, height: size.height)
    }

    /// Image pixels → canvas points.
    private var displayTransform: CGAffineTransform {
        let rect = imageRect
        guard pixelSize.width > 0 else { return .identity }
        let scale = rect.width / pixelSize.width
        return CGAffineTransform(translationX: rect.minX, y: rect.minY).scaledBy(x: scale, y: scale)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = imageRect
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let transform = displayTransform
        for (shape, shapeLayer) in zip(shapes, shapeLayers) {
            shapeLayer.frame = bounds
            shapeLayer.path = path(for: shape, transform: transform)
            shapeLayer.lineWidth = strokeWidth * transform.a
        }
        activeLayer.frame = bounds
        activeLayer.lineWidth = strokeWidth * transform.a
        CATransaction.commit()
    }

    func undo() {
        guard !shapes.isEmpty else { return }
        shapes.removeLast()
        shapeLayers.removeLast().removeFromSuperlayer()
        onShapesChanged?(shapes.count)
    }

    /// The screenshot with every shape drawn at full resolution.
    func render() -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: pixelSize, format: format).image { context in
            image.draw(in: CGRect(origin: .zero, size: pixelSize))
            let cg = context.cgContext
            cg.setStrokeColor(Theme.annotation.cgColor)
            cg.setLineWidth(strokeWidth)
            cg.setLineCap(.round)
            cg.setLineJoin(.round)
            for shape in shapes {
                cg.addPath(path(for: shape, transform: .identity))
                cg.strokePath()
            }
        }
    }

    // MARK: Touches

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = imagePoint(touches) else { return }
        if tool == .pen {
            let path = CGMutablePath()
            path.move(to: CGPoint(x: point.x, y: point.y))
            path.addLine(to: CGPoint(x: point.x + 0.01, y: point.y))
            activePen = ([point], path)
        }
        active = Shape(tool: tool, start: point)
        redrawActive()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let current = active, let touch = touches.first else { return }
        // Coalesced touches keep fast pen strokes smooth at 120 Hz without extra redraws.
        let samples = tool == .pen ? (event?.coalescedTouches(for: touch) ?? [touch]) : [touch]
        for sample in samples {
            let point = imagePoint(sample.location(in: self))
            if var pen = activePen, let previous = pen.points.last {
                pen.path.addQuadCurve(
                    to: CGPoint(x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2),
                    control: CGPoint(x: previous.x, y: previous.y)
                )
                pen.points.append(point)
                activePen = pen
            } else {
                active = current.extended(to: point)
            }
        }
        redrawActive()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        defer { clearActive() }
        let shape: Shape?
        if let pen = activePen { shape = .pen(pen.points) } else { shape = active }
        let minSize = Double(max(pixelSize.width, pixelSize.height)) * 0.01
        guard let shape, shape.isVisible(minSize: minSize) else { return }
        shapes.append(shape)
        let shapeLayer = CAShapeLayer()
        style(shapeLayer)
        shapeLayer.frame = bounds
        let transform = displayTransform
        shapeLayer.lineWidth = strokeWidth * transform.a
        shapeLayer.path = path(for: shape, transform: transform)
        layer.insertSublayer(shapeLayer, below: activeLayer)
        shapeLayers.append(shapeLayer)
        onShapesChanged?(shapes.count)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        clearActive()
    }

    private func clearActive() {
        active = nil
        activePen = nil
        activeLayer.path = nil
    }

    private func redrawActive() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        var transform = displayTransform
        if let pen = activePen {
            activeLayer.path = pen.path.copy(using: &transform)
        } else if let active {
            activeLayer.path = path(for: active, transform: transform)
        }
        CATransaction.commit()
    }

    private func imagePoint(_ touches: Set<UITouch>) -> Pt? {
        guard let touch = touches.first else { return nil }
        let location = touch.location(in: self)
        guard imageRect.insetBy(dx: -20, dy: -20).contains(location) else { return nil }
        return imagePoint(location)
    }

    private func imagePoint(_ location: CGPoint) -> Pt {
        let point = location.applying(displayTransform.inverted())
        return Pt(x: Double(min(max(point.x, 0), pixelSize.width)), y: Double(min(max(point.y, 0), pixelSize.height)))
    }

    private func style(_ shapeLayer: CAShapeLayer) {
        shapeLayer.strokeColor = Theme.annotation.cgColor
        shapeLayer.fillColor = nil
        shapeLayer.lineCap = .round
        shapeLayer.lineJoin = .round
        shapeLayer.contentsScale = UIScreen.main.scale
    }

    private func path(for shape: Shape, transform: CGAffineTransform) -> CGPath {
        let path = CGMutablePath()
        func cg(_ point: Pt) -> CGPoint { CGPoint(x: point.x, y: point.y) }
        switch shape {
        case .pen(let points):
            guard let first = points.first else { break }
            path.move(to: cg(first))
            if points.count == 1 { path.addLine(to: CGPoint(x: first.x + 0.01, y: first.y)) }
            for index in points.indices.dropFirst() {
                let previous = points[index - 1], current = points[index]
                path.addQuadCurve(to: CGPoint(x: (previous.x + current.x) / 2, y: (previous.y + current.y) / 2), control: cg(previous))
            }
        case .box(let from, let to):
            path.addRect(CGRect(x: min(from.x, to.x), y: min(from.y, to.y), width: abs(to.x - from.x), height: abs(to.y - from.y)))
        case .arrow(let from, let to):
            let (left, right) = arrowBarbs(from: from, to: to, length: Double(strokeWidth) * 5)
            path.move(to: cg(from))
            path.addLine(to: cg(to))
            path.move(to: cg(left))
            path.addLine(to: cg(to))
            path.addLine(to: cg(right))
        }
        var transform = transform
        return path.copy(using: &transform) ?? path
    }
}
#endif
