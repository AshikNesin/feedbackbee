package io.nesin.feedbackbee.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

/**
 * Last-known server data on disk, so a screen paints at once and refreshes
 * after (stale-while-revalidate). Scoped to one server and account: signing
 * out or switching servers wipes it.
 */
class DiskCache(private val dir: File) {

    suspend fun projects(): List<Project>? = read("projects.json", ListSerializer(Project.serializer()))
    suspend fun saveProjects(projects: List<Project>) = write("projects.json", ListSerializer(Project.serializer()), projects)

    /** The first page of a project's inbox, unfiltered. */
    suspend fun inbox(projectId: String): FeedbackPage? = read("inbox-${safe(projectId)}.json", FeedbackPage.serializer())
    suspend fun saveInbox(projectId: String, page: FeedbackPage) =
        write("inbox-${safe(projectId)}.json", FeedbackPage.serializer(), page)

    suspend fun clear() = withContext(Dispatchers.IO) { dir.listFiles()?.forEach { it.delete() } ; Unit }

    private suspend fun <T> read(name: String, serializer: KSerializer<T>): T? = withContext(Dispatchers.IO) {
        val file = File(dir, name)
        if (!file.exists()) null else runCatching { json.decodeFromString(serializer, file.readText()) }.getOrNull()
    }

    private suspend fun <T> write(name: String, serializer: KSerializer<T>, value: T) = withContext(Dispatchers.IO) {
        runCatching {
            dir.mkdirs()
            val tmp = File(dir, "$name.tmp")
            tmp.writeText(json.encodeToString(serializer, value))
            tmp.renameTo(File(dir, name))
        }
        Unit
    }

    private fun safe(id: String) = id.replace(Regex("[^A-Za-z0-9_-]"), "_")
}
