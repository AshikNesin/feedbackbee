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
 *         FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev")
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

    private val mainThread = Handler(Looper.getMainLooper())
    private var installation: Installation? = null

    /**
     * Starts FeedbackBee. Call it from `Application.onCreate`. Calling it again replaces the previous setup.
     *
     * ```kotlin
     * FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev")
     * FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev", shake = false)
     * ```
     *
     * @param projectId the project id from your FeedbackBee dashboard.
     * @param endpoint required base URL of your FeedbackBee website or Worker. There is no default server.
     * @param shake when true (the default), three firm jolts within 1.5 seconds open the sheet.
     * @throws IllegalArgumentException if [projectId] is blank or [endpoint] is not an http(s) URL.
     */
    @JvmStatic
    @JvmOverloads
    fun init(application: Application, projectId: String, endpoint: String, shake: Boolean = true) {
        val config = FeedbackConfig.create(projectId, endpoint)
        val previous = installation
        val resumed = previous?.resumedActivity
        previous?.uninstall()
        installation = Installation(application, config, shake).also { it.install(resumed) }
    }

    /**
     * Opens the feedback sheet over the foreground activity, for example from a "Send feedback" button.
     * Does nothing while a sheet is already open. Safe to call from any thread.
     *
     * `options` preselects the feedback type, prefills the note, or locks the type picker:
     *
     * ```kotlin
     * FeedbackBee.open()                                                            // picker, like a shake
     * FeedbackBee.open(OpenOptions(kind = FeedbackKind.Issue, lockKind = true))     // a "Report a problem" button
     * ```
     */
    @JvmStatic
    @JvmOverloads
    fun open(options: OpenOptions = OpenOptions()) {
        if (Looper.myLooper() == Looper.getMainLooper()) openNow(options) else mainThread.post { openNow(options) }
    }

    /** Reporter details the host already knows. Sticky: applied to every [open] until [reset] or the next call. */
    @JvmStatic
    @JvmOverloads
    fun identify(email: String? = null, name: String? = null, id: String? = null) = Reporter.identify(email, name, id)

    /** Extra key/value context for every report (plan, build, feature flag…). Merge semantics; a null value removes a key. Sticky until [reset]. */
    @JvmStatic
    fun setContext(metadata: Map<String, Any?>) = Reporter.setContext(metadata)

    /** Clears [identify] and [setContext] state, e.g. on logout. The sheet, if open, keeps what it already drew. */
    @JvmStatic
    fun reset() = Reporter.reset()

    internal fun configOrNull(): FeedbackConfig? = installation?.config

    private fun openNow(options: OpenOptions) {
        val current = installation ?: return Installation.warn("open() ignored: call FeedbackBee.init() first.")
        current.show(options)
    }
}

/** Per-open options for [FeedbackBee.open]. */
data class OpenOptions(
    /** Preselected feedback type. `null` shows the picker, as a shake does. */
    val kind: FeedbackKind? = null,
    /** Hides the type picker and its Back control: for a dedicated "Report a problem" button. */
    val lockKind: Boolean = false,
    /** Prefilled note; the user can edit it. */
    val text: String = "",
) {
    internal fun toBundle(): android.os.Bundle = android.os.Bundle().apply {
        putString(ARG_KIND, kind?.name)
        putBoolean(ARG_LOCK_KIND, lockKind)
        putString(ARG_TEXT, text)
    }

    internal companion object {
        private const val ARG_KIND = "kind"
        private const val ARG_LOCK_KIND = "lockKind"
        private const val ARG_TEXT = "text"

        fun fromArguments(arguments: android.os.Bundle?): OpenOptions = OpenOptions(
            kind = arguments?.getString(ARG_KIND)?.let { runCatching { FeedbackKind.valueOf(it) }.getOrNull() },
            lockKind = arguments?.getBoolean(ARG_LOCK_KIND) ?: false,
            text = arguments?.getString(ARG_TEXT) ?: "",
        )
    }
}
