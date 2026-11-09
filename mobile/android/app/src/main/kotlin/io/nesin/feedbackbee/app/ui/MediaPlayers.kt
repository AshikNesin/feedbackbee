package io.nesin.feedbackbee.app.ui

import android.annotation.SuppressLint
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import io.nesin.feedbackbee.app.data.clock
import kotlinx.coroutines.delay

/**
 * An inline voice-note player: play/pause, a scrubber and the time. The
 * player is created on first play (opening a report costs nothing) and
 * released when the row leaves the screen. ExoPlayer handles every format the
 * server accepts (AAC/m4a, MP3, Ogg and WebM Opus).
 */
@Composable
fun AudioPlayerRow(url: String, durationSeconds: Double?) {
    val context = LocalContext.current
    var player by remember(url) { mutableStateOf<ExoPlayer?>(null) }
    var playing by remember(url) { mutableStateOf(false) }
    var buffering by remember(url) { mutableStateOf(false) }
    var positionMs by remember(url) { mutableLongStateOf(0L) }
    var durationMs by remember(url) { mutableLongStateOf(((durationSeconds ?: 0.0) * 1000).toLong()) }
    var scrub by remember(url) { mutableFloatStateOf(-1f) }
    var failed by remember(url) { mutableStateOf(false) }

    DisposableEffect(url) { onDispose { player?.release(); player = null } }

    // Follow the playhead while playing.
    LaunchedEffect(player, playing) {
        val p = player ?: return@LaunchedEffect
        while (playing) {
            positionMs = p.currentPosition
            if (p.duration > 0) durationMs = p.duration
            delay(200)
        }
    }

    fun toggle() {
        failed = false
        val p = player ?: ExoPlayer.Builder(context).build().also { created ->
            created.setMediaItem(MediaItem.fromUri(url))
            created.addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
                override fun onPlayerError(error: PlaybackException) {
                    // A failed player can't resume: drop it, so the next tap starts over.
                    failed = true
                    playing = false
                    buffering = false
                    created.release()
                    if (player === created) player = null
                }
                override fun onPlaybackStateChanged(state: Int) {
                    buffering = state == Player.STATE_BUFFERING
                    if (state == Player.STATE_ENDED) {
                        created.pause()
                        created.seekTo(0)
                        positionMs = 0
                    }
                }
            })
            created.prepare()
            player = created
        }
        if (p.isPlaying) p.pause() else p.play()
    }

    Row(
        Modifier.fillMaxWidth().padding(start = 4.dp, end = 16.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        IconButton(onClick = ::toggle) {
            if (buffering && !playing) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Bee.ink)
            } else {
                Icon(
                    if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (playing) "Pause voice note" else "Play voice note",
                    tint = Bee.ink,
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(
                if (failed) "Couldn't play the voice note. Tap to retry." else "Voice note",
                style = MaterialTheme.typography.bodyMedium,
                color = if (failed) Bee.danger else Bee.inkMuted,
            )
            Slider(
                value = if (scrub >= 0) scrub else if (durationMs > 0) positionMs.toFloat() / durationMs else 0f,
                onValueChange = { scrub = it },
                onValueChangeFinished = {
                    val target = (scrub * durationMs).toLong()
                    player?.seekTo(target)
                    positionMs = target
                    scrub = -1f
                },
                enabled = player != null && durationMs > 0,
                colors = SliderDefaults.colors(
                    thumbColor = Bee.ink,
                    activeTrackColor = Bee.ink,
                    inactiveTrackColor = Bee.rule,
                    disabledThumbColor = Bee.inkMuted,
                    disabledInactiveTrackColor = Bee.rule,
                ),
            )
        }
        Text(
            "${clock(positionMs / 1000.0)} / ${clock(durationMs / 1000.0)}",
            style = MaterialTheme.typography.labelMedium,
            color = Bee.inkMuted,
        )
    }
}

/** A screen recording, full screen, with the standard Media3 controls. */
@OptIn(UnstableApi::class)
@Composable
fun VideoViewer(url: String, onClose: () -> Unit) {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
            playWhenReady = true
        }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    FullScreen(onClose = onClose, dark = true) {
        AndroidView(
            factory = { PlayerView(it).apply { this.player = player; setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS) } },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

/**
 * A session replay (rrweb), played by the server's own replay page in a
 * WebView: the same player as the dashboard, no second implementation.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ReplayViewer(url: String, onClose: () -> Unit) {
    val uri = LocalUriHandler.current
    var loading by remember(url) { mutableStateOf(true) }
    var loadError by remember(url) { mutableStateOf<String?>(null) }
    FullScreen(
        onClose = onClose,
        dark = false,
        title = "Session replay",
        extra = {
            IconButton(onClick = { uri.openUri(url) }) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open in browser", tint = Bee.ink)
            }
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, url: String?) { loading = false }
                            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                                if (request?.isForMainFrame == true) {
                                    loading = false
                                    loadError = "Couldn't load the replay (${error?.description ?: "network error"})."
                                }
                            }
                            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, response: WebResourceResponse?) {
                                if (request?.isForMainFrame == true) {
                                    loading = false
                                    loadError = "Couldn't load the replay (HTTP ${response?.statusCode})."
                                }
                            }
                        }
                        loadUrl(url)
                    }
                },
                onRelease = { it.destroy() },
                modifier = Modifier.fillMaxSize(),
            )
            if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center), color = Bee.ink)
            loadError?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Bee.inkMuted,
                    modifier = Modifier.align(Alignment.Center).background(Bee.paper).padding(24.dp),
                )
            }
        }
    }
}

/** A full-screen dialog with a top bar (close, optional title and actions). */
@Composable
private fun FullScreen(
    onClose: () -> Unit,
    dark: Boolean,
    title: String? = null,
    extra: @Composable () -> Unit = {},
    content: @Composable () -> Unit,
) {
    val background = if (dark) Color.Black else Bee.paper
    val ink = if (dark) Color.White else Bee.ink
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Column(Modifier.fillMaxSize().background(background).systemBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onClose) { Icon(Icons.Filled.Close, contentDescription = "Close", tint = ink) }
                Text(title.orEmpty(), style = MaterialTheme.typography.titleMedium, color = ink, modifier = Modifier.weight(1f))
                extra()
            }
            Box(Modifier.weight(1f)) { content() }
        }
    }
}
