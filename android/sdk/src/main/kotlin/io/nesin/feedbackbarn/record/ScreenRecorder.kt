package io.nesin.feedbackbarn.record

import androidx.activity.ComponentActivity
import java.io.File

internal class Recording(val file: File, val seconds: Int)

/**
 * Seam for MediaProjection screen recording (5 minute hard cap, foreground-service notification).
 * Only the unavailable implementation ships in v0.1; the sheet reads [isAvailable] and disables the button.
 */
internal interface ScreenRecorder {
    val isAvailable: Boolean

    fun start(activity: ComponentActivity, onFinished: (Result<Recording>) -> Unit)
}

internal object UnavailableScreenRecorder : ScreenRecorder {
    override val isAvailable = false

    override fun start(activity: ComponentActivity, onFinished: (Result<Recording>) -> Unit) =
        onFinished(Result.failure(UnsupportedOperationException("Screen recording isn't available in this SDK build.")))
}
