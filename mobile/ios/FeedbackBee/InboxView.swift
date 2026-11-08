import FeedbackBeeCore
import SwiftUI

/// One project's reports (DESIGN.md §4.3): filters, search, swipe actions,
/// a context menu for status, and the honey New issue button.
struct InboxView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    let projectId: String
    @Binding var composeOnOpen: Bool
    @Binding var path: [Route]

    init(projectId: String, composeOnOpen: Binding<Bool>, path: Binding<[Route]>) {
        self.projectId = projectId
        _composeOnOpen = composeOnOpen
        _path = path
    }

    @State private var kindFilter: Kind?
    @State private var query = ""
    @State private var composing = false
    @State private var pendingDelete: FeedbackItem?
    @State private var confirmDeleteProject = false

    private var store: InboxStore { model.inbox(projectId) }
    private var project: Project? { model.projects.find(projectId) }

    private var shown: [FeedbackItem] {
        let q = query.trimmingCharacters(in: .whitespaces)
        return store.items.filter { item in
            (kindFilter == nil || item.kind == kindFilter)
                && (q.isEmpty
                    || item.text.localizedCaseInsensitiveContains(q)
                    || item.reporterEmail?.localizedCaseInsensitiveContains(q) == true
                    || item.issueNumber.map { "#\($0)" == q || "\($0)" == q } == true)
        }
    }

    var body: some View {
        @Bindable var store = store
        content
            .safeAreaInset(edge: .top, spacing: 0) { filters }
            .safeAreaInset(edge: .bottom) { newIssueButton }
            .background(Bee.paper)
            .navigationTitle(project?.name ?? "Inbox")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "Search reports")
            .toolbar { menu }
            .refreshable { await store.refresh() }
            .task {
                await model.projects.start()
                await store.start()
            }
            .onAppear {
                if composeOnOpen {
                    composeOnOpen = false
                    composing = true
                }
            }
            .onChange(of: scenePhase) { _, phase in
                // Back from another app: the Share Extension may have filed something.
                if phase == .active, store.loaded { Task { await store.refresh() } }
            }
            .onChange(of: composeOnOpen) { _, open in
                if open { composeOnOpen = false; composing = true }
            }
            .sheet(isPresented: $composing) {
                if let project {
                    ComposeSheet(title: "New issue", action: "Send", allowImages: true) { kind, text, images in
                        try await store.submit(project: project, kind: kind, text: text, images: images)
                    }
                }
            }
            .confirmationDialog(
                "Delete this report?",
                isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
                titleVisibility: .visible,
                presenting: pendingDelete
            ) { item in
                Button("Delete", role: .destructive) { Task { await store.delete(item) }; pendingDelete = nil }
                Button("Cancel", role: .cancel) { pendingDelete = nil }
            } message: { item in
                Text(deleteReportMessage(item))
            }
            .confirmationDialog("Delete \(project?.name ?? "project")?", isPresented: $confirmDeleteProject, titleVisibility: .visible) {
                Button("Delete project", role: .destructive, action: deleteProject)
            } message: {
                Text("Its reports are deleted from FeedbackBee. GitHub issues and uploaded media stay. Widgets using “\(project?.slug ?? "")” stop working.")
            }
            .toast($store.message)
    }

    @ViewBuilder private var content: some View {
        if !store.loaded {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if shown.isEmpty {
            ContentUnavailableView {
                Label(query.isEmpty ? "Nothing here yet" : "No matches", systemImage: query.isEmpty ? "tray" : "magnifyingglass")
            } description: {
                Text(query.isEmpty
                    ? (store.error ?? "Reports from your widget and SDKs land here. Tap New issue to file one.")
                    : "Search covers the reports loaded so far.")
            }
        } else {
            List {
                ForEach(shown) { item in
                    NavigationLink(value: Route.report(projectId: projectId, feedbackId: item.id)) {
                        FeedbackRow(item: item)
                    }
                    .listRowBackground(Bee.paper)
                    .swipeActions(edge: .leading) {
                        if item.status != .done {
                            Button { Task { await store.setStatus(item, .done) } } label: { Label("Done", systemImage: "checkmark") }
                                .tint(Bee.status(.done))
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) { pendingDelete = item } label: { Label("Delete", systemImage: "trash") }
                    }
                    .contextMenu {
                        ForEach(Status.allCases) { status in
                            Button { Task { await store.setStatus(item, status) } } label: {
                                if item.status == status { Label(status.label, systemImage: "checkmark") } else { Text(status.label) }
                            }
                        }
                        Divider()
                        Button(role: .destructive) { pendingDelete = item } label: { Label("Delete", systemImage: "trash") }
                    }
                    .onAppear {
                        // Infinite scroll: fetch the next page near the end.
                        if item.id == shown.suffix(5).first?.id { Task { await store.loadMore() } }
                    }
                }
                if store.loadingMore {
                    ProgressView().frame(maxWidth: .infinity).listRowBackground(Bee.paper).listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
        }
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Menu {
                    Picker("Kind", selection: $kindFilter) {
                        Text("All kinds").tag(Kind?.none)
                        ForEach(Kind.allCases) { Text("\($0.short)s").tag(Kind?.some($0)) }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(kindFilter.map { "\($0.short)s" } ?? "All kinds")
                        Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                    }
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .foregroundStyle(kindFilter == nil ? Bee.ink : Bee.onHoney)
                    .background(kindFilter == nil ? Color.clear : Bee.honey, in: Capsule())
                    .overlay(Capsule().strokeBorder(kindFilter == nil ? Bee.rule : .clear))
                }
                Chip(label: "All", selected: store.status == nil) { Task { await store.setStatusFilter(nil) } }
                ForEach(Status.allCases) { status in
                    Chip(label: status.label, dot: Bee.status(status), selected: store.status == status) {
                        Task { await store.setStatusFilter(status) }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Bee.paper)
        .overlay(alignment: .bottom) { Rectangle().fill(Bee.rule).frame(height: 1) }
    }

    @ViewBuilder private var newIssueButton: some View {
        if project != nil {
            HStack {
                Spacer()
                Button { composing = true } label: {
                    Label("New issue", systemImage: "plus")
                        .font(.headline)
                        .padding(.horizontal, 20).padding(.vertical, 14)
                        .foregroundStyle(Bee.onHoney)
                        .background(Bee.honey, in: Capsule())
                        .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
                }
                .padding(.trailing, 16)
            }
        }
    }

    @ToolbarContentBuilder private var menu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button { Task { await store.sync() } } label: { Label("Sync from GitHub", systemImage: "arrow.triangle.2.circlepath") }
                if let project {
                    Button { openURL(model.api.dashboardURL(projectSlug: project.slug)) } label: {
                        Label("Open in dashboard", systemImage: "safari")
                    }
                    Divider()
                    Button(role: .destructive) { confirmDeleteProject = true } label: { Label("Delete project", systemImage: "trash") }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More")
        }
    }

    private func deleteProject() {
        guard let project else { return }
        Task {
            do {
                try await model.projects.delete(project)
                model.lastProjectId = nil
                path = []
            } catch {
                store.message = userMessage(error)
            }
        }
    }
}

func deleteReportMessage(_ item: FeedbackItem) -> String {
    if let n = item.issueNumber {
        return "It's removed from FeedbackBee. Issue #\(n) stays on GitHub; set Won't fix first to close it."
    }
    return "It's removed from FeedbackBee."
}

/// Kind dot, two lines of text, time, then status, issue, attachments and reporter.
struct FeedbackRow: View {
    let item: FeedbackItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Dot(color: Bee.kind(item.kind)).padding(.top, 7)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.text).font(.body).foregroundStyle(Bee.ink).lineLimit(2)
                    Spacer(minLength: 8)
                    Text(relativeTime(item.createdAt)).font(.caption).foregroundStyle(Bee.inkMuted)
                }
                HStack(spacing: 10) {
                    StatusLabel(status: item.status)
                    if let n = item.issueNumber { meta("#\(n)") }
                    if item.issueFailed {
                        Image(systemName: "exclamationmark.triangle.fill").font(.caption2).foregroundStyle(Bee.danger)
                            .accessibilityLabel("Issue not filed")
                    }
                    if !item.images.isEmpty {
                        HStack(spacing: 2) {
                            Image(systemName: "photo")
                            if item.images.count > 1 { Text("\(item.images.count)") }
                        }
                        .font(.caption).foregroundStyle(Bee.inkMuted)
                    }
                    if item.recordingKey != nil { Image(systemName: "play.circle").font(.caption).foregroundStyle(Bee.inkMuted) }
                    if item.audioKey != nil { Image(systemName: "mic").font(.caption).foregroundStyle(Bee.inkMuted) }
                    if let who = item.reporterEmail ?? item.reporterName { meta(who).lineLimit(1) }
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private func meta(_ text: String) -> some View { Text(text).font(.caption).foregroundStyle(Bee.inkMuted) }
}
