package io.nesin.feedbackbee.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.nesin.feedbackbee.app.AppGraph
import io.nesin.feedbackbee.app.data.GithubRepository
import io.nesin.feedbackbee.app.data.Project
import io.nesin.feedbackbee.app.data.RepositoriesState
import io.nesin.feedbackbee.app.data.isValidSlug
import io.nesin.feedbackbee.app.data.slugify
import io.nesin.feedbackbee.app.data.userMessage
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(graph: AppGraph, onOpen: (Project) -> Unit, onSettings: () -> Unit) {
    val store = graph.projects
    LaunchedEffect(store) { store.start() }
    val state by store.state.collectAsStateWithLifecycle()
    var creating by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.error) { state.error?.let { snackbar.showSnackbar(it) } }

    Scaffold(
        containerColor = Bee.paper,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Projects") },
                actions = {
                    IconButton(onClick = { creating = true }) { Icon(Icons.Filled.Add, contentDescription = "New project") }
                    IconButton(onClick = onSettings) { Icon(Icons.Filled.Settings, contentDescription = "Settings") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Bee.paper),
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing && state.loaded,
            onRefresh = store::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                !state.loaded -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Bee.ink) }
                state.projects.isEmpty() && state.error != null -> EmptyState("Couldn't load projects", "${state.error} Pull to retry.")
                state.projects.isEmpty() -> EmptyState(
                    "No projects yet",
                    "A project files its reports as issues in one GitHub repository. Tap + to add one.",
                )
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(state.projects, key = { it.id }) { project ->
                        ProjectRow(project, onClick = { onOpen(project) })
                        RowDivider()
                    }
                }
            }
        }
    }

    if (creating) {
        NewProjectSheet(graph, onDismiss = { creating = false }, onCreated = { creating = false; onOpen(it) })
    }
}

@Composable
private fun ProjectRow(project: Project, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(project.name, style = MaterialTheme.typography.titleMedium, color = Bee.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                "${project.slug} · ${project.githubRepo}",
                style = MaterialTheme.typography.bodyMedium,
                color = Bee.inkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Bee.inkMuted)
    }
}

/** Name → project id (derived until edited) → a repository the GitHub App can file in. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewProjectSheet(graph: AppGraph, onDismiss: () -> Unit, onCreated: (Project) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var slug by rememberSaveable { mutableStateOf("") }
    var slugEdited by rememberSaveable { mutableStateOf(false) }
    var repo by rememberSaveable { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val loaded by graph.projects.repositories.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { graph.projects.loadRepositories() }
    val repos: List<GithubRepository>? = when (val r = loaded) {
        RepositoriesState.Loading -> null
        is RepositoriesState.Loaded -> r.repositories
        is RepositoriesState.Failed -> emptyList()
    }
    LaunchedEffect(repos) { if (repo == null && repos?.size == 1) repo = repos[0].fullName }
    val loadError = (loaded as? RepositoriesState.Failed)?.message

    val effectiveSlug = if (slugEdited) slug else slugify(name)
    val canCreate = name.isNotBlank() && isValidSlug(effectiveSlug) && repo != null && !busy

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Bee.card) {
        Column(
            Modifier.fillMaxWidth().imePadding().padding(horizontal = 16.dp).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("New project", style = MaterialTheme.typography.titleLarge, color = Bee.ink)
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                placeholder = { Text("My app") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = effectiveSlug,
                onValueChange = { slug = it.lowercase(); slugEdited = true },
                label = { Text("Project id") },
                supportingText = { Text("Used in the embed snippet and SDKs. Can't change later.") },
                isError = effectiveSlug.isNotEmpty() && !isValidSlug(effectiveSlug),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, autoCorrectEnabled = false),
                modifier = Modifier.fillMaxWidth(),
            )
            Text("GitHub repository", style = MaterialTheme.typography.labelLarge, color = Bee.inkMuted)
            val list = repos
            when {
                list == null -> CircularProgressIndicator(Modifier.size(24.dp), color = Bee.ink)
                list.isEmpty() -> Text(
                    if (loadError != null) "Couldn't load repositories. Close this sheet and open it again to retry."
                    else "No repositories yet. Connect GitHub in the web dashboard (Settings → GitHub) and install the app on a repository.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Bee.inkMuted,
                )
                else -> LazyColumn(Modifier.fillMaxWidth().heightIn(max = 240.dp)) {
                    items(list, key = { it.id }) { r ->
                        Row(
                            Modifier.fillMaxWidth().clickable { repo = r.fullName }.padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = repo == r.fullName, onClick = { repo = r.fullName })
                            Text(r.fullName, style = MaterialTheme.typography.bodyLarge, color = Bee.ink)
                        }
                    }
                }
            }
            (error ?: loadError)?.let { Text(it, color = Bee.danger, style = MaterialTheme.typography.bodyMedium) }
            Button(
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        runCatching { graph.projects.create(name.trim(), effectiveSlug, repo!!) }
                            .onSuccess(onCreated)
                            .onFailure { error = it.userMessage(); busy = false }
                    }
                },
                enabled = canCreate,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (busy) "Creating…" else "Create project") }
        }
    }
}
