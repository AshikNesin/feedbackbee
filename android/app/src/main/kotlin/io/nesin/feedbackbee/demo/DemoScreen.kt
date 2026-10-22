package io.nesin.feedbackbee.demo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun DemoScreen(
    initialProjectId: String,
    initialEndpoint: String,
    initiallyConfigured: Boolean,
    onSaveConfiguration: (String, String) -> String?,
    onOpenSheet: () -> Unit,
) {
    var projectId by rememberSaveable { mutableStateOf(initialProjectId) }
    var endpoint by rememberSaveable { mutableStateOf(initialEndpoint) }
    var savedProjectId by rememberSaveable { mutableStateOf(initialProjectId.trim()) }
    var savedEndpoint by rememberSaveable { mutableStateOf(initialEndpoint.trim().trimEnd('/')) }
    var configured by rememberSaveable { mutableStateOf(initiallyConfigured) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    val hasChanges = projectId.trim() != savedProjectId || endpoint.trim().trimEnd('/') != savedEndpoint
    val canOpen = configured && !hasChanges
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background, contentColor = MaterialTheme.colorScheme.onBackground) {
        Column(
            Modifier.safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Text("FeedbackBee", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = projectId,
                onValueChange = { projectId = it; error = null },
                label = { Text("Project id (required)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = endpoint,
                onValueChange = { endpoint = it; error = null },
                label = { Text("Website host (required)") },
                placeholder = { Text("https://feedback.example.com") },
                supportingText = { Text("Your FeedbackBee website or Worker URL, including https://.") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                singleLine = true,
                isError = error != null,
                modifier = Modifier.fillMaxWidth(),
            )
            if (error != null) {
                Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Button(
                onClick = {
                    error = onSaveConfiguration(projectId, endpoint)
                    if (error == null) {
                        projectId = projectId.trim()
                        endpoint = endpoint.trim().trimEnd('/')
                        savedProjectId = projectId
                        savedEndpoint = endpoint
                        configured = true
                    }
                },
                enabled = projectId.isNotBlank() && endpoint.isNotBlank() && (!configured || hasChanges),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save configuration")
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (configured) "Shake to feedback (on)" else "Set up feedback", fontWeight = FontWeight.SemiBold)
                Text(
                    when {
                        !configured -> "Enter a project id and website host, then save to enable feedback."
                        hasChanges -> "Save your changes before opening feedback. Shake still uses the saved configuration."
                        else -> "Three firm jolts open the sheet. Sends to $savedEndpoint."
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Button(onClick = onOpenSheet, enabled = canOpen, modifier = Modifier.fillMaxWidth()) { Text("Open feedback sheet") }
            Button(onClick = onOpenSheet, enabled = canOpen, modifier = Modifier.fillMaxWidth()) { Text("Try a voice note") }
        }
    }
}
