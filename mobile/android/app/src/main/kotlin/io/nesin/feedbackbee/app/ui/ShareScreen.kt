package io.nesin.feedbackbee.app.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.nesin.feedbackbee.app.AppGraph

/**
 * The share target's UI: the quick-file sheet with a project picker on top,
 * prefilled with the shared images and text. Signed out, it says so and
 * offers to open the app.
 */
@Composable
fun ShareScreen(
    graph: AppGraph,
    text: String,
    images: List<Uri>,
    onFiled: (projectName: String) -> Unit,
    onCancel: () -> Unit,
    onOpenApp: () -> Unit,
) {
    val session by graph.session.collectAsStateWithLifecycle()
    if (session == null) {
        SignedOut(onCancel, onOpenApp)
        return
    }
    val store = graph.projects
    LaunchedEffect(store) { store.start() }
    val state by store.state.collectAsStateWithLifecycle()
    var projectId by rememberSaveable { mutableStateOf(graph.lastProjectId) }
    val project = state.projects.firstOrNull { it.id == projectId } ?: state.projects.firstOrNull()

    ComposeSheet(
        title = "New issue",
        action = "Send",
        initialText = text,
        initialImages = images,
        header = {
            when {
                !state.loaded -> Text("Loading projects…", style = MaterialTheme.typography.bodyMedium, color = Bee.inkMuted)
                state.projects.isEmpty() -> Text(
                    state.error ?: "No projects yet. Create one in the app first.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Bee.danger,
                )
                else -> LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(end = 8.dp)) {
                    items(state.projects, key = { it.id }) { p ->
                        FilterChip(
                            selected = p.id == project?.id,
                            onClick = { projectId = p.id },
                            label = { Text(p.name) },
                            leadingIcon = { Icon(Icons.Filled.Folder, null, Modifier.size(16.dp)) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Bee.honey,
                                selectedLabelColor = Bee.onHoney,
                                selectedLeadingIconColor = Bee.onHoney,
                                labelColor = Bee.ink,
                            ),
                        )
                    }
                }
            }
        },
        onDismiss = onCancel,
        onSubmitted = { project?.let { onFiled(it.name) } ?: onCancel() },
        onSubmit = { kind, body, attached ->
            val target = project ?: error("Pick a project first")
            graph.lastProjectId = target.id
            graph.inbox(target.id).submit(target, kind, body, attached)
        },
    )
}

@Composable
private fun SignedOut(onCancel: () -> Unit, onOpenApp: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
        Column(
            Modifier.padding(24.dp).widthIn(max = 400.dp).fillMaxWidth()
                .background(Bee.card, MaterialTheme.shapes.extraLarge).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Sign in first", style = MaterialTheme.typography.titleLarge, color = Bee.ink)
            Text(
                "Sign in to your FeedbackBee in the app, then share again.",
                style = MaterialTheme.typography.bodyMedium,
                color = Bee.inkMuted,
            )
            Button(onClick = onOpenApp, modifier = Modifier.fillMaxWidth()) { Text("Open FeedbackBee") }
            TextButton(onClick = onCancel, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Cancel", color = Bee.ink) }
        }
    }
}
