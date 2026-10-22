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
    fun websiteHostDeterminesTheUploadDestination() {
        val config = FeedbackConfig.create("myapp", "https://feedback.example.com/")
        assertEquals("https://feedback.example.com", config.endpoint)
        assertEquals("https://feedback.example.com/api/feedback", config.feedbackUrl)
    }

    @Test
    fun basePathsAndLocalDevelopmentHostsAreSupported() {
        listOf(
            "https://example.com/feedbackbee",
            "http://localhost:8787",
            "http://10.0.2.2:8787",
            "http://[::1]:8787",
        ).forEach { endpoint ->
            assertEquals("$endpoint/api/feedback", FeedbackConfig.create("myapp", "$endpoint/").feedbackUrl)
        }
    }

    @Test
    fun blankProjectIdFailsFastAndNamesTheParameter() {
        val error = assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("  ", "https://x.dev") }
        assertTrue(error.message!!.contains("projectId"))
    }

    @Test
    fun badEndpointFailsFast() {
        listOf(
            "", "  ", "x.dev", "https://", "https:///path", "https://?host=example.com",
            "https://bad host.example", "ftp://example.com", "http://example.com:0", "http://example.com:65536",
        ).forEach { endpoint ->
            val error = assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", endpoint) }
            assertTrue(error.message!!.contains("endpoint"))
        }
    }

    @Test
    fun endpointMustNotContainCredentialsQueryOrFragment() {
        listOf(
            "https://user:password@example.com",
            "https://example.com?project=other",
            "https://example.com#feedback",
        ).forEach { endpoint ->
            val error = assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", endpoint) }
            assertTrue(error.message!!.contains("endpoint"))
            assertTrue(!error.message!!.contains(endpoint))
        }
    }

    @Test
    fun blankEndpointIsExplicitlyRequired() {
        val error = assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("myapp", " ") }
        assertEquals("FeedbackBee: endpoint must not be blank", error.message)
    }

    @Test
    fun kindsMapToTheContractWireValuesAndWebLabels() {
        assertEquals(listOf("bug", "idea", "feedback"), FeedbackKind.entries.map { it.wire })
        assertEquals(listOf("Issue", "Idea", "Other"), FeedbackKind.entries.map { it.label })
        assertEquals(listOf("Report an issue", "Share an idea", "Tell us more"), FeedbackKind.entries.map { it.formTitle })
    }
}
