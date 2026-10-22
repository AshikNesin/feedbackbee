package io.nesin.feedbackbee.upload

import io.nesin.feedbackbee.FeedbackKind
import io.nesin.feedbackbee.FeedbackLimits
import java.io.InputStream

internal enum class MediaKind(val wire: String, val maxBytes: Long) {
    Screenshot("screenshot", FeedbackLimits.MAX_SCREENSHOT_BYTES),
    Recording("recording", FeedbackLimits.MAX_RECORDING_BYTES),
}

internal class Media(
    val kind: MediaKind,
    val filename: String,
    val mimeType: String,
    val length: Long,
    val seconds: Int? = null,
    val open: () -> InputStream,
) {
    val withinLimit: Boolean get() = length <= kind.maxBytes
}

internal class Audio(
    val filename: String,
    val mimeType: String,
    val length: Long,
    val seconds: Int,
    val open: () -> InputStream,
) {
    val withinLimit: Boolean get() = length <= FeedbackLimits.MAX_AUDIO_BYTES
    val secondsWithinLimit: Boolean get() = seconds in 0..FeedbackLimits.MAX_AUDIO_SECONDS
}

internal data class DeviceInfo(
    val appVersion: String?,
    val osVersion: String,
    val deviceModel: String,
    val screenWidth: Int,
    val screenHeight: Int,
)

internal class UploadRequest(
    val project: String,
    val kind: FeedbackKind,
    val text: String,
    val email: String?,
    val device: DeviceInfo,
    val media: Media?,
    val audio: Audio? = null,
)

internal sealed interface UploadOutcome {
    /** [issueUrl] is null on a 202: the server stored the feedback but could not create the issue yet. */
    data class Accepted(val issueUrl: String?) : UploadOutcome

    data class Rejected(val message: String) : UploadOutcome
}
