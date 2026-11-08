package io.nesin.feedbackbee.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.nesin.feedbackbee.app.data.Kind
import io.nesin.feedbackbee.app.data.Status

/**
 * FeedbackBee mobile design tokens (mobile/DESIGN.md §2). The web dashboard's
 * palette in sRGB; screens read from here and MaterialTheme, never hardcode.
 * DESIGN.md and this file change together.
 */
@Immutable
data class BeeColors(
    val paper: Color,
    val card: Color,
    val muted: Color,
    val rule: Color,
    val ink: Color,
    val inkMuted: Color,
    val honey: Color = Color(0xFFF4B306),
    val onHoney: Color = Color(0xFF18181B),
    val danger: Color,
    val open: Color,
    val inProgress: Color,
    val done: Color,
    val wontFix: Color,
) {
    fun status(status: Status): Color = when (status) {
        Status.Open -> open
        Status.InProgress -> inProgress
        Status.Done -> done
        Status.WontFix -> wontFix
    }

    fun kind(kind: Kind): Color = when (kind) {
        Kind.Issue -> danger
        Kind.FeatureRequest -> honey
        Kind.Other -> inkMuted
    }
}

private val Light = BeeColors(
    paper = Color(0xFFFBFAF7),
    card = Color(0xFFFEFDFC),
    muted = Color(0xFFF4F1ED),
    rule = Color(0xFFE2DFDA),
    ink = Color(0xFF181612),
    inkMuted = Color(0xFF605D57),
    danger = Color(0xFFDC2626),
    open = Color(0xFF2563EB),
    inProgress = Color(0xFFB45309),
    done = Color(0xFF15803D),
    wontFix = Color(0xFF71717A),
)

private val Dark = BeeColors(
    paper = Color(0xFF0E0D0B),
    card = Color(0xFF171613),
    muted = Color(0xFF211F1C),
    rule = Color(0xFF282623),
    ink = Color(0xFFEDEBE7),
    inkMuted = Color(0xFFA19E99),
    danger = Color(0xFFF87171),
    open = Color(0xFF60A5FA),
    inProgress = Color(0xFFF4B93C),
    done = Color(0xFF4ADE80),
    wontFix = Color(0xFFA1A1AA),
)

val LocalBee = staticCompositionLocalOf { Light }

/** Shorthand for the current palette. */
val Bee: BeeColors @Composable get() = LocalBee.current

private val BeeShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(24.dp),
)

@Composable
fun BeeTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val c = if (dark) Dark else Light
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.ink, onPrimary = c.paper, background = c.paper, onBackground = c.ink,
            surface = c.paper, onSurface = c.ink, surfaceVariant = c.muted, onSurfaceVariant = c.inkMuted,
            surfaceContainer = c.card, surfaceContainerLow = c.card, surfaceContainerHigh = c.muted,
            surfaceContainerHighest = c.muted, surfaceContainerLowest = c.paper,
            outline = c.rule, outlineVariant = c.rule, error = c.danger,
            secondaryContainer = c.honey, onSecondaryContainer = c.onHoney,
            primaryContainer = c.honey, onPrimaryContainer = c.onHoney,
        )
    } else {
        lightColorScheme(
            primary = c.ink, onPrimary = c.paper, background = c.paper, onBackground = c.ink,
            surface = c.paper, onSurface = c.ink, surfaceVariant = c.muted, onSurfaceVariant = c.inkMuted,
            surfaceContainer = c.card, surfaceContainerLow = c.card, surfaceContainerHigh = c.muted,
            surfaceContainerHighest = c.muted, surfaceContainerLowest = c.paper,
            outline = c.rule, outlineVariant = c.rule, error = c.danger,
            secondaryContainer = c.honey, onSecondaryContainer = c.onHoney,
            primaryContainer = c.honey, onPrimaryContainer = c.onHoney,
        )
    }
    CompositionLocalProvider(LocalBee provides c) {
        MaterialTheme(colorScheme = scheme, shapes = BeeShapes, content = content)
    }
}

/** A status: dot plus word, never color alone (DESIGN.md §2). */
@Composable
fun StatusLabel(status: Status, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Dot(Bee.status(status))
        Text(status.label, style = MaterialTheme.typography.labelMedium, color = Bee.inkMuted)
    }
}

@Composable
fun Dot(color: Color, size: Int = 8) {
    Box(Modifier.size(size.dp).background(color, CircleShape))
}
