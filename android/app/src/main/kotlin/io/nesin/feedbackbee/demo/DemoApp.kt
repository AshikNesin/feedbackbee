package io.nesin.feedbackbee.demo

import android.app.Application
import io.nesin.feedbackbee.FeedbackBee

class DemoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startFeedbackBee(DemoSettings.projectId(this))
    }
}

/** The whole integration. Shake is on by default; the endpoint is only overridden for local debugging. */
fun Application.startFeedbackBee(projectId: String) {
    val endpoint = BuildConfig.FEEDBACKBEE_ENDPOINT.ifEmpty { FeedbackBee.DEFAULT_ENDPOINT }
    FeedbackBee.init(this, projectId = projectId, endpoint = endpoint)
}
