package io.nesin.feedbackbee

import android.app.Application
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import io.nesin.feedbackbee.sheet.FeedbackSheetFragment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
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

    class HostApplication : Application() {
        override fun onCreate() {
            super.onCreate()
            FeedbackBee.init(this, projectId = "otp-bee", endpoint = "https://feedbackbee.nesin.io")
        }
    }
}
