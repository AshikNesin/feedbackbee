package io.nesin.feedbackbee.reactnative

import android.app.Application
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.LifecycleState
import io.nesin.feedbackbee.FeedbackBee
import io.nesin.feedbackbee.FeedbackConfig
import io.nesin.feedbackbee.FeedbackKind
import io.nesin.feedbackbee.OpenOptions

/** TurboModule entry point. Calls forward to the vendored Android SDK; nothing here blocks the JS thread. */
class FeedbackBeeModule(reactContext: ReactApplicationContext) : NativeFeedbackBeeSpec(reactContext) {

    /** Validates on the JS thread so a bad config throws in JS; the setup itself runs on the UI thread. */
    override fun configure(projectId: String, endpoint: String, shake: Boolean): String? {
        try {
            FeedbackConfig.create(projectId, endpoint)
        } catch (e: IllegalArgumentException) {
            return e.message ?: "FeedbackBee: invalid configuration"
        }
        val context = reactApplicationContext
        UiThreadUtil.runOnUiThread {
            // The host activity resumed long before JS ran, so hand it over instead of waiting for the next resume.
            val resumed = context.currentActivity?.takeIf { context.lifecycleState == LifecycleState.RESUMED }
            FeedbackBee.init(context.applicationContext as Application, projectId, endpoint, shake, resumed)
        }
        return null
    }

    override fun open(kind: String?, lockKind: Boolean, text: String) {
        val feedbackKind = FeedbackKind.entries.firstOrNull { it.wire == kind }
        FeedbackBee.open(OpenOptions(kind = feedbackKind, lockKind = lockKind, text = text))
    }

    override fun identify(email: String?, name: String?, reporterId: String?) {
        FeedbackBee.identify(email = email, name = name, id = reporterId)
    }

    override fun setContext(context: ReadableMap) {
        // Numbers arrive as Double; the SDK's encoder validates every value against the contract.
        FeedbackBee.setContext(context.toHashMap())
    }

    override fun reset() {
        FeedbackBee.reset()
    }

    companion object {
        const val NAME = NativeFeedbackBeeSpec.NAME
    }
}
