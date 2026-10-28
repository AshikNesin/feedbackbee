package io.nesin.feedbackbee.upload

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MetadataJsonTest {

    @Test
    fun encodesStringsNumbersAndBooleans() {
        val json = MetadataJson.encode(mapOf("plan" to "pro", "build" to 4211, "beta" to true, "ratio" to 1.5))
        assertEquals("pro", JSONObject(json).getString("plan"))
        assertEquals(4211, JSONObject(json).getInt("build"))
        assertEquals(true, JSONObject(json).getBoolean("beta"))
        assertEquals(1.5, JSONObject(json).getDouble("ratio"), 0.0)
    }

    @Test
    fun dropsKeysAndValuesOutsideTheContract() {
        val json = MetadataJson.encode(
            mapOf(
                "ok_key" to "fine",
                "bad key!" to "dropped key",
                "nested_key" to mapOf("a" to 1),
                "list_key" to listOf(1, 2),
                "long_value" to "x".repeat(501),
                "x".repeat(41) to "dropped long key",
            ),
        )
        val parsed = JSONObject(json)
        assertEquals(setOf("ok_key"), parsed.keySet())
    }

    @Test
    fun keepsAtMostTwentyKeys() {
        val many = (1..30).associate { "k$it" to it }
        assertEquals(20, JSONObject(MetadataJson.encode(many)).length())
    }

    @Test
    fun nonFiniteNumbersAreDropped() {
        val json = MetadataJson.encode(mapOf("inf" to Double.POSITIVE_INFINITY, "nan" to Double.NaN, "ok" to 1))
        val parsed = JSONObject(json)
        assertFalse(parsed.has("inf"))
        assertFalse(parsed.has("nan"))
        assertTrue(parsed.has("ok"))
    }
}
