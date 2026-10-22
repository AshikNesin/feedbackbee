package io.nesin.feedbackbee.ui

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

internal class Palette(
    val surface: Int,
    val onSurface: Int,
    val muted: Int,
    val field: Int,
    val outline: Int,
    val accent: Int,
    val onAccent: Int,
    val error: Int,
)

private val DARK = Palette(
    surface = Color.parseColor("#17171A"),
    onSurface = Color.parseColor("#F4F4F5"),
    muted = Color.parseColor("#A1A1AA"),
    field = Color.parseColor("#232328"),
    outline = Color.parseColor("#34343B"),
    accent = Color.parseColor("#F59E0B"),
    onAccent = Color.parseColor("#1A1203"),
    error = Color.parseColor("#FF6B6B"),
)

private val LIGHT = Palette(
    surface = Color.WHITE,
    onSurface = Color.parseColor("#18181B"),
    muted = Color.parseColor("#6B6B76"),
    field = Color.parseColor("#F4F4F5"),
    outline = Color.parseColor("#E4E4E7"),
    accent = Color.parseColor("#D97706"),
    onAccent = Color.WHITE,
    error = Color.parseColor("#D92D20"),
)

internal fun Context.palette(): Palette {
    val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
    return if (night == Configuration.UI_MODE_NIGHT_YES) DARK else LIGHT
}

internal fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

internal fun Context.roundedRect(fill: Int, radiusDp: Int, stroke: Int? = null): GradientDrawable =
    GradientDrawable().apply {
        setColor(fill)
        cornerRadius = dp(radiusDp).toFloat()
        stroke?.let { setStroke(dp(1), it) }
    }

internal enum class ButtonStyle { Primary, Secondary, Selected }

internal fun Context.actionButton(label: String, style: ButtonStyle = ButtonStyle.Secondary): Button {
    val p = palette()
    return Button(this).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textSize = 14f
        setPadding(dp(16), dp(11), dp(16), dp(11))
        applyStyle(style, p)
    }
}

internal fun Button.applyStyle(style: ButtonStyle, p: Palette) {
    val (fill, text, stroke) = when (style) {
        ButtonStyle.Primary -> Triple(p.accent, p.onAccent, null)
        ButtonStyle.Selected -> Triple(p.onSurface, p.surface, null)
        ButtonStyle.Secondary -> Triple(p.field, p.onSurface, p.outline)
    }
    setTextColor(text)
    val shape = context.roundedRect(fill, radiusDp = 12, stroke = stroke)
    background = RippleDrawable(ColorStateList.valueOf(Color.argb(40, 128, 128, 128)), shape, null)
}

internal fun Button.setEnabledDimmed(enabled: Boolean) {
    isEnabled = enabled
    alpha = if (enabled) 1f else 0.4f
}

internal fun Context.label(text: String, sizeSp: Float, color: Int, bold: Boolean = false): TextView =
    TextView(this).apply {
        this.text = text
        textSize = sizeSp
        setTextColor(color)
        if (bold) typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

internal fun Context.row(vararg children: View, gapDp: Int = 8, weighted: Boolean = true): LinearLayout =
    LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        children.forEachIndexed { index, child ->
            val params = if (weighted) LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            else LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            if (index > 0) params.marginStart = dp(gapDp)
            addView(child, params)
        }
    }
