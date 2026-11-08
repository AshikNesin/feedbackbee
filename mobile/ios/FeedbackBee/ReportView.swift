import FeedbackBeeCore
import SwiftUI

/// One report: read it, triage it, edit or delete it (DESIGN.md §4.4).
struct ReportView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    let projectId: String
    let feedbackId: String

    init(projectId: String, feedbackId: String) {
        self.projectId = projectId
        self.feedbackId = feedbackId
    }

    @State private var fetched: FeedbackItem?
    @State private var loadError: String?
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var viewing: ViewedImage?
    @State private var media: MediaSheet?

    private var store: InboxStore { model.inbox(projectId) }
    /// The live copy from the list, else the last one we saw (survives a refresh filtering it out).
    private var report: FeedbackItem? { store.item(feedbackId) ?? fetched }

    var body: some View {
        @Bindable var store = store
        Group {
            if let report {
                content(report)
            } else if let loadError {
                ContentUnavailableView("Couldn't load this report", systemImage: "exclamationmark.triangle", description: Text(loadError))
            } else {
                ProgressView()
            }
        }
        .background(Bee.paper)
        .navigationTitle(report?.issueNumber.map { "Issue #\($0)" } ?? "Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .task {
            if let live = store.item(feedbackId) {
                fetched = live
            } else {
                do { fetched = try await store.fetch(feedbackId) } catch { loadError = userMessage(error) }
            }
            #if DEBUG
            if DemoMode.screen == .edit, fetched != nil { editing = true }
            #endif
        }
        .onChange(of: store.item(feedbackId)) { _, live in if let live { fetched = live } }
        .sheet(isPresented: $editing) {
            if let report {
                ComposeSheet(title: "Edit report", action: "Save", initialKind: report.kind, initialText: report.text, allowImages: false) { kind, text, _ in
                    fetched = try await store.edit(report, kind: kind, text: text)
                }
            }
        }
        .confirmationDialog("Delete this report?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let report { Task { await store.delete(report) } }
                dismiss()
            }
        } message: {
            if let report { Text(deleteReportMessage(report)) }
        }
        .fullScreenCover(item: $viewing) { ImageViewer(url: $0.url) }
        .fullScreenCover(item: $media) { MediaSheetView(sheet: $0) }
        .toast($store.message)
    }

    private func content(_ report: FeedbackItem) -> some View {
        List {
            Section {
                HStack(spacing: 8) {
                    Dot(color: Bee.kind(report.kind))
                    Text(report.kind.label).font(.subheadline.weight(.semibold)).foregroundStyle(Bee.ink)
                    Text("· \(relativeTime(report.createdAt))").font(.subheadline).foregroundStyle(Bee.inkMuted)
                }
                Text(report.text).font(.body).foregroundStyle(Bee.ink).textSelection(.enabled)
            }

            Section("Status") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Status.allCases) { status in
                            Chip(label: status.label, dot: Bee.status(status), selected: report.status == status, selectedFill: Bee.muted, selectedInk: Bee.ink) {
                                Task { await store.setStatus(report, status) }
                            }
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            }

            if !report.images.isEmpty {
                Section("Images") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(report.images, id: \.self) { key in
                                let url = model.api.mediaURL(key)
                                Button { viewing = ViewedImage(url: url) } label: {
                                    RemoteImage(url: url, maxPoints: 180)
                                        .frame(width: 135, height: 180)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Image")
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }
            }

            Section("GitHub & media") {
                if let url = report.issueUrl.flatMap(URL.init(string:)), let n = report.issueNumber {
                    linkRow("Issue", "#\(n)", icon: "number") { openURL(url) }
                } else if report.issueFailed {
                    LabeledContent("Issue") { Text(report.issueError ?? "Not filed").foregroundStyle(Bee.danger) }
                } else {
                    LabeledContent("Issue", value: "Filing…")
                }
                if let key = report.recordingKey {
                    let replay = report.isReplay
                    playRow(replay ? "Replay" : "Recording", clock(report.recordingSeconds)) {
                        media = replay ? .replay(model.api.replayURL(key)) : .video(model.api.mediaURL(key))
                    }
                }
                if let key = report.audioKey {
                    AudioPlayerRow(url: model.api.mediaURL(key), duration: report.audioSeconds)
                }
            }

            if report.reporterEmail != nil || report.reporterName != nil || report.reporterId != nil {
                Section("Reporter") {
                    if let email = report.reporterEmail, let mail = URL(string: "mailto:\(email)?subject=Re%3A%20your%20feedback") {
                        linkRow("Email", email, icon: "envelope") { openURL(mail) }
                    }
                    if let name = report.reporterName { LabeledContent("Name", value: name) }
                    if let id = report.reporterId { LabeledContent("User id", value: id) }
                }
            }

            let details = contextRows(report)
            if !details.isEmpty {
                Section("Context") {
                    ForEach(details, id: \.0) { label, value in
                        if label == "Page", let page = report.url.flatMap(URL.init(string:)) {
                            linkRow(label, value, icon: nil) { openURL(page) }
                        } else {
                            LabeledContent(label) { Text(value).foregroundStyle(Bee.ink).lineLimit(3) }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func contextRows(_ r: FeedbackItem) -> [(String, String)] {
        var rows: [(String, String)] = []
        if let page = pagePath(r.url) { rows.append(("Page", page)) }
        if let os = r.osName { rows.append(("OS", [os, r.osVersion].compactMap { $0 }.joined(separator: " "))) }
        if let device = r.deviceModel { rows.append(("Device", device)) }
        if let version = r.appVersion { rows.append(("App version", version)) }
        if let w = r.screenW, let h = r.screenH { rows.append(("Screen", "\(w)×\(h)")) }
        if let ua = r.userAgent { rows.append(("User agent", ua)) }
        for (key, value) in (r.metadata ?? [:]).sorted(by: { $0.key < $1.key }) { rows.append((key, value.description)) }
        return rows
    }

    /// A row that plays media in the app.
    private func playRow(_ label: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: "play.circle").foregroundStyle(Bee.inkMuted).frame(width: 22)
                Text(label).foregroundStyle(Bee.inkMuted)
                Spacer()
                Text(value).foregroundStyle(Bee.ink)
                Image(systemName: "play.fill").font(.caption).foregroundStyle(Bee.inkMuted)
            }
        }
    }

    private func linkRow(_ label: String, _ value: String, icon: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                if let icon { Image(systemName: icon).foregroundStyle(Bee.inkMuted).frame(width: 22) }
                Text(label).foregroundStyle(Bee.inkMuted)
                Spacer()
                Text(value).foregroundStyle(Bee.ink).lineLimit(1)
                Image(systemName: "arrow.up.right").font(.caption.weight(.semibold)).foregroundStyle(Bee.inkMuted)
            }
        }
    }

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        if let report {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { editing = true } label: { Image(systemName: "pencil") }.accessibilityLabel("Edit")
                if let url = report.issueUrl.flatMap(URL.init(string:)) {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }.accessibilityLabel("Share issue link")
                }
                Menu {
                    if let project = model.projects.find(projectId) {
                        Button { openURL(model.api.dashboardURL(projectSlug: project.slug, feedbackId: report.id)) } label: {
                            Label("Open in dashboard", systemImage: "safari")
                        }
                    }
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                } label: { Image(systemName: "ellipsis.circle") }
                .accessibilityLabel("More")
            }
        }
    }
}

/// The image open in the full-screen viewer.
struct ViewedImage: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
