package io.nesin.feedbackbarn.demo

import android.app.Application
import io.nesin.feedbackbarn.FeedbackBarn

class DemoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val settings = DemoSettings.load(this)
        runCatching { FeedbackBarn.init(this, settings.projectSlug, settings.endpoint) }
            .onFailure { FeedbackBarn.init(this, DemoSettings.DEFAULT_SLUG, DemoSettings.EMULATOR_ENDPOINT) }
    }
}
