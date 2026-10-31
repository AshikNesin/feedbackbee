package io.nesin.feedbackbee.upload

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadResponseTest {

    @Test
    fun created201ReturnsTheIssueUrl() {
        val body = """{"success":true,"data":{"id":"abc","state":"created","issueUrl":"https://github.com/o/r/issues/7"}}"""
        assertEquals(UploadOutcome.Accepted("https://github.com/o/r/issues/7"), parseUploadResponse(201, body))
    }

    @Test
    fun pending202IsAcceptedWithoutALink() {
        assertEquals(UploadOutcome.Accepted(null), parseUploadResponse(202, """{"success":true,"data":{"id":"abc","state":"issue_error"}}"""))
    }

    @Test
    fun created201WithGarbageBodyStillCountsAsSent() {
        assertEquals(UploadOutcome.Accepted(null), parseUploadResponse(201, "<html>"))
    }

    @Test
    fun badRequestSurfacesTheServerMessage() {
        val outcome = parseUploadResponse(400, """{"success":false,"error":{"code":"VALIDATION_ERROR","message":"text is required"}}""")
        assertEquals(UploadOutcome.Rejected("text is required"), outcome)
    }

    @Test
    fun unknownProjectAndRejectedMediaSurfaceTheServerMessage() {
        val notFound = """{"success":false,"error":{"code":"NOT_FOUND","message":"unknown project"}}"""
        assertEquals(UploadOutcome.Rejected("unknown project"), parseUploadResponse(404, notFound))
        assertTrue((parseUploadResponse(413, "<html>") as UploadOutcome.Rejected).message.contains("rejected"))
    }

    @Test
    fun rateLimitAndServerErrorsGetFriendlyMessages() {
        assertTrue((parseUploadResponse(429, "") as UploadOutcome.Rejected).message.contains("Too many"))
        assertTrue((parseUploadResponse(500, "") as UploadOutcome.Rejected).message.contains("HTTP 500"))
        assertTrue((parseUploadResponse(301, "") as UploadOutcome.Rejected).message.contains("redirected"))
    }
}
