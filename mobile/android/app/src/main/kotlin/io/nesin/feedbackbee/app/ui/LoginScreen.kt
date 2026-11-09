package io.nesin.feedbackbee.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import io.nesin.feedbackbee.app.AppGraph
import io.nesin.feedbackbee.app.R
import io.nesin.feedbackbee.app.data.userMessage
import kotlinx.coroutines.launch

/** Sign in to a FeedbackBee server: its address, then the owner's email and password. */
@Composable
fun LoginScreen(graph: AppGraph) {
    var host by rememberSaveable { mutableStateOf(graph.lastHost?.removePrefix("https://").orEmpty()) }
    var email by rememberSaveable { mutableStateOf(graph.lastEmail.orEmpty()) }
    // Not saveable: the password never goes into the saved-state Bundle, and a
    // sign-in cancelled by recreation must not come back as "busy".
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val canSubmit = host.isNotBlank() && email.isNotBlank() && password.isNotEmpty() && !busy

    fun submit() {
        if (!canSubmit) return
        busy = true
        error = null
        scope.launch {
            runCatching { graph.signIn(host, email, password) }
                .onFailure { error = it.userMessage(); busy = false }
        }
    }

    Scaffold(containerColor = Bee.paper) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Column(Modifier.widthIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Image(
                    painterResource(R.drawable.ic_launcher_foreground),
                    contentDescription = null,
                    modifier = Modifier.size(72.dp).align(Alignment.CenterHorizontally),
                )
                Text(
                    "Sign in to FeedbackBee",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Bee.ink,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
                Text(
                    "Use the address of your FeedbackBee and the owner account you use on the web.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Bee.inkMuted,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = host,
                    onValueChange = { host = it },
                    label = { Text("Server") },
                    placeholder = { Text("bee.example.com") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.EmailAddress },
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.Password },
                )
                if (error != null) {
                    Text(error!!, color = Bee.danger, style = MaterialTheme.typography.bodyMedium)
                }
                Button(onClick = ::submit, enabled = canSubmit, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Bee.paper)
                    else Text("Sign in")
                }
            }
        }
    }
}
