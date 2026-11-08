package io.nesin.feedbackbee.app

import android.app.Application
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import android.view.WindowManager
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.test.core.app.ApplicationProvider
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.imageDecoderEnabled
import coil3.request.allowHardware
import io.nesin.feedbackbee.app.data.Session
import io.nesin.feedbackbee.app.data.SessionStore
import io.nesin.feedbackbee.app.data.TokenCipher
import io.nesin.feedbackbee.app.ui.BeeTheme
import kotlinx.coroutines.flow.MutableStateFlow
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant

/**
 * Every screen, driven through the real UI, stores and API client against a
 * fake FeedbackBee server. Doubles as a flow test (sign-in form, projects →
 * inbox → report, quick-file sheet, status menu, settings). With
 * FEEDBACKBEE_SCREENSHOT_DIR set, each screen is saved as `<name>-<theme>.png`.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w393dp-h852dp-xhdpi")
class ScreensTest(private val dark: Boolean) {
    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{index}: dark={0}")
        fun themes() = listOf(arrayOf<Any>(false), arrayOf<Any>(true))
    }

    @get:Rule val compose = createComposeRule()

    private lateinit var server: MockWebServer
    private lateinit var app: Application
    private val theme get() = if (dark) "dark" else "light"

    private object PlainCipher : TokenCipher {
        override fun encrypt(plain: ByteArray) = plain
        override fun decrypt(sealed: ByteArray) = sealed
    }

    @Before fun setUp() {
        app = ApplicationProvider.getApplicationContext()
        // Software bitmaps (windows are drawn into a software canvas) decoded by BitmapFactory
        // (Robolectric has no ImageDecoder). The app's own loader is unchanged.
        SingletonImageLoader.setUnsafe { context ->
            ImageLoader.Builder(context).allowHardware(false).imageDecoderEnabled(false).build()
        }
        server = MockWebServer()
        server.dispatcher = FakeServer(screenshotPng())
        server.start()
    }

    @After fun tearDown() = server.shutdown()

    private fun host() = server.url("/").toString().trimEnd('/')

    private fun launch(signedIn: Boolean = true, lastProject: String? = null) {
        val store = SessionStore(app, PlainCipher)
        store.save(Session(host(), "ashik@nesin.io", "test-token"))
        if (!signedIn) store.clear()
        store.lastProjectId = lastProject
        val graph = AppGraph(app, store)
        compose.setContent { BeeTheme(dark = dark) { Root(graph, MutableStateFlow(0)) } }
    }

    private fun waitForText(text: String, substring: Boolean = false) {
        compose.waitUntil(20_000) {
            compose.onAllNodesWithText(text, substring = substring, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /** Let images arrive and animations end. */
    private fun settle(rounds: Int = 20) {
        repeat(rounds) {
            Thread.sleep(25)
            compose.waitForIdle()
        }
    }

    /** All windows (screen, sheets, menus, dialogs) composited bottom to top, with their dim. */
    private fun shoot(name: String) {
        settle()
        val views = rootViews()
        assertTrue(views.isNotEmpty())
        val dir = System.getenv("FEEDBACKBEE_SCREENSHOT_DIR") ?: return
        val base = views.first()
        val out = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        for (view in views) {
            val params = view.layoutParams as? WindowManager.LayoutParams
            if (params != null && params.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND != 0) {
                canvas.drawColor(Color.argb((params.dimAmount * 255).toInt(), 0, 0, 0))
            }
            val at = IntArray(2).also(view::getLocationOnScreen)
            canvas.save()
            canvas.translate(at[0].toFloat(), at[1].toFloat())
            view.draw(canvas)
            canvas.restore()
        }
        File(dir).mkdirs()
        File(dir, "$name-$theme.png").outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Every window's root view, in z-order (WindowManagerGlobal is reachable under Robolectric). */
    @Suppress("PrivateApi")
    private fun rootViews(): List<View> {
        val clazz = Class.forName("android.view.WindowManagerGlobal")
        val global = clazz.getMethod("getInstance").invoke(null)
        @Suppress("UNCHECKED_CAST")
        val names = clazz.getMethod("getViewRootNames").invoke(global) as Array<String>
        val getRootView = clazz.getMethod("getRootView", String::class.java)
        return names.mapNotNull { getRootView.invoke(global, it) as? View }.filter { it.isShown && it.width > 0 }
    }

    @Test fun signIn() {
        launch(signedIn = false)
        waitForText("Sign in to FeedbackBee")
        compose.onAllNodes(hasSetTextAction())[2].performTextInput("correct horse battery")
        shoot("01-sign-in")
    }

    @Test fun projects() {
        launch()
        waitForText("Acme Web")
        shoot("02-projects")
    }

    @Test fun inbox() {
        openInbox()
        shoot("03-inbox")
    }

    @Test fun statusMenu() {
        openInbox()
        compose.onAllNodesWithText("Dark mode", substring = true, useUnmergedTree = true)[0]
            .performTouchInput { longClick() }
        waitForText("Won't fix")
        shoot("04-status-menu")
    }

    @Test fun quickFileSheet() {
        openInbox()
        compose.onNodeWithText("New issue", useUnmergedTree = true).performClick()
        waitForText("New issue in Acme Web")
        val fields = compose.onAllNodes(hasSetTextAction())
        fields[fields.fetchSemanticsNodes().size - 1].performTextInput("Search field loses focus after the first letter on Android 16")
        shoot("05-quick-file-sheet")
    }

    @Test fun report() {
        openReport()
        settle(rounds = 120) // two screenshots load from the fake server
        shoot("06-report")
    }

    @Test fun editSheet() {
        openReport()
        compose.onNodeWithContentDescription("Edit").performClick()
        waitForText("Edit report")
        assertTrue(compose.onAllNodesWithContentDescription("Attach images").fetchSemanticsNodes().isEmpty())
        shoot("07-edit-sheet")
    }

    @Test fun newProject() {
        launch()
        waitForText("Acme Web")
        compose.onNodeWithContentDescription("New project").performClick()
        waitForText("acme/android")
        compose.onAllNodes(hasSetTextAction())[0].performTextInput("Acme Android")
        compose.onNodeWithText("acme/android").performClick()
        shoot("08-new-project")
    }

    @Test fun settings() {
        launch()
        waitForText("Acme Web")
        compose.onNodeWithContentDescription("Settings").performClick()
        waitForText("Signed in as")
        shoot("09-settings")
    }

    private fun openInbox() {
        launch(lastProject = "p1")
        waitForText("Checkout total doesn't update", substring = true)
    }

    private fun openReport() {
        openInbox()
        compose.onAllNodesWithText("Checkout total doesn't update", substring = true, useUnmergedTree = true)[0].performClick()
        waitForText("GITHUB & MEDIA")
    }
}

