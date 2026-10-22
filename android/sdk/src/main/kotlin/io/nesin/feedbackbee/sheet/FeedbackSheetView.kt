package io.nesin.feedbackbee.sheet

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.SystemClock
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.SpannableString
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.ViewOutlineProvider
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import io.nesin.feedbackbee.FeedbackKind
import io.nesin.feedbackbee.FeedbackLimits
import io.nesin.feedbackbee.FeedbackState
import io.nesin.feedbackbee.R
import io.nesin.feedbackbee.form
import io.nesin.feedbackbee.record.formatVoiceDuration
import io.nesin.feedbackbee.ui.Theme
import io.nesin.feedbackbee.ui.dp
import io.nesin.feedbackbee.ui.dpF
import io.nesin.feedbackbee.ui.label
import io.nesin.feedbackbee.ui.ripple
import io.nesin.feedbackbee.ui.roundedRect

internal interface SheetActions {
    fun onKindSelected(kind: FeedbackKind)
    fun onBack()
    fun onTextChanged(text: String)
    fun onEmailChanged(email: String)
    fun onAttachScreenshot()
    fun onRemoveScreenshot()
    fun onVoiceClicked()
    fun onStopVoice()
    fun onRemoveVoice()
    fun onSend()
    fun onClose()
    fun onOpenIssue(url: String)
}

