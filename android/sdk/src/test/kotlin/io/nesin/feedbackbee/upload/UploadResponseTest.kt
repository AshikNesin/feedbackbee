package io.nesin.feedbackbee.upload

import io.nesin.feedbackbee.FeedbackConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadResponseTest {

    @Test
    fun created201ReturnsTheIssueUrl() {
        val body = """{"id":"abc","state":"created","issueUrl":"https://github.com/o/r/issues/7"}"""
        assertEquals(UploadOutcome.Accepted("https://github.com/o/r/issues/7"), parseUploadResponse(201, body))
    }

    @Test
    fun pending202IsAcceptedWithoutALink() {
        assertEquals(UploadOutcome.Accepted(null), parseUploadResponse(202, """{"id":"abc","state":"pending"}"""))
    }

    @Test
    fun created201WithGarbageBodyStillCountsAsSent() {
        assertEquals(UploadOutcome.Accepted(null), parseUploadResponse(201, "<html>"))
    }

    @Test
    fun badRequestSurfacesTheServerMessage() {
        val outcome = parseUploadResponse(400, """{"error":"text is required"}""")
        assertEquals(UploadOutcome.Rejected("text is required"), outcome)
    }

    @Test
    fun rateLimitAndServerErrorsGetFriendlyMessages() {
        assertTrue((parseUploadResponse(429, "") as UploadOutcome.Rejected).message.contains("Too many"))
        assertTrue((parseUploadResponse(500, "") as UploadOutcome.Rejected).message.contains("HTTP 500"))
        assertTrue((parseUploadResponse(301, "") as UploadOutcome.Rejected).message.contains("redirected"))
    }

    @Test
    fun endpointIsTrimmedAndTrailingSlashesRemoved() {
        val config = FeedbackConfig.create(" myapp ", " http://10.0.2.2:8787// ")
        assertEquals("myapp", config.projectSlug)
        assertEquals("http://10.0.2.2:8787/api/feedback", config.feedbackUrl)
    }

    @Test
    fun badConfigFailsFast() {
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create(" ", "https://x.dev") }
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", "x.dev") }
        assertThrows(IllegalArgumentException::class.java) { FeedbackConfig.create("a", "https://") }
    }
}
