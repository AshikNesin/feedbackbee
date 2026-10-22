package io.nesin.feedbackbee.record

import org.junit.Assert.assertEquals
import org.junit.Test

class VoiceRecorderTest {

    @Test
    fun durationIsFlooredAndCappedAtFiveMinutes() {
        assertEquals(0, voiceDurationSeconds(1_000L, 1_999L))
        assertEquals(12, voiceDurationSeconds(1_000L, 13_999L))
        assertEquals(300, voiceDurationSeconds(0L, 301_000L))
        assertEquals(0, voiceDurationSeconds(2_000L, 1_000L))
    }

    @Test
    fun durationIsDisplayedAsMinutesAndSeconds() {
        assertEquals("0:00", formatVoiceDuration(0))
        assertEquals("1:05", formatVoiceDuration(65))
        assertEquals("5:00", formatVoiceDuration(301))
    }
}
