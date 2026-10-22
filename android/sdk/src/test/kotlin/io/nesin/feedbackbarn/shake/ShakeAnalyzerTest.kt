package io.nesin.feedbackbarn.shake

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShakeAnalyzerTest {

    private val gravity = 9.8f
    private val jolt = 22f

    /** 50 Hz stream starting at [startMs]; one sample per 20 ms, jolts at the given offsets, gravity otherwise. */
    private fun stream(analyzer: ShakeAnalyzer, startMs: Long, durationMs: Long, joltsAtMs: List<Long>): List<Long> {
        val fired = mutableListOf<Long>()
        var t = 0L
        while (t <= durationMs) {
            val inJolt = joltsAtMs.any { t >= it && t < it + 40 }
            val z = if (inJolt) jolt else gravity
            if (analyzer.onSample(startMs + t, 0f, 0f, z)) fired += startMs + t
            t += 20
        }
        return fired
    }

    @Test
    fun threeJoltsInsideWindowTriggerOnTheThirdPeak() {
        val fired = stream(ShakeAnalyzer(), startMs = 10_000, durationMs = 2_000, joltsAtMs = listOf(100, 600, 1_100))
        assertEquals(listOf(11_100L), fired)
    }

    @Test
    fun threeJoltsSpreadOverMoreThanWindowDoNotTrigger() {
        val fired = stream(ShakeAnalyzer(), startMs = 0, durationMs = 4_000, joltsAtMs = listOf(0, 800, 1_700, 2_600))
        assertTrue(fired.isEmpty())
    }

    @Test
    fun twoJoltsAreNotEnough() {
        val fired = stream(ShakeAnalyzer(), startMs = 0, durationMs = 2_000, joltsAtMs = listOf(100, 700))
        assertTrue(fired.isEmpty())
    }

    @Test
    fun restingAndWalkingNeverTrigger() {
        val analyzer = ShakeAnalyzer()
        var fired = false
        for (i in 0 until 1_000) {
            val walkingZ = gravity + 3f * kotlin.math.sin(i / 5.0).toFloat()
            fired = fired or analyzer.onSample(i * 20L, 0f, 0f, walkingZ)
        }
        assertFalse(fired)
    }

    @Test
    fun oneSustainedHighReadingCountsAsOnePeak() {
        val analyzer = ShakeAnalyzer()
        var fired = false
        for (i in 0 until 40) fired = fired or analyzer.onSample(i * 20L, 0f, 0f, jolt)
        assertFalse(fired)
    }

    @Test
    fun magnitudeUsesAllThreeAxes() {
        val analyzer = ShakeAnalyzer()
        val fired = (0..2).map { i ->
            analyzer.onSample(i * 400L, 10f, 10f, 10f).also { analyzer.onSample(i * 400L + 200, 0f, 0f, gravity) }
        }
        assertEquals(listOf(false, false, true), fired)
    }

    @Test
    fun peaksResetAfterATrigger() {
        val analyzer = ShakeAnalyzer()
        val first = stream(analyzer, startMs = 0, durationMs = 1_400, joltsAtMs = listOf(0, 400, 800))
        val second = stream(analyzer, startMs = 5_000, durationMs = 400, joltsAtMs = listOf(0))
        assertEquals(1, first.size)
        assertTrue(second.isEmpty())
    }
}
