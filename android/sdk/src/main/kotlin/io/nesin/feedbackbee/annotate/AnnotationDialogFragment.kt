package io.nesin.feedbackbee.annotate

import android.app.Dialog
import android.content.DialogInterface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import io.nesin.feedbackbee.FeedbackState
import io.nesin.feedbackbee.FeedbackViewModel
import io.nesin.feedbackbee.ui.ButtonStyle
import io.nesin.feedbackbee.ui.Theme
import io.nesin.feedbackbee.ui.actionButton
import io.nesin.feedbackbee.ui.applyStyle
import io.nesin.feedbackbee.ui.dp
import io.nesin.feedbackbee.ui.setEnabledDimmed
import kotlinx.coroutines.launch

internal class AnnotationDialogFragment : DialogFragment() {

    private val viewModel by lazy { FeedbackViewModel.of(requireActivity()) }
    private var canvasView: AnnotationView? = null
    private val toolButtons = LinkedHashMap<Tool, Button>()
    private var undoButton: Button? = null

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = Dialog(requireContext(), android.R.style.Theme_Black_NoTitleBar)
        dialog.window?.let { window ->
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.setLayout(MATCH_PARENT, MATCH_PARENT)
            WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        }
        return dialog
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val annotating = viewModel.state.value as? FeedbackState.Annotating
        return annotating?.let(::buildContent) ?: View(requireContext())
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { if (it !is FeedbackState.Annotating) dismissAllowingStateLoss() }
            }
        }
    }

    override fun onCancel(dialog: DialogInterface) {
        viewModel.cancelAnnotation()
    }

    override fun onDestroyView() {
        canvasView = null
        undoButton = null
        toolButtons.clear()
        super.onDestroyView()
    }

    private fun buildContent(state: FeedbackState.Annotating): View {
        val ctx = requireContext()
        val canvas = AnnotationView(ctx, state.source, state.shapes) { shapes ->
            viewModel.updateShapes(shapes)
            refreshUndo()
        }
        canvasView = canvas

        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Theme.Overlay)
        }
        root.addView(topBar(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        root.addView(canvas, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        root.addView(toolBar(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        applySystemBarInsets(root)
        selectTool(Tool.Pen)
        return root
    }

    private fun topBar(): View {
        val ctx = requireContext()
        val cancel = ctx.actionButton("Cancel").apply { setOnClickListener { viewModel.cancelAnnotation() } }
        val save = ctx.actionButton("Save", ButtonStyle.Primary).apply {
            setOnClickListener { canvasView?.let { viewModel.finishAnnotation(it.exportAnnotated()) } }
        }
        return LinearLayout(ctx).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(ctx.dp(12), ctx.dp(8), ctx.dp(12), ctx.dp(8))
            addView(cancel)
            addView(View(ctx), LinearLayout.LayoutParams(0, 1, 1f))
            addView(save)
        }
    }

    private fun toolBar(): View {
        val ctx = requireContext()
        val bar = LinearLayout(ctx).apply {
            gravity = Gravity.CENTER
            setPadding(ctx.dp(12), ctx.dp(10), ctx.dp(12), ctx.dp(10))
        }
        Tool.entries.forEach { tool ->
            val button = ctx.actionButton(tool.name).apply { setOnClickListener { selectTool(tool) } }
            toolButtons[tool] = button
            bar.addView(button, spacedParams())
        }
        undoButton = ctx.actionButton("Undo").apply { setOnClickListener { canvasView?.undo() } }
        bar.addView(undoButton, spacedParams())
        refreshUndo()
        return bar
    }

    private fun spacedParams() = LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
        marginStart = requireContext().dp(4)
        marginEnd = requireContext().dp(4)
    }

    private fun selectTool(tool: Tool) {
        canvasView?.tool = tool
        toolButtons.forEach { (t, button) ->
            button.applyStyle(if (t == tool) ButtonStyle.Selected else ButtonStyle.Secondary)
        }
    }

    private fun refreshUndo() {
        undoButton?.setEnabledDimmed(canvasView?.canUndo == true)
    }

    private fun applySystemBarInsets(root: ViewGroup) {
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }
}
