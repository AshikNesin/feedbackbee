package io.nesin.feedbackbarn.upload

import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

internal sealed interface Part {
    val name: String

    class Text(override val name: String, val value: String) : Part

    class File(
        override val name: String,
        val filename: String,
        val mimeType: String,
        val length: Long,
        val open: () -> InputStream,
    ) : Part
}

/** Hand-rolled multipart/form-data. Exact length is known up front so HttpURLConnection can stream instead of buffering a 200 MB file. */
internal class MultipartBody(
    private val parts: List<Part>,
    private val boundary: String = "FeedbackBarn-" + UUID.randomUUID().toString().replace("-", ""),
) {
    val contentType: String get() = "multipart/form-data; boundary=$boundary"

    fun contentLength(): Long = parts.sumOf { header(it).size + bodyLength(it) + CRLF.size } + closing().size

    fun writeTo(out: OutputStream) {
        parts.forEach { part ->
            out.write(header(part))
            when (part) {
                is Part.Text -> out.write(part.value.toByteArray(Charsets.UTF_8))
                is Part.File -> part.open().use { it.copyTo(out) }
            }
            out.write(CRLF)
        }
        out.write(closing())
        out.flush()
    }

    private fun bodyLength(part: Part): Long = when (part) {
        is Part.Text -> part.value.toByteArray(Charsets.UTF_8).size.toLong()
        is Part.File -> part.length
    }

    private fun header(part: Part): ByteArray {
        val disposition = when (part) {
            is Part.Text -> "form-data; name=\"${quote(part.name)}\""
            is Part.File -> "form-data; name=\"${quote(part.name)}\"; filename=\"${quote(part.filename)}\""
        }
        val type = if (part is Part.File) "Content-Type: ${part.mimeType}\r\n" else ""
        return "--$boundary\r\nContent-Disposition: $disposition\r\n$type\r\n".toByteArray(Charsets.UTF_8)
    }

    private fun closing(): ByteArray = "--$boundary--\r\n".toByteArray(Charsets.UTF_8)

    private fun quote(value: String): String =
        value.replace("\"", "%22").replace("\r", "%0D").replace("\n", "%0A")

    private companion object {
        val CRLF = "\r\n".toByteArray(Charsets.UTF_8)
    }
}
