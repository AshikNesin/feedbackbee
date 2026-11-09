import FeedbackBeeCore
import SwiftUI
import UIKit

enum Route: Hashable {
    case inbox(projectId: String)
    case report(projectId: String, feedbackId: String)
    case settings
}

/// Sign-in, or the signed-in navigation stack (a fresh one per session).
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        #if DEBUG
        if DemoMode.screen == .share {
            // The Share Extension's UI, as it appears over the app the user shared from.
            Color.gray.opacity(0.3).ignoresSafeArea().sheet(isPresented: .constant(true)) {
                ShareView(
                    model: model,
                    attachments: [ComposeAttachment(data: DemoServer.screenshot, thumbnail: UIImage(data: DemoServer.screenshot)!)],
                    text: "Checkout button overlaps the footer on small screens",
                    onDone: { _ in }
                )
            }
        } else {
            content
        }
        #else
        content
        #endif
    }

    @ViewBuilder private var content: some View {
        if let session = model.session {
            SignedInView().id(session.token)
        } else {
            LoginView()
        }
    }
}

struct SignedInView: View {
    @Environment(AppModel.self) private var model
    @State private var path: [Route] = []
    /// Set by the quick action: the inbox opens its compose sheet once.
    @State private var composeOnOpen = false
    @State private var restored = false

    var body: some View {
        NavigationStack(path: $path) {
            ProjectsView(path: $path)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .inbox(let projectId):
                        InboxView(projectId: projectId, composeOnOpen: $composeOnOpen, path: $path)
                    case .report(let projectId, let feedbackId):
                        ReportView(projectId: projectId, feedbackId: feedbackId)
                    case .settings:
                        SettingsView()
                    }
                }
        }
        .onAppear {
            // Launch straight into the last project's inbox.
            guard !restored else { return }
            restored = true
            if let last = model.lastProjectId { path = [.inbox(projectId: last)] }
            #if DEBUG
            switch DemoMode.screen {
            case .report, .edit: path = [.inbox(projectId: "p1"), .report(projectId: "p1", feedbackId: "f1")]
            case .settings: path = [.settings]
            case .compose: composeOnOpen = true
            default: break
            }
            #endif
        }
        .onChange(of: model.newIssueRequests, initial: true) { _, count in
            guard count > 0, let last = model.lastProjectId else { return }
            composeOnOpen = true
            path = [.inbox(projectId: last)]
        }
    }
}
