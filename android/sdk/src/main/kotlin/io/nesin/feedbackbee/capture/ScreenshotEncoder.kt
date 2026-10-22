package io.nesin.feedbackbee.capture

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream

internal object ScreenshotEncoder {
    private const val SHRINK_FACTOR = 0.75f
    private const val MAX_ATTEMPTS = 4

    /** PNG bytes within [maxBytes], shrinking the bitmap a few times if a large tablet capture overshoots. Null if it never fits. */
    fun encodePng(bitmap: Bitmap, maxBytes: Long): ByteArray? {
        var current = bitmap
        repeat(MAX_ATTEMPTS) {
            val bytes = ByteArrayOutputStream().also { current.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
            if (bytes.size <= maxBytes) return bytes
            current = Bitmap.createScaledBitmap(
                current,
                (current.width * SHRINK_FACTOR).toInt().coerceAtLeast(1),
                (current.height * SHRINK_FACTOR).toInt().coerceAtLeast(1),
                true,
            )
        }
        return null
    }
}
