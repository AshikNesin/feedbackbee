package io.nesin.feedbackbee.shake

import kotlin.math.sqrt

/**
 * Android-free shake logic. Feed it accelerometer samples in time order; it returns true on the
 * sample that completes [peaksRequired] distinct peaks inside [windowMs].
 *
 * Magnitude includes gravity (about 9.8 at rest), so 15 m/s^2 is a firm jolt, not a tilt.
 */
internal class ShakeAnalyzer(
    private val thresholdMs2: Float = 15f,
    private val peaksRequired: Int = 3,
    private val windowMs: Long = 1_500,
    private val minPeakGapMs: Long = 120,
) {
    private val peaks = ArrayDeque<Long>()
    private var wasAbove = false

    fun onSample(timestampMs: Long, x: Float, y: Float, z: Float): Boolean {
        val above = sqrt(x * x + y * y + z * z) > thresholdMs2
        val risingEdge = above && !wasAbove
        wasAbove = above
        if (risingEdge) recordPeak(timestampMs)
        dropExpired(timestampMs)
        if (peaks.size < peaksRequired) return false
        reset()
        return true
    }

    fun reset() {
        peaks.clear()
        wasAbove = false
    }

    private fun recordPeak(timestampMs: Long) {
        val last = peaks.lastOrNull()
        if (last == null || timestampMs - last >= minPeakGapMs) peaks.addLast(timestampMs)
    }

    private fun dropExpired(now: Long) {
        while (peaks.isNotEmpty() && now - peaks.first() > windowMs) peaks.removeFirst()
    }
}
