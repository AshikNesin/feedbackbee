package io.nesin.feedbackbee.demo

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import io.nesin.feedbackbee.FeedbackBee

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        FeedbackBee.register(this)
        setContent {
            DemoTheme {
                DemoScreen(
                    initial = DemoSettings.load(this),
                    onSave = ::applySettings,
                    onOpenSheet = { FeedbackBee.showFeedbackSheet(this) },
                )
            }
        }
    }

    private fun applySettings(settings: DemoSettings): String? = try {
        FeedbackBee.init(application, settings.projectSlug, settings.endpoint)
        settings.save(this)
        null
    } catch (e: IllegalArgumentException) {
        e.message
    }
}
