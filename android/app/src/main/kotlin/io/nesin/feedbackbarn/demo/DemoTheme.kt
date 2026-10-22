package io.nesin.feedbackbarn.demo

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Amber = Color(0xFFF59E0B)
private val Ink = Color(0xFF0E0E10)
private val Surface = Color(0xFF17171A)
private val SurfaceHigh = Color(0xFF232328)

private val Scheme = darkColorScheme(
    primary = Amber,
    onPrimary = Color(0xFF1A1203),
    background = Ink,
    onBackground = Color(0xFFF4F4F5),
    surface = Surface,
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = SurfaceHigh,
    onSurfaceVariant = Color(0xFFA1A1AA),
    outline = Color(0xFF34343B),
    error = Color(0xFFFF6B6B),
)

@Composable
fun DemoTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = Scheme, content = content)
