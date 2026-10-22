package io.nesin.feedbackbarn.demo

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import io.nesin.feedbackbarn.FeedbackBarn

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        FeedbackBarn.register(this)
        setContent {
            DemoTheme {
                DemoScreen(
                    initial = DemoSettings.load(this),
                    onSave = ::applySettings,
                    onOpenSheet = { FeedbackBarn.showFeedbackSheet(this) },
                )
            }
        }
    }

    private fun applySettings(settings: DemoSettings): String? = try {
        FeedbackBarn.init(application, settings.projectSlug, settings.endpoint)
        settings.save(this)
        null
    } catch (e: IllegalArgumentException) {
        e.message
    }
}
