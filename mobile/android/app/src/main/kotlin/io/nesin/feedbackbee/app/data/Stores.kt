package io.nesin.feedbackbee.app.data

import android.net.Uri
import androidx.compose.runtime.Immutable
import io.nesin.feedbackbee.app.AppGraph
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@Immutable
data class ProjectsState(
    val projects: List<Project> = emptyList(),
    /** True once anything (cache or network) has filled the list. */
    val loaded: Boolean = false,
    /** True once the server (not just the cache) has answered. */
    val fromServer: Boolean = false,
    val refreshing: Boolean = false,
    val error: String? = null,
)

/** The project list: cached on disk, refreshed from the server. */
class ProjectsStore(private val graph: AppGraph, private val scope: CoroutineScope) {
    /** This session's cache; a store from a signed-out session writes nowhere. */
    private val cache = graph.cache
    private val _state = MutableStateFlow(ProjectsState())
    val state: StateFlow<ProjectsState> = _state.asStateFlow()
    private var started = false

    fun start() {
        if (started) return
        started = true
        scope.launch {
            cache.projects()?.let { cached ->
                _state.update { if (it.loaded) it else it.copy(projects = cached, loaded = true) }
            }
            refresh()
        }
    }

    fun refresh() {
        if (_state.value.refreshing) return
        _state.update { it.copy(refreshing = true, error = null) }
        scope.launch {
            attempt { graph.api().projects() }
                .onSuccess { projects ->
                    _state.update { it.copy(projects = projects, loaded = true, fromServer = true, refreshing = false) }
                    cache.saveProjects(projects)
                }
                .onFailure { e -> _state.update { it.copy(refreshing = false, loaded = true, error = e.userMessage()) } }
        }
    }

    fun find(id: String): Project? = _state.value.projects.firstOrNull { it.id == id }

    private val _repositories = MutableStateFlow<RepositoriesState>(RepositoriesState.Loading)
    /** Repositories the GitHub App can file in, for New project. */
    val repositories: StateFlow<RepositoriesState> = _repositories.asStateFlow()

    fun loadRepositories() {
        if (_repositories.value is RepositoriesState.Loaded) return
        _repositories.value = RepositoriesState.Loading
        scope.launch {
            _repositories.value = attempt { graph.api().repositories() }
                .fold({ RepositoriesState.Loaded(it) }, { RepositoriesState.Failed(it.userMessage()) })
        }
    }

    suspend fun create(name: String, slug: String, repo: String): Project {
        val project = graph.api().createProject(name, slug, repo)
        _state.update { it.copy(projects = listOf(project) + it.projects) }
        cache.saveProjects(_state.value.projects)
        return project
    }

    suspend fun delete(project: Project) {
        graph.api().deleteProject(project.id)
        _state.update { s -> s.copy(projects = s.projects.filterNot { it.id == project.id }) }
        cache.saveProjects(_state.value.projects)
    }
}

sealed interface RepositoriesState {
    data object Loading : RepositoriesState
    data class Loaded(val repositories: List<GithubRepository>) : RepositoriesState
    data class Failed(val message: String) : RepositoriesState
}

@Immutable
data class InboxState(
    val items: List<FeedbackItem> = emptyList(),
    val hasMore: Boolean = false,
    /** Server-side status filter; null is All. */
    val status: Status? = null,
    val loaded: Boolean = false,
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val error: String? = null,
)

/**
 * One project's inbox, shared by the list and the report screen so an edit in
 * one shows in the other. Status changes and deletes are optimistic and roll
 * back on failure; messages for the snackbar arrive on [messages].
 */
