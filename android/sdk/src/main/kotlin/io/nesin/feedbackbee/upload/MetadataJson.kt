package io.nesin.feedbackbee.upload

import io.nesin.feedbackbee.Installation
import org.json.JSONObject

/**
 * Encodes `setContext` metadata for the `metadata` contract part with the same
 * rules the server enforces: keys `[A-Za-z0-9_.-]{1,40}`, at most 20 keys,
 * values a string ≤500 chars, a finite number, or a boolean. Anything else is
 * dropped (with a log) so a host-side bug can never block a user's report.
 */
internal object MetadataJson {
    private const val MAX_KEYS = 20
    private const val MAX_KEY_LENGTH = 40
    private const val MAX_STRING_LENGTH = 500
    private val KEY = Regex("^[A-Za-z0-9_.-]{1,${MAX_KEY_LENGTH}}$")

    fun encode(metadata: Map<String, Any?>): String {
        val json = JSONObject()
        metadata.entries
            .filter { (key, value) -> key inMetadataKeys value }
            .take(MAX_KEYS)
            .forEach { (key, value) -> json.put(key, value as Any) }
        return json.toString()
    }

    private infix fun String.inMetadataKeys(value: Any?): Boolean {
        val keyOk = KEY.matches(this)
        val valueOk = when (value) {
            is String -> value.length <= MAX_STRING_LENGTH
            is Boolean -> true
            is Int, is Long, is Float, is Double -> (value as Number).toDouble().isFinite()
            else -> false
        }
        if (!keyOk || !valueOk) Installation.warnContextDropped(this)
        return keyOk && valueOk
    }
}
