import FeedbackBeeCore
import SwiftUI

struct ProjectsView: View {
    @Environment(AppModel.self) private var model
    @Binding var path: [Route]
    @State private var creating = false
    @State private var loadFailed = false

    init(path: Binding<[Route]>) { _path = path }

    var body: some View {
        let store = model.projects!
        Group {
            if !store.loaded {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.projects.isEmpty {
                ContentUnavailableView(
                    "No projects yet",
                    systemImage: "tray",
                    description: Text("A project files its reports as issues in one GitHub repository. Tap + to add one.")
                )
            } else {
                List(store.projects) { project in
                    Button {
                        model.lastProjectId = project.id
                        path.append(.inbox(projectId: project.id))
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(project.name).font(.headline).foregroundStyle(Bee.ink)
                                Text("\(project.slug) · \(project.githubRepo)")
                                    .font(.subheadline).foregroundStyle(Bee.inkMuted).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Bee.inkMuted)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Bee.paper)
                }
                .listStyle(.plain)
            }
        }
        .background(Bee.paper)
        .navigationTitle("Projects")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { path.append(.settings) } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Settings")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { creating = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("New project")
            }
        }
        .refreshable { await store.refresh() }
        .task {
            #if DEBUG
            if DemoMode.screen == .newProject { creating = true }
            #endif
            await store.start()
        }
        .onChange(of: store.error) { _, error in loadFailed = error != nil && store.projects.isEmpty }
        .alert("Couldn't load projects", isPresented: $loadFailed) {
            Button("Retry") { Task { await store.refresh() } }
            Button("OK", role: .cancel) {}
        } message: { Text(store.error ?? "") }
        .sheet(isPresented: $creating) {
            NewProjectSheet { project in
                creating = false
                model.lastProjectId = project.id
                path.append(.inbox(projectId: project.id))
            }
        }
    }
}

/// Name → project id (derived until edited) → a repository the GitHub App can file in.
struct NewProjectSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let onCreated: (Project) -> Void

    init(onCreated: @escaping (Project) -> Void) { self.onCreated = onCreated }
    @State private var name = ""
    @State private var slug = ""
    @State private var slugEdited = false
    @State private var repo: String?
    @State private var repos: [GithubRepository]?
    @State private var error: String?
    @State private var busy = false

    private var effectiveSlug: String { slugEdited ? slug : slugify(name) }
    private var canCreate: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && isValidSlug(effectiveSlug) && repo != nil && !busy }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name, prompt: Text("My app"))
                    TextField("Project id", text: Binding(get: { effectiveSlug }, set: { slug = $0.lowercased(); slugEdited = true }))
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                } footer: {
                    Text("The project id is used in the embed snippet and SDKs. It can't change later.")
                }
                Section("GitHub repository") {
                    if let repos {
                        if repos.isEmpty {
                            Text("No repositories yet. Connect GitHub in the web dashboard (Settings → GitHub) and install the app on a repository.")
                                .font(.subheadline).foregroundStyle(Bee.inkMuted)
                        }
                        ForEach(repos) { r in
                            Button { repo = r.fullName } label: {
                                HStack {
                                    Text(r.fullName).foregroundStyle(Bee.ink)
                                    Spacer()
                                    if repo == r.fullName { Image(systemName: "checkmark").foregroundStyle(Bee.ink) }
                                }
                            }
                        }
                    } else {
                        ProgressView()
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(Bee.danger) }
                }
            }
            .navigationTitle("New project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Creating…" : "Create", action: create).disabled(!canCreate).fontWeight(.semibold)
                }
            }
            .task {
                do {
                    let list = try await model.api.repositories()
                    repos = list
                    if list.count == 1 { repo = list[0].fullName }
                } catch {
                    repos = []
                    self.error = userMessage(error)
                }
            }
        }
    }

    private func create() {
        guard let repo else { return }
        busy = true
        error = nil
        Task {
            do {
                onCreated(try await model.projects.create(name: name.trimmingCharacters(in: .whitespaces), slug: effectiveSlug, repo: repo))
            } catch {
                self.error = userMessage(error)
                busy = false
            }
        }
    }
}
