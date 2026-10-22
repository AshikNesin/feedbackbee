package io.nesin.feedbackbarn.demo

import android.content.Context

data class DemoSettings(val projectSlug: String, val endpoint: String) {

    fun save(context: Context) {
        prefs(context).edit().putString(KEY_SLUG, projectSlug).putString(KEY_ENDPOINT, endpoint).apply()
    }

    companion object {
        const val DEFAULT_SLUG = "demo"
        const val EMULATOR_ENDPOINT = "http://10.0.2.2:8787"

        private const val KEY_SLUG = "slug"
        private const val KEY_ENDPOINT = "endpoint"

        fun load(context: Context): DemoSettings {
            val prefs = prefs(context)
            return DemoSettings(
                projectSlug = prefs.getString(KEY_SLUG, null) ?: DEFAULT_SLUG,
                endpoint = prefs.getString(KEY_ENDPOINT, null) ?: EMULATOR_ENDPOINT,
            )
        }

        private fun prefs(context: Context) = context.getSharedPreferences("feedbackbarn-demo", Context.MODE_PRIVATE)
    }
}
