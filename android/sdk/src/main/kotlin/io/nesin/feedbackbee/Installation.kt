package io.nesin.feedbackbee

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.util.Log
import androidx.fragment.app.FragmentActivity
import io.nesin.feedbackbee.shake.ShakeDetector
import io.nesin.feedbackbee.sheet.FeedbackSheetFragment
import java.lang.ref.WeakReference

/**
 * One [FeedbackBee.init] call: tracks the resumed activity so the host app never writes per-activity code,
 * and runs the shake detector only while some activity is resumed.
 */
internal class Installation(
    private val application: Application,
    val config: FeedbackConfig,
    shake: Boolean,
) : Application.ActivityLifecycleCallbacks {

    private val detector = if (shake) ShakeDetector(application, onShake = ::openFromShake) else null
    private var resumed: WeakReference<Activity>? = null

    val resumedActivity: Activity? get() = resumed?.get()

    /** [resumed] is passed on by a re-init so open() keeps working until the next onResume. */
    fun install(resumed: Activity?) {
        if (detector != null && !detector.isSupported) {
            Log.i(TAG, "No accelerometer on this device; call FeedbackBee.open() from your own button.")
        }
        application.registerActivityLifecycleCallbacks(this)
        if (resumed != null) onActivityResumed(resumed)
    }

    fun uninstall() {
        application.unregisterActivityLifecycleCallbacks(this)
        detector?.stop()
        resumed = null
    }

    fun show(options: OpenOptions = OpenOptions()) {
        when (val activity = resumedActivity) {
            null -> warn("open() ignored: no activity is in the foreground.")
            !is FragmentActivity -> warn(
                "open() ignored: ${activity.javaClass.name} is not a FragmentActivity (use AppCompatActivity or FragmentActivity).",
            )
            else -> FeedbackSheetFragment.open(activity, options)
        }
    }

    private fun openFromShake() = show()

    override fun onActivityResumed(activity: Activity) {
        resumed = WeakReference(activity)
        detector?.start()
    }

    override fun onActivityPaused(activity: Activity) {
        if (resumedActivity !== activity) return
        resumed = null
        detector?.stop()
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit

    companion object {
        private const val TAG = "FeedbackBee"

        fun warn(message: String) {
            Log.w(TAG, message)
        }

        fun warnContextDropped(key: String) {
            Log.w(TAG, "setContext: dropped metadata key \"$key\" (key or value outside the contract limits)")
        }
    }
}
