package io.nesin.feedbackbee.demo

import android.app.Application
import io.nesin.feedbackbee.FeedbackBee

class DemoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val settings = DemoSettings.load(this)
        runCatching { FeedbackBee.init(this, settings.projectSlug, settings.endpoint) }
            .onFailure { FeedbackBee.init(this, DemoSettings.DEFAULT_SLUG, DemoSettings.EMULATOR_ENDPOINT) }
    }
}
