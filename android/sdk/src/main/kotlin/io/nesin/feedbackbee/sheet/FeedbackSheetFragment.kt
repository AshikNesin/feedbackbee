package io.nesin.feedbackbee.sheet

import android.app.Dialog
import android.content.ActivityNotFoundException
import android.content.DialogInterface
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import io.nesin.feedbackbee.FeedbackBee
import io.nesin.feedbackbee.FeedbackKind
import io.nesin.feedbackbee.FeedbackState
import io.nesin.feedbackbee.FeedbackViewModel
import io.nesin.feedbackbee.annotate.AnnotationDialogFragment
import io.nesin.feedbackbee.capture.ScreenshotCapture
import io.nesin.feedbackbee.ui.dp
import io.nesin.feedbackbee.upload.collectDeviceInfo
import kotlinx.coroutines.launch
import kotlin.math.min

internal class FeedbackSheetFragment : DialogFragment(), SheetActions {

    private val viewModel by lazy { FeedbackViewModel.of(requireActivity()) }
    private var sheet: FeedbackSheetView? = null

    // Deprecated for edge-to-edge windows only; a floating dialog still needs it to rise above the keyboard.
    @Suppress("DEPRECATION")
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog =
        Dialog(requireContext(), android.R.style.Theme_DeviceDefault_Dialog_NoActionBar).apply {
            window?.apply {
                setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
                setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)
                setDimAmount(DIM)
                setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
            }
        }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FeedbackSheetView(requireContext(), this)
        sheet = view
        if (savedInstanceState == null) slideIn(view)
        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect(::render)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val metrics = resources.displayMetrics
        val width = min(metrics.widthPixels, requireContext().dp(MAX_SHEET_WIDTH_DP))
        dialog?.window?.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    override fun onDestroyView() {
        sheet = null
        super.onDestroyView()
    }

    override fun onDismiss(dialog: DialogInterface) {
        super.onDismiss(dialog)
        if (activity?.isChangingConfigurations == false) viewModel.reset()
    }

    private fun render(state: FeedbackState) {
        isCancelable = state !is FeedbackState.Uploading
        sheet?.render(state)
        if (state is FeedbackState.Annotating) showAnnotator()
    }

    private fun showAnnotator() {
        val fm = parentFragmentManager
        if (fm.findFragmentByTag(ANNOTATOR_TAG) == null && !fm.isStateSaved) {
            AnnotationDialogFragment().show(fm, ANNOTATOR_TAG)
        }
    }

    override fun onKindSelected(kind: FeedbackKind) = viewModel.chooseKind(kind)

    override fun onBack() = viewModel.backToKindPicker()

    override fun onTextChanged(text: String) = viewModel.editDraft { it.copy(text = text) }

    override fun onEmailChanged(email: String) = viewModel.editDraft { it.copy(email = email) }

    override fun onAttachScreenshot() {
        ScreenshotCapture.capture(requireActivity()) { result ->
            result.fold(
                onSuccess = viewModel::beginAnnotation,
                onFailure = { viewModel.reportProblem(it.message ?: "Couldn't capture the screen.") },
            )
        }
    }

    override fun onRemoveScreenshot() = viewModel.removeScreenshot()

    override fun onSend() {
        val config = FeedbackBee.configOrNull() ?: return viewModel.reportProblem("FeedbackBee.init() was not called.")
        viewModel.send(collectDeviceInfo(requireContext()), config)
    }

    override fun onClose() = dismissAllowingStateLoss()

    override fun onOpenIssue(url: String) {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" && uri.scheme != "http") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(requireContext(), "No app can open this link.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun slideIn(view: View) {
        view.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
            override fun onPreDraw(): Boolean {
                view.viewTreeObserver.removeOnPreDrawListener(this)
                view.translationY = view.height.toFloat()
                view.animate().translationY(0f).setDuration(SLIDE_MS).setInterpolator(DecelerateInterpolator()).start()
                return true
            }
        })
    }

    companion object {
        private const val TAG = "io.nesin.feedbackbee.sheet"
        private const val ANNOTATOR_TAG = "io.nesin.feedbackbee.annotator"
        private const val MAX_SHEET_WIDTH_DP = 360
        private const val SLIDE_MS = 240L
        private const val DIM = 0.4f

        /** Does nothing while a sheet is already open, so a shake can never stack a second one. */
        fun open(activity: FragmentActivity) {
            val fragments = activity.supportFragmentManager
            if (fragments.isStateSaved || fragments.isDestroyed) return
            if (fragments.findFragmentByTag(TAG) != null) return
            FeedbackSheetFragment().show(fragments, TAG)
        }
    }
}
