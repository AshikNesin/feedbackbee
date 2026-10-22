package io.nesin.feedbackbarn.annotate

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import kotlin.math.max
import kotlin.math.min

internal class ShapeRenderer(bitmapWidth: Int, bitmapHeight: Int) {
    val strokeWidth = max(bitmapWidth, bitmapHeight) * 0.005f

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FF3B30")
        style = Paint.Style.STROKE
        strokeWidth = this@ShapeRenderer.strokeWidth
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    fun draw(canvas: Canvas, shapes: List<Shape>) = shapes.forEach { draw(canvas, it) }

    fun draw(canvas: Canvas, shape: Shape) {
        when (shape) {
            is Shape.Pen -> canvas.drawPath(smoothPath(shape.points), paint)
            is Shape.Box -> canvas.drawRect(
                min(shape.from.x, shape.to.x), min(shape.from.y, shape.to.y),
                max(shape.from.x, shape.to.x), max(shape.from.y, shape.to.y), paint,
            )
            is Shape.Arrow -> drawArrow(canvas, shape)
        }
    }

    private fun drawArrow(canvas: Canvas, arrow: Shape.Arrow) {
        val (left, right) = arrowBarbs(arrow.from, arrow.to, length = strokeWidth * 5)
        canvas.drawLine(arrow.from.x, arrow.from.y, arrow.to.x, arrow.to.y, paint)
        canvas.drawLine(arrow.to.x, arrow.to.y, left.x, left.y, paint)
        canvas.drawLine(arrow.to.x, arrow.to.y, right.x, right.y, paint)
    }

    private fun smoothPath(points: List<Pt>): Path {
        val path = Path()
        val first = points.firstOrNull() ?: return path
        path.moveTo(first.x, first.y)
        if (points.size == 1) path.lineTo(first.x + 0.01f, first.y)
        for (i in 1 until points.size) {
            val prev = points[i - 1]
            val cur = points[i]
            path.quadTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2)
        }
        return path
    }
}
