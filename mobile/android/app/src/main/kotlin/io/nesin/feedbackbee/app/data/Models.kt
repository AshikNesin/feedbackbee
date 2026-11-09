package io.nesin.feedbackbee.app.data

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant

/**
 * The dashboard API's shapes (apps/web/src/server/wire-types.ts). Unknown
 * fields are ignored, so a newer server never breaks an older app.
 */

@Serializable
enum class Kind(val label: String, val short: String) {
    @SerialName("issue") Issue("Issue", "Issue"),
    @SerialName("feature_request") FeatureRequest("Feature request", "Idea"),
    @SerialName("other") Other("Other", "Other");

    /** The wire value, for multipart form fields. */
    val wire: String get() = when (this) {
        Issue -> "issue"
        FeatureRequest -> "feature_request"
        Other -> "other"
    }
}

@Serializable
enum class Status(val label: String) {
    @SerialName("open") Open("Open"),
    @SerialName("in_progress") InProgress("In progress"),
    @SerialName("done") Done("Done"),
    @SerialName("wont_fix") WontFix("Won't fix");

    val wire: String get() = when (this) {
        Open -> "open"
        InProgress -> "in_progress"
        Done -> "done"
        WontFix -> "wont_fix"
    }
}

@Immutable
@Serializable
data class Project(
    val id: String,
    val name: String,
    val slug: String,
    val githubRepo: String,
    val createdAt: String? = null,
)

@Immutable
@Serializable
data class FeedbackItem(
    val id: String,
    val projectId: String,
    val kind: Kind,
    val text: String,
    val status: Status = Status.Open,
    val state: String = "pending",
    val reporterEmail: String? = null,
    val reporterName: String? = null,
    val reporterId: String? = null,
    val metadata: Map<String, JsonPrimitive>? = null,
    val url: String? = null,
    val userAgent: String? = null,
    /** Numbers on the wire; the web widget may send fractional CSS pixels. */
    val screenW: Double? = null,
    val screenH: Double? = null,
    val appVersion: String? = null,
    val osName: String? = null,
    val osVersion: String? = null,
    val deviceModel: String? = null,
    val recordingKey: String? = null,
    val recordingSeconds: Double? = null,
    val audioKey: String? = null,
    val audioSeconds: Double? = null,
    val issueNumber: Int? = null,
    val issueUrl: String? = null,
    val issueError: String? = null,
    val createdAt: String,
    val images: List<String> = emptyList(),
) {
    /** `createdAt` in epoch ms: the paging cursor and the row's time. */
    val createdAtMs: Long by lazy { runCatching { Instant.parse(createdAt).toEpochMilli() }.getOrDefault(0L) }

    val isReplay: Boolean get() = recordingKey?.endsWith(".rrweb.gz") == true
}

@Serializable
data class FeedbackPage(val items: List<FeedbackItem>, val hasMore: Boolean)

@Serializable
data class SessionUser(val id: Int, val email: String, val name: String? = null)

@Serializable
data class SignIn(val token: String, val user: SessionUser)

@Serializable
data class GithubRepository(val id: Long, val fullName: String)

@Serializable
data class SubmitResult(val id: String, val state: String, val issueUrl: String? = null, val error: String? = null)

@Serializable
data class SyncResult(val checked: Int, val updated: Int)

/** Who is signed in where. The token is kept encrypted (see [SessionStore]). */
data class Session(val host: String, val email: String, val token: String)
