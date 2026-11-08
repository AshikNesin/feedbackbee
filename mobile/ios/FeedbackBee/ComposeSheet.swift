import FeedbackBeeCore
import PhotosUI
import SwiftUI
import UIKit

/// Reports carry at most 5 images (docs/CONTRACT.md).
private let maxImages = 5

/// The quick-file sheet (DESIGN.md §4.5): kind chips, the note already
/// focused, optional photos, Send. With `allowImages` off it edits a report.
/// `onSubmit` throws to keep the sheet open with the error shown.
struct ComposeSheet: View {
    let title: String
    let action: String
    var initialKind: Kind = .issue
    var initialText: String = ""
    var allowImages = true
    let onSubmit: (Kind, String, [Upload]) async throws -> Void

    init(
        title: String,
        action: String,
        initialKind: Kind = .issue,
        initialText: String = "",
        allowImages: Bool = true,
        onSubmit: @escaping (Kind, String, [Upload]) async throws -> Void
    ) {
        self.title = title
        self.action = action
        self.initialKind = initialKind
        self.initialText = initialText
        self.allowImages = allowImages
        self.onSubmit = onSubmit
    }

    @Environment(\.dismiss) private var dismiss
    @State private var kind: Kind = .issue
    @State private var text = ""
    @State private var picks: [PhotosPickerItem] = []
    @State private var thumbnails: [UIImage] = []
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var changed: Bool { trimmed != initialText.trimmingCharacters(in: .whitespacesAndNewlines) || kind != initialKind }
    private var canSend: Bool { !trimmed.isEmpty && !busy && (allowImages || changed) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    ForEach(Kind.allCases) { option in
                        Chip(label: option.short, dot: Bee.kind(option), selected: kind == option, selectedFill: Bee.muted, selectedInk: Bee.ink) {
                            kind = option
                        }
                    }
                }
                ZStack(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(kind == .featureRequest ? "What would make it better?" : "What happened?")
                            .foregroundStyle(Bee.inkMuted).padding(.horizontal, 5).padding(.vertical, 8)
                    }
                    TextEditor(text: $text)
                        .focused($focused)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 120)
                        .onChange(of: text) { _, new in if new.count > 5000 { text = String(new.prefix(5000)) } }
                }
                .padding(8)
                .background(Bee.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(focused ? Bee.ink : Bee.rule))

                if allowImages {
                    HStack(spacing: 8) {
                        PhotosPicker(selection: $picks, maxSelectionCount: maxImages, matching: .images) {
                            Image(systemName: "photo.badge.plus").font(.title3).foregroundStyle(Bee.inkMuted)
                                .frame(width: 56, height: 56)
                                .background(Bee.muted, in: RoundedRectangle(cornerRadius: 10))
                        }
                        .accessibilityLabel("Attach images")
                        ForEach(Array(thumbnails.enumerated()), id: \.offset) { index, image in
                            Image(uiImage: image).resizable().scaledToFill()
                                .frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(alignment: .topTrailing) {
                                    Button {
                                        picks.remove(at: index)
                                    } label: {
                                        Image(systemName: "xmark.circle.fill").symbolRenderingMode(.palette)
                                            .foregroundStyle(.white, .black.opacity(0.6))
                                    }
                                    .offset(x: 6, y: -6)
                                    .accessibilityLabel("Remove image")
                                }
                        }
                    }
                }
                if let error { Text(error).font(.subheadline).foregroundStyle(Bee.danger) }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(Bee.paper)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                ToolbarItem(placement: .confirmationAction) {
                    if busy {
                        ProgressView()
                    } else {
                        Button(action, action: send).fontWeight(.semibold).disabled(!canSend)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
        .onAppear {
            kind = initialKind
            text = initialText
            focused = true
        }
        .task(id: picks) { thumbnails = await loadThumbnails(picks) }
    }

    private func send() {
        busy = true
        error = nil
        Task {
            do {
                let uploads = allowImages ? await encodeUploads(picks) : []
                try await onSubmit(kind, trimmed, uploads)
                dismiss()
            } catch {
                self.error = userMessage(error)
                busy = false
            }
        }
    }
}

/// Picked photos → JPEG uploads, scaled down off the main thread so a report
/// with five photos stays far under the server's 10 MB / 50 MB caps and sends fast.
private func encodeUploads(_ picks: [PhotosPickerItem]) async -> [Upload] {
    var uploads: [Upload] = []
    for (index, pick) in picks.enumerated() {
        guard let data = try? await pick.loadTransferable(type: Data.self) else { continue }
        let jpeg = await Task.detached(priority: .userInitiated) { () -> Data? in
            ImageLoader.downsample(data, maxPixels: 2048)?.jpegData(compressionQuality: 0.85)
        }.value
        if let jpeg { uploads.append(Upload(data: jpeg, mime: "image/jpeg", fileName: "image-\(index + 1).jpg")) }
    }
    return uploads
}

private func loadThumbnails(_ picks: [PhotosPickerItem]) async -> [UIImage] {
    var images: [UIImage] = []
    for pick in picks {
        guard let data = try? await pick.loadTransferable(type: Data.self) else { continue }
        if let thumb = await Task.detached(operation: { ImageLoader.downsample(data, maxPixels: 168) }).value { images.append(thumb) }
    }
    return images
}
