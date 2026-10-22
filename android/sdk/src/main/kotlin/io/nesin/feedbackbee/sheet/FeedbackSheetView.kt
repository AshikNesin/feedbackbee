package io.nesin.feedbackbee.sheet

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import io.nesin.feedbackbee.FeedbackKind
import io.nesin.feedbackbee.FeedbackLimits
import io.nesin.feedbackbee.FeedbackState
import io.nesin.feedbackbee.form
import io.nesin.feedbackbee.ui.ButtonStyle
import io.nesin.feedbackbee.ui.actionButton
import io.nesin.feedbackbee.ui.applyStyle
import io.nesin.feedbackbee.ui.dp
import io.nesin.feedbackbee.ui.label
import io.nesin.feedbackbee.ui.palette
import io.nesin.feedbackbee.ui.roundedRect
import io.nesin.feedbackbee.ui.row
import io.nesin.feedbackbee.ui.setEnabledDimmed

internal interface SheetActions {
    fun onKindSelected(kind: FeedbackKind)
    fun onTextChanged(text: String)
    fun onEmailChanged(email: String)
    fun onAttachScreenshot()
    fun onRemoveScreenshot()
    fun onRecordScreen()
    fun onSend()
    fun onClose()
    fun onOpenIssue(url: String)
}

/** Pure projection of [FeedbackState]; holds no state of its own beyond the widgets. */
internal class FeedbackSheetView(
    context: Context,
    private val actions: SheetActions,
    private val recordingAvailable: Boolean,
) : ScrollView(context) {

    private val p = context.palette()
    private var shownScreenshot: Bitmap? = null
    private val kindButtons = FeedbackKind.entries.associateWith { kind ->
        context.actionButton(kind.label).apply { setOnClickListener { actions.onKindSelected(kind) } }
    }
    private val textField = field("What's on your mind?", multiline = true)
    private val emailField = field("Email (optional)", multiline = false)
    private val attachButton = context.actionButton("Attach screenshot").apply { setOnClickListener { actions.onAttachScreenshot() } }
    private val recordButton = context.actionButton(if (recordingAvailable) "Record screen" else "Record screen (soon)")
        .apply { setOnClickListener { actions.onRecordScreen() } }
    private val thumbnail = ImageView(context).apply {
        scaleType = ImageView.ScaleType.FIT_CENTER
        adjustViewBounds = true
        contentDescription = "Annotated screenshot"
        background = context.roundedRect(p.field, 12, p.outline)
        setPadding(context.dp(6), context.dp(6), context.dp(6), context.dp(6))
    }
    private val removeButton = context.actionButton("Remove screenshot").apply { setOnClickListener { actions.onRemoveScreenshot() } }
    private val screenshotBlock = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(thumbnail, LinearLayout.LayoutParams(MATCH_PARENT, context.dp(150)))
        addView(removeButton, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = context.dp(8) })
    }
    private val statusLine = context.label("", 13f, p.muted).apply { visibility = View.GONE }
    private val progress = ProgressBar(context, null, android.R.attr.progressBarStyleSmall).apply { visibility = View.GONE }
    private val sendButton = context.actionButton("Send", ButtonStyle.Primary).apply { setOnClickListener { actions.onSend() } }
    private val cancelButton = context.actionButton("Cancel").apply { setOnClickListener { actions.onClose() } }
    private val formGroup = buildForm()
    private val thanks = context.label("", 18f, p.onSurface, bold = true)
    private val issueLink = context.label("", 15f, p.accent).apply {
        paintFlags = paintFlags or Paint.UNDERLINE_TEXT_FLAG
        setPadding(0, context.dp(10), 0, context.dp(10))
    }
    private val doneButton = context.actionButton("Done", ButtonStyle.Primary).apply { setOnClickListener { actions.onClose() } }
    private val sentGroup = buildSent()

    init {
        isFillViewport = false
        clipToPadding = false
        background = GradientDrawable().apply {
            setColor(p.surface)
            val r = context.dp(24).toFloat()
            cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(context.dp(20), context.dp(20), context.dp(20), context.dp(20))
            addView(formGroup)
            addView(sentGroup)
        })
        textField.addTextChangedListener(watcher { actions.onTextChanged(it) })
        emailField.addTextChangedListener(watcher { actions.onEmailChanged(it) })
    }

    fun render(state: FeedbackState) {
        val form = state.form
        formGroup.visibility = if (form == null) View.GONE else View.VISIBLE
        sentGroup.visibility = if (state is FeedbackState.Sent) View.VISIBLE else View.GONE
        if (state is FeedbackState.Sent) renderSent(state)
        if (form != null) renderForm(state, form)
    }

    private fun renderForm(state: FeedbackState, form: FeedbackState.Editable) {
        val draft = form.draft
        val interactive = state is FeedbackState.Editable || state is FeedbackState.Failed
        kindButtons.forEach { (kind, button) ->
            button.applyStyle(if (kind == draft.kind) ButtonStyle.Selected else ButtonStyle.Secondary, p)
            button.setEnabledDimmed(interactive)
        }
        syncText(textField, draft.text)
        syncText(emailField, draft.email)
        textField.isEnabled = interactive
        emailField.isEnabled = interactive

        val screenshot = (form as? FeedbackState.WithScreenshot)?.bitmap
        screenshotBlock.visibility = if (screenshot == null) View.GONE else View.VISIBLE
        if (screenshot !== shownScreenshot) thumbnail.setImageBitmap(screenshot)
        shownScreenshot = screenshot
        removeButton.setEnabledDimmed(interactive)
        attachButton.text = if (screenshot == null) "Attach screenshot" else "Retake screenshot"
        attachButton.setEnabledDimmed(interactive)
        recordButton.setEnabledDimmed(interactive && recordingAvailable)

        renderStatus(state)
        sendButton.text = if (state is FeedbackState.Failed) "Try again" else "Send"
        sendButton.setEnabledDimmed(interactive && draft.canSend)
        cancelButton.setEnabledDimmed(state !is FeedbackState.Uploading)
    }

    private fun renderStatus(state: FeedbackState) {
        progress.visibility = if (state is FeedbackState.Uploading) View.VISIBLE else View.GONE
        statusLine.visibility = View.VISIBLE
        when (state) {
            is FeedbackState.Uploading -> statusLine.setStatus("Sending…", p.muted)
            is FeedbackState.Failed -> statusLine.setStatus(state.error, p.error)
            else -> statusLine.visibility = View.GONE
        }
    }

    private fun renderSent(state: FeedbackState.Sent) {
        val url = state.issueUrl
        thanks.text = if (url != null) "Thank you! Tracked on GitHub" else "Thank you! Your feedback was received."
        issueLink.visibility = if (url != null) View.VISIBLE else View.GONE
        issueLink.text = url.orEmpty()
        issueLink.setOnClickListener { url?.let(actions::onOpenIssue) }
    }

    private fun buildForm(): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(context.label("Send feedback", 20f, p.onSurface, bold = true))
        addView(context.row(*kindButtons.values.toTypedArray()), topSpaced(16))
        addView(textField, topSpaced(14))
        addView(emailField, topSpaced(10))
        addView(context.row(attachButton, recordButton), topSpaced(14))
        addView(screenshotBlock, topSpaced(12))
        addView(context.row(progress, statusLine, weighted = false), topSpaced(12))
        addView(context.row(cancelButton, sendButton), topSpaced(18))
    }

    private fun buildSent(): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        visibility = View.GONE
        addView(thanks)
        addView(issueLink)
        addView(doneButton, topSpaced(12))
    }

    private fun field(hint: String, multiline: Boolean): EditText = EditText(context).apply {
        this.hint = hint
        setHintTextColor(p.muted)
        setTextColor(p.onSurface)
        textSize = 15f
        background = context.roundedRect(p.field, 12, p.outline)
        setPadding(context.dp(14), context.dp(12), context.dp(14), context.dp(12))
        if (multiline) {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 3
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            filters = arrayOf(InputFilter.LengthFilter(FeedbackLimits.MAX_TEXT_CHARS))
        } else {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            maxLines = 1
        }
    }

    private fun topSpaced(dp: Int) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = context.dp(dp) }

    private fun syncText(field: EditText, value: String) {
        if (field.text.toString() != value) field.setText(value)
    }

    private fun TextView.setStatus(message: String, color: Int) {
        text = message
        setTextColor(color)
    }

    private fun watcher(onChange: (String) -> Unit) = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = onChange(s.toString())
        override fun afterTextChanged(s: Editable?) = Unit
    }
}
