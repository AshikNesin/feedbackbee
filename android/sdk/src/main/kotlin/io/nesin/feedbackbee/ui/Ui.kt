package io.nesin.feedbackbee.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.widget.Button
import android.widget.TextView

/** Same tokens as the web widget, so the two feel like one product. Light only, like the web panel. */
internal object Theme {
    val Ink = Color.parseColor("#2D3E50")
    val Muted = Color.parseColor("#91A4BE")
    val Tile = Color.parseColor("#EDF3F8")
    val TileInk = Color.parseColor("#5B7186")
    val Focus = Color.parseColor("#3B82F6")
    val Accent = Color.parseColor("#F5B940")
    val Error = Color.parseColor("#DC2626")
    val Panel = Color.WHITE
    val Overlay = Color.parseColor("#1C2632")
}

internal fun Context.dp(value: Int): Int = dpF(value.toFloat()).toInt()

internal fun Context.dpF(value: Float): Float = value * resources.displayMetrics.density

internal fun Context.roundedRect(fill: Int, radiusDp: Int, strokeDp: Float = 0f, stroke: Int = Color.TRANSPARENT): GradientDrawable =
    GradientDrawable().apply {
        setColor(fill)
        cornerRadius = dpF(radiusDp.toFloat())
        if (strokeDp > 0f) setStroke(dpF(strokeDp).toInt(), stroke)
    }

internal fun Context.ripple(content: GradientDrawable): RippleDrawable =
    RippleDrawable(ColorStateList.valueOf(Color.argb(36, 45, 62, 80)), content, null)

internal fun Context.label(text: CharSequence, sizeSp: Float, color: Int, bold: Boolean = false): TextView =
    TextView(this).apply {
        this.text = text
        textSize = sizeSp
        setTextColor(color)
        if (bold) typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

/** Buttons on the dark annotation overlay. The sheet draws its own controls. */
internal enum class ButtonStyle { Primary, Secondary, Selected }

internal fun Context.actionButton(label: String, style: ButtonStyle = ButtonStyle.Secondary): Button =
    Button(this).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textSize = 14f
        setPadding(dp(16), dp(10), dp(16), dp(10))
        applyStyle(style)
    }

internal fun Button.applyStyle(style: ButtonStyle) {
    val (fill, text) = when (style) {
        ButtonStyle.Primary -> Theme.Accent to Theme.Ink
        ButtonStyle.Selected -> Theme.Focus to Color.WHITE
        ButtonStyle.Secondary -> Color.WHITE to Theme.Ink
    }
    setTextColor(text)
    background = context.ripple(context.roundedRect(fill, radiusDp = 11))
}

internal fun Button.setEnabledDimmed(enabled: Boolean) {
    isEnabled = enabled
    alpha = if (enabled) 1f else 0.4f
}
