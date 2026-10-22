package io.nesin.feedbackbee

import io.nesin.feedbackbee.FeedbackState.Choosing
import io.nesin.feedbackbee.FeedbackState.Draft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

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
        viewModel.chooseKind(FeedbackKind.Idea)
        assertEquals(Draft(kind = FeedbackKind.Idea), viewModel.state.value)
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
}
