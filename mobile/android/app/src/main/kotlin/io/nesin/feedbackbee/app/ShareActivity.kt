package io.nesin.feedbackbee.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.IntentCompat
import io.nesin.feedbackbee.app.ui.BeeTheme
import io.nesin.feedbackbee.app.ui.ShareScreen

/**
 * The share target: "Share → FeedbackBee" from Photos, a screenshot, a
 * browser. Floats the quick-file sheet over the sharing app, prefilled with
 * what was shared, and finishes once the issue is filed or the sheet is closed.
 */
class ShareActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val graph = (application as FeedbackBeeApp).graph
        val shared = sharedContent(intent)
        setContent {
            BeeTheme {
                ShareScreen(
                    graph = graph,
                    text = shared.text,
                    images = shared.images,
                    onFiled = { projectName ->
                        Toast.makeText(this, "Filed in $projectName", Toast.LENGTH_SHORT).show()
                        finish()
                    },
                    onCancel = ::finish,
                    onOpenApp = {
                        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        finish()
                    },
                )
            }
        }
    }
}

/** What another app shared: images (content URIs, readable while this activity lives) and text. */
data class SharedContent(val text: String, val images: List<Uri>)

fun sharedContent(intent: Intent?): SharedContent {
    if (intent == null) return SharedContent("", emptyList())
    val images = when (intent.action) {
        Intent.ACTION_SEND -> listOfNotNull(
            IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                ?.takeIf { intent.type?.startsWith("image/") == true },
        )
        Intent.ACTION_SEND_MULTIPLE ->
            IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
        else -> emptyList()
    }
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
    val body = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val text = listOf(subject, body).filter { it.isNotEmpty() }.distinct().joinToString("\n\n")
    return SharedContent(text.take(5000), images.take(5))
}
