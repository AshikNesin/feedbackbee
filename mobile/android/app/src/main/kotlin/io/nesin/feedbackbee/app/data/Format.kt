package io.nesin.feedbackbee.app.data

import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The server's base URL from what the owner typed: `bee.example.com`,
 * `https://bee.example.com/app/projects/x` and `https://bee.example.com/`
 * all become `https://bee.example.com`. Null when it isn't a URL.
 */
fun normalizeHost(input: String): String? {
    val trimmed = input.trim()
    if (trimmed.isEmpty() || trimmed.any { it.isWhitespace() }) return null
    val withScheme = if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(trimmed)) trimmed else "https://$trimmed"
    val uri = runCatching { URI(withScheme) }.getOrNull() ?: return null
    val scheme = uri.scheme?.lowercase(Locale.ROOT)
    if (scheme != "https" && scheme != "http") return null
    val host = uri.host?.lowercase(Locale.ROOT) ?: return null
    if (host.isEmpty()) return null
    val port = if (uri.port == -1) "" else ":${uri.port}"
    return "$scheme://$host$port"
}

/** Hosts a debug build may reach over plain HTTP (res/xml in src/debug): a local dev server. */
fun isLocalDevHost(base: String): Boolean =
    runCatching { URI(base).host }.getOrNull() in setOf("localhost", "127.0.0.1", "10.0.2.2")

/** Project id from a name, like the web's New project dialog: a-z, 0-9, inner hyphens, 3-40 chars. */
fun slugify(name: String): String =
    name.lowercase(Locale.ROOT)
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .take(40)
        .trimEnd('-')

fun isValidSlug(slug: String): Boolean = Regex("^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$").matches(slug)

private val shortDate = DateTimeFormatter.ofPattern("MMM d", Locale.getDefault())
private val longDate = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault())

/** "now", "5m", "3h", "2d", then "Mar 4" (this year) or "Mar 4, 2025". */
fun relativeTime(
    epochMs: Long,
    nowMs: Long = System.currentTimeMillis(),
    zone: ZoneId = ZoneId.systemDefault(),
    locale: Locale? = null,
): String {
    val (short, long) = if (locale == null) shortDate to longDate
    else DateTimeFormatter.ofPattern("MMM d", locale) to DateTimeFormatter.ofPattern("MMM d, yyyy", locale)
    val seconds = (nowMs - epochMs) / 1000
    return when {
        seconds < 60 -> "now"
        seconds < 3600 -> "${seconds / 60}m"
        seconds < 86_400 -> "${seconds / 3600}h"
        seconds < 7 * 86_400 -> "${seconds / 86_400}d"
        else -> {
            val date = Instant.ofEpochMilli(epochMs).atZone(zone)
            val now = Instant.ofEpochMilli(nowMs).atZone(zone)
            (if (date.year == now.year) short else long).format(date)
        }
    }
}

/** `m:ss` for a recording or voice-note length. */
fun clock(seconds: Double?): String {
    val s = Math.round(seconds ?: 0.0).coerceAtLeast(0)
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

/** `host/path` of a page URL, for one-line display. */
fun pagePath(url: String?): String? {
    if (url == null) return null
    val uri = runCatching { URI(url) }.getOrNull() ?: return url
    val host = uri.host ?: return url
    val port = if (uri.port == -1) "" else ":${uri.port}"
    val path = uri.path.orEmpty()
    return host + port + if (path == "/") "" else path
}
