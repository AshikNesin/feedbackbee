package io.nesin.feedbackbee

/**
 * Reporter details and metadata the host set via [FeedbackBee.identify] / [FeedbackBee.setContext].
 * Held here (not on the FeedbackBee object) so the ViewModel can read them in JVM unit tests,
 * where android.os.Looper isn't available.
 */
internal object Reporter {
    private val lock = Any()
    private var identity: ReporterIdentity? = null
    private val context = LinkedHashMap<String, Any?>()

    fun identify(email: String?, name: String?, id: String?) {
        synchronized(lock) {
            identity = ReporterIdentity(
                email = email?.trim()?.takeIf { it.isNotEmpty() },
                name = name?.trim()?.takeIf { it.isNotEmpty() },
                id = id?.trim()?.takeIf { it.isNotEmpty() },
            )
        }
    }

    fun setContext(metadata: Map<String, Any?>) {
        synchronized(lock) {
            metadata.forEach { (key, value) ->
                if (value == null) context.remove(key) else context[key] = value
            }
        }
    }

    fun reset() {
        synchronized(lock) {
            identity = null
            context.clear()
        }
    }

    fun identityOrNull(): ReporterIdentity? =
        synchronized(lock) { identity?.takeIf { it.email != null || it.name != null || it.id != null } }

    fun contextOrNull(): Map<String, Any?> = synchronized(lock) { context.toMap() }
}

/** Sticky reporter details, set once per login instead of per report. */
internal data class ReporterIdentity(val email: String?, val name: String?, val id: String?)
