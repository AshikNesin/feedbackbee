package io.nesin.feedbackbee.app

import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** What the share target takes from other apps' share intents. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ShareContentTest {
    private val shot = Uri.parse("content://media/external/images/media/1")

    @Test fun `one screenshot`() {
        val intent = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, shot)
        assertEquals(SharedContent("", listOf(shot)), sharedContent(intent))
    }

    @Test fun `several images keep five`() {
        val uris = ArrayList((1..7).map { Uri.parse("content://media/external/images/media/$it") })
        val intent = Intent(Intent.ACTION_SEND_MULTIPLE).setType("image/*").putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        assertEquals(uris.take(5), sharedContent(intent).images)
    }

    @Test fun `text with a subject, like a browser page`() {
        val intent = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "Checkout – Acme")
            .putExtra(Intent.EXTRA_TEXT, "https://acme.dev/checkout")
        assertEquals(SharedContent("Checkout – Acme\n\nhttps://acme.dev/checkout", emptyList()), sharedContent(intent))
    }

    @Test fun `a non-image stream is ignored`() {
        val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_STREAM, shot).putExtra(Intent.EXTRA_TEXT, "hi")
        assertEquals(SharedContent("hi", emptyList()), sharedContent(intent))
    }
}
