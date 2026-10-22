package io.nesin.feedbackbee

import android.graphics.Bitmap
import io.nesin.feedbackbee.annotate.Shape
import java.io.File

internal enum class FeedbackKind(val wire: String, val label: String, val formTitle: String) {
    Issue("bug", "Issue", "Report an issue"),
    Idea("idea", "Idea", "Share an idea"),
    Other("feedback", "Other", "Tell us more"),
}

internal object FeedbackLimits {
    const val MAX_TEXT_CHARS = 5000
    const val MAX_SCREENSHOT_BYTES = 10L * 1024 * 1024
    const val MAX_RECORDING_BYTES = 200L * 1024 * 1024
    const val MAX_RECORDING_SECONDS = 300
    const val MAX_AUDIO_BYTES = 25L * 1024 * 1024
    const val MAX_AUDIO_SECONDS = 300
}

/**
 * One feedback submission's lifecycle. The sheet renders straight from this;
 * there are no side flags like "isLoading" or "hasError".
 */
internal sealed interface FeedbackState {

    /** States in which the user can still change the form. */
    sealed interface Editable : FeedbackState {
        val draft: Draft
        fun withDraft(draft: Draft): Editable
    }

    data class Draft(
        val text: String = "",
        val kind: FeedbackKind = FeedbackKind.Other,
        val email: String = "",
        val audio: AudioNote? = null,
    ) : Editable {
        override val draft: Draft get() = this
        override fun withDraft(draft: Draft): Editable = draft
        val canSend: Boolean get() = text.isNotBlank()
    }

    /** The kind picker. [from] keeps the draft and screenshot so Back from the form loses nothing. */
    data class Choosing(val from: Editable = Draft()) : FeedbackState

    /** The recorder owns the file until [FeedbackViewModel.finishVoiceRecording] stores it in the draft. */
    class RecordingAudio(
        val from: Editable,
        val startedAtElapsedMs: Long,
    ) : FeedbackState

    /** [from] is where Cancel returns to, so retaking never loses an existing screenshot. */
    class Annotating(
        val from: Editable,
        val source: Bitmap,
        val shapes: List<Shape> = emptyList(),
    ) : FeedbackState

    class WithScreenshot(override val draft: Draft, val bitmap: Bitmap) : Editable {
        override fun withDraft(draft: Draft) = WithScreenshot(draft, bitmap)
    }

    class Uploading(val from: Editable) : FeedbackState

    data class Sent(val issueUrl: String?) : FeedbackState

    /** [resume] is where the user lands to fix the problem and try again. */
    class Failed(val error: String, val resume: Editable) : FeedbackState
}

internal data class AudioNote(val file: File, val seconds: Int)

/** The form behind this state, or null once the submission is done. */
internal val FeedbackState.form: FeedbackState.Editable?
    get() = when (this) {
        is FeedbackState.Editable -> this
        is FeedbackState.Choosing -> from
        is FeedbackState.RecordingAudio -> from
        is FeedbackState.Annotating -> from
        is FeedbackState.Uploading -> from
        is FeedbackState.Failed -> resume
        is FeedbackState.Sent -> null
    }
