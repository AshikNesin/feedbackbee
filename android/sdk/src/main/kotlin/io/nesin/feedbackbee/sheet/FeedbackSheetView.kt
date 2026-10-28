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
import androidx.core.view.ViewCompat
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
}

/** Pure projection of [FeedbackState]: three screens (pick a kind, write the note, done) sharing one panel. */
internal class FeedbackSheetView(
    context: Context,
    private val actions: SheetActions,
) : ScrollView(context) {

    private var shownScreenshot: Bitmap? = null

    private val backButton = iconButton(R.drawable.fbb_ic_back, "Back").apply { setOnClickListener { actions.onBack() } }
    private val closeButton = iconButton(R.drawable.fbb_ic_close, "Close").apply { setOnClickListener { actions.onClose() } }
    private val title = context.label("", 18f, Theme.Ink, bold = true).apply {
        gravity = Gravity.CENTER_VERTICAL
        maxLines = 2
        letterSpacing = -0.02f
        ViewCompat.setAccessibilityHeading(this, true)
    }
    private val subtitle = context.label("", 13f, Theme.Muted)

    private val chooseGroup = buildChooseGroup()

    private val noteField = field(hint = "What happened? What did you expect?", multiline = true)
    private val emailField = field(hint = "you@example.com", multiline = false)
    private val screenshotImage = ImageView(context).apply {
        scaleType = ImageView.ScaleType.FIT_CENTER
        contentDescription = "Annotated screenshot"
        background = context.roundedRect(Theme.Tile, 10, strokeDp = 1f, stroke = Theme.Border)
        clipRounded(10)
    }
    private val removeScreenshot = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_close)
        setColorFilter(Theme.TileInk)
        setPadding(context.dp(14), context.dp(14), context.dp(14), context.dp(14))
        background = context.ripple(context.roundedRect(Theme.Panel, 10))
        contentDescription = "Remove screenshot"
        setOnClickListener { actions.onRemoveScreenshot() }
    }
    private val screenshotBlock = FrameLayout(context).apply {
        visibility = View.GONE
        addView(screenshotImage, FrameLayout.LayoutParams(MATCH_PARENT, context.dp(SCREENSHOT_HEIGHT_DP)))
        addView(removeScreenshot, FrameLayout.LayoutParams(context.dp(48), context.dp(48), Gravity.TOP or Gravity.END).apply {
            setMargins(0, context.dp(4), context.dp(4), 0)
        })
    }
    private val errorLine = context.label("", 13f, Theme.Error).apply {
        visibility = View.GONE
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    private val cameraButton = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_camera)
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(14), context.dp(14), context.dp(14), context.dp(14))
        setColorFilter(Theme.TileInk)
        background = context.ripple(context.roundedRect(Theme.Panel, 10, strokeDp = 1f, stroke = Theme.Border))
        contentDescription = "Attach a screenshot"
        setOnClickListener { actions.onAttachScreenshot() }
    }
    private val micButton = ImageButton(context).apply {
        setImageResource(R.drawable.fbb_ic_mic)
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(14), context.dp(14), context.dp(14), context.dp(14))
        setColorFilter(Theme.TileInk)
        background = context.ripple(context.roundedRect(Theme.Panel, 10, strokeDp = 1f, stroke = Theme.Border))
        contentDescription = "Record voice note"
        setOnClickListener { actions.onVoiceClicked() }
    }
    private val voiceTimer = context.label("Voice note · 0:00 / 5:00", 12f, Theme.TileInk).apply { fontFeatureSettings = "tnum" }
    private val stopVoiceButton = compactButton("Stop").apply {
        setTextColor(Theme.Error)
        setOnClickListener { actions.onStopVoice() }
    }
    private val voiceRecordingBlock = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        visibility = View.GONE
        background = context.roundedRect(Theme.Tile, 10)
        setPadding(context.dp(12), context.dp(4), context.dp(4), context.dp(4))
        addView(View(context).apply { background = context.roundedRect(Theme.Error, 4) },
            LinearLayout.LayoutParams(context.dp(7), context.dp(7)).apply { marginEnd = context.dp(8) })
        addView(voiceTimer, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        addView(stopVoiceButton, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
    }
    private val voiceDuration = context.label("", 12f, Theme.TileInk)
    private val rerecordVoiceButton = compactButton("Re-record").apply { setOnClickListener { actions.onVoiceClicked() } }
    private val removeVoiceButton = iconButton(R.drawable.fbb_ic_close, "Remove voice note").apply {
        setOnClickListener { actions.onRemoveVoice() }
    }
    private val voiceAttachmentBlock = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        visibility = View.GONE
        background = context.roundedRect(Theme.Tile, 10)
        setPadding(context.dp(12), context.dp(4), context.dp(4), context.dp(4))
        addView(voiceDuration, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        addView(rerecordVoiceButton, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        addView(removeVoiceButton, LinearLayout.LayoutParams(context.dp(48), context.dp(48)))
    }
    private val voiceHint = context.label("", 12f, Theme.TileInk).apply {
        visibility = View.GONE
        setPadding(context.dp(4), context.dp(5), context.dp(4), 0)
    }
    private var voicePermissionDenied = false
    private val sendButton = buildSendButton()
    private val formGroup = buildFormGroup()

    private val doneHeadline = context.label("Feedback sent", 18f, Theme.Ink, bold = true).apply {
        gravity = Gravity.CENTER
        ViewCompat.setAccessibilityHeading(this, true)
    }
    private val doneDetail = context.label("", 13f, Theme.Muted).apply {
        gravity = Gravity.CENTER
        minimumHeight = context.dp(48)
        setPadding(0, context.dp(6), 0, context.dp(6))
    }
    private val doneGroup = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        visibility = View.GONE
        setPadding(0, context.dp(8), 0, context.dp(16))
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        addView(ImageView(context).apply {
            setImageResource(R.drawable.fbb_ic_check)
            setColorFilter(Theme.Ink)
            setPadding(context.dp(12), context.dp(12), context.dp(12), context.dp(12))
            background = context.roundedRect(Theme.Tile, 24)
        }, LinearLayout.LayoutParams(context.dp(48), context.dp(48)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = context.dp(16)
        })
        addView(doneHeadline, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(doneDetail, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    init {
        clipToPadding = false
        background = GradientDrawable().apply {
            setColor(Theme.Panel)
            val r = context.dpF(20f)
            cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(context.dp(20), context.dp(12), context.dp(20), context.dp(22))
            addView(buildHeader(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(subtitle, spaced(top = 2).apply { bottomMargin = context.dp(20) })
            addView(chooseGroup, spaced(top = 0))
            addView(formGroup, spaced(top = 0))
            addView(doneGroup, spaced(top = 0))
            addView(buildFooter(), spaced(top = 18))
        })
        noteField.addTextChangedListener(watcher { actions.onTextChanged(it) })
        emailField.addTextChangedListener(watcher { actions.onEmailChanged(it) })
    }

    fun render(state: FeedbackState) {
        when (state) {
            is FeedbackState.Choosing -> renderChoose()
            is FeedbackState.Sent -> renderDone()
            else -> renderForm(state)
        }
        closeButton.isEnabled = state !is FeedbackState.Uploading
        closeButton.alpha = if (closeButton.isEnabled) 1f else DISABLED_ALPHA
    }

    private fun renderChoose() {
        showOnly(chooseGroup)
        title.text = "Share feedback"
        subtitle.text = "A little feedback goes a long way."
        subtitle.visibility = View.VISIBLE
        backButton.visibility = View.GONE
        dismissKeyboard()
    }

    private fun renderDone() {
        showOnly(doneGroup)
        title.text = "Share feedback"
        subtitle.visibility = View.GONE
        backButton.visibility = View.GONE
        dismissKeyboard()
        doneDetail.text = "Thanks for helping us make things better."
    }

    private fun renderForm(state: FeedbackState) {
        val form = checkNotNull(state.form) { "A form state always has a form" }
        val draft = form.draft
        val interactive = state is FeedbackState.Editable || state is FeedbackState.Failed
        showOnly(formGroup)
        title.text = draft.kind.formTitle
        subtitle.text = "We're listening. Tell us a little more."
        subtitle.visibility = View.VISIBLE
        noteField.hint = when (draft.kind) {
            FeedbackKind.Issue -> "What happened? What did you expect?"
            FeedbackKind.FeatureRequest -> "What would make this better for you?"
            FeedbackKind.Other -> "What's on your mind?"
        }
        backButton.visibility = View.VISIBLE
        backButton.isEnabled = interactive
        backButton.alpha = if (interactive) 1f else DISABLED_ALPHA

        syncText(noteField, draft.text)
        syncText(emailField, draft.email)
        noteField.isEnabled = interactive
        emailField.isEnabled = interactive && !draft.emailLocked
        emailField.hint = if (draft.emailLocked) draft.email else "you@example.com"
        emailLabel.text = if (draft.emailLocked) "Email (from your account)" else "Email (optional)"
        backButton.visibility = if (draft.kindLocked) View.GONE else View.VISIBLE

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

    private fun buildHeader() = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = context.dp(48)
        val side = context.dp(HEADER_BUTTON_DP)
        addView(backButton, LinearLayout.LayoutParams(side, side))
        addView(title, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        addView(closeButton, LinearLayout.LayoutParams(side, side))
    }

    private fun buildChooseGroup() = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val tiles = listOf(
            kindTile(FeedbackKind.Issue, R.drawable.fbb_ic_issue, "Something isn't working as expected"),
            kindTile(FeedbackKind.FeatureRequest, R.drawable.fbb_ic_idea, "A small improvement or a big idea"),
            kindTile(FeedbackKind.Other, R.drawable.fbb_ic_other, "Anything else on your mind"),
        )
        tiles.forEachIndexed { index, tile ->
            addView(tile, spaced(top = if (index > 0) 8 else 0))
        }
    }

    private fun kindTile(kind: FeedbackKind, icon: Int, detail: String) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = context.dp(72)
        setPadding(context.dp(12), context.dp(12), context.dp(12), context.dp(12))
        background = context.ripple(context.roundedRect(Theme.Panel, 12, strokeDp = 1f, stroke = Theme.Border))
        isClickable = true
        isFocusable = true
        val heading = if (kind == FeedbackKind.Other) "Something else" else kind.formTitle
        contentDescription = "$heading. $detail"
        setOnClickListener { actions.onKindSelected(kind) }
        addView(ImageView(context).apply {
            setImageResource(icon)
            setColorFilter(Theme.Ink)
            setPadding(context.dp(8), context.dp(8), context.dp(8), context.dp(8))
            background = context.roundedRect(Theme.Tile, 9)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(context.dp(36), context.dp(36)))
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            addView(context.label(heading, 14f, Theme.Ink, bold = true))
            addView(context.label(detail, 12f, Theme.Muted), spaced(top = 2))
        }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginStart = context.dp(12) })
        addView(ImageView(context).apply {
            setImageResource(R.drawable.fbb_ic_chevron)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(context.dp(16), context.dp(16)).apply {
            marginStart = context.dp(8)
        })
    }

    private val emailLabel = fieldLabel("Email (optional)", emailField)

    private fun buildFormGroup() = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(fieldLabel("Your feedback", noteField), spaced(top = 0).apply { bottomMargin = context.dp(7) })
        addView(noteField, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(emailLabel, spaced(top = 14).apply { bottomMargin = context.dp(7) })
        addView(emailField, spaced(top = 0))
        addView(screenshotBlock, spaced(top = 12))
        addView(voiceRecordingBlock, spaced(top = 12))
        addView(voiceAttachmentBlock, spaced(top = 12))
        addView(voiceHint, spaced(top = 2))
        addView(errorLine, spaced(top = 10))
        addView(LinearLayout(context).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(context.label("Add context", 12f, Theme.Muted), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            addView(cameraButton, LinearLayout.LayoutParams(context.dp(48), context.dp(48)))
            addView(micButton, LinearLayout.LayoutParams(context.dp(48), context.dp(48)).apply { marginStart = context.dp(6) })
        }, spaced(top = 12))
        addView(sendButton, spaced(top = 14))
    }

    private fun fieldLabel(text: String, field: EditText) = context.label(text, 12f, Theme.TileInk, bold = true).apply {
        labelFor = field.id
    }

    private fun compactButton(label: String) = Button(context).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minimumHeight = context.dp(48)
        setPadding(context.dp(8), 0, context.dp(8), 0)
        textSize = 12f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(Theme.TileInk)
        background = context.ripple(context.roundedRect(Theme.Tile, 8))
    }

    private fun buildSendButton() = Button(context).apply {
        isAllCaps = false
        stateListAnimator = null
        minWidth = 0
        minHeight = context.dp(48)
        setPadding(context.dp(12), context.dp(10), context.dp(12), context.dp(10))
        textSize = 14f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(ColorStateList(arrayOf(intArrayOf(android.R.attr.state_enabled), intArrayOf()), intArrayOf(Color.WHITE, Theme.Muted)))
        background = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_enabled), context.ripple(context.roundedRect(Theme.Ink, 10)))
            addState(intArrayOf(), context.roundedRect(Theme.Tile, 10))
        }
        setOnClickListener { actions.onSend() }
    }

    private fun buildFooter(): TextView = context.label(footerText(), 11f, Theme.Muted).apply { gravity = Gravity.CENTER }

    private fun footerText() = SpannableString("Powered by FeedbackBee").apply {
        val start = indexOf("FeedbackBee")
        setSpan(ForegroundColorSpan(Theme.TileInk), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        setSpan(StyleSpan(Typeface.BOLD), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    private fun field(hint: CharSequence, multiline: Boolean): EditText = EditText(context).apply {
        id = View.generateViewId()
        this.hint = hint
        setHintTextColor(Theme.Muted)
        setTextColor(Theme.Ink)
        background = fieldBackground()
        if (multiline) {
            textSize = 16f
            setPadding(context.dp(12), context.dp(11), context.dp(12), context.dp(11))
            minHeight = context.dp(128)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            filters = arrayOf(InputFilter.LengthFilter(FeedbackLimits.MAX_TEXT_CHARS))
        } else {
            textSize = 16f
            minimumHeight = context.dp(48)
            setPadding(context.dp(12), context.dp(11), context.dp(12), context.dp(11))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setSingleLine(true)
        }
    }

    private fun fieldBackground(): Drawable = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), context.roundedRect(Theme.Panel, 10, strokeDp = 2f, stroke = Theme.Focus))
        addState(intArrayOf(), context.roundedRect(Theme.Panel, 10, strokeDp = 1f, stroke = Theme.Border))
    }

    private fun iconButton(icon: Int, description: String) = ImageButton(context).apply {
        setImageResource(icon)
        setColorFilter(Theme.Muted)
        contentDescription = description
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(context.dp(14), context.dp(14), context.dp(14), context.dp(14))
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
            voiceTimer.text = voiceTimerText(startedAt)
            postDelayed(this, 1_000L)
        }
    }

    private var recordingStartedAt: Long? = null

    private fun updateVoiceTimer(startedAt: Long) {
        recordingStartedAt = startedAt
        voiceTimer.text = voiceTimerText(startedAt)
        removeCallbacks(updateTimer)
        post(updateTimer)
    }

    private fun voiceTimerText(startedAt: Long): String =
        "Voice note · ${formatVoiceDuration(((SystemClock.elapsedRealtime() - startedAt) / 1_000L).toInt())} / 5:00"

    override fun onDetachedFromWindow() {
        removeCallbacks(updateTimer)
        super.onDetachedFromWindow()
    }

    private companion object {
        const val HEADER_BUTTON_DP = 48
        const val SCREENSHOT_HEIGHT_DP = 160
        const val DISABLED_ALPHA = 0.4f
    }
}
