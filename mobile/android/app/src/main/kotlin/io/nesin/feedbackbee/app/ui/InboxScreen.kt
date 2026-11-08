package io.nesin.feedbackbee.app.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.nesin.feedbackbee.app.AppGraph
import io.nesin.feedbackbee.app.data.FeedbackItem
import io.nesin.feedbackbee.app.data.Kind
import io.nesin.feedbackbee.app.data.Status
import io.nesin.feedbackbee.app.data.relativeTime
import io.nesin.feedbackbee.app.data.userMessage
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

/** Kind filter on the loaded items, like the web inbox's tabs. Null is All. */
private val KIND_FILTERS = listOf(null, Kind.Issue, Kind.FeatureRequest, Kind.Other)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    graph: AppGraph,
    projectId: String,
    openCompose: Boolean,
    onBack: () -> Unit,
    onOpenReport: (String) -> Unit,
    onProjectDeleted: () -> Unit,
) {
    val store = remember(projectId) { graph.inbox(projectId) }
    val projects by graph.projects.state.collectAsStateWithLifecycle()
    LaunchedEffect(store) {
        graph.projects.start()
        store.start()
    }
    val state by store.state.collectAsStateWithLifecycle()
    val project = projects.projects.firstOrNull { it.id == projectId }

    var kindFilter by rememberSaveable { mutableStateOf<Kind?>(null) }
    var searching by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var composeConsumed by rememberSaveable { mutableStateOf(false) }
    var composing by rememberSaveable { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var confirmDeleteProject by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<FeedbackItem?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val uri = LocalUriHandler.current
    val scope = rememberCoroutineScope()

    if (openCompose && !composeConsumed) {
        composeConsumed = true
        composing = true
    }

    LaunchedEffect(store) { store.messages.collect { snackbar.showSnackbar(it) } }
    LaunchedEffect(state.error) { state.error?.let { snackbar.showSnackbar(it) } }

    val shown = remember(state.items, kindFilter, query) {
        val q = query.trim()
        state.items.filter { item ->
            (kindFilter == null || item.kind == kindFilter) &&
                (q.isEmpty() || item.text.contains(q, ignoreCase = true) ||
                    item.reporterEmail?.contains(q, ignoreCase = true) == true ||
                    item.issueNumber?.toString() == q.removePrefix("#"))
        }
    }

    // Infinite scroll: fetch the next page when within 5 rows of the end.
    val listState = rememberLazyListState()
    val nearEnd by remember {
        derivedStateOf {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= listState.layoutInfo.totalItemsCount - 5
        }
    }
    LaunchedEffect(listState, store) {
        snapshotFlow { nearEnd }.distinctUntilChanged().collect { if (it) store.loadMore() }
    }

    Scaffold(
        containerColor = Bee.paper,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            if (searching) {
                SearchBar(query, onQuery = { query = it }, onClose = { searching = false; query = "" })
            } else {
                TopAppBar(
                    navigationIcon = { BackButton(onBack) },
                    title = {
                        Column {
                            Text(project?.name ?: "Inbox", maxLines = 1, overflow = TextOverflow.Ellipsis)
                            project?.let {
                                Text(it.githubRepo, style = MaterialTheme.typography.bodySmall, color = Bee.inkMuted, maxLines = 1)
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = { searching = true }) { Icon(Icons.Filled.Search, contentDescription = "Search") }
                        Box {
                            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, contentDescription = "More") }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, containerColor = Bee.card) {
                                DropdownMenuItem(
                                    text = { Text("Sync from GitHub") },
                                    leadingIcon = { Icon(Icons.Filled.Sync, null) },
                                    onClick = { menu = false; store.sync() },
                                )
                                if (project != null) {
                                    DropdownMenuItem(
                                        text = { Text("Open in dashboard") },
                                        leadingIcon = { Icon(Icons.AutoMirrored.Filled.OpenInNew, null) },
                                        onClick = { menu = false; uri.openUri(graph.api().dashboardUrl(project.slug)) },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Delete project", color = Bee.danger) },
                                        leadingIcon = { Icon(Icons.Filled.Delete, null, tint = Bee.danger) },
                                        onClick = { menu = false; confirmDeleteProject = true },
                                    )
                                }
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Bee.paper),
                )
            }
        },
        floatingActionButton = {
            if (project != null) {
                ExtendedFloatingActionButton(
                    onClick = { composing = true },
                    icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                    text = { Text("New issue") },
                    containerColor = Bee.honey,
                    contentColor = Bee.onHoney,
                )
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Filters(
                status = state.status,
                onStatus = store::setStatusFilter,
                kind = kindFilter,
                onKind = { kindFilter = it },
            )
            HorizontalDivider(thickness = 1.dp, color = Bee.rule)
            PullToRefreshBox(
                isRefreshing = state.refreshing && state.loaded,
                onRefresh = store::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                when {
                    !state.loaded -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Bee.ink)
                    }
                    shown.isEmpty() -> EmptyState(
                        if (query.isNotBlank()) "No matches" else "Nothing here yet",
                        if (query.isNotBlank()) "Search covers the reports loaded so far." else "Reports from your widget and SDKs land here. Tap New issue to file one.",
                    )
                    else -> LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 96.dp),
                    ) {
                        items(shown, key = { it.id }, contentType = { "report" }) { item ->
                            FeedbackRow(
                                item = item,
                                onClick = { onOpenReport(item.id) },
                                onStatus = { store.setStatus(item, it) },
                                onDelete = { pendingDelete = item },
                            )
                            RowDivider(start = 36)
                        }
                        if (state.loadingMore) {
                            item(key = "more", contentType = "more") {
                                Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(Modifier.size(24.dp), color = Bee.inkMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (composing && project != null) {
        ComposeSheet(
            title = "New issue in ${project.name}",
            action = "Send",
            onDismiss = { composing = false },
            onSubmit = { kind, text, images -> store.submit(project, kind, text, images) },
        )
    }
    pendingDelete?.let { item ->
        ConfirmDialog(
            title = "Delete this report?",
            body = deleteReportBody(item),
            confirm = "Delete",
            onConfirm = { store.delete(item) },
            onDismiss = { pendingDelete = null },
        )
    }
    if (confirmDeleteProject && project != null) {
        ConfirmDialog(
            title = "Delete ${project.name}?",
            body = "Its reports are deleted from FeedbackBee. GitHub issues and uploaded media stay. Widgets using “${project.slug}” stop working.",
            confirm = "Delete project",
            onConfirm = {
                scope.launch {
                    runCatching { graph.projects.delete(project) }
                        .onSuccess { onProjectDeleted() }
                        .onFailure { snackbar.showSnackbar(it.userMessage()) }
                }
            },
            onDismiss = { confirmDeleteProject = false },
        )
    }
}

fun deleteReportBody(item: FeedbackItem): String =
    if (item.issueNumber != null) "It's removed from FeedbackBee. Issue #${item.issueNumber} stays on GitHub; set Won't fix first to close it."
    else "It's removed from FeedbackBee."

@Composable
private fun Filters(status: Status?, onStatus: (Status?) -> Unit, kind: Kind?, onKind: (Kind?) -> Unit) {
    var kindMenu by remember { mutableStateOf(false) }
    val chipColors = FilterChipDefaults.filterChipColors(
        selectedContainerColor = Bee.honey,
        selectedLabelColor = Bee.onHoney,
        selectedLeadingIconColor = Bee.onHoney,
        selectedTrailingIconColor = Bee.onHoney,
        labelColor = Bee.ink,
    )
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "kind") {
            Box {
                FilterChip(
                    selected = kind != null,
                    onClick = { kindMenu = true },
                    label = { Text(kind?.short?.let { "${it}s" } ?: "All kinds") },
                    trailingIcon = { Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(18.dp)) },
                    colors = chipColors,
                )
                DropdownMenu(expanded = kindMenu, onDismissRequest = { kindMenu = false }, containerColor = Bee.card) {
                    for (option in KIND_FILTERS) {
                        DropdownMenuItem(
                            text = { Text(option?.short?.let { "${it}s" } ?: "All kinds") },
                            leadingIcon = { if (option != null) Dot(Bee.kind(option)) },
                            onClick = { kindMenu = false; onKind(option) },
                        )
                    }
                }
            }
        }
        item(key = "all") {
            FilterChip(selected = status == null, onClick = { onStatus(null) }, label = { Text("All") }, colors = chipColors)
        }
        items(Status.entries, key = { it.name }) { option ->
            FilterChip(
                selected = status == option,
                onClick = { onStatus(option) },
                label = { Text(option.label) },
                leadingIcon = { Dot(if (status == option) Bee.onHoney else Bee.status(option)) },
                colors = chipColors,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FeedbackRow(item: FeedbackItem, onClick: () -> Unit, onStatus: (Status) -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier
                .fillMaxWidth()
                .combinedClickable(onClick = onClick, onLongClick = { menu = true })
                .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.padding(top = 6.dp)) { Dot(Bee.kind(item.kind)) }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        item.text,
                        style = MaterialTheme.typography.bodyLarge,
                        color = Bee.ink,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(relativeTime(item.createdAtMs), style = MaterialTheme.typography.labelMedium, color = Bee.inkMuted)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatusLabel(item.status)
                    item.issueNumber?.let { Meta("#$it") }
                    if (item.state == "issue_error") Icon(Icons.Filled.Warning, "Issue not filed", tint = Bee.danger, modifier = Modifier.size(14.dp))
                    if (item.images.isNotEmpty()) MetaIcon(Icons.Filled.Image, if (item.images.size > 1) "${item.images.size}" else null)
                    if (item.recordingKey != null) MetaIcon(Icons.Filled.PlayCircle, null)
                    if (item.audioKey != null) MetaIcon(Icons.Filled.Mic, null)
                    (item.reporterEmail ?: item.reporterName)?.let {
                        Text(it, style = MaterialTheme.typography.labelMedium, color = Bee.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, containerColor = Bee.card) {
            for (status in Status.entries) {
                DropdownMenuItem(
                    text = { Text(status.label) },
                    leadingIcon = { Dot(Bee.status(status)) },
                    trailingIcon = { if (status == item.status) Text("✓", color = Bee.ink) },
                    onClick = { menu = false; onStatus(status) },
                )
            }
            HorizontalDivider(color = Bee.rule)
            DropdownMenuItem(
                text = { Text("Delete", color = Bee.danger) },
                leadingIcon = { Icon(Icons.Filled.Delete, null, tint = Bee.danger) },
                onClick = { menu = false; onDelete() },
            )
        }
    }
}

@Composable
private fun Meta(text: String) {
    Text(text, style = MaterialTheme.typography.labelMedium, color = Bee.inkMuted)
}

@Composable
private fun MetaIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, count: String?) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Icon(icon, contentDescription = null, tint = Bee.inkMuted, modifier = Modifier.size(14.dp))
        count?.let { Meta(it) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchBar(query: String, onQuery: (String) -> Unit, onClose: () -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    TopAppBar(
        navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Filled.Close, contentDescription = "Close search") } },
        title = {
            TextField(
                value = query,
                onValueChange = onQuery,
                placeholder = { Text("Search reports") },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Bee.paper,
                    unfocusedContainerColor = Bee.paper,
                    focusedIndicatorColor = Bee.paper,
                    unfocusedIndicatorColor = Bee.paper,
                ),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = Bee.paper),
    )
}
