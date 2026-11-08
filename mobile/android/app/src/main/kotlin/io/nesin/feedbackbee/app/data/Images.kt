package io.nesin.feedbackbee.app.data

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.math.max

/** Longest edge of an attached image. Phone photos shrink ~10x; screenshots stay legible. */
private const val MAX_EDGE = 2048

/**
 * Picked images → JPEG uploads, scaled down off the main thread so a report
 * with five photos stays far under the server's 10 MB / 50 MB caps and sends fast.
 */
suspend fun encodeForUpload(resolver: ContentResolver, uris: List<Uri>): List<Upload> = withContext(Dispatchers.Default) {
    uris.mapIndexed { index, uri ->
        val source = ImageDecoder.createSource(resolver, uri)
        val bitmap = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            val edge = max(info.size.width, info.size.height)
            if (edge > MAX_EDGE) {
                val scale = MAX_EDGE.toFloat() / edge
                decoder.setTargetSize((info.size.width * scale).toInt(), (info.size.height * scale).toInt())
            }
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
        bitmap.recycle()
        Upload(out.toByteArray(), "image/jpeg", "image-${index + 1}.jpg")
    }
}