/** A FeedbackBee server with one owner, three projects and a lively inbox. */
private class FakeServer(private val png: ByteArray) : Dispatcher() {
    private val now = Instant.now()
    private fun ago(minutes: Long) = now.minusSeconds(minutes * 60).toString()

    private val projects = """[
        {"id":"p1","name":"Acme Web","slug":"acme-web","githubRepo":"acme/web","createdAt":"${ago(90_000)}"},
        {"id":"p2","name":"Acme iOS","slug":"acme-ios","githubRepo":"acme/ios","createdAt":"${ago(80_000)}"},
        {"id":"p3","name":"Docs site","slug":"docs","githubRepo":"acme/docs","createdAt":"${ago(70_000)}"}
    ]"""

    private fun item(
        id: String, kind: String, text: String, minutes: Long, status: String = "open", issue: Int? = null,
        images: Int = 0, email: String? = null, recording: String? = null, audio: Boolean = false,
        os: String = "web", device: String? = null, url: String? = "https://acme.dev/checkout", state: String = "created",
    ) = """{"id":"$id","projectId":"p1","kind":"$kind","text":${quote(text)},"status":"$status","state":"$state",
        "reporterEmail":${email?.let(::quote) ?: "null"},"url":${url?.let(::quote) ?: "null"},
        "userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "osName":"$os","osVersion":"18.1","deviceModel":${device?.let(::quote) ?: "null"},"appVersion":"2.4.0",
        "screenW":1512,"screenH":982,"metadata":${if (email != null) """{"plan":"pro","seats":12}""" else "null"},
        "recordingKey":${recording?.let(::quote) ?: "null"},"recordingSeconds":${if (recording != null) 48 else "null"},
        "audioKey":${if (audio) "\"p/p1/f/voice.webm\"" else "null"},"audioSeconds":${if (audio) 14 else "null"},
        "issueNumber":${issue ?: "null"},"issueUrl":${issue?.let { "\"https://github.com/acme/web/issues/$it\"" } ?: "null"},
        "issueError":${if (state == "issue_error") "\"GitHub 403: Resource not accessible by integration\"" else "null"},
        "createdAt":"${ago(minutes)}","images":[${(1..images).joinToString(",") { "\"p/p1/f/shot-$id-$it.png\"" }}]}"""

