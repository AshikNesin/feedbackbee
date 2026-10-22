package io.nesin.feedbackbarn

internal data class FeedbackConfig(val projectSlug: String, val endpoint: String) {
    val feedbackUrl: String get() = "$endpoint/api/feedback"

    companion object {
        fun create(projectSlug: String, endpoint: String): FeedbackConfig {
            val slug = projectSlug.trim()
            require(slug.isNotEmpty()) { "FeedbackBarn: projectSlug must not be blank" }
            return FeedbackConfig(slug, normalizeEndpoint(endpoint))
        }

        fun normalizeEndpoint(raw: String): String {
            val url = raw.trim().trimEnd('/')
            require(url.startsWith("https://") || url.startsWith("http://")) {
                "FeedbackBarn: endpoint must start with http:// or https:// (got \"$raw\")"
            }
            require(url.substringAfter("://").isNotEmpty()) {
                "FeedbackBarn: endpoint has no host (got \"$raw\")"
            }
            return url
        }
    }
}
