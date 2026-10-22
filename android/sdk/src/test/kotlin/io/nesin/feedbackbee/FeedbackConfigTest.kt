package io.nesin.feedbackbee

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedbackConfigTest {

    @Test
    fun projectIdAndEndpointAreTrimmedAndTrailingSlashesRemoved() {
        val config = FeedbackConfig.create(" myapp ", " http://10.0.2.2:8787// ")
        assertEquals("myapp", config.projectId)
        assertEquals("http://10.0.2.2:8787/api/feedback", config.feedbackUrl)
    }

    @Test
    fun theDefaultEndpointIsAValidHttpsUrl() {
        val config = FeedbackConfig.create("myapp", FeedbackBee.DEFAULT_ENDPOINT)
        assertTrue(config.endpoint.startsWith("https://"))
        assertEquals("${FeedbackBee.DEFAULT_ENDPOINT}/api/feedback", config.feedbackUrl)
    }

    @Test
    fun blankProjectIdFailsFastAndNamesTheParameter() {
        val error = assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("  ", "https://x.dev") }
        assertTrue(error.message!!.contains("projectId"))
    }

    @Test
    fun badEndpointFailsFast() {
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", "x.dev") }
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", "https://") }
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", "") }
    }

    @Test
    fun kindsMapToTheContractWireValuesAndWebLabels() {
        assertEquals(listOf("bug", "idea", "feedback"), FeedbackKind.entries.map { it.wire })
        assertEquals(listOf("Issue", "Idea", "Other"), FeedbackKind.entries.map { it.label })
        assertEquals(listOf("Report an issue", "Share an idea", "Tell us more"), FeedbackKind.entries.map { it.formTitle })
    }
}
