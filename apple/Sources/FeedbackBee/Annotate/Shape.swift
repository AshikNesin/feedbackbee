import Foundation

struct Pt: Equatable {
    var x: Double
    var y: Double
}

enum Tool: CaseIterable {
    case pen, box, arrow

    var label: String {
        switch self {
        case .pen: return "Pen"
        case .box: return "Box"
        case .arrow: return "Arrow"
        }
    }
}

/// Coordinates are in source-image pixels, so the on-screen canvas and the exported PNG draw identically.
enum Shape: Equatable {
    case pen([Pt])
    case box(from: Pt, to: Pt)
    case arrow(from: Pt, to: Pt)

    init(tool: Tool, start: Pt) {
        switch tool {
        case .pen: self = .pen([start])
        case .box: self = .box(from: start, to: start)
        case .arrow: self = .arrow(from: start, to: start)
        }
    }

    func extended(to point: Pt) -> Shape {
        switch self {
        case .pen(let points): return .pen(points + [point])
        case .box(let from, _): return .box(from: from, to: point)
        case .arrow(let from, _): return .arrow(from: from, to: point)
        }
    }

    func isVisible(minSize: Double) -> Bool {
        switch self {
        case .pen(let points): return points.count > 1
        case .box(let from, let to): return abs(to.x - from.x) >= minSize && abs(to.y - from.y) >= minSize
        case .arrow(let from, let to): return hypot(to.x - from.x, to.y - from.y) >= minSize
        }
    }
}

/// Stroke width for an image of this size, matching the Android annotator.
func annotationStrokeWidth(width: Double, height: Double) -> Double { max(width, height) * 0.005 }

/// The two barb tips of an arrow whose tip is at `to`.
func arrowBarbs(from: Pt, to: Pt, length: Double, spread: Double = 0.45) -> (Pt, Pt) {
    let back = atan2(from.y - to.y, from.x - to.x)
    func barb(_ angle: Double) -> Pt { Pt(x: to.x + length * cos(angle), y: to.y + length * sin(angle)) }
    return (barb(back + spread), barb(back - spread))
}
