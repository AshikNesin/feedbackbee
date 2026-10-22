package io.nesin.feedbackbee.record

import android.media.MediaRecorder
import android.os.SystemClock
import io.nesin.feedbackbee.FeedbackLimits
import java.io.File

internal data class VoiceRecording(val file: File, val seconds: Int)

internal fun voiceDurationSeconds(startedAtMs: Long, endedAtMs: Long): Int =
    (((endedAtMs - startedAtMs).coerceAtLeast(0L)) / 1_000L).toInt().coerceIn(0, FeedbackLimits.MAX_AUDIO_SECONDS)

internal fun formatVoiceDuration(seconds: Int): String {
    val safeSeconds = seconds.coerceIn(0, FeedbackLimits.MAX_AUDIO_SECONDS)
    return "%d:%02d".format(safeSeconds / 60, safeSeconds % 60)
}

internal class VoiceRecorder(
    private val nowMs: () -> Long = SystemClock::elapsedRealtime,
) {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAtMs: Long = 0L

    val isRecording: Boolean get() = recorder != null

    fun start(cacheDir: File, onLimitReached: () -> Unit): Result<Unit> {
        if (isRecording) return Result.failure(IllegalStateException("Voice recording is already active."))
        val output = try {
            File.createTempFile("feedbackbee-voice-", ".m4a", cacheDir)
        } catch (error: Exception) {
            return Result.failure(error)
        }
        var activeRecorder: MediaRecorder? = null
        return try {
            @Suppress("DEPRECATION")
            val createdRecorder = MediaRecorder()
            activeRecorder = createdRecorder
            createdRecorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                // AAC in an MP4 container keeps .m4a broadly playable while matching accepted audio types.
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44_100)
                setMaxDuration(FeedbackLimits.MAX_AUDIO_SECONDS * 1_000)
                setMaxFileSize(FeedbackLimits.MAX_AUDIO_BYTES)
                setOutputFile(output.absolutePath)
                setOnInfoListener { _, what, _ ->
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED ||
                        what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED
                    ) {
                        onLimitReached()
                    }
                }
                prepare()
                start()
            }
            activeRecorder = createdRecorder
            recorder = createdRecorder
            outputFile = output
            startedAtMs = nowMs()
            Result.success(Unit)
        } catch (error: Exception) {
            activeRecorder?.let(::releaseQuietly)
            output.delete()
            Result.failure(error)
        }
    }

    fun stop(): Result<VoiceRecording> {
        val activeRecorder = recorder ?: return Result.failure(IllegalStateException("Voice recording is not active."))
        val output = outputFile ?: return Result.failure(IllegalStateException("Voice recording has no output file."))
        val seconds = voiceDurationSeconds(startedAtMs, nowMs())
        recorder = null
        outputFile = null
        return try {
            activeRecorder.stop()
            activeRecorder.reset()
            activeRecorder.release()
            Result.success(VoiceRecording(output, seconds))
        } catch (error: Exception) {
            releaseQuietly(activeRecorder)
            output.delete()
            Result.failure(error)
        }
    }

    fun cancel() {
        val activeRecorder = recorder ?: return
        recorder = null
        outputFile?.delete()
        outputFile = null
        try {
            activeRecorder.reset()
        } catch (_: Exception) {
        }
        releaseQuietly(activeRecorder)
    }

    private fun releaseQuietly(recorder: MediaRecorder) {
        try {
            recorder.release()
        } catch (_: Exception) {
            // Cleanup is best effort; the host app must never crash because the sheet closed mid-recording.
        }
    }
}
