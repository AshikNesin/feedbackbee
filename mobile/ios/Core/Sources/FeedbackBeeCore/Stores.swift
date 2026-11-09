import Foundation
import Observation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The app's one set of long-lived state: the session, the HTTP client, the
/// disk cache and the stores. Signing out or switching servers drops the
/// stores and the cache, so no data from one account shows in another.
@MainActor
@Observable
public final class AppModel {
    public private(set) var session: Session?
    /// Bumped by the "New issue" home-screen quick action; the UI reacts once per value.
    public var newIssueRequests = 0
    public private(set) var projects: ProjectsStore!

    @ObservationIgnored private let store: SessionStore
    /// This session's cache; replaced (and the old one retired) on every session change.
    @ObservationIgnored private(set) var cache: DiskCache
    @ObservationIgnored private let makeCache: () -> DiskCache
    @ObservationIgnored let urlSession: URLSession
    @ObservationIgnored let device: DeviceContext
    @ObservationIgnored private var inboxes: [String: InboxStore] = [:]
    @ObservationIgnored private var client: APIClient?

    /// `cache` makes the cache for each session (all in the same place).
    public init(store: SessionStore, cache: @escaping @autoclosure () -> DiskCache, urlSession: URLSession = .shared, device: DeviceContext) {
        self.store = store
        self.makeCache = cache
        self.cache = cache()
        self.urlSession = urlSession
        self.device = device
        self.session = store.load()
        self.projects = ProjectsStore(app: self)
    }

    public var lastHost: String? { store.lastHost }
    public var lastEmail: String? { store.lastEmail }
    public var lastProjectId: String? {
        get { store.lastProjectId }
        set { store.lastProjectId = newValue }
    }

    /// The API for the signed-in server. Signed out (e.g. a store still
    /// finishing after expiry), every call fails fast instead of crashing.
    public var api: APIClient {
        if let client { return client }
        guard let session else {
            return APIClient(host: URL(string: "https://signed-out.invalid")!, token: nil, session: urlSession)
        }
        let token = session.token
        let made = APIClient(host: session.host, token: token, session: urlSession) { [weak self] in
            Task { @MainActor in self?.expire(token) }
        }
        client = made
        return made
    }

    public func inbox(_ projectId: String) -> InboxStore {
        if let existing = inboxes[projectId] { return existing }
        let made = InboxStore(app: self, projectId: projectId)
        inboxes[projectId] = made
        return made
    }

    /// Sign in, then switch to that session. Throws with the server's message on failure.
    public func signIn(host input: String, email: String, password: String) async throws {
        guard let host = normalizeHost(input) else {
            throw APIError(status: 0, code: "HOST", message: "Enter your FeedbackBee address, like bee.example.com")
        }
        let result = try await APIClient(host: host, token: nil, session: urlSession)
            .signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        let next = Session(host: host, email: result.user.email, token: result.token)
        let accountChanged = lastHost != host.absoluteString || lastEmail != next.email
        store.save(next)
        reset()
        if accountChanged { await cache.clear() }
        session = next
    }

    public func signOut() {
        store.clear()
        reset()
        session = nil
    }

    /// The server refused `token` (expired, or the account is gone): back to
    /// sign-in. A late 401 from an earlier session's request is ignored.
    private func expire(_ token: String) {
        if session?.token == token { signOut() }
    }

    /// Drop the session's stores and retire its cache (pending writes discarded, files wiped).
    private func reset() {
        client = nil
        inboxes = [:]
        let old = cache
        Task { await old.retireAndClear() }
        cache = makeCache()
        projects = ProjectsStore(app: self)
    }
}

/// The project list: cached on disk, refreshed from the server.
@MainActor
@Observable
public final class ProjectsStore {
    public private(set) var projects: [Project] = []
    /// True once anything (cache or network) has filled the list.
    public private(set) var loaded = false
    /// True once the server (not just the cache) has answered.
    public private(set) var fromServer = false
    public private(set) var refreshing = false
    public var error: String?

    @ObservationIgnored private let app: AppModel
    @ObservationIgnored private let cache: DiskCache
    @ObservationIgnored private var started = false

    init(app: AppModel) {
        self.app = app
        self.cache = app.cache
    }

    /// Load once per session. Runs in its own task, so a view that disappears
    /// mid-load (launching straight into an inbox) doesn't leave it unloaded.
    public func start() async {
        guard !started else { return }
        started = true
        await Task {
            if let cached = await cache.projects(), !loaded {
                projects = cached
                loaded = true
            }
            await load()
        }.value
    }

    public func refresh() async {
        await Task { await load() }.value
    }

    private func load() async {
        guard !refreshing else { return }
        refreshing = true
        error = nil
        defer { refreshing = false }
        do {
            let fresh = try await app.api.projects()
            projects = fresh
            loaded = true
            fromServer = true
            await cache.saveProjects(fresh)
        } catch is CancellationError {
        } catch {
            loaded = true
            self.error = userMessage(error)
        }
    }

    public func find(_ id: String) -> Project? { projects.first { $0.id == id } }

    public func create(name: String, slug: String, repo: String) async throws -> Project {
        let project = try await app.api.createProject(name: name, slug: slug, githubRepo: repo)
        projects.insert(project, at: 0)
        await cache.saveProjects(projects)
        return project
    }

