package io.nesin.feedbackbee.demo

import android.content.Context

object DemoSettings {
    const val DEFAULT_PROJECT_ID = "demo"

    private const val KEY_PROJECT_ID = "project-id"
    private const val KEY_ENDPOINT = "endpoint"

    fun projectId(context: Context): String =
        prefs(context).getString(KEY_PROJECT_ID, null) ?: DEFAULT_PROJECT_ID

    fun endpoint(context: Context): String =
        prefs(context).getString(KEY_ENDPOINT, null) ?: BuildConfig.FEEDBACKBEE_ENDPOINT

    fun isConfigured(context: Context): Boolean = prefs(context).contains(KEY_ENDPOINT)

    fun saveConfiguration(context: Context, projectId: String, endpoint: String) {
        prefs(context).edit()
            .putString(KEY_PROJECT_ID, projectId.trim())
            .putString(KEY_ENDPOINT, endpoint.trim().trimEnd('/'))
            .apply()
    }

    private fun prefs(context: Context) = context.getSharedPreferences("feedbackbee-demo", Context.MODE_PRIVATE)
}
