package io.nesin.feedbackbee.app.data

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** A failed call, with the server's message when it sent one (groot's error envelope). */
class ApiException(val status: Int, val code: String?, override val message: String) : Exception(message) {
    /** The session guard's 401: the token expired or the account is gone. */
    val sessionInvalid: Boolean get() = status == 401 && (code == "SESSION_INVALID" || code == null)
}

/** An image to attach to a new report, already encoded (see `Images.kt`). */
class Upload(val bytes: ByteArray, val mime: String, val fileName: String)

/** Device context sent with reports filed from the app (docs/CONTRACT.md). */
data class DeviceContext(val appVersion: String, val osVersion: String, val deviceModel: String)

val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

/**
 * The FeedbackBee HTTP API for one signed-in server. Responses are decoded on
 * OkHttp's threads, never the main thread; every call is cancellable.
 */
class Api(
    private val client: OkHttpClient,
    val host: String,
    private val token: String?,
    private val onSessionInvalid: () -> Unit = {},
) {
    // Auth

    suspend fun signIn(email: String, password: String): SignIn =
        call(post("/api/v1/auth/login", Login(email, password)), SignIn.serializer(), authed = false)

    // Projects

    suspend fun projects(): List<Project> = call(get("/api/v1/projects"), ListSerializer(Project.serializer()))

    suspend fun createProject(name: String, slug: String, githubRepo: String): Project =
        call(post("/api/v1/projects", NewProject(name, slug, githubRepo)), Project.serializer())

    suspend fun deleteProject(projectId: String) {
        call(request("/api/v1/projects/$projectId").delete().build(), JsonElement.serializer())
    }

    suspend fun repositories(): List<GithubRepository> =
        call(get("/api/v1/github/repositories"), ListSerializer(GithubRepository.serializer()))

    // Feedback

    suspend fun feedback(projectId: String, before: Long? = null, status: Status? = null): FeedbackPage {
        val url = "$host/api/v1/projects/$projectId/feedback".toHttpUrl().newBuilder().apply {
            if (before != null) addQueryParameter("before", before.toString())
            if (status != null) addQueryParameter("status", status.wire)
        }.build()
        return call(authed(Request.Builder().url(url)).build(), FeedbackPage.serializer())
    }

    suspend fun feedbackItem(projectId: String, feedbackId: String): FeedbackItem =
        call(get("/api/v1/projects/$projectId/feedback/$feedbackId"), FeedbackItem.serializer())

    suspend fun updateFeedback(
        projectId: String,
        feedbackId: String,
        status: Status? = null,
        kind: Kind? = null,
        text: String? = null,
    ): FeedbackItem {
        val body = FeedbackEdit(status?.wire, kind?.wire, text)
        val req = request("/api/v1/projects/$projectId/feedback/$feedbackId").patch(jsonBody(body, FeedbackEdit.serializer())).build()
        return call(req, FeedbackItem.serializer())
    }

    suspend fun deleteFeedback(projectId: String, feedbackId: String) {
        call(request("/api/v1/projects/$projectId/feedback/$feedbackId").delete().build(), JsonElement.serializer())
    }

    suspend fun sync(projectId: String): SyncResult =
        call(request("/api/v1/projects/$projectId/sync").post(ByteArray(0).toRequestBody()).build(), SyncResult.serializer())

    /** File a report through the public submit endpoint, as the owner (no rate limit). */
    suspend fun submit(
        projectSlug: String,
        kind: Kind,
        text: String,
        images: List<Upload>,
        device: DeviceContext,
    ): SubmitResult {
        val form = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("project", projectSlug)
            .addFormDataPart("kind", kind.wire)
            .addFormDataPart("text", text)
            .addFormDataPart("os_name", "android")
            .addFormDataPart("os_version", device.osVersion)
            .addFormDataPart("device_model", device.deviceModel)
            .addFormDataPart("app_version", device.appVersion)
        for (image in images) {
            form.addFormDataPart("image", image.fileName, image.bytes.toRequestBody(image.mime.toMediaType()))
        }
        return call(request("/api/v1/feedback").post(form.build()).build(), SubmitResult.serializer())
    }

    /** Public media (`/f/<key>`): immutable, cached forever by the image loader. */
    fun mediaUrl(key: String): String = "$host/f/$key"

    fun replayUrl(key: String): String = "$host/replay/$key"

    fun dashboardUrl(projectSlug: String? = null, feedbackId: String? = null): String = when {
        projectSlug == null -> "$host/app/projects"
        feedbackId == null -> "$host/app/projects/$projectSlug"
        else -> "$host/app/projects/$projectSlug?feedback=$feedbackId"
    }

    // Plumbing

    private fun request(path: String): Request.Builder = authed(Request.Builder().url(host + path))

    private fun authed(builder: Request.Builder): Request.Builder =
        if (token != null) builder.header("Authorization", "Bearer $token") else builder

    private fun get(path: String) = request(path).get().build()

    private inline fun <reified T> post(path: String, body: T): Request where T : Any =
        request(path).post(jsonBody(body, kotlinx.serialization.serializer<T>())).build()

    private fun <T> jsonBody(body: T, serializer: KSerializer<T>): RequestBody =
        json.encodeToString(serializer, body).toRequestBody(JSON)

    private suspend fun <T> call(request: Request, serializer: KSerializer<T>, authed: Boolean = true): T =
        client.newCall(request).await { response ->
            // Runs on OkHttp's thread: reading and decoding never touch the main thread.
            val text = response.body?.string().orEmpty()
            val envelope = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull()
            val success = envelope?.get("success")?.jsonPrimitive?.booleanOrNull
            if (response.isSuccessful && success == true) {
                json.decodeFromJsonElement(serializer, envelope["data"] ?: JsonObject(emptyMap()))
            } else {
                val error = envelope?.get("error") as? JsonObject
                val code = error?.get("code")?.jsonPrimitive?.contentOrNull
                val message = error?.get("message")?.jsonPrimitive?.contentOrNull
                    ?: if (response.isSuccessful) "The server sent an unexpected response" else "Request failed (${response.code})"
                val failure = ApiException(response.code, code, message)
                if (authed && failure.sessionInvalid) onSessionInvalid()
                throw failure
            }
        }

    @Serializable private data class Login(val email: String, val password: String)

    @Serializable private data class NewProject(val name: String, val slug: String, val githubRepo: String)

    @Serializable private data class FeedbackEdit(val status: String?, val kind: String?, val text: String?)

    companion object {
        private val JSON = "application/json".toMediaType()
    }
}

/**
 * Run an OkHttp call and [transform] its response on OkHttp's thread;
 * cancelling the coroutine cancels the request.
 */
suspend fun <R> Call.await(transform: (Response) -> R): R = suspendCancellableCoroutine { cont ->
    cont.invokeOnCancellation { runCatching { cancel() } }
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            val result = runCatching { response.use(transform) }
            result.fold({ cont.resume(it) }, { cont.resumeWithException(it) })
        }

        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(ApiException(0, "NETWORK", "Can't reach the server. Check your connection"))
        }
    })
}

/**
 * `runCatching` that never swallows cancellation: a request cancelled by a
 * newer refresh or a filter change is not a failure to show.
 */
inline fun <T> attempt(block: () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (cancelled: kotlinx.coroutines.CancellationException) {
        throw cancelled
    } catch (error: Throwable) {
        Result.failure(error)
    }

/** A message fit for a snackbar. */
fun Throwable.userMessage(): String = (this as? ApiException)?.message ?: message ?: "Something went wrong"
