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
        setContent {
            DemoTheme {
                DemoScreen(
                    initialProjectId = DemoSettings.projectId(this),
                    initialEndpoint = DemoSettings.endpoint(this),
                    initiallyConfigured = DemoSettings.isConfigured(this),
                    onSaveConfiguration = ::applyConfiguration,
                    onOpenSheet = { FeedbackBee.open() },
                )
            }
        }
    }

    private fun applyConfiguration(projectId: String, endpoint: String): String? {
        val wasConfigured = DemoSettings.isConfigured(this)
        try {
            application.startFeedbackBee(projectId, endpoint)
        } catch (error: IllegalArgumentException) {
            return error.message?.removePrefix("FeedbackBee: ") ?: "Check the project id and website host."
        }
        DemoSettings.saveConfiguration(this, projectId, endpoint)
        // First-time setup registers SDK lifecycle callbacks after this activity already resumed.
        if (!wasConfigured) recreate()
        return null
    }
}
