#if canImport(UIKit)
import UIKit

/// Full-screen pen / box / arrow markup over a screenshot.
final class AnnotationViewController: UIViewController {
    var onSave: ((AnnotatedScreenshot) -> Void)?
    var onCancel: (() -> Void)?

    private let canvas: AnnotationCanvas
    private var toolButtons: [Tool: UIButton] = [:]
    private let undoButton = makeButton("Undo", style: .secondary, size: 14)

    init(image: CGImage, pointScale: CGFloat) {
        canvas = AnnotationCanvas(image: image, pointScale: pointScale)
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
        onSave?(canvas.result)
    }
}

/// Every stroke is its own `CAShapeLayer` in image pixel space, inside one container layer whose
/// transform maps pixels to points. Layout (rotation, resize) only changes that transform, and a
/// touch only touches the stroke under the finger; the GPU composites the rest.
final class AnnotationCanvas: UIView {
    var tool: Tool = .pen
    var onShapesChanged: ((Int) -> Void)?

    private let image: CGImage
    private let pixelSize: CGSize
    private let strokeWidth: CGFloat
    private let imageView = UIImageView()
    private let drawing = CALayer()
    private let activeLayer = CAShapeLayer()
    private var shapes: [Shape] = []
    private var shapeLayers: [CAShapeLayer] = []
    private var active: Shape?
    private var activePen: PenStroke?

    var result: AnnotatedScreenshot { AnnotatedScreenshot(base: image, shapes: shapes) }

    init(image: CGImage, pointScale: CGFloat) {
        self.image = image
        pixelSize = CGSize(width: image.width, height: image.height)
        strokeWidth = CGFloat(annotationStrokeWidth(width: Double(image.width), height: Double(image.height)))
        super.init(frame: .zero)
        isMultipleTouchEnabled = false
        imageView.image = UIImage(cgImage: image, scale: pointScale, orientation: .up)
        imageView.contentMode = .scaleToFill
        addSubview(imageView)
        drawing.anchorPoint = .zero
        drawing.bounds = CGRect(origin: .zero, size: pixelSize)
        layer.addSublayer(drawing)
        style(activeLayer)
        drawing.addSublayer(activeLayer)
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

    override func layoutSubviews() {
        super.layoutSubviews()
        let rect = imageRect
        imageView.frame = rect
        CATransaction.begin()
        CATransaction.setDisableActions(true)
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

    // MARK: Touches

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, imageRect.insetBy(dx: -20, dy: -20).contains(touch.location(in: self)) else { return }
        let point = imagePoint(touch.location(in: self))
        if tool == .pen { activePen = PenStroke(start: point) } else { active = Shape(tool: tool, start: point) }
        redrawActive()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        if let pen = activePen {
            // Coalesced touches keep fast strokes smooth at 120 Hz with one redraw per frame.
            for sample in event?.coalescedTouches(for: touch) ?? [touch] {
                pen.add(imagePoint(sample.location(in: self)))
            }
        } else if let current = active {
            active = current.extended(to: imagePoint(touch.location(in: self)))
        } else {
            return
        }
        redrawActive()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        let shape = activePen.map { Shape.pen($0.points) } ?? active
        clearActive()
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

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        clearActive()
    }

    private func clearActive() {
        active = nil
        activePen = nil
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        activeLayer.path = nil
        CATransaction.commit()
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
        shapeLayer.strokeColor = Theme.annotation.cgColor
        shapeLayer.fillColor = nil
        shapeLayer.lineWidth = strokeWidth
        shapeLayer.lineCap = .round
        shapeLayer.lineJoin = .round
    }
}
#endif
