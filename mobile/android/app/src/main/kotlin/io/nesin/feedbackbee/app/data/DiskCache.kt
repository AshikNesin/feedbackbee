package io.nesin.feedbackbee.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

/**
 * Last-known server data on disk, so a screen paints at once and refreshes
 * after (stale-while-revalidate). One instance per session: signing out
 * retires it (later writes from that session are dropped) and wipes the files.
 * Reads, writes and the wipe are serialized, so a write in flight can't
 * outlive the wipe.
 */
class DiskCache(private val dir: File) {
    private val lock = Mutex()
    private var retired = false

    suspend fun projects(): List<Project>? = read("projects.json", ListSerializer(Project.serializer()))
    suspend fun saveProjects(projects: List<Project>) = write("projects.json", ListSerializer(Project.serializer()), projects)

    /** The first page of a project's inbox, unfiltered. */
    suspend fun inbox(projectId: String): FeedbackPage? = read("inbox-${safe(projectId)}.json", FeedbackPage.serializer())
    suspend fun saveInbox(projectId: String, page: FeedbackPage) =
        write("inbox-${safe(projectId)}.json", FeedbackPage.serializer(), page)

    /** Wipe the files, keeping this cache usable (e.g. signing in to another account). */
    suspend fun clear() = lock.withLock { withContext(Dispatchers.IO) { dir.listFiles()?.forEach { it.delete() }; Unit } }

    /** Sign-out: drop every later write from this session, then wipe. */
    suspend fun retireAndClear() = lock.withLock {
        retired = true
        withContext(Dispatchers.IO) { dir.listFiles()?.forEach { it.delete() }; Unit }
    }

    private suspend fun <T> read(name: String, serializer: KSerializer<T>): T? = lock.withLock {
        if (retired) return@withLock null
        withContext(Dispatchers.IO) {
            val file = File(dir, name)
            if (!file.exists()) null else runCatching { json.decodeFromString(serializer, file.readText()) }.getOrNull()
        }
    }

    private suspend fun <T> write(name: String, serializer: KSerializer<T>, value: T) = lock.withLock {
        if (retired) return@withLock
        withContext(Dispatchers.IO) {
            runCatching {
                dir.mkdirs()
                val tmp = File.createTempFile("$name-", ".tmp", dir)
                tmp.writeText(json.encodeToString(serializer, value))
                if (!tmp.renameTo(File(dir, name))) tmp.delete()
            }
        }
        Unit
    }

    private fun safe(id: String) = id.replace(Regex("[^A-Za-z0-9_-]"), "_")
}