class InboxStore(
    private val graph: AppGraph,
    private val scope: CoroutineScope,
    val projectId: String,
) {
    private val cache = graph.cache
    private val _state = MutableStateFlow(InboxState())
    val state: StateFlow<InboxState> = _state.asStateFlow()
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages
    private var started = false
    private var pageJob: Job? = null

    fun start() {
        if (started) return
        started = true
        scope.launch {
            cache.inbox(projectId)?.let { cached ->
                _state.update { if (it.loaded) it else it.copy(items = cached.items, hasMore = cached.hasMore, loaded = true) }
            }
        }
        refresh()
    }

    fun refresh() {
        val status = _state.value.status
        pageJob?.cancel()
        _state.update { it.copy(refreshing = true, error = null) }
        pageJob = scope.launch {
            attempt { graph.api().feedback(projectId, status = status) }
                .onSuccess { page ->
                    _state.update { it.copy(items = page.items, hasMore = page.hasMore, loaded = true, refreshing = false) }
                    if (status == null) cache.saveInbox(projectId, page)
                }
                .onFailure { e -> _state.update { it.copy(refreshing = false, loaded = true, error = e.userMessage()) } }
        }
    }

    fun setStatusFilter(status: Status?) {
        if (_state.value.status == status) return
        _state.update { it.copy(status = status, items = emptyList(), hasMore = false, loaded = false) }
        refresh()
    }

    fun loadMore() {
        val s = _state.value
        if (!s.hasMore || s.loadingMore || s.refreshing) return
        val cursor = s.items.lastOrNull()?.createdAtMs ?: return
        _state.update { it.copy(loadingMore = true) }
        pageJob = scope.launch {
            attempt { graph.api().feedback(projectId, before = cursor, status = s.status) }
                .onSuccess { page ->
                    _state.update { cur ->
                        val known = cur.items.mapTo(HashSet()) { it.id }
                        cur.copy(items = cur.items + page.items.filterNot { it.id in known }, hasMore = page.hasMore, loadingMore = false)
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(loadingMore = false) }
                    _messages.tryEmit(e.userMessage())
                }
        }
    }

    fun item(id: String): FeedbackItem? = _state.value.items.firstOrNull { it.id == id }

    /** Fetch one report (e.g. opened before the list loaded) and keep it in the list. */
    suspend fun fetch(id: String): FeedbackItem {
        val item = graph.api().feedbackItem(projectId, id)
        replace(item)
        return item
    }

    fun setStatus(item: FeedbackItem, status: Status) {
        if (item.status == status) return
        replace(item.copy(status = status))
        scope.launch {
            attempt { graph.api().updateFeedback(projectId, item.id, status = status) }
                .onSuccess(::replace)
                .onFailure { e ->
                    replace(item)
                    _messages.tryEmit(e.userMessage())
                }
        }
    }

    /** Edit kind and text; GitHub is rewritten server-side, so this waits for it. */
    suspend fun edit(item: FeedbackItem, kind: Kind, text: String): FeedbackItem {
        val updated = graph.api().updateFeedback(
            projectId,
            item.id,
            kind = kind.takeIf { it != item.kind },
            text = text.takeIf { it != item.text },
        )
        replace(updated)
        return updated
    }

    fun delete(item: FeedbackItem) {
        val before = _state.value.items
        _state.update { s -> s.copy(items = s.items.filterNot { it.id == item.id }) }
        scope.launch {
            attempt { graph.api().deleteFeedback(projectId, item.id) }
                .onSuccess { _messages.tryEmit("Report deleted") }
                .onFailure { e ->
                    _state.update { it.copy(items = before) }
                    _messages.tryEmit(e.userMessage())
                }
        }
    }

    fun sync() {
        scope.launch {
            attempt { graph.api().sync(projectId) }
                .onSuccess { result ->
                    _messages.tryEmit(
                        if (result.updated == 0) "Up to date with GitHub" else "Updated ${result.updated} of ${result.checked} from GitHub",
                    )
                    refresh()
                }
                .onFailure { e -> _messages.tryEmit(e.userMessage()) }
        }
    }

    /** File a report, then show it at the top. Throws when nothing was stored. */
    suspend fun submit(project: Project, kind: Kind, text: String, images: List<Uri>) {
        val uploads = encodeForUpload(graph.contentResolver, images)
        val result = graph.api().submit(project.slug, kind, text, uploads, graph.device)
        if (result.state == "issue_error") {
            _messages.tryEmit("Saved, but GitHub refused the issue: ${result.error ?: "unknown error"}")
        } else {
            _messages.tryEmit("Filed")
        }
        val item = attempt { graph.api().feedbackItem(projectId, result.id) }.getOrNull()
        if (item == null) {
            refresh()
            return
        }
        _state.update { s ->
            if (s.status != null && s.status != item.status) s else s.copy(items = listOf(item) + s.items.filterNot { it.id == item.id })
        }
    }

    private fun replace(item: FeedbackItem) {
        _state.update { s ->
            val index = s.items.indexOfFirst { it.id == item.id }
            if (index < 0) s else s.copy(items = s.items.toMutableList().also { it[index] = item })
        }
    }
}
