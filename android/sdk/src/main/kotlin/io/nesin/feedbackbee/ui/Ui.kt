package io.nesin.feedbackbee.ui

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.TypedValue
import android.widget.Button
import android.widget.TextView

/** Base light palette; the screenshot annotation overlay keeps its fixed styling. */
internal object Theme {
    val Ink = Color.parseColor("#18181B")
    val Muted = Color.parseColor("#71717A")
    val Tile = Color.parseColor("#F4F4F5")
    val Border = Color.parseColor("#E4E4E7")
    val TileInk = Color.parseColor("#52525B")
    val Focus = Color.parseColor("#2563EB")
    val Error = Color.parseColor("#DC2626")
    val Panel = Color.WHITE
    val Overlay = Color.parseColor("#18181B")
}

internal class SheetTheme(context: Context) {
    val isDark = TypedValue().let { value ->
        if (context.theme.resolveAttribute(android.R.attr.isLightTheme, value, true)) {
            value.data == 0
        } else {
            context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        }
    }
    val Ink = if (isDark) Color.parseColor("#F4F4F5") else Theme.Ink
    val Muted = if (isDark) Color.parseColor("#A1A1AA") else Theme.Muted
    val Tile = if (isDark) Color.parseColor("#27272A") else Theme.Tile
    val Border = if (isDark) Color.parseColor("#3F3F46") else Theme.Border
    val TileInk = if (isDark) Color.parseColor("#D4D4D8") else Theme.TileInk
    val Focus = if (isDark) Color.parseColor("#60A5FA") else Theme.Focus
    val Error = if (isDark) Color.parseColor("#F87171") else Theme.Error
    val Panel = if (isDark) Color.parseColor("#18181B") else Theme.Panel
    val OnPrimary = if (isDark) Color.parseColor("#18181B") else Color.WHITE
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
    RippleDrawable(ColorStateList.valueOf(Color.argb(24, 113, 113, 122)), content, null)

internal fun Context.label(text: CharSequence, sizeSp: Float, color: Int, bold: Boolean = false): TextView =
    TextView(this).apply {
        this.text = text
        textSize = sizeSp
        setTextColor(color)
        if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
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
        ButtonStyle.Primary -> Theme.Ink to Color.WHITE
        ButtonStyle.Selected -> Theme.Border to Theme.Ink
        ButtonStyle.Secondary -> Color.WHITE to Theme.Ink
    }
    setTextColor(text)
    background = context.ripple(context.roundedRect(fill, radiusDp = 11))
}

internal fun Button.setEnabledDimmed(enabled: Boolean) {
    isEnabled = enabled
    alpha = if (enabled) 1f else 0.4f
}
