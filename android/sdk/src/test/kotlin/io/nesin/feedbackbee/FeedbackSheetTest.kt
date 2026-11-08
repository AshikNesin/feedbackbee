package io.nesin.feedbackbee

import android.app.Application
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import io.nesin.feedbackbee.sheet.FeedbackSheetFragment
import io.nesin.feedbackbee.sheet.FeedbackSheetView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], application = FeedbackSheetTest.HostApplication::class)
class FeedbackSheetTest {

    @Test
    fun opensFeedbackSheetOverResumedFragmentActivity() {
        Robolectric.buildActivity(FragmentActivity::class.java).use { controller ->
            val activity = controller.setup().get()
            assertEquals(Lifecycle.State.RESUMED, activity.lifecycle.currentState)

            FeedbackBee.open()
            activity.supportFragmentManager.executePendingTransactions()

            val sheet = activity.supportFragmentManager.fragments.filterIsInstance<FeedbackSheetFragment>().single()
            assertTrue(sheet.requireDialog().isShowing)
        }
    }

    @Test
    @Config(qualifiers = "notnight")
    fun lightHostKeepsLightSheet() = assertSheetColors(android.R.style.Theme_Material_Light_NoActionBar, false)

    @Test
    @Config(qualifiers = "night")
    fun darkHostUsesDarkSheet() = assertSheetColors(android.R.style.Theme_Material_NoActionBar, true)

    @Test
    @Config(qualifiers = "notnight")
    fun appLevelDarkThemeOverridesLightSystem() = assertSheetColors(android.R.style.Theme_Material_NoActionBar, true)

    @Test
    @Config(qualifiers = "night")
    fun appLevelLightThemeOverridesDarkSystem() = assertSheetColors(android.R.style.Theme_Material_Light_NoActionBar, false)

    private fun assertSheetColors(hostTheme: Int, dark: Boolean) {
        Robolectric.buildActivity(FragmentActivity::class.java).use { controller ->
            controller.get().setTheme(hostTheme)
            val activity = controller.setup().get()
            FeedbackBee.open()
            activity.supportFragmentManager.executePendingTransactions()
            val fragment = activity.supportFragmentManager.fragments.filterIsInstance<FeedbackSheetFragment>().single()
            assertTrue(fragment.requireDialog().isShowing)
            val sheet = fragment.requireView() as FeedbackSheetView
            val panel = if (dark) Color.rgb(24, 24, 27) else Color.WHITE
            val ink = if (dark) Color.rgb(244, 244, 245) else Color.rgb(24, 24, 27)
            assertEquals(panel, (sheet.background as GradientDrawable).color!!.defaultColor)

            sheet.render(FeedbackState.Choosing())
            assertEquals(ink, sheet.descendants().filterIsInstance<TextView>().first { it.text == "Share feedback" }.currentTextColor)
            sheet.render(FeedbackState.Draft(text = "Test only, not submitted", kind = FeedbackKind.Issue))
            sheet.descendants().filterIsInstance<EditText>().forEach { field ->
                assertEquals(ink, field.currentTextColor)
                assertEquals(panel, (field.background.current as GradientDrawable).color!!.defaultColor)
            }
            val send = sheet.descendants().filterIsInstance<TextView>().first { it.text == "Send feedback" }
            assertEquals(panel, send.currentTextColor)
            assertEquals(ink, (send.background.current as android.graphics.drawable.RippleDrawable).let {
                (it.getDrawable(0) as GradientDrawable).color!!.defaultColor
            })
            sheet.render(FeedbackState.Sent(null))
            assertEquals(panel, (sheet.background as GradientDrawable).color!!.defaultColor)
        }
    }

    /** React Native's MainActivity handles uiMode itself, so the activity is not recreated on a switch. */
    @Test
    @Config(qualifiers = "notnight")
    fun liveSwitchToDarkRebuildsTheSheetAndKeepsTheDraft() {
        Robolectric.buildActivity(FragmentActivity::class.java).use { controller ->
            controller.get().setTheme(android.R.style.Theme_Material_Light_NoActionBar)
            val activity = controller.setup().get()
            FeedbackBee.open(OpenOptions(kind = FeedbackKind.Issue, text = "Draft survives"))
            activity.supportFragmentManager.executePendingTransactions()
            val before = activity.supportFragmentManager.fragments.filterIsInstance<FeedbackSheetFragment>().single()
            assertEquals(Color.WHITE, ((before.requireView() as FeedbackSheetView).background as GradientDrawable).color!!.defaultColor)

            // What AppCompat's DayNight does without recreating: new night qualifier, theme re-applied in place.
            RuntimeEnvironment.setQualifiers("+night")
            activity.setTheme(android.R.style.Theme_Material_NoActionBar)
            before.onConfigurationChanged(activity.resources.configuration)
            shadowOf(Looper.getMainLooper()).idle()
            activity.supportFragmentManager.executePendingTransactions()

            val after = activity.supportFragmentManager.fragments.filterIsInstance<FeedbackSheetFragment>().single()
            assertTrue(after !== before)
            assertTrue(after.requireDialog().isShowing)
            val sheet = after.requireView() as FeedbackSheetView
            assertEquals(Color.rgb(24, 24, 27), (sheet.background as GradientDrawable).color!!.defaultColor)
            assertEquals("Draft survives", sheet.descendants().filterIsInstance<EditText>().first().text.toString())
        }
    }

    private fun View.descendants(): Sequence<View> = sequence {
        yield(this@descendants)
        if (this@descendants is ViewGroup) {
            for (index in 0 until childCount) yieldAll(getChildAt(index).descendants())
        }
    }

    class HostApplication : Application() {
        override fun onCreate() {
            super.onCreate()
            FeedbackBee.init(this, projectId = "otp-bee", endpoint = "https://feedbackbee.nesin.io")
        }
    }
}
