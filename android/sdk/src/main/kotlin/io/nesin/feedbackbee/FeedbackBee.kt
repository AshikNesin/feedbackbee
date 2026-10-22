package io.nesin.feedbackbee

import android.app.Application
import android.os.Handler
import android.os.Looper

/**
 * Feedback for Android: a bottom sheet with an optional annotated screenshot, sent to a FeedbackBee Worker.
 *
 * Set it up once in your [Application]; nothing else is needed per activity:
 *
 * ```kotlin
 * class MyApp : Application() {
 *     override fun onCreate() {
 *         super.onCreate()
 *         FeedbackBee.init(this, projectId = "myapp")
 *     }
 * }
 * ```
 *
 * The sheet is a DialogFragment, so the foreground activity must be a `FragmentActivity`
 * (`AppCompatActivity` is one; for Compose extend `FragmentActivity` instead of `ComponentActivity`).
 *
 * Privacy: the SDK only reads its host app's own window, and only when the user taps the camera button.
 * It never touches notifications, SMS or system logs, and nothing leaves the device until the user presses Send.
 */
object FeedbackBee {

    /** The hosted FeedbackBee Worker. Override `endpoint` in [init] when you self-host. */
    const val DEFAULT_ENDPOINT = "https://feedbackbee.ashik.workers.dev"

    private val mainThread = Handler(Looper.getMainLooper())
    private var installation: Installation? = null

    /**
     * Starts FeedbackBee. Call it from `Application.onCreate`. Calling it again replaces the previous setup.
     *
     * ```kotlin
     * FeedbackBee.init(this, projectId = "myapp")                          // shake to open the sheet
     * FeedbackBee.init(this, projectId = "myapp", shake = false)           // open it yourself with show()
     * FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev")  // self-hosted
     * ```
     *
     * @param projectId the project id from your FeedbackBee dashboard.
     * @param shake when true (the default), three firm jolts within 1.5 seconds open the sheet.
     * @param endpoint base URL of the Worker. Defaults to [DEFAULT_ENDPOINT]; override it when self-hosting.
     * @throws IllegalArgumentException if [projectId] is blank or [endpoint] is not an http(s) URL.
     */
    @JvmStatic
    @JvmOverloads
    fun init(application: Application, projectId: String, shake: Boolean = true, endpoint: String = DEFAULT_ENDPOINT) {
        val config = FeedbackConfig.create(projectId, endpoint)
        val previous = installation
        val resumed = previous?.resumedActivity
        previous?.uninstall()
        installation = Installation(application, config, shake).also { it.install(resumed) }
    }

    /**
     * Opens the feedback sheet over the foreground activity, for example from a "Send feedback" button.
     * Does nothing while a sheet is already open. Safe to call from any thread.
     */
    @JvmStatic
    fun show() {
        if (Looper.myLooper() == Looper.getMainLooper()) showNow() else mainThread.post(::showNow)
    }

    internal fun configOrNull(): FeedbackConfig? = installation?.config

    private fun showNow() {
        val current = installation ?: return Installation.warn("show() ignored: call FeedbackBee.init() first.")
        current.show()
    }
}
