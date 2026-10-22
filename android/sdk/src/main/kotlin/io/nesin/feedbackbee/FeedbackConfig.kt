package io.nesin.feedbackbee

internal data class FeedbackConfig(val projectId: String, val endpoint: String) {
    val feedbackUrl: String get() = "$endpoint/api/feedback"

    companion object {
        fun create(projectId: String, endpoint: String): FeedbackConfig {
            val id = projectId.trim()
            require(id.isNotEmpty()) { "FeedbackBee: projectId must not be blank" }
            return FeedbackConfig(id, normalizeEndpoint(endpoint))
        }

        fun normalizeEndpoint(raw: String): String {
            val url = raw.trim().trimEnd('/')
            require(url.startsWith("https://") || url.startsWith("http://")) {
                "FeedbackBee: endpoint must start with http:// or https:// (got \"$raw\")"
            }
            require(url.substringAfter("://").isNotEmpty()) {
                "FeedbackBee: endpoint has no host (got \"$raw\")"
            }
            return url
        }
    }
}
