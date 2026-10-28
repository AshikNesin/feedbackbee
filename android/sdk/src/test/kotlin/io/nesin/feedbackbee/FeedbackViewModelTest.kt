package io.nesin.feedbackbee

import io.nesin.feedbackbee.FeedbackState.Choosing
import io.nesin.feedbackbee.FeedbackState.Draft
import io.nesin.feedbackbee.FeedbackState.RecordingAudio
import io.nesin.feedbackbee.record.VoiceRecording
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class FeedbackViewModelTest {

    private val viewModel = FeedbackViewModel()

    @Test
    fun startsOnTheKindPickerWithAnEmptyDraft() {
        val state = viewModel.state.value
        assertTrue(state is Choosing)
        assertEquals(Draft(), (state as Choosing).from)
    }

    @Test
    fun pickingAKindOpensTheFormForThatKind() {
        viewModel.chooseKind(FeedbackKind.FeatureRequest)
        assertEquals(Draft(kind = FeedbackKind.FeatureRequest), viewModel.state.value)
    }

    @Test
    fun openOptionsPrefillAndLockTheForm() {
        Reporter.identify(email = "jane@acme.com", name = "Jane", id = "u_123")
        try {
            viewModel.applyOptions(OpenOptions(kind = FeedbackKind.Issue, lockKind = true, text = "It broke"))
            val draft = viewModel.state.value as Draft
            assertEquals(FeedbackKind.Issue, draft.kind)
            assertEquals("It broke", draft.text)
            assertEquals("jane@acme.com", draft.email)
            assertEquals(true, draft.emailLocked)
            assertEquals(true, draft.kindLocked)

            viewModel.backToKindPicker()
            assertEquals(Draft("It broke", FeedbackKind.Issue, "jane@acme.com", emailLocked = true, kindLocked = true), viewModel.state.value)
        } finally {
            Reporter.reset()
        }
    }

    @Test
    fun applyOptionsOnlyPrefillsAVirginSheet() {
        Reporter.identify(email = "jane@acme.com", name = null, id = null)
        try {
            viewModel.chooseKind(FeedbackKind.Issue)
            viewModel.editDraft { it.copy(text = "already typed") }
            viewModel.applyOptions(OpenOptions(text = "ignored"))
            val draft = viewModel.state.value as Draft
            assertEquals("already typed", draft.text)
        } finally {
            Reporter.reset()
        }
    }

    @Test
    fun backKeepsTheTypedNoteAndEmail() {
        viewModel.chooseKind(FeedbackKind.Issue)
        viewModel.editDraft { it.copy(text = "Checkout is cut off", email = "a@b.co") }
        viewModel.backToKindPicker()
        assertTrue(viewModel.state.value is Choosing)

        viewModel.chooseKind(FeedbackKind.Other)
        assertEquals(Draft("Checkout is cut off", FeedbackKind.Other, "a@b.co"), viewModel.state.value)
    }

    @Test
    fun editsAreIgnoredWhileThePickerIsShown() {
        viewModel.editDraft { it.copy(text = "ghost") }
        assertEquals(Choosing(Draft()), viewModel.state.value)
    }

    @Test
    fun sendNeedsANote() {
        viewModel.chooseKind(FeedbackKind.Issue)
        assertTrue(!(viewModel.state.value as Draft).canSend)
        viewModel.editDraft { it.copy(text = "  ") }
        assertTrue(!(viewModel.state.value as Draft).canSend)
        viewModel.editDraft { it.copy(text = "broken") }
        assertTrue((viewModel.state.value as Draft).canSend)
    }

    @Test
    fun resetReturnsToAFreshPicker() {
        viewModel.chooseKind(FeedbackKind.Issue)
        viewModel.editDraft { it.copy(text = "x") }
        viewModel.reset()
        assertEquals(Choosing(Draft()), viewModel.state.value)
    }

    @Test
    fun voiceRecordingBecomesDraftAudioAndCanBeRemoved() {
        val file = File.createTempFile("feedbackbee-test-", ".m4a")
        try {
            viewModel.chooseKind(FeedbackKind.Issue)
            viewModel.editDraft { it.copy(text = "broken") }
            viewModel.beginVoiceRecording(1_000L)
            assertTrue(viewModel.state.value is RecordingAudio)

            viewModel.finishVoiceRecording(VoiceRecording(file, 12))
            val withAudio = viewModel.state.value as Draft
            assertEquals(12, withAudio.audio?.seconds)
            assertEquals(file, withAudio.audio?.file)

            viewModel.removeVoiceNote()
            assertEquals(null, (viewModel.state.value as Draft).audio)
        } finally {
            file.delete()
        }
    }
}
