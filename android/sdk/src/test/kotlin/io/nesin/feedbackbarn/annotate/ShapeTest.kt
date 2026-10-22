package io.nesin.feedbackbarn.annotate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

class ShapeTest {

    @Test
    fun arrowBarbsSweepBackFromTheTipSymmetrically() {
        val (a, b) = arrowBarbs(from = Pt(0f, 0f), to = Pt(100f, 0f), length = 10f, spreadRadians = 0.5f)
        assertEquals(100f - 10f * cos(0.5f), a.x, 0.001f)
        assertEquals(100f - 10f * cos(0.5f), b.x, 0.001f)
        assertEquals(-a.y, b.y, 0.001f)
        assertEquals(10f * sin(0.5f), kotlin.math.abs(a.y), 0.001f)
    }

    @Test
    fun arrowBarbsFollowTheDirectionOfTheDrag() {
        val (a, b) = arrowBarbs(from = Pt(50f, 50f), to = Pt(50f, 0f), length = 10f)
        assertTrue(a.y > 0f && b.y > 0f)
    }

    @Test
    fun tapsTooSmallToSeeAreDropped() {
        val tap = Pt(10f, 10f)
        assertFalse(Shape.Box(tap, Pt(11f, 11f)).isVisible(minSize = 4f))
        assertFalse(Shape.Arrow(tap, Pt(11f, 10f)).isVisible(minSize = 4f))
        assertFalse(Shape.Pen(listOf(tap)).isVisible(minSize = 4f))
        assertTrue(Shape.Box(tap, Pt(40f, 40f)).isVisible(minSize = 4f))
        assertTrue(Shape.Arrow(tap, Pt(40f, 10f)).isVisible(minSize = 4f))
        assertTrue(Shape.Pen(listOf(tap, Pt(12f, 12f))).isVisible(minSize = 4f))
    }
}