    private val items = listOf(
        item("f1", "issue", "Checkout total doesn't update after removing a coupon. It still shows the discounted price until I refresh the page.", 4, issue = 128, images = 2, email = "maya@customer.dev", recording = "p/p1/f/r1.rrweb.gz"),
        item("f2", "feature_request", "Dark mode for the dashboard please, I use it at night a lot", 38, "in_progress", issue = 127, email = "leo@studio.io"),
        item("f3", "issue", "Upload button does nothing on Safari 18 when the file is larger than 5 MB", 170, issue = 126, images = 1, os = "ios", device = "iPhone 16 Pro", audio = true),
        item("f4", "other", "Love the new onboarding, took me two minutes to set up.", 600, "done", issue = 125, url = "https://acme.dev/welcome"),
        item("f5", "issue", "Login link in the reset email points to the staging domain", 1500, "done", issue = 124),
        item("f6", "feature_request", "Export reports as CSV", 3000, "wont_fix", issue = 123, email = "ops@bigco.com"),
        item("f7", "issue", "Charts flicker when switching tabs", 5000, state = "issue_error"),
        item("f8", "other", "Typo on the pricing page: \"anual\"", 9000, "done", issue = 121, url = "https://acme.dev/pricing"),
    )

    private val repos = """[{"id":1,"fullName":"acme/android","installationId":7},{"id":2,"fullName":"acme/docs","installationId":7},
        {"id":3,"fullName":"acme/ios","installationId":7},{"id":4,"fullName":"acme/web","installationId":7}]"""

    override fun dispatch(request: RecordedRequest): MockResponse {
        val path = request.path.orEmpty().substringBefore('?')
        return when {
            path.startsWith("/f/") -> MockResponse().setHeader("Content-Type", "image/png").setBody(Buffer().write(png))
            path == "/api/v1/projects" -> ok(projects)
            path == "/api/v1/github/repositories" -> ok(repos)
            path == "/api/v1/projects/p1/feedback" -> ok("""{"items":[${items.joinToString(",")}],"hasMore":false}""")
            path.startsWith("/api/v1/projects/p1/feedback/") -> {
                val id = path.substringAfterLast('/')
                ok(items.firstOrNull { it.contains("\"id\":\"$id\"") } ?: items[0])
            }
            else -> MockResponse().setResponseCode(404).setBody("""{"success":false,"error":{"code":"NOT_FOUND","message":"Not found"}}""")
        }
    }

    private fun ok(data: String) = MockResponse().setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":$data}""")

    private fun quote(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}

/** A stand-in app screenshot with an annotation, like reporters attach. */
private fun screenshotPng(): ByteArray {
    val bitmap = Bitmap.createBitmap(390, 520, Bitmap.Config.ARGB_8888)
    val c = Canvas(bitmap)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    c.drawColor(0xFFF8FAFC.toInt())
    p.color = 0xFF1E293B.toInt(); c.drawRect(0f, 0f, 390f, 56f, p)
    p.color = 0xFFE2E8F0.toInt()
    for (i in 0 until 5) c.drawRoundRect(RectF(20f, 80f + i * 64f, 370f, 128f + i * 64f), 10f, 10f, p)
    p.color = 0xFF6366F1.toInt(); c.drawRoundRect(RectF(20f, 420f, 370f, 470f), 12f, 12f, p)
    p.style = Paint.Style.STROKE; p.strokeWidth = 5f; p.color = 0xFFFF3B30.toInt()
    c.drawOval(RectF(200f, 330f, 380f, 400f), p)
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    return out.toByteArray()
}
