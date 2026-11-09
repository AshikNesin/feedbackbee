package io.nesin.feedbackbee.app

import io.nesin.feedbackbee.app.data.clock
import io.nesin.feedbackbee.app.data.isValidSlug
import io.nesin.feedbackbee.app.data.normalizeHost
import io.nesin.feedbackbee.app.data.pagePath
import io.nesin.feedbackbee.app.data.relativeTime
import io.nesin.feedbackbee.app.data.slugify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneOffset

class FormatTest {
    @Test fun `host gets https and loses paths and trailing slashes`() {
        assertEquals("https://bee.example.com", normalizeHost("bee.example.com"))
        assertEquals("https://bee.example.com", normalizeHost("  https://Bee.Example.com/  "))
        assertEquals("https://bee.example.com", normalizeHost("https://bee.example.com/app/projects/x?feedback=1"))
        assertEquals("http://10.0.2.2:8787", normalizeHost("http://10.0.2.2:8787"))
        assertEquals("https://my-bee.workers.dev", normalizeHost("my-bee.workers.dev/app"))
    }

    @Test fun `host rejects what is not a web address`() {
        assertNull(normalizeHost(""))
        assertNull(normalizeHost("not a host"))
        assertNull(normalizeHost("ftp://bee.example.com"))
        assertNull(normalizeHost("https://"))
    }

    @Test fun `slug follows the server's project id rule`() {
        assertEquals("my-app-dev", slugify("My App.dev"))
        assertEquals("caf", slugify("  Café!! "))
        assertTrue(isValidSlug(slugify("Hello World")))
        assertFalse(isValidSlug("ab"))
        assertFalse(isValidSlug("-abc"))
        assertFalse(isValidSlug("a".repeat(41)))
        assertEquals(40, slugify("x".repeat(60)).length)
    }

    @Test fun `relative time steps from now to dates`() {
        val now = 1_760_000_000_000L // 2025-10-09T08:53:20Z
        val utc = ZoneOffset.UTC
        val en = java.util.Locale.US
        assertEquals("now", relativeTime(now - 30_000, now, utc))
        assertEquals("5m", relativeTime(now - 5 * 60_000, now, utc))
        assertEquals("3h", relativeTime(now - 3 * 3_600_000, now, utc))
        assertEquals("2d", relativeTime(now - 2 * 86_400_000, now, utc))
        assertTrue(relativeTime(now - 20L * 86_400_000, now, utc, en).startsWith("Sep"))
        assertTrue(relativeTime(now - 400L * 86_400_000, now, utc, en).endsWith("2024"))
    }

    @Test fun `clock and page path format like the web`() {
        assertEquals("0:00", clock(null))
        assertEquals("1:05", clock(65.4))
        assertEquals("example.com/checkout", pagePath("https://example.com/checkout?x=1"))
        assertEquals("example.com", pagePath("https://example.com/"))
        assertEquals("localhost:8787/demo", pagePath("http://localhost:8787/demo"))
        assertNull(pagePath(null))
    }
}