/** Pure projection of [FeedbackState]: three screens (pick a kind, write the note, done) sharing one panel. */
internal class FeedbackSheetView(
    context: Context,
    private val actions: SheetActions,
) : ScrollView(context) {

    private var shownScreenshot: Bitmap? = null

    private val backButton = iconButton(R.drawable.fbb_ic_back, "Back").apply { setOnClickListener { actions.onBack() } }
    private val closeButton = iconButton(R.drawable.fbb_ic_close, "Close").apply { setOnClickListener { actions.onClose() } }
    private val title = context.label("", 17f, Theme.Ink, bold = true).apply {
        gravity = Gravity.CENTER
        maxLines = 1
    }

    private val chooseGroup = buildChooseGroup()

    private val noteField = field(hint = "I noticed that...", multiline = true)
    private val emailField = field(hint = "Email (optional)", multiline = false)
    private val screenshotImage = ImageView(context).apply {
        scaleType = ImageView.ScaleType.FIT_CENTER
        contentDescription = "Annotated screenshot"
        background = context.roundedRect(Theme.Tile, 16)
        clipRounded(16)
    }
    private val removeScreenshot = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_close)
        setColorFilter(Color.WHITE)
        setPadding(context.dp(7), context.dp(7), context.dp(7), context.dp(7))
        background = context.roundedRect(Color.argb(210, 45, 62, 80), 14)
        contentDescription = "Remove screenshot"
        setOnClickListener { actions.onRemoveScreenshot() }
    }
    private val screenshotBlock = FrameLayout(context).apply {
        visibility = View.GONE
        addView(screenshotImage, FrameLayout.LayoutParams(MATCH_PARENT, context.dp(SCREENSHOT_HEIGHT_DP)))
        addView(removeScreenshot, FrameLayout.LayoutParams(context.dp(28), context.dp(28), Gravity.TOP or Gravity.END).apply {
            setMargins(0, context.dp(8), context.dp(8), 0)
        })
    }
    private val errorLine = context.label("", 13f, Theme.Error).apply { visibility = View.GONE }
    private val cameraButton = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_camera)
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(25), context.dp(13), context.dp(25), context.dp(13))
        background = context.ripple(context.roundedRect(Theme.Tile, 15))
        setOnClickListener { actions.onAttachScreenshot() }
    }
    private val micButton = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_mic)
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(13), context.dp(13), context.dp(13), context.dp(13))
        background = context.ripple(context.roundedRect(Theme.Tile, 15))
        contentDescription = "Record voice note"
        setOnClickListener { actions.onVoiceClicked() }
    }
    private val voiceTimer = context.label("0:00", 14f, Theme.Ink, bold = true)
    private val stopVoiceButton = compactButton("Stop").apply { setOnClickListener { actions.onStopVoice() } }
    private val voiceRecordingBlock = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        visibility = View.GONE
        addView(voiceTimer, LinearLayout.LayoutParams(0, context.dp(44), 1f))
        addView(stopVoiceButton, LinearLayout.LayoutParams(WRAP_CONTENT, context.dp(44)))
    }
    private val voiceDuration = context.label("", 13.5f, Theme.TileInk, bold = true)
    private val rerecordVoiceButton = compactButton("Re-record").apply { setOnClickListener { actions.onVoiceClicked() } }
    private val removeVoiceButton = compactButton("Delete").apply { setOnClickListener { actions.onRemoveVoice() } }
    private val voiceAttachmentBlock = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        visibility = View.GONE
        addView(voiceDuration, LinearLayout.LayoutParams(0, context.dp(44), 1f))
        addView(rerecordVoiceButton, LinearLayout.LayoutParams(WRAP_CONTENT, context.dp(44)))
        addView(removeVoiceButton, LinearLayout.LayoutParams(WRAP_CONTENT, context.dp(44)).apply { marginStart = context.dp(4) })
    }
    private val voiceHint = context.label("", 12f, Theme.TileInk).apply {
        visibility = View.GONE
        setPadding(context.dp(4), context.dp(5), context.dp(4), 0)
    }
    private var voicePermissionDenied = false
    private val sendButton = buildSendButton()
    private val formGroup = buildFormGroup()

    private val doneHeadline = context.label("Thank you!", 16f, Theme.Ink, bold = true).apply { gravity = Gravity.CENTER }
    private val doneDetail = context.label("", 13.5f, Theme.TileInk).apply {
        gravity = Gravity.CENTER
        setPadding(0, context.dp(6), 0, context.dp(6))
    }
    private val doneGroup = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        visibility = View.GONE
        setPadding(0, context.dp(10), 0, context.dp(4))
        addView(doneHeadline, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(doneDetail, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    init {
        clipToPadding = false
        background = GradientDrawable().apply {
            setColor(Theme.Panel)
            val r = context.dpF(28f)
            cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(context.dp(22), context.dp(14), context.dp(22), context.dp(22))
            addView(buildHeader(), LinearLayout.LayoutParams(MATCH_PARENT, context.dp(40)))
            addView(chooseGroup, spaced(top = 6))
            addView(formGroup, spaced(top = 6))
            addView(doneGroup, spaced(top = 6))
            addView(buildFooter(), spaced(top = 14))
        })
        noteField.addTextChangedListener(watcher { actions.onTextChanged(it) })
        emailField.addTextChangedListener(watcher { actions.onEmailChanged(it) })
    }

    fun render(state: FeedbackState) {
        when (state) {
            is FeedbackState.Choosing -> renderChoose()
            is FeedbackState.Sent -> renderDone(state)
            else -> renderForm(state)
        }
        closeButton.isEnabled = state !is FeedbackState.Uploading
        closeButton.alpha = if (closeButton.isEnabled) 1f else DISABLED_ALPHA
    }

    private fun renderChoose() {
        showOnly(chooseGroup)
        title.text = "What's on your mind?"
        backButton.visibility = View.INVISIBLE
        dismissKeyboard()
    }

    private fun renderDone(state: FeedbackState.Sent) {
        showOnly(doneGroup)
        title.text = ""
        backButton.visibility = View.INVISIBLE
        dismissKeyboard()
        val url = state.issueUrl
        doneDetail.text = if (url != null) "Tracked on GitHub →" else "We received your report."
        doneDetail.setTextColor(if (url != null) Theme.Focus else Theme.TileInk)
        doneDetail.setOnClickListener(if (url != null) View.OnClickListener { actions.onOpenIssue(url) } else null)
        doneDetail.isClickable = url != null
    }

    private fun renderForm(state: FeedbackState) {
        val form = checkNotNull(state.form) { "A form state always has a form" }
        val draft = form.draft
        val interactive = state is FeedbackState.Editable || state is FeedbackState.Failed
        showOnly(formGroup)
        title.text = draft.kind.formTitle
        backButton.visibility = View.VISIBLE
        backButton.isEnabled = interactive
        backButton.alpha = if (interactive) 1f else DISABLED_ALPHA

        syncText(noteField, draft.text)
        syncText(emailField, draft.email)
        noteField.isEnabled = interactive
        emailField.isEnabled = interactive

        val screenshot = (form as? FeedbackState.WithScreenshot)?.bitmap
        screenshotBlock.visibility = if (screenshot == null) View.GONE else View.VISIBLE
        if (screenshot !== shownScreenshot) screenshotImage.setImageBitmap(screenshot)
        shownScreenshot = screenshot
        removeScreenshot.isEnabled = interactive
        cameraButton.contentDescription = if (screenshot == null) "Attach screenshot" else "Retake screenshot"
        cameraButton.isEnabled = interactive
        cameraButton.alpha = if (interactive) 1f else DISABLED_ALPHA
        val audio = draft.audio
        micButton.isEnabled = interactive && !voicePermissionDenied
        micButton.alpha = if (micButton.isEnabled) 1f else DISABLED_ALPHA
        voiceRecordingBlock.visibility = if (state is FeedbackState.RecordingAudio) View.VISIBLE else View.GONE
        voiceAttachmentBlock.visibility = if (audio != null && state !is FeedbackState.RecordingAudio) View.VISIBLE else View.GONE
        micButton.visibility = if (audio == null && state !is FeedbackState.RecordingAudio) View.VISIBLE else View.GONE
        if (state is FeedbackState.RecordingAudio) {
            updateVoiceTimer(state.startedAtElapsedMs)
        } else {
            removeCallbacks(updateTimer)
        }
        voiceDuration.text = audio?.let { "Voice note · ${formatVoiceDuration(it.seconds)}" }.orEmpty()
        val controlsEnabled = interactive && state !is FeedbackState.RecordingAudio
        rerecordVoiceButton.isEnabled = controlsEnabled
        removeVoiceButton.isEnabled = controlsEnabled
        rerecordVoiceButton.alpha = if (controlsEnabled) 1f else DISABLED_ALPHA
        removeVoiceButton.alpha = if (controlsEnabled) 1f else DISABLED_ALPHA
        stopVoiceButton.isEnabled = state is FeedbackState.RecordingAudio
        stopVoiceButton.alpha = if (stopVoiceButton.isEnabled) 1f else DISABLED_ALPHA

        errorLine.visibility = if (state is FeedbackState.Failed) View.VISIBLE else View.GONE
        if (state is FeedbackState.Failed) errorLine.text = state.error
        sendButton.text = if (state is FeedbackState.Uploading) "Sending…" else "Send feedback"
        sendButton.isEnabled = interactive && draft.canSend
    }

    fun setVoicePermissionDenied(denied: Boolean) {
        voicePermissionDenied = denied
        voiceHint.visibility = if (denied) View.VISIBLE else View.GONE
        voiceHint.text = if (denied) "Microphone access is off. Enable it in Settings to record a voice note." else ""
        if (denied) {
            micButton.isEnabled = false
            micButton.alpha = DISABLED_ALPHA
            micButton.contentDescription = "Voice notes unavailable: microphone permission denied"
        } else {
            micButton.contentDescription = "Record voice note"
        }
    }

    private fun showOnly(group: View) {
        chooseGroup.visibility = if (group === chooseGroup) View.VISIBLE else View.GONE
        formGroup.visibility = if (group === formGroup) View.VISIBLE else View.GONE
        doneGroup.visibility = if (group === doneGroup) View.VISIBLE else View.GONE
    }

    private fun buildHeader() = FrameLayout(context).apply {
        val side = context.dp(HEADER_BUTTON_DP)
        val bleed = -context.dp(8)
        addView(title, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT).apply {
            marginStart = side
            marginEnd = side
        })
        addView(backButton, FrameLayout.LayoutParams(side, side, Gravity.CENTER_VERTICAL or Gravity.START).apply { marginStart = bleed })
        addView(closeButton, FrameLayout.LayoutParams(side, side, Gravity.CENTER_VERTICAL or Gravity.END).apply { marginEnd = bleed })
    }

    private fun buildChooseGroup() = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        val tiles = listOf(
            kindTile(FeedbackKind.Issue, R.drawable.fbb_ic_issue),
            kindTile(FeedbackKind.Idea, R.drawable.fbb_ic_idea),
            kindTile(FeedbackKind.Other, R.drawable.fbb_ic_other),
        )
        tiles.forEachIndexed { index, tile ->
            addView(tile, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { if (index > 0) marginStart = context.dp(10) })
        }
    }

    private fun kindTile(kind: FeedbackKind, icon: Int) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(context.dp(6), context.dp(16), context.dp(6), context.dp(14))
        background = context.ripple(context.roundedRect(Theme.Tile, 18))
        isClickable = true
        isFocusable = true
        setOnClickListener { actions.onKindSelected(kind) }
        addView(ImageView(context).apply { setImageResource(icon) }, LinearLayout.LayoutParams(context.dp(26), context.dp(26)))
        addView(context.label(kind.label, 14f, Theme.TileInk, bold = true), LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
            topMargin = context.dp(8)
        })
    }

    private fun buildFormGroup() = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(noteField, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(emailField, spaced(top = 10))
        addView(screenshotBlock, spaced(top = 10))
        addView(voiceRecordingBlock, spaced(top = 10))
        addView(voiceAttachmentBlock, spaced(top = 10))
        addView(voiceHint, spaced(top = 2))
        addView(errorLine, spaced(top = 10))
        addView(LinearLayout(context).apply {
            addView(cameraButton, LinearLayout.LayoutParams(context.dp(52), context.dp(48)))
            addView(micButton, LinearLayout.LayoutParams(context.dp(52), context.dp(48)).apply { marginStart = context.dp(8) })
            addView(sendButton, LinearLayout.LayoutParams(0, context.dp(48), 1f).apply { marginStart = context.dp(8) })
        }, spaced(top = 12))
    }

    private fun compactButton(label: String) = Button(context).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        setPadding(context.dp(8), 0, context.dp(8), 0)
        textSize = 12f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setTextColor(Theme.TileInk)
        background = context.ripple(context.roundedRect(Theme.Tile, 12))
    }

    private fun buildSendButton() = Button(context).apply {
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        setPadding(0, 0, 0, 0)
        textSize = 14.5f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setTextColor(ColorStateList(arrayOf(intArrayOf(android.R.attr.state_enabled), intArrayOf()), intArrayOf(Color.WHITE, Theme.Muted)))
        background = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_enabled), context.ripple(context.roundedRect(Theme.Ink, 15)))
            addState(intArrayOf(), context.roundedRect(Theme.Tile, 15))
        }
        setOnClickListener { actions.onSend() }
    }

    private fun buildFooter(): TextView = context.label(footerText(), 11.5f, Theme.Muted).apply { gravity = Gravity.CENTER }

    private fun footerText() = SpannableString("Widget by FeedbackBee").apply {
        val start = indexOf("FeedbackBee")
        setSpan(ForegroundColorSpan(Theme.TileInk), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        setSpan(StyleSpan(Typeface.BOLD), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    private fun field(hint: CharSequence, multiline: Boolean): EditText = EditText(context).apply {
        this.hint = if (multiline) boldHint(hint) else hint
        setHintTextColor(Theme.Muted)
        setTextColor(Theme.Ink)
        background = fieldBackground()
        if (multiline) {
            textSize = 15f
            setPadding(context.dp(16), context.dp(14), context.dp(16), context.dp(14))
            minHeight = context.dp(96)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            filters = arrayOf(InputFilter.LengthFilter(FeedbackLimits.MAX_TEXT_CHARS))
        } else {
            textSize = 14f
            setPadding(context.dp(16), context.dp(11), context.dp(16), context.dp(11))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            maxLines = 1
        }
    }

    private fun boldHint(text: CharSequence) = SpannableString(text).apply {
        setSpan(StyleSpan(Typeface.BOLD), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    private fun fieldBackground(): Drawable = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), context.roundedRect(Theme.Tile, 22, strokeDp = 2.5f, stroke = Theme.Focus))
        addState(intArrayOf(), context.roundedRect(Theme.Tile, 22))
    }

    private fun iconButton(icon: Int, description: String) = ImageButton(context).apply {
        setImageResource(icon)
        contentDescription = description
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(9), context.dp(9), context.dp(9), context.dp(9))
        val ripple = TypedValue()
        context.theme.resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, ripple, true)
        setBackgroundResource(ripple.resourceId)
    }

    private fun View.clipRounded(radiusDp: Int) {
        val radius = context.dpF(radiusDp.toFloat())
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
        clipToOutline = true
    }

    private fun dismissKeyboard() {
        noteField.clearFocus()
        emailField.clearFocus()
        context.getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(windowToken, 0)
    }

    private fun spaced(top: Int) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = context.dp(top) }

    private fun syncText(field: EditText, value: String) {
        if (field.text.toString() != value) field.setText(value)
    }

    private fun watcher(onChange: (String) -> Unit) = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = onChange(s.toString())
        override fun afterTextChanged(s: Editable?) = Unit
    }

    private val updateTimer = object : Runnable {
        override fun run() {
            if (voiceRecordingBlock.visibility != View.VISIBLE) return
            val startedAt = recordingStartedAt ?: return
            voiceTimer.text = formatVoiceDuration(((SystemClock.elapsedRealtime() - startedAt) / 1_000L).toInt())
            postDelayed(this, 1_000L)
        }
    }

    private var recordingStartedAt: Long? = null

    private fun updateVoiceTimer(startedAt: Long) {
        recordingStartedAt = startedAt
        voiceTimer.text = formatVoiceDuration(((SystemClock.elapsedRealtime() - startedAt) / 1_000L).toInt())
        removeCallbacks(updateTimer)
        post(updateTimer)
    }

    private companion object {
        const val HEADER_BUTTON_DP = 40
        const val SCREENSHOT_HEIGHT_DP = 160
        const val DISABLED_ALPHA = 0.4f
    }
}
