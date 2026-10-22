package io.nesin.feedbackbarn.upload

import io.nesin.feedbackbarn.FeedbackConfig
import io.nesin.feedbackbarn.FeedbackLimits
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal object FeedbackUploader {
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 60_000
    private const val MAX_RESPONSE_CHARS = 64 * 1024

    suspend fun upload(config: FeedbackConfig, request: UploadRequest): UploadOutcome {
        request.media?.let { media ->
            if (!media.withinLimit) return UploadOutcome.Rejected(tooLargeMessage(media))
        }
        return withContext(Dispatchers.IO) {
            try {
                post(config, buildBody(request))
            } catch (e: IOException) {
                UploadOutcome.Rejected("Couldn't reach the server (${e.message ?: e.javaClass.simpleName}). Check your connection.")
            }
        }
    }

    internal fun buildBody(request: UploadRequest): MultipartBody {
        val device = request.device
        val parts = buildList<Part> {
            add(Part.Text("project", request.project))
            add(Part.Text("kind", request.kind.wire))
            add(Part.Text("text", request.text.trim().take(FeedbackLimits.MAX_TEXT_CHARS)))
            request.email?.takeIf { it.isNotBlank() }?.let { add(Part.Text("email", it.trim())) }
            device.appVersion?.let { add(Part.Text("app_version", it)) }
            add(Part.Text("os_name", "android"))
            add(Part.Text("os_version", device.osVersion))
            add(Part.Text("device_model", device.deviceModel))
            add(Part.Text("screen_w", device.screenWidth.toString()))
            add(Part.Text("screen_h", device.screenHeight.toString()))
            request.media?.let { media ->
                add(Part.Text("media_kind", media.kind.wire))
                media.seconds?.let { add(Part.Text("media_seconds", it.toString())) }
                add(Part.File("media", media.filename, media.mimeType, media.length, media.open))
            }
        }
        return MultipartBody(parts)
    }

    private fun post(config: FeedbackConfig, body: MultipartBody): UploadOutcome {
        val connection = URL(config.feedbackUrl).openConnection() as HttpURLConnection
        try {
            connection.apply {
                requestMethod = "POST"
                doOutput = true
                instanceFollowRedirects = false
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                setRequestProperty("Content-Type", body.contentType)
                setRequestProperty("Accept", "application/json")
                setFixedLengthStreamingMode(body.contentLength())
            }
            connection.outputStream.use { body.writeTo(it) }
            val code = connection.responseCode
            val stream = if (code >= 400) connection.errorStream else connection.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(MAX_RESPONSE_CHARS) }.orEmpty()
            return parseUploadResponse(code, text)
        } finally {
            connection.disconnect()
        }
    }

    private fun tooLargeMessage(media: Media): String {
        val mb = media.kind.maxBytes / (1024 * 1024)
        return "That ${media.kind.wire} is over the $mb MB limit."
    }
}
