package io.nesin.feedbackbee.demo

import android.content.Context

object DemoSettings {
    const val DEFAULT_PROJECT_ID = "demo"

    private const val KEY_PROJECT_ID = "project-id"

    fun projectId(context: Context): String =
        prefs(context).getString(KEY_PROJECT_ID, null) ?: DEFAULT_PROJECT_ID

    fun saveProjectId(context: Context, projectId: String) {
        prefs(context).edit().putString(KEY_PROJECT_ID, projectId).apply()
    }

    private fun prefs(context: Context) = context.getSharedPreferences("feedbackbee-demo", Context.MODE_PRIVATE)
}
