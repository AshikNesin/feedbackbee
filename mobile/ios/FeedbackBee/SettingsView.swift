import FeedbackBeeCore
import SwiftUI

/// Account, server, version and company (kept off the main screens, DESIGN.md §1).
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var confirmSignOut = false

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "0"
        let build = info?["CFBundleVersion"] as? String ?? "0"
        return "\(short) (\(build))"
    }

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Server", value: model.session.map { pagePath($0.host.absoluteString) ?? $0.host.absoluteString } ?? "")
                LabeledContent("Signed in as", value: model.session?.email ?? "")
                Button("Open web dashboard") { openURL(model.api.dashboardURL()) }
            }
            Section("About") {
                LabeledContent("Version", value: version)
                Button { openURL(URL(string: "https://nesin.io?ref=feedbackbee")!) } label: {
                    LabeledContent("Made by", value: "Nesin Technologies LLP")
                }
                .foregroundStyle(Bee.ink)
            }
            Section {
                Button("Sign out", role: .destructive) { confirmSignOut = true }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { model.signOut() }
        } message: {
            Text("This device forgets your session and cached reports. Your server keeps everything.")
        }
    }
}
