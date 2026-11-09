import FeedbackBeeCore
import SwiftUI

/// Sign in to a FeedbackBee server: its address, then the owner's email and password.
struct LoginView: View {
    @Environment(AppModel.self) private var model
    @State private var host = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case host, email, password }

    private var canSubmit: Bool {
        !host.trimmingCharacters(in: .whitespaces).isEmpty && !email.isEmpty && !password.isEmpty && !busy
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image("Mark").resizable().frame(width: 72, height: 72).padding(.top, 48)
                Text("Sign in to FeedbackBee").font(.title2.weight(.semibold)).foregroundStyle(Bee.ink)
                Text("Use the address of your FeedbackBee and the owner account you use on the web.")
                    .font(.subheadline).foregroundStyle(Bee.inkMuted).multilineTextAlignment(.center)
                    .padding(.bottom, 12)

                VStack(spacing: 0) {
                    field("Server", text: $host, prompt: "bee.example.com")
                        .keyboardType(.URL).textContentType(.URL).focused($focus, equals: .host)
                        .submitLabel(.next).onSubmit { focus = .email }
                    Divider().overlay(Bee.rule)
                    field("Email", text: $email, prompt: "you@example.com")
                        .keyboardType(.emailAddress).textContentType(.username).focused($focus, equals: .email)
                        .submitLabel(.next).onSubmit { focus = .password }
                    Divider().overlay(Bee.rule)
                    SecureField("Password", text: $password)
                        .textContentType(.password).focused($focus, equals: .password)
                        .submitLabel(.go).onSubmit(submit)
                        .padding(14)
                }
                .background(Bee.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Bee.rule))

                if let error {
                    Text(error).font(.subheadline).foregroundStyle(Bee.danger).frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: submit) {
                    Group {
                        if busy { ProgressView().tint(Bee.paper) } else { Text("Sign in").font(.headline) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .foregroundStyle(Bee.paper)
                    .background(Bee.ink.opacity(canSubmit || busy ? 1 : 0.35), in: RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canSubmit)
                .padding(.top, 4)
            }
            .frame(maxWidth: 420)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Bee.paper)
        .onAppear {
            host = model.lastHost.map { $0.replacingOccurrences(of: "https://", with: "") } ?? ""
            email = model.lastEmail ?? ""
            focus = host.isEmpty ? .host : .password
        }
    }

    private func field(_ title: String, text: Binding<String>, prompt: String) -> some View {
        TextField(title, text: text, prompt: Text(prompt))
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(14)
            .accessibilityLabel(title)
    }

    private func submit() {
        guard canSubmit else { return }
        busy = true
        error = nil
        Task {
            do {
                try await model.signIn(host: host, email: email, password: password)
            } catch {
                self.error = userMessage(error)
                busy = false
            }
        }
    }
}
