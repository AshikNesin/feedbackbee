package io.nesin.feedbackbarn.annotate

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

internal data class Pt(val x: Float, val y: Float)

internal enum class Tool { Pen, Box, Arrow }

/** Coordinates are in source-bitmap pixels so the on-screen view and the exported PNG draw identically. */
internal sealed interface Shape {
    class Pen(val points: List<Pt>) : Shape
    data class Box(val from: Pt, val to: Pt) : Shape
    data class Arrow(val from: Pt, val to: Pt) : Shape
}

internal fun Shape.isVisible(minSize: Float): Boolean = when (this) {
    is Shape.Pen -> points.size > 1
    is Shape.Box -> abs(to.x - from.x) >= minSize && abs(to.y - from.y) >= minSize
    is Shape.Arrow -> hypot(to.x - from.x, to.y - from.y) >= minSize
}

internal fun newShape(tool: Tool, start: Pt): Shape = when (tool) {
    Tool.Pen -> Shape.Pen(listOf(start))
    Tool.Box -> Shape.Box(start, start)
    Tool.Arrow -> Shape.Arrow(start, start)
}

/** The two barb tips of an arrow whose tip is at [to]. */
internal fun arrowBarbs(from: Pt, to: Pt, length: Float, spreadRadians: Float = 0.45f): Pair<Pt, Pt> {
    val back = atan2(from.y - to.y, from.x - to.x)
    fun barb(angle: Float) = Pt(to.x + length * cos(angle), to.y + length * sin(angle))
    return barb(back + spreadRadians) to barb(back - spreadRadians)
}
