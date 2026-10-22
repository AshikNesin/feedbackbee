package io.nesin.feedbackbee

import android.graphics.Bitmap
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.nesin.feedbackbee.FeedbackState.Annotating
import io.nesin.feedbackbee.FeedbackState.Draft
import io.nesin.feedbackbee.FeedbackState.Editable
import io.nesin.feedbackbee.FeedbackState.Failed
import io.nesin.feedbackbee.FeedbackState.Sent
import io.nesin.feedbackbee.FeedbackState.Uploading
import io.nesin.feedbackbee.FeedbackState.WithScreenshot
import io.nesin.feedbackbee.annotate.Shape
import io.nesin.feedbackbee.capture.ScreenshotEncoder
import io.nesin.feedbackbee.upload.DeviceInfo
import io.nesin.feedbackbee.upload.FeedbackUploader
import io.nesin.feedbackbee.upload.Media
import io.nesin.feedbackbee.upload.MediaKind
import io.nesin.feedbackbee.upload.UploadOutcome
import io.nesin.feedbackbee.upload.UploadRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream

/** Activity-scoped so the draft, screenshot and in-flight upload survive rotation and fold/unfold. */
internal class FeedbackViewModel : ViewModel() {

    private val _state = MutableStateFlow<FeedbackState>(Draft())
    val state: StateFlow<FeedbackState> = _state.asStateFlow()

    fun editDraft(transform: (Draft) -> Draft) = _state.update { current ->
        val editable = current.editable() ?: return@update current
        editable.withDraft(transform(editable.draft))
    }

    fun beginAnnotation(source: Bitmap) = _state.update { current ->
        val editable = current.editable() ?: return@update current
        Annotating(from = editable, source = source)
    }

    fun updateShapes(shapes: List<Shape>) = _state.update { current ->
        if (current is Annotating) Annotating(current.from, current.source, shapes) else current
    }

    fun finishAnnotation(annotated: Bitmap) = _state.update { current ->
        if (current is Annotating) WithScreenshot(current.from.draft, annotated) else current
    }

    fun cancelAnnotation() = _state.update { current ->
        if (current is Annotating) current.from else current
    }

    fun removeScreenshot() = _state.update { current ->
        if (current is WithScreenshot) current.draft else current
    }

    fun reportProblem(message: String) = _state.update { current ->
        val editable = current.editable() ?: return@update current
        Failed(message, editable)
    }

    fun send(device: DeviceInfo, config: FeedbackConfig) {
        val from = _state.value.editable() ?: return
        if (!from.draft.canSend) return
        _state.value = Uploading(from)
        viewModelScope.launch {
            val outcome = submit(from, device, config)
            _state.value = when (outcome) {
                is UploadOutcome.Accepted -> Sent(outcome.issueUrl)
                is UploadOutcome.Rejected -> Failed(outcome.message, from)
            }
        }
    }

    fun reset() {
        if (_state.value !is Uploading) _state.value = Draft()
    }

    private suspend fun submit(from: Editable, device: DeviceInfo, config: FeedbackConfig): UploadOutcome {
        val media = if (from is WithScreenshot) {
            screenshotMedia(from.bitmap) ?: return UploadOutcome.Rejected("The screenshot is too large to upload.")
        } else null
        val draft = from.draft
        val request = UploadRequest(
            project = config.projectSlug,
            kind = draft.kind,
            text = draft.text,
            email = draft.email,
            device = device,
            media = media,
        )
        return FeedbackUploader.upload(config, request)
    }

    private suspend fun screenshotMedia(bitmap: Bitmap): Media? = withContext(Dispatchers.Default) {
        ScreenshotEncoder.encodePng(bitmap, MediaKind.Screenshot.maxBytes)?.let { png ->
            Media(MediaKind.Screenshot, "screenshot.png", "image/png", png.size.toLong()) { ByteArrayInputStream(png) }
        }
    }

    private fun FeedbackState.editable(): Editable? = when (this) {
        is Editable -> this
        is Failed -> resume
        else -> null
    }

    companion object {
        private val factory = viewModelFactory { initializer { FeedbackViewModel() } }

        fun of(activity: FragmentActivity): FeedbackViewModel =
            ViewModelProvider(activity, factory)[FeedbackViewModel::class.java]
    }
}
