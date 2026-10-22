package io.nesin.feedbackbee.demo

import android.app.Application
import io.nesin.feedbackbee.FeedbackBee

class DemoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (DemoSettings.isConfigured(this)) {
            startFeedbackBee(DemoSettings.projectId(this), DemoSettings.endpoint(this))
        }
    }
}

/** The whole integration. Both the project id and website host are explicit. */
fun Application.startFeedbackBee(projectId: String, endpoint: String) {
    FeedbackBee.init(this, projectId = projectId, endpoint = endpoint)
}
