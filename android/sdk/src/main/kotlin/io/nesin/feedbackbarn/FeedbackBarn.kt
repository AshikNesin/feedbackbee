package io.nesin.feedbackbarn

import android.app.Application
import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import io.nesin.feedbackbarn.shake.ShakeDetector
import io.nesin.feedbackbarn.sheet.FeedbackSheetFragment
import java.lang.ref.WeakReference

/**
 * Shake-to-feedback for Android. Call every function on the main thread.
 *
 * Privacy: the SDK only ever reads its host app's own window, and only when the user taps
 * "Attach screenshot". It never touches notifications, SMS or system logs, and nothing
 * leaves the device until the user presses Send.
 */
object FeedbackBarn {
    private const val TAG = "FeedbackBarn"

    private var config: FeedbackConfig? = null
    private var registration: Registration? = null

    /** Throws [IllegalArgumentException] for a blank slug or an endpoint that is not an http(s) URL. */
    fun init(app: Application, projectSlug: String, endpoint: String) {
        config = FeedbackConfig.create(projectSlug, endpoint)
        if (!app.packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_ACCELEROMETER)) {
            Log.i(TAG, "No accelerometer on this device; call showFeedbackSheet() from your own button.")
        }
    }

    /**
     * Starts shake detection while [activity] is resumed. The activity must be a
     * [FragmentActivity] (AppCompatActivity and most Compose templates are); the sheet is a DialogFragment.
     */
    fun register(activity: ComponentActivity) {
        unregister()
        if (activity !is FragmentActivity) {
            Log.w(TAG, "register() needs a FragmentActivity; ${activity.javaClass.name} is not one.")
            return
        }
        val detector = ShakeDetector(activity, onShake = { showFeedbackSheet(activity) })
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> detector.start()
                Lifecycle.Event.ON_PAUSE -> detector.stop()
                Lifecycle.Event.ON_DESTROY -> if (registration?.activity?.get() === activity) unregister()
                else -> Unit
            }
        }
        registration = Registration(WeakReference(activity), detector, observer)
        activity.lifecycle.addObserver(observer)
    }

    fun unregister() {
        val current = registration ?: return
        registration = null
        current.detector.stop()
        current.activity.get()?.lifecycle?.removeObserver(current.observer)
    }

    /** Does nothing while a sheet is already open, so a shake can never stack a second one. */
    fun showFeedbackSheet(activity: ComponentActivity) {
        if (config == null) {
            Log.w(TAG, "showFeedbackSheet() ignored: call FeedbackBarn.init() first.")
            return
        }
        if (activity !is FragmentActivity) {
            Log.w(TAG, "showFeedbackSheet() needs a FragmentActivity.")
            return
        }
        val fragments = activity.supportFragmentManager
        if (fragments.isStateSaved || fragments.isDestroyed) return
        if (fragments.findFragmentByTag(FeedbackSheetFragment.TAG) != null) return
        FeedbackSheetFragment().show(fragments, FeedbackSheetFragment.TAG)
    }

    internal fun configOrNull(): FeedbackConfig? = config

    private class Registration(
        val activity: WeakReference<ComponentActivity>,
        val detector: ShakeDetector,
        val observer: LifecycleEventObserver,
    )
}
