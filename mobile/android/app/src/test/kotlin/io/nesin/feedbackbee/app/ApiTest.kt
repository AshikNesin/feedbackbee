package io.nesin.feedbackbee.app

import io.nesin.feedbackbee.app.data.Api
import io.nesin.feedbackbee.app.data.ApiException
import io.nesin.feedbackbee.app.data.DeviceContext
import io.nesin.feedbackbee.app.data.Kind
import io.nesin.feedbackbee.app.data.Status
import io.nesin.feedbackbee.app.data.Upload
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** The API client against a fake server speaking groot's envelope. */
class ApiTest {
    private lateinit var server: MockWebServer
    private var expired = 0

    @Before fun setUp() {
        server = MockWebServer()
        server.start()
        expired = 0
    }

    @After fun tearDown() = server.shutdown()

    private fun api(token: String? = "tok") =
        Api(OkHttpClient(), server.url("/").toString().trimEnd('/'), token, onSessionInvalid = { expired++ })

    private fun ok(data: String, code: Int = 200) = MockResponse().setResponseCode(code).setBody("""{"success":true,"data":$data}""")

    private fun fail(code: Int, errorCode: String, message: String) =
        MockResponse().setResponseCode(code).setBody("""{"success":false,"error":{"code":"$errorCode","message":"$message"}}""")

    private val item = """
        {"id":"f1","projectId":"p1","kind":"feature_request","text":"Dark mode","reporterEmail":"a@b.co",
         "metadata":{"plan":"pro","seats":3,"beta":true},"url":"https://x.dev/a","userAgent":null,
         "screenW":390,"screenH":844,"recordingKey":"p/p1/f/r.rrweb.gz","recordingSeconds":12.5,
         "state":"created","issueNumber":42,"issueUrl":"https://github.com/o/r/issues/42","issueError":null,
         "status":"in_progress","createdAt":"2026-11-08T10:00:00.000Z","images":["p/p1/f/a.png"],"somethingNew":1}
    """.trimIndent()

    @Test fun `sign in posts credentials without a token and returns the session`() = runBlocking {
        server.enqueue(ok("""{"token":"jwt","user":{"id":1,"email":"me@x.dev","name":null}}"""))
        val result = api(token = null).signIn("me@x.dev", "pw")
        assertEquals("jwt", result.token)
        val req = server.takeRequest()
        assertEquals("/api/v1/auth/login", req.path)
        assertEquals(null, req.getHeader("Authorization"))
        assertEquals("""{"email":"me@x.dev","password":"pw"}""", req.body.readUtf8())
    }

    @Test fun `a wrong password surfaces the server message and does not expire anything`() = runBlocking {
        server.enqueue(fail(401, "UNAUTHORIZED", "Invalid email or password"))
        try {
            api(token = null).signIn("me@x.dev", "nope")
            fail("expected an error")
        } catch (e: ApiException) {
            assertEquals("Invalid email or password", e.message)
        }
        assertEquals(0, expired)
    }

    @Test fun `an expired session signs out`() = runBlocking {
        server.enqueue(fail(401, "SESSION_INVALID", "Invalid or expired token"))
        runCatching { api().projects() }
        assertEquals(1, expired)
        assertEquals("Bearer tok", server.takeRequest().getHeader("Authorization"))
    }

    @Test fun `feedback pages decode every field and send the cursor and filter`() = runBlocking {
        server.enqueue(ok("""{"items":[$item],"hasMore":true}"""))
        val page = api().feedback("p1", before = 1700000000000, status = Status.InProgress)
        val f = page.items.single()
        assertTrue(page.hasMore)
        assertEquals(Kind.FeatureRequest, f.kind)
        assertEquals(Status.InProgress, f.status)
        assertEquals(42, f.issueNumber)
        assertEquals("pro", f.metadata!!["plan"]!!.content)
        assertTrue(f.isReplay)
        assertEquals(1_794_132_000_000L, f.createdAtMs) // 2026-11-08T10:00:00Z
        assertEquals(listOf("p/p1/f/a.png"), f.images)
        assertEquals("/api/v1/projects/p1/feedback?before=1700000000000&status=in_progress", server.takeRequest().path)
    }

    @Test fun `an edit sends only the fields that changed`() = runBlocking {
        server.enqueue(ok(item))
        api().updateFeedback("p1", "f1", text = "Dark mode, please")
        val req = server.takeRequest()
        assertEquals("PATCH", req.method)
        assertEquals("/api/v1/projects/p1/feedback/f1", req.path)
        assertEquals("""{"text":"Dark mode, please"}""", req.body.readUtf8())
    }

    @Test fun `delete and sync hit their paths`() = runBlocking {
        server.enqueue(ok("""{"id":"f1"}"""))
        server.enqueue(ok("""{"checked":3,"updated":1}"""))
        api().deleteFeedback("p1", "f1")
        assertEquals(1, api().sync("p1").updated)
        assertEquals("DELETE", server.takeRequest().method)
        assertEquals("/api/v1/projects/p1/sync", server.takeRequest().path)
    }

    @Test fun `submit is multipart with device context, images and the owner token`() = runBlocking {
        server.enqueue(ok("""{"id":"f9","state":"created","issueUrl":"https://github.com/o/r/issues/9"}""", code = 201))
        val result = api().submit(
            "myapp",
            Kind.Issue,
            "Crash on save",
            listOf(Upload(byteArrayOf(-1, -40, -1, 0), "image/jpeg", "image-1.jpg")),
            DeviceContext("0.1.0", "16", "Google Pixel 9"),
        )
        assertEquals("f9", result.id)
        val req = server.takeRequest()
        assertEquals("/api/v1/feedback", req.path)
        assertEquals("Bearer tok", req.getHeader("Authorization"))
        assertTrue(req.getHeader("Content-Type")!!.startsWith("multipart/form-data"))
        val body = req.body.readUtf8()
        for (part in listOf("project", "kind", "text", "os_name", "os_version", "device_model", "app_version", "image")) {
            assertTrue("missing $part", body.contains("name=\"$part\""))
        }
        assertTrue(body.contains("Crash on save"))
        assertTrue(body.contains("filename=\"image-1.jpg\""))
        assertFalse(body.contains("name=\"email\""))
    }

    @Test fun `an unreachable server is a readable error`() = runBlocking {
        server.shutdown()
        try {
            api().projects()
            fail("expected an error")
        } catch (e: ApiException) {
            assertEquals("NETWORK", e.code)
        }
    }
}
