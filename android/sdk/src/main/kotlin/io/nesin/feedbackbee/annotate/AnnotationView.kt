package io.nesin.feedbackbee.annotate

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import io.nesin.feedbackbee.ui.Theme
import kotlin.math.min

internal class AnnotationView(
    context: Context,
    private val source: Bitmap,
    initialShapes: List<Shape>,
    private val onShapesChanged: (List<Shape>) -> Unit,
) : View(context) {

    var tool: Tool = Tool.Pen

    private val shapes = initialShapes.toMutableList()
    private val renderer = ShapeRenderer(source.width, source.height)
    private val toView = Matrix()
    private val toBitmap = Matrix()
    private val bitmapBounds = RectF(0f, 0f, source.width.toFloat(), source.height.toFloat())

    private var drawing: Shape? = null
    private var penPoints = ArrayList<Pt>()

    val canUndo: Boolean get() = shapes.isNotEmpty()

    fun undo() {
        if (shapes.isEmpty()) return
        shapes.removeAt(shapes.lastIndex)
        onShapesChanged(shapes.toList())
        invalidate()
    }

    fun exportAnnotated(): Bitmap {
        val out = source.copy(Bitmap.Config.ARGB_8888, true)
        renderer.draw(Canvas(out), shapes)
        return out
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val scale = min(w / bitmapBounds.width(), h / bitmapBounds.height())
        val dx = (w - bitmapBounds.width() * scale) / 2
        val dy = (h - bitmapBounds.height() * scale) / 2
        toView.setScale(scale, scale)
        toView.postTranslate(dx, dy)
        toView.invert(toBitmap)
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(Theme.Overlay)
        canvas.save()
        canvas.concat(toView)
        canvas.drawBitmap(source, 0f, 0f, null)
        renderer.draw(canvas, shapes)
        drawing?.let { renderer.draw(canvas, it) }
        canvas.restore()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val point = toBitmapPoint(event.x, event.y)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> begin(point)
            MotionEvent.ACTION_MOVE -> extend(point)
            MotionEvent.ACTION_UP -> commit(point)
            MotionEvent.ACTION_CANCEL -> discard()
            else -> return false
        }
        return true
    }

    private fun begin(point: Pt) {
        parent?.requestDisallowInterceptTouchEvent(true)
        penPoints = arrayListOf(point)
        drawing = newShape(tool, point)
        invalidate()
    }

    private fun extend(point: Pt) {
        val current = drawing ?: return
        drawing = when (current) {
            is Shape.Pen -> Shape.Pen(penPoints.apply { add(point) })
            is Shape.Box -> current.copy(to = point)
            is Shape.Arrow -> current.copy(to = point)
        }
        invalidate()
    }

    private fun commit(point: Pt) {
        extend(point)
        val finished = drawing ?: return
        drawing = null
        if (finished.isVisible(minSize = renderer.strokeWidth)) {
            shapes += if (finished is Shape.Pen) Shape.Pen(finished.points.toList()) else finished
            onShapesChanged(shapes.toList())
        }
        invalidate()
    }

    private fun discard() {
        drawing = null
        invalidate()
    }

    private fun toBitmapPoint(x: Float, y: Float): Pt {
        val xy = floatArrayOf(x, y)
        toBitmap.mapPoints(xy)
        return Pt(xy[0].coerceIn(0f, bitmapBounds.width()), xy[1].coerceIn(0f, bitmapBounds.height()))
    }
}
