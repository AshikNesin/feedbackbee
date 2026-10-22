package io.nesin.feedbackbarn.demo

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun DemoScreen(initial: DemoSettings, onSave: (DemoSettings) -> String?, onOpenSheet: () -> Unit) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(
            Modifier.safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Header()
            SettingsCard(initial, onSave)
            InstructionsCard(onOpenSheet)
            SampleCard()
        }
    }
}

@Composable
private fun Header() {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("FeedbackBarn", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "Shake your phone to send feedback with an annotated screenshot.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SettingsCard(initial: DemoSettings, onSave: (DemoSettings) -> String?) {
    var slug by remember { mutableStateOf(initial.projectSlug) }
    var endpoint by remember { mutableStateOf(initial.endpoint) }
    var status by remember { mutableStateOf<Status?>(null) }

    DemoCard("Settings") {
        OutlinedTextField(
            value = slug,
            onValueChange = { slug = it; status = null },
            label = { Text("Project slug") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = endpoint,
            onValueChange = { endpoint = it; status = null },
            label = { Text("Endpoint") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = {
                val error = onSave(DemoSettings(slug, endpoint))
                status = if (error == null) Status("Saved", isError = false) else Status(error, isError = true)
            }) { Text("Save") }
            OutlinedButton(onClick = { endpoint = DemoSettings.EMULATOR_ENDPOINT; status = null }) {
                Text("Emulator URL")
            }
        }
        status?.let {
            Text(
                it.message,
                color = if (it.isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun InstructionsCard(onOpenSheet: () -> Unit) {
    DemoCard("How to try it") {
        Step(1, "Run the worker: npm run dev (http://localhost:8787).")
        Step(2, "Create a project in the dashboard and copy its slug here.")
        Step(3, "Emulator: keep 10.0.2.2:8787. A real device needs your computer's LAN address.")
        Step(4, "Shake the device three times. Emulator: ⋮ → Virtual sensors → Move.")
        OutlinedButton(onClick = onOpenSheet, modifier = Modifier.fillMaxWidth()) {
            Text("No shake? Open the feedback sheet")
        }
    }
}

@Composable
private fun SampleCard() {
    DemoCard("Something to circle") {
        listOf("Checkout button is cut off" to 0xFFF59E0B, "Dark mode contrast is low" to 0xFF60A5FA, "Search is slow" to 0xFF34D399)
            .forEach { (label, color) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(12.dp).background(androidx.compose.ui.graphics.Color(color), CircleShape))
                    Text(label)
                }
            }
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier.fillMaxWidth().height(56.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) { Text("Pay now", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun Step(number: Int, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("$number", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DemoCard(title: String, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

private class Status(val message: String, val isError: Boolean)
