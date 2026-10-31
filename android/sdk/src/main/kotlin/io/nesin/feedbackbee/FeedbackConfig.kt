package io.nesin.feedbackbee

import java.net.URI
import java.net.URISyntaxException

internal data class FeedbackConfig(val projectId: String, val endpoint: String) {
    val feedbackUrl: String get() = "$endpoint/api/v1/feedback"

    companion object {
        fun create(projectId: String, endpoint: String): FeedbackConfig {
            val id = projectId.trim()
            require(id.isNotEmpty()) { "FeedbackBee: projectId must not be blank" }
            return FeedbackConfig(id, normalizeEndpoint(endpoint))
        }

        fun normalizeEndpoint(raw: String): String {
            val url = raw.trim()
            require(url.isNotEmpty()) { "FeedbackBee: endpoint must not be blank" }
            val uri = try {
                URI(url)
            } catch (_: URISyntaxException) {
                throw IllegalArgumentException("FeedbackBee: endpoint must be a valid http:// or https:// URL with a host")
            }
            require(uri.scheme?.lowercase() in listOf("http", "https") && !uri.host.isNullOrBlank()) {
                "FeedbackBee: endpoint must be a valid http:// or https:// URL with a host"
            }
            require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null) {
                "FeedbackBee: endpoint must not include credentials, query parameters, or a fragment"
            }
            require(uri.port == -1 || uri.port in 1..65535) {
                "FeedbackBee: endpoint port must be between 1 and 65535"
            }
            return url.trimEnd('/')
        }
    }
}
