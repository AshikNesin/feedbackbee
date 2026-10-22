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
                    endpoint = BuildConfig.FEEDBACKBEE_ENDPOINT.ifEmpty { FeedbackBee.DEFAULT_ENDPOINT },
                    onProjectIdChange = ::applyProjectId,
                    onOpenSheet = { FeedbackBee.show() },
                )
            }
        }
    }

    private fun applyProjectId(projectId: String) {
        if (projectId.isBlank()) return
        DemoSettings.saveProjectId(this, projectId.trim())
        application.startFeedbackBee(projectId)
    }
}
