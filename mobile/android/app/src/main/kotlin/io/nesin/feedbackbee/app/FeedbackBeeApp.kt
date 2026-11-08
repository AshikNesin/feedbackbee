package io.nesin.feedbackbee.app

import android.app.Application
import android.content.ContentResolver
import android.os.Build
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache as CoilDiskCache
import coil3.disk.directory
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import io.nesin.feedbackbee.app.data.Api
import io.nesin.feedbackbee.app.data.DeviceContext
import io.nesin.feedbackbee.app.data.DiskCache
import io.nesin.feedbackbee.app.data.InboxStore
import io.nesin.feedbackbee.app.data.ProjectsStore
import io.nesin.feedbackbee.app.data.Session
import io.nesin.feedbackbee.app.data.SessionStore
import io.nesin.feedbackbee.app.data.normalizeHost
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.io.File
import java.util.concurrent.TimeUnit

class FeedbackBeeApp : Application(), SingletonImageLoader.Factory {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
    }

    /** Media at `/f/<key>` is immutable: a large disk cache, decoded at view size into memory. */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { graph.http })) }
            .memoryCache { MemoryCache.Builder().maxSizePercent(context, 0.2).build() }
            .diskCache { CoilDiskCache.Builder().directory(context.cacheDir.resolve("media")).maxSizeBytes(256L * 1024 * 1024).build() }
            .crossfade(true)
            .build()
}

/**
 * The app's one set of long-lived objects: the HTTP client, the session, the
 * disk cache and the stores. Signing out or switching servers drops the stores
 * and the cache, so no data from one account shows in another.
 */
class AppGraph(private val app: Application, private val sessionStore: SessionStore = SessionStore(app)) {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS) // image uploads on slow networks
        .build()

    private val _session = MutableStateFlow(sessionStore.load())
    val session: StateFlow<Session?> = _session.asStateFlow()

    val cache = DiskCache(File(app.filesDir, "cache"))
    val contentResolver: ContentResolver get() = app.contentResolver

    val device = DeviceContext(
        appVersion = BuildConfig.VERSION_NAME,
        osVersion = Build.VERSION.RELEASE,
        deviceModel = listOf(Build.MANUFACTURER.replaceFirstChar { it.uppercase() }, Build.MODEL)
            .distinct().joinToString(" ").take(128),
    )

    private var scope = newScope()
    private var api: Api? = null
    var projects = ProjectsStore(this, scope)
        private set
    private val inboxes = HashMap<String, InboxStore>()

    val lastHost: String? get() = sessionStore.lastHost
    val lastEmail: String? get() = sessionStore.lastEmail

    var lastProjectId: String?
        get() = sessionStore.lastProjectId
        set(value) { sessionStore.lastProjectId = value }

    /** The API for the signed-in server. Throws when signed out (screens never call it then). */
    fun api(): Api {
        api?.let { return it }
        val s = _session.value ?: error("Not signed in")
        return Api(http, s.host, s.token, onSessionInvalid = ::expire).also { api = it }
    }

    fun inbox(projectId: String): InboxStore = inboxes.getOrPut(projectId) { InboxStore(this, scope, projectId) }

    /** Sign in, then switch to that session. Throws with the server's message on failure. */
    suspend fun signIn(hostInput: String, email: String, password: String) {
        val host = normalizeHost(hostInput) ?: throw IllegalArgumentException("Enter your FeedbackBee address, like bee.example.com")
        val result = Api(http, host, token = null).signIn(email.trim(), password)
        val session = Session(host, result.user.email, result.token)
        if (lastHost != host || lastEmail != session.email) cache.clear()
        sessionStore.save(session)
        reset()
        _session.value = session
    }

    fun signOut() {
        sessionStore.clear()
        reset()
        _session.value = null
        CoroutineScope(Dispatchers.IO).launch { cache.clear() }
    }

    /** The server refused the token (expired or the account is gone): back to sign-in. */
    private fun expire() {
        CoroutineScope(Dispatchers.Main).launch { if (_session.value != null) signOut() }
    }

    private fun reset() {
        scope.cancel()
        scope = newScope()
        api = null
        inboxes.clear()
        projects = ProjectsStore(this, scope)
    }

    private fun newScope() = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
}