    public func delete(_ project: Project) async throws {
        try await app.api.deleteProject(project.id)
        projects.removeAll { $0.id == project.id }
        await cache.saveProjects(projects)
    }
}

/// One project's inbox, shared by the list and the report screen so an edit in
/// one shows in the other. Status changes and deletes are optimistic and roll
/// back on failure; short messages for a banner land in `message`.
@MainActor
@Observable
public final class InboxStore {
    public let projectId: String
    public private(set) var items: [FeedbackItem] = []
    public private(set) var hasMore = false
    /// Server-side status filter; nil is All.
    public private(set) var status: Status?
    public private(set) var loaded = false
    public private(set) var refreshing = false
    public private(set) var loadingMore = false
    public var error: String?
    public var message: String?

    @ObservationIgnored private let app: AppModel
    @ObservationIgnored private let cache: DiskCache
    @ObservationIgnored private var started = false
    @ObservationIgnored private var pageTask: Task<Void, Never>?
    /// Bumped by every refresh: an older page that lands later is dropped.
    @ObservationIgnored private var generation = 0

    init(app: AppModel, projectId: String) {
        self.app = app
        self.cache = app.cache
        self.projectId = projectId
    }

    public func start() async {
        guard !started else { return }
        started = true
        if let cached = await cache.inbox(projectId), !loaded {
            items = cached.items
            hasMore = cached.hasMore
            loaded = true
        }
        await refresh()
    }

    public func refresh() async {
        pageTask?.cancel()
        generation += 1
        loadingMore = false
        let status = status
        refreshing = true
        error = nil
        let task = Task { [weak self] in
            guard let self else { return }
            do {
                let page = try await app.api.feedback(projectId: projectId, status: status)
                guard !Task.isCancelled else { return }
                items = page.items
                hasMore = page.hasMore
                loaded = true
                refreshing = false
                if status == nil { await cache.saveInbox(projectId, page) }
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled else { return }
                loaded = true
                refreshing = false
                self.error = userMessage(error)
            }
        }
        pageTask = task
        await task.value
    }

    public func setStatusFilter(_ next: Status?) async {
        guard status != next else { return }
        status = next
        items = []
        hasMore = false
        loaded = false
        await refresh()
    }

    public func loadMore() async {
        guard hasMore, !loadingMore, !refreshing, let cursor = items.last?.createdAtMs else { return }
        let started = generation
        loadingMore = true
        defer { if generation == started { loadingMore = false } }
        do {
            let page = try await app.api.feedback(projectId: projectId, before: cursor, status: status)
            guard generation == started else { return } // a refresh or filter change replaced the list
            let known = Set(items.map(\.id))
            items += page.items.filter { !known.contains($0.id) }
            hasMore = page.hasMore
        } catch is CancellationError {
        } catch {
            if generation == started { message = userMessage(error) }
        }
    }

    public func item(_ id: String) -> FeedbackItem? { items.first { $0.id == id } }

    /// Fetch one report (e.g. opened before the list had it).
    public func fetch(_ id: String) async throws -> FeedbackItem {
        let item = try await app.api.feedbackItem(projectId: projectId, id: id)
        replace(item)
        return item
    }

    public func setStatus(_ item: FeedbackItem, _ next: Status) async {
        guard item.status != next else { return }
        var optimistic = item
        optimistic.status = next
        replace(optimistic)
        do {
            replace(try await app.api.updateFeedback(projectId: projectId, id: item.id, status: next))
        } catch {
            replace(item)
            message = userMessage(error)
        }
    }

    /// Edit kind and text; GitHub is rewritten server-side, so this waits for it.
    @discardableResult
    public func edit(_ item: FeedbackItem, kind: Kind, text: String) async throws -> FeedbackItem {
        let updated = try await app.api.updateFeedback(
            projectId: projectId,
            id: item.id,
            kind: kind == item.kind ? nil : kind,
            text: text == item.text ? nil : text
        )
        replace(updated)
        return updated
    }

    public func delete(_ item: FeedbackItem) async {
        let before = items
        items.removeAll { $0.id == item.id }
        do {
            try await app.api.deleteFeedback(projectId: projectId, id: item.id)
            message = "Report deleted"
        } catch {
            items = before
            message = userMessage(error)
        }
    }

    public func sync() async {
        do {
            let result = try await app.api.sync(projectId: projectId)
            message = result.updated == 0 ? "Up to date with GitHub" : "Updated \(result.updated) of \(result.checked) from GitHub"
            await refresh()
        } catch {
            message = userMessage(error)
        }
    }

    /// File a report, then show it at the top. Throws when nothing was stored.
    public func submit(project: Project, kind: Kind, text: String, images: [Upload]) async throws {
        let result = try await app.api.submit(projectSlug: project.slug, kind: kind, text: text, images: images, device: app.device)
        message = result.state == "issue_error"
            ? "Saved, but GitHub refused the issue: \(result.error ?? "unknown error")"
            : "Filed"
        guard let item = try? await app.api.feedbackItem(projectId: projectId, id: result.id) else {
            await refresh()
            return
        }
        if status == nil || status == item.status {
            items.removeAll { $0.id == item.id }
            items.insert(item, at: 0)
        }
    }

    private func replace(_ item: FeedbackItem) {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index] = item
    }
}
