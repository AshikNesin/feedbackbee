package io.nesin.feedbackbee.app.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import io.nesin.feedbackbee.app.AppGraph
import io.nesin.feedbackbee.app.data.FeedbackItem
import io.nesin.feedbackbee.app.data.Status
import io.nesin.feedbackbee.app.data.clock
import io.nesin.feedbackbee.app.data.pagePath
import io.nesin.feedbackbee.app.data.relativeTime
import io.nesin.feedbackbee.app.data.userMessage

/** One report: read it, triage it, edit or delete it (DESIGN.md §4.4). */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ReportScreen(graph: AppGraph, projectId: String, feedbackId: String, onBack: () -> Unit) {
    val store = remember(projectId) { graph.inbox(projectId) }
    val state by store.state.collectAsStateWithLifecycle()
    val item = state.items.firstOrNull { it.id == feedbackId }
    var fetched by remember { mutableStateOf<FeedbackItem?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val report = item ?: fetched
    val project = graph.projects.find(projectId)
    val api = graph.api()
    val uri = LocalUriHandler.current
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var viewer by remember { mutableStateOf<String?>(null) }
    var playing by remember { mutableStateOf<Playback?>(null) }

    // Opened before the list had it (or after it was filtered out): fetch the one report.
    LaunchedEffect(feedbackId, item == null) {
        if (item == null && fetched == null) {
            runCatching { store.fetch(feedbackId) }.onSuccess { fetched = it }.onFailure { loadError = it.userMessage() }
        }
    }
    // Keep the last known copy, so the screen survives the list refreshing it away.
    LaunchedEffect(item) { if (item != null) fetched = item }
    LaunchedEffect(store) { store.messages.collect { snackbar.showSnackbar(it) } }

    Scaffold(
        containerColor = Bee.paper,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                navigationIcon = { BackButton(onBack) },
                title = { Text(report?.issueNumber?.let { "Issue #$it" } ?: "Report") },
                actions = {
                    if (report != null) {
                        IconButton(onClick = { editing = true }) { Icon(Icons.Filled.Edit, contentDescription = "Edit") }
                        report.issueUrl?.let { url ->
                            IconButton(onClick = {
                                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url)
                                context.startActivity(Intent.createChooser(send, null))
                            }) { Icon(Icons.Filled.Share, contentDescription = "Share issue link") }
                        }
                        Box {
                            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, contentDescription = "More") }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, containerColor = Bee.card) {
                                if (project != null) {
                                    DropdownMenuItem(
                                        text = { Text("Open in dashboard") },
                                        leadingIcon = { Icon(Icons.AutoMirrored.Filled.OpenInNew, null) },
                                        onClick = { menu = false; uri.openUri(api.dashboardUrl(project.slug, report.id)) },
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text("Delete", color = Bee.danger) },
                                    leadingIcon = { Icon(Icons.Filled.Delete, null, tint = Bee.danger) },
                                    onClick = { menu = false; confirmDelete = true },
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Bee.paper),
            )
        },
    ) { padding ->
        if (report == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                if (loadError != null) Text(loadError!!, color = Bee.inkMuted) else CircularProgressIndicator(color = Bee.ink)
            }
            return@Scaffold
        }
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
            Row(
                Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Dot(Bee.kind(report.kind))
                Text(report.kind.label, style = MaterialTheme.typography.labelLarge, color = Bee.ink)
                Text("· ${relativeTime(report.createdAtMs)}", style = MaterialTheme.typography.labelLarge, color = Bee.inkMuted)
            }
            SelectionContainer {
                Text(
                    report.text,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Bee.ink,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            SectionHeader("Status")
            FlowRow(
                Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (status in Status.entries) {
                    FilterChip(
                        selected = report.status == status,
                        onClick = { store.setStatus(report, status) },
                        label = { Text(status.label) },
                        leadingIcon = { Dot(Bee.status(status)) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Bee.muted, selectedLabelColor = Bee.ink),
                    )
                }
            }

            if (report.images.isNotEmpty()) {
                SectionHeader("Images")
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(report.images, key = { _, key -> key }) { index, key ->
                        AsyncImage(
                            model = api.mediaUrl(key),
                            contentDescription = "Image ${index + 1}",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .height(180.dp)
                                .size(width = 135.dp, height = 180.dp)
                                .clip(MaterialTheme.shapes.medium)
                                .background(Bee.muted)
                                .clickable { viewer = api.mediaUrl(key) },
                        )
                    }
                }
            }

            SectionHeader("GitHub & media")
            when {
                report.issueUrl != null -> InfoRow("Issue", "#${report.issueNumber}", Icons.Filled.Tag) { uri.openUri(report.issueUrl) }
                report.state == "issue_error" -> InfoRow("Issue", report.issueError ?: "Not filed", Icons.Filled.Warning, valueColor = Bee.danger)
                else -> InfoRow("Issue", "Filing…", Icons.Filled.Tag)
            }
            report.recordingKey?.let { key ->
                RowDivider(48)
                if (report.isReplay) {
                    InfoRow("Replay", clock(report.recordingSeconds), Icons.Filled.PlayCircle, action = Icons.Filled.PlayArrow) {
                        playing = Playback.Replay(api.replayUrl(key))
                    }
                } else {
                    InfoRow("Recording", clock(report.recordingSeconds), Icons.Filled.PlayCircle, action = Icons.Filled.PlayArrow) {
                        playing = Playback.Video(api.mediaUrl(key))
                    }
                }
            }
            report.audioKey?.let { key ->
                RowDivider(48)
                AudioPlayerRow(api.mediaUrl(key), report.audioSeconds)
            }

            val reporter = listOfNotNull(report.reporterEmail, report.reporterName, report.reporterId)
            if (reporter.isNotEmpty()) {
                SectionHeader("Reporter")
                report.reporterEmail?.let { email ->
                    val subject = android.net.Uri.encode("Re: your feedback")
                    InfoRow("Email", email, Icons.Filled.Mail) { uri.openUri("mailto:$email?subject=$subject") }
                }
                report.reporterName?.let { InfoRow("Name", it) }
                report.reporterId?.let { InfoRow("User id", it) }
            }

            val details = listOfNotNull(
                pagePath(report.url)?.let { "Page" to it },
                report.osName?.let { "OS" to listOfNotNull(it, report.osVersion).joinToString(" ") },
                report.deviceModel?.let { "Device" to it },
                report.appVersion?.let { "App version" to it },
                if (report.screenW != null && report.screenH != null) "Screen" to "${report.screenW}×${report.screenH}" else null,
                report.userAgent?.let { "User agent" to it },
            ) + report.metadata.orEmpty().map { (k, v) -> k to v.content }
            if (details.isNotEmpty()) {
                SectionHeader("Context")
                details.forEachIndexed { index, (label, value) ->
                    if (index > 0) RowDivider()
                    if (label == "Page" && report.url != null) InfoRow(label, value) { uri.openUri(report.url) }
                    else InfoRow(label, value)
                }
            }
        }
    }

    if (editing && report != null) {
        ComposeSheet(
            title = "Edit report",
            action = "Save",
            initialKind = report.kind,
            initialText = report.text,
            allowImages = false,
            onDismiss = { editing = false },
            onSubmit = { kind, text, _ -> fetched = store.edit(report, kind, text) },
        )
    }
    if (confirmDelete && report != null) {
        ConfirmDialog(
            title = "Delete this report?",
            body = deleteReportBody(report),
            confirm = "Delete",
            onConfirm = { store.delete(report); onBack() },
            onDismiss = { confirmDelete = false },
        )
    }
    viewer?.let { url -> ImageViewer(url, onClose = { viewer = null }) }
    when (val media = playing) {
        is Playback.Replay -> ReplayViewer(media.url, onClose = { playing = null })
        is Playback.Video -> VideoViewer(media.url, onClose = { playing = null })
        null -> Unit
    }
}

/** Full-screen image: pinch to zoom, drag to pan, tap to close. */
@Composable
private fun ImageViewer(url: String, onClose: () -> Unit) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val transform = rememberTransformableState { zoom, pan, _ ->
        scale = (scale * zoom).coerceIn(1f, 6f)
        offset = if (scale == 1f) Offset.Zero else offset + pan
    }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
                .pointerInput(Unit) { detectTapGestures(onTap = { onClose() }) },
        ) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .transformable(transform)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        translationX = offset.x
                        translationY = offset.y
                    },
            )
            IconButton(onClick = onClose, modifier = Modifier.align(Alignment.TopEnd).systemBarsPadding().padding(8.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
            }
        }
    }
}

/** What's open full screen: a session replay (web page) or a screen recording (video). */
private sealed interface Playback {
    data class Replay(val url: String) : Playback
    data class Video(val url: String) : Playback
}
