package io.nesin.feedbackbee.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import io.nesin.feedbackbee.app.data.Kind
import io.nesin.feedbackbee.app.data.userMessage
import kotlinx.coroutines.launch

/** Reports carry at most 5 images (docs/CONTRACT.md). */
private const val MAX_IMAGES = 5

/**
 * The quick-file sheet (DESIGN.md §4.5): kind chips, the note already
 * focused, optional images, Send. With [allowImages] off it edits a report.
 * [onSubmit] throws to keep the sheet open with the error shown.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComposeSheet(
    title: String,
    action: String,
    initialKind: Kind = Kind.Issue,
    initialText: String = "",
    allowImages: Boolean = true,
    /** Images already attached, e.g. shared into the app (at most 5 are kept). */
    initialImages: List<Uri> = emptyList(),
    /** Shown under the title, e.g. the share sheet's project picker. */
    header: (@Composable () -> Unit)? = null,
    onDismiss: () -> Unit,
    /** After a successful send; defaults to [onDismiss]. */
    onSubmitted: () -> Unit = onDismiss,
    onSubmit: suspend (Kind, String, List<Uri>) -> Unit,
) {
    var kind by rememberSaveable { mutableStateOf(initialKind) }
    var text by rememberSaveable { mutableStateOf(initialText) }
    val images = remember { mutableStateListOf<Uri>().apply { addAll(initialImages.distinct().take(MAX_IMAGES)) } }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_IMAGES)) { picked ->
        images.addAll(picked.filterNot { it in images }.take(MAX_IMAGES - images.size))
    }

    LaunchedEffect(Unit) { focus.requestFocus() }

    val changed = text.trim() != initialText.trim() || kind != initialKind
    val canSend = text.isNotBlank() && !busy && (allowImages || changed)

    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        sheetState = sheet,
        containerColor = Bee.card,
    ) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = Bee.ink)
            header?.invoke()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (option in Kind.entries) {
                    FilterChip(
                        selected = kind == option,
                        onClick = { kind = option },
                        label = { Text(option.short) },
                        leadingIcon = { Dot(Bee.kind(option)) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Bee.muted,
                            selectedLabelColor = Bee.ink,
                            labelColor = Bee.inkMuted,
                        ),
                    )
                }
            }
            OutlinedTextField(
                value = text,
                onValueChange = { if (it.length <= 5000) text = it },
                placeholder = { Text(if (kind == Kind.FeatureRequest) "What would make it better?" else "What happened?") },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp, max = 280.dp).focusRequester(focus),
            )
            if (allowImages && images.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(images, key = { it.toString() }) { uri ->
                        Box {
                            AsyncImage(
                                model = uri,
                                contentDescription = "Attached image",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(64.dp).clip(MaterialTheme.shapes.small).background(Bee.muted),
                            )
                            // A 20dp badge drawn inside a 40dp tap target over the thumbnail's corner.
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .size(40.dp)
                                    .clickable(onClickLabel = "Remove image") { images.remove(uri) },
                                contentAlignment = Alignment.TopEnd,
                            ) {
                                Box(
                                    Modifier.padding(4.dp).size(20.dp).background(Bee.ink.copy(alpha = 0.75f), CircleShape),
                                    contentAlignment = Alignment.Center,
                                ) { Icon(Icons.Filled.Close, contentDescription = "Remove image", tint = Bee.paper, modifier = Modifier.size(12.dp)) }
                            }
                        }
                    }
                }
            }
            error?.let { Text(it, color = Bee.danger, style = MaterialTheme.typography.bodyMedium) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (allowImages) {
                    IconButton(
                        onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        enabled = images.size < MAX_IMAGES && !busy,
                    ) { Icon(Icons.Filled.AddPhotoAlternate, contentDescription = "Attach images", tint = Bee.inkMuted) }
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        busy = true
                        error = null
                        scope.launch {
                            runCatching { onSubmit(kind, text.trim(), images.toList()) }
                                .onSuccess { sheet.hide(); onSubmitted() }
                                .onFailure { error = it.userMessage(); busy = false }
                        }
                    },
                    enabled = canSend,
                    colors = ButtonDefaults.buttonColors(containerColor = Bee.honey, contentColor = Bee.onHoney),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Bee.onHoney)
                    else Text(action)
                }
            }
        }
    }
}
