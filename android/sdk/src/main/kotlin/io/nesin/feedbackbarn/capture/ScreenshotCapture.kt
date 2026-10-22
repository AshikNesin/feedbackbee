package io.nesin.feedbackbarn.capture

import android.app.Activity
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy

internal object ScreenshotCapture {

    /** Copies only [activity]'s own window. The result is delivered on the main thread; this never throws. */
    fun capture(activity: Activity, onResult: (Result<Bitmap>) -> Unit) {
        captureProblem(activity)?.let { return onResult(Result.failure(CaptureException(it))) }
        val decor = activity.window.decorView
        val bitmap = try {
            Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
        } catch (_: OutOfMemoryError) {
            return onResult(Result.failure(CaptureException("Not enough memory to capture the screen.")))
        }
        request(activity, bitmap, onResult)
    }

    private fun captureProblem(activity: Activity): String? {
        val decor = activity.window?.decorView
        return when {
            activity.isFinishing || activity.isDestroyed -> "The screen is closing."
            decor == null -> "This screen has no window to capture."
            !decor.isAttachedToWindow || decor.width <= 0 || decor.height <= 0 -> "The screen isn't ready to capture yet."
            else -> null
        }
    }

    private fun request(activity: Activity, bitmap: Bitmap, onResult: (Result<Bitmap>) -> Unit) {
        try {
            PixelCopy.request(activity.window, bitmap, { code ->
                val result = if (code == PixelCopy.SUCCESS) Result.success(bitmap)
                else Result.failure(CaptureException("Screen capture failed (${describe(code)})."))
                onResult(result)
            }, Handler(Looper.getMainLooper()))
        } catch (e: IllegalArgumentException) {
            onResult(Result.failure(CaptureException("Screen capture isn't available on this window.")))
        }
    }

    private fun describe(code: Int): String = when (code) {
        PixelCopy.ERROR_SOURCE_NO_DATA -> "nothing drawn yet"
        PixelCopy.ERROR_SOURCE_INVALID -> "window not ready"
        PixelCopy.ERROR_DESTINATION_INVALID -> "bad destination"
        PixelCopy.ERROR_TIMEOUT -> "timed out"
        else -> "code $code"
    }

    class CaptureException(message: String) : Exception(message)
}
