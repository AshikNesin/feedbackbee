package io.nesin.feedbackbee.upload

import io.nesin.feedbackbee.FeedbackKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class MultipartBodyTest {

    private val device = DeviceInfo(
        appVersion = "1.2.3", osVersion = "35", deviceModel = "Pixel 9", screenWidth = 1080, screenHeight = 2400,
    )

    private fun render(body: MultipartBody): String =
        ByteArrayOutputStream().also(body::writeTo).toString(Charsets.ISO_8859_1.name())

    @Test
    fun declaredLengthMatchesBytesWritten() {
        val png = ByteArray(1234) { it.toByte() }
        val body = MultipartBody(
            listOf(
                Part.Text("text", "héllo wörld ✓"),
                Part.File("media", "screenshot.png", "image/png", png.size.toLong()) { ByteArrayInputStream(png) },
            ),
            boundary = "b",
        )
        val written = ByteArrayOutputStream().also(body::writeTo).size().toLong()
        assertEquals(body.contentLength(), written)
    }

    @Test
    fun partsAreFramedByTheBoundary() {
        val body = MultipartBody(listOf(Part.Text("project", "myapp")), boundary = "XYZ")
        assertEquals(
            "--XYZ\r\nContent-Disposition: form-data; name=\"project\"\r\n\r\nmyapp\r\n--XYZ--\r\n",
            render(body),
        )
        assertEquals("multipart/form-data; boundary=XYZ", body.contentType)
    }

    @Test
    fun quotesAndNewlinesInNamesCannotBreakOutOfTheHeader() {
        val body = MultipartBody(listOf(Part.Text("a\"b\r\nc", "v")), boundary = "B")
        assertTrue(render(body).contains("name=\"a%22b%0D%0Ac\""))
    }

    @Test
    fun screenshotRequestCarriesEveryContractField() {
        val png = byteArrayOf(1, 2, 3)
        val request = UploadRequest(
            project = "myapp",
            kind = FeedbackKind.Issue,
            text = "  It crashed  ",
            email = "a@b.co",
            device = device,
            media = Media(MediaKind.Screenshot, "screenshot.png", "image/png", 3) { ByteArrayInputStream(png) },
        )
        val out = render(FeedbackUploader.buildBody(request))
        val expected = listOf(
            "name=\"project\"\r\n\r\nmyapp",
            "name=\"kind\"\r\n\r\nbug",
            "name=\"text\"\r\n\r\nIt crashed\r\n",
            "name=\"email\"\r\n\r\na@b.co",
            "name=\"app_version\"\r\n\r\n1.2.3",
            "name=\"os_name\"\r\n\r\nandroid",
            "name=\"os_version\"\r\n\r\n35",
            "name=\"device_model\"\r\n\r\nPixel 9",
            "name=\"screen_w\"\r\n\r\n1080",
            "name=\"screen_h\"\r\n\r\n2400",
            "name=\"media_kind\"\r\n\r\nscreenshot",
            "name=\"media\"; filename=\"screenshot.png\"\r\nContent-Type: image/png",
        )
        expected.forEach { assertTrue("missing $it in:\n$out", out.contains(it)) }
    }

    @Test
    fun optionalFieldsAreOmittedWhenAbsent() {
        val request = UploadRequest(
            project = "p", kind = FeedbackKind.Idea, text = "t", email = " ",
            device = device.copy(appVersion = null), media = null,
        )
        val out = render(FeedbackUploader.buildBody(request))
        listOf("name=\"email\"", "name=\"app_version\"", "name=\"media\"", "name=\"media_kind\"").forEach {
            assertTrue("unexpected $it", !out.contains(it))
        }
    }

    @Test
    fun mediaFieldsComeAfterTextFieldsSoServersCanStream() {
        val request = UploadRequest(
            "p", FeedbackKind.Other, "t", null, device,
            Media(MediaKind.Recording, "r.mp4", "video/mp4", 2, seconds = 42) { ByteArrayInputStream(byteArrayOf(0, 0)) },
        )
        val out = render(FeedbackUploader.buildBody(request))
        assertTrue(out.indexOf("name=\"media_seconds\"\r\n\r\n42") in 1 until out.indexOf("name=\"media\";"))
    }

    @Test
    fun mediaLimitsMatchTheContract() {
        fun media(kind: MediaKind, length: Long) = Media(kind, "f", "x/y", length) { ByteArrayInputStream(ByteArray(0)) }
        val mb = 1024L * 1024
        assertTrue(media(MediaKind.Screenshot, 10 * mb).withinLimit)
        assertTrue(!media(MediaKind.Screenshot, 10 * mb + 1).withinLimit)
        assertTrue(media(MediaKind.Recording, 200 * mb).withinLimit)
        assertTrue(!media(MediaKind.Recording, 200 * mb + 1).withinLimit)
    }
}
