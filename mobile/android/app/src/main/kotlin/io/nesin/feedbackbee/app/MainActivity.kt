package io.nesin.feedbackbee.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.nesin.feedbackbee.app.ui.BeeTheme
import io.nesin.feedbackbee.app.ui.InboxScreen
import io.nesin.feedbackbee.app.ui.LoginScreen
import io.nesin.feedbackbee.app.ui.ProjectsScreen
import io.nesin.feedbackbee.app.ui.ReportScreen
import io.nesin.feedbackbee.app.ui.SettingsScreen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable

@Serializable internal object ProjectsRoute
@Serializable internal data class InboxRoute(val projectId: String, val compose: Boolean = false)
@Serializable internal data class ReportRoute(val projectId: String, val feedbackId: String)
@Serializable internal object SettingsRoute

/** The launcher shortcut (res/xml/shortcuts.xml) that opens the quick-file sheet. */
private const val ACTION_NEW_ISSUE = "io.nesin.feedbackbee.NEW_ISSUE"

class MainActivity : ComponentActivity() {
    /** Bumped for each "New issue" shortcut launch; the nav graph reacts once per value. */
    private val newIssueRequests = MutableStateFlow(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null && intent?.action == ACTION_NEW_ISSUE) newIssueRequests.value++
        val graph = (application as FeedbackBeeApp).graph
        setContent {
            BeeTheme { Root(graph, newIssueRequests) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == ACTION_NEW_ISSUE) newIssueRequests.value++
    }
}

/** The whole UI for [graph]: sign-in, or the signed-in navigation graph. */
@Composable
internal fun Root(graph: AppGraph, newIssueRequests: StateFlow<Int>) {
    val session by graph.session.collectAsStateWithLifecycle()
    val current = session
    if (current == null) {
        LoginScreen(graph)
        return
    }
    // A new session gets a fresh back stack.
    key(current.token) { SignedIn(graph, newIssueRequests) }
}

@Composable
private fun SignedIn(graph: AppGraph, newIssueRequests: StateFlow<Int>) {
    val nav = rememberNavController()
    val newIssue by newIssueRequests.collectAsStateWithLifecycle()

    // Launch straight into the last project's inbox (once; the back stack survives rotation).
    var restored by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (restored) return@LaunchedEffect
        restored = true
        graph.lastProjectId?.let { nav.navigate(InboxRoute(it)) }
    }
    LaunchedEffect(newIssue) {
        if (newIssue == 0) return@LaunchedEffect
        val last = graph.lastProjectId ?: return@LaunchedEffect
        nav.navigate(InboxRoute(last, compose = true)) { popUpTo(ProjectsRoute) }
    }

    NavHost(nav, startDestination = ProjectsRoute) {
        composable<ProjectsRoute> {
            ProjectsScreen(
                graph = graph,
                onOpen = { project ->
                    graph.lastProjectId = project.id
                    nav.navigate(InboxRoute(project.id))
                },
                onSettings = { nav.navigate(SettingsRoute) },
            )
        }
        composable<InboxRoute> { entry ->
            val route = entry.toRoute<InboxRoute>()
            InboxScreen(
                graph = graph,
                projectId = route.projectId,
                openCompose = route.compose,
                onBack = {
                    graph.lastProjectId = null
                    if (!nav.popBackStack()) nav.navigate(ProjectsRoute)
                },
                onOpenReport = { id -> nav.navigate(ReportRoute(route.projectId, id)) },
                onProjectDeleted = {
                    graph.lastProjectId = null
                    nav.popBackStack(ProjectsRoute, inclusive = false)
                },
            )
        }
        composable<ReportRoute> { entry ->
            val route = entry.toRoute<ReportRoute>()
            ReportScreen(graph, route.projectId, route.feedbackId, onBack = { nav.popBackStack() })
        }
        composable<SettingsRoute> {
            SettingsScreen(graph, onBack = { nav.popBackStack() })
        }
    }
}
