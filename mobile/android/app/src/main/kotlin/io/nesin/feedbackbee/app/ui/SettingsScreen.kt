package io.nesin.feedbackbee.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Web
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.nesin.feedbackbee.app.AppGraph
import io.nesin.feedbackbee.app.BuildConfig

/** Account, server, version and company (kept off the main screens, DESIGN.md §1). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(graph: AppGraph, onBack: () -> Unit) {
    val session by graph.session.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    var confirmSignOut by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = Bee.paper,
        topBar = {
            TopAppBar(
                navigationIcon = { BackButton(onBack) },
                title = { Text("Settings") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Bee.paper),
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
            SectionHeader("Account")
            InfoRow("Server", session?.host.orEmpty(), Icons.Filled.Dns)
            RowDivider(48)
            InfoRow("Signed in as", session?.email.orEmpty(), Icons.Filled.Person)
            RowDivider(48)
            InfoRow("Dashboard", "Open on the web", Icons.Filled.Web) { uri.openUri(graph.api().dashboardUrl()) }

            SectionHeader("About")
            InfoRow("Version", BuildConfig.VERSION_NAME, Icons.Filled.Info)
            RowDivider(48)
            InfoRow("Made by", "Nesin Technologies LLP", Icons.Filled.Info) { uri.openUri("https://nesin.io?ref=feedbackbee") }

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 32.dp)
                    .clickable { confirmSignOut = true }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Bee.danger)
                Text("Sign out", color = Bee.danger, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }

    if (confirmSignOut) {
        ConfirmDialog(
            title = "Sign out?",
            body = "This device forgets your session and cached reports. Your server keeps everything.",
            confirm = "Sign out",
            onConfirm = graph::signOut,
            onDismiss = { confirmSignOut = false },
        )
    }
}
