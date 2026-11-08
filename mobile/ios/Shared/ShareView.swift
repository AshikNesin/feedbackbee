import FeedbackBeeCore
import SwiftUI

/// The Share Extension's UI: the quick-file sheet with a project picker on
/// top, prefilled with what was shared. Signed out (in the app), it says so.
/// `onDone` gets the project's name once filed, nil when cancelled.
struct ShareView: View {
    let model: AppModel
    let attachments: [ComposeAttachment]
    let text: String
    let onDone: (_ filedIn: String?) -> Void
    @State private var projectId: String?
    @State private var filedIn: String?

    init(model: AppModel, attachments: [ComposeAttachment], text: String, onDone: @escaping (_ filedIn: String?) -> Void) {
        self.model = model
        self.attachments = attachments
        self.text = text
        self.onDone = onDone
        _projectId = State(initialValue: model.lastProjectId)
    }

    private var project: Project? {
        model.projects.find(projectId ?? "") ?? model.projects.projects.first
    }

    var body: some View {
        if model.session == nil {
            signedOut
        } else {
            ComposeSheet(
                title: "New issue",
                action: "Send",
                initialText: text,
                attachments: attachments,
                header: AnyView(picker),
                onClose: { onDone(filedIn) },
                onSubmit: { kind, body, uploads in
                    guard let project else {
                        throw APIError(status: 0, code: "PROJECT", message: "Pick a project first")
                    }
                    model.lastProjectId = project.id
                    try await model.inbox(project.id).submit(project: project, kind: kind, text: body, images: uploads)
                    filedIn = project.name
                }
            )
            .task { await model.projects.start() }
        }
    }

    @ViewBuilder private var picker: some View {
        let store = model.projects!
        if !store.loaded {
            Text("Loading projects…").font(.subheadline).foregroundStyle(Bee.inkMuted)
        } else if store.projects.isEmpty {
            Text(store.error ?? "No projects yet. Create one in the app first.").font(.subheadline).foregroundStyle(Bee.danger)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(store.projects) { p in
                        Chip(label: p.name, selected: p.id == project?.id) { projectId = p.id }
                    }
                }
            }
        }
    }

    private var signedOut: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.exclamationmark").font(.largeTitle).foregroundStyle(Bee.inkMuted)
            Text("Sign in first").font(.title3.weight(.semibold)).foregroundStyle(Bee.ink)
            Text("Open FeedbackBee and sign in to your server, then share again.")
                .font(.subheadline).foregroundStyle(Bee.inkMuted).multilineTextAlignment(.center)
            Button("Close") { onDone(nil) }.buttonStyle(.borderedProminent).tint(Bee.ink).padding(.top, 8)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Bee.paper)
    }
}
