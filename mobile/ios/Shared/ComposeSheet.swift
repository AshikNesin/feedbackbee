import FeedbackBeeCore
import PhotosUI
import SwiftUI
import UIKit

/// Reports carry at most 5 images (docs/CONTRACT.md).
let maxImages = 5

/// The server's 5,000-character limit counts UTF-16 code units (JavaScript
/// string length), so emoji count double; trim whole characters to fit.
func clampToServerLimit(_ text: String, limit: Int = 5000) -> String {
    guard text.utf16.count > limit else { return text }
    var out = ""
    var used = 0
    for character in text {
        let size = character.utf16.count
        if used + size > limit { break }
        out.append(character)
        used += size
    }
    return out
}

/// An image attached to a new report: the original bytes (encoded at send
/// time) and a small thumbnail for the sheet.
struct ComposeAttachment: Identifiable {
    let id = UUID()
    let data: Data
    let thumbnail: UIImage

    /// Decodes a thumbnail off the main thread; nil when `data` isn't an image.
    static func make(_ data: Data) async -> ComposeAttachment? {
        let thumb = await Task.detached(priority: .userInitiated) { ImageLoader.downsample(data, maxPixels: 168) }.value
        return thumb.map { ComposeAttachment(data: data, thumbnail: $0) }
    }
}

/// The quick-file sheet (DESIGN.md §4.5): kind chips, the note already
/// focused, optional photos, Send. With `allowImages` off it edits a report.
/// `onSubmit` throws to keep the sheet open with the error shown. Used in the
/// app (as a sheet) and in the Share Extension (as its whole UI, with `onClose`).
struct ComposeSheet: View {
    let title: String
    let action: String
    var initialKind: Kind
    var initialText: String
    var allowImages: Bool
    var header: AnyView?
    /// Called on Cancel and after a successful send; nil dismisses the sheet.
    var onClose: (() -> Void)?
    let onSubmit: (Kind, String, [Upload]) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kind: Kind = .issue
    @State private var text = ""
    @State private var attachments: [ComposeAttachment]
    @State private var picks: [PhotosPickerItem] = []
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    init(
        title: String,
        action: String,
        initialKind: Kind = .issue,
        initialText: String = "",
        allowImages: Bool = true,
        attachments: [ComposeAttachment] = [],
        header: AnyView? = nil,
        onClose: (() -> Void)? = nil,
        onSubmit: @escaping (Kind, String, [Upload]) async throws -> Void
    ) {
        self.title = title
        self.action = action
        self.initialKind = initialKind
        self.initialText = initialText
        self.allowImages = allowImages
        self.header = header
        self.onClose = onClose
        self.onSubmit = onSubmit
        _attachments = State(initialValue: Array(attachments.prefix(maxImages)))
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var changed: Bool { trimmed != initialText.trimmingCharacters(in: .whitespacesAndNewlines) || kind != initialKind }
    private var canSend: Bool { !trimmed.isEmpty && !busy && (allowImages || changed) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                if let header { header }
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
                        .onChange(of: text) { _, new in
                            let clamped = clampToServerLimit(new)
                            if clamped != new { text = clamped }
                        }
                }
                .padding(8)
                .background(Bee.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(focused ? Bee.ink : Bee.rule))

                if allowImages {
                    // Scrolls sideways: five thumbnails and the add button don't fit a narrow iPhone.
                    ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        if attachments.count < maxImages {
                            PhotosPicker(selection: $picks, maxSelectionCount: maxImages - attachments.count, matching: .images) {
                                Image(systemName: "photo.badge.plus").font(.title3).foregroundStyle(Bee.inkMuted)
                                    .frame(width: 56, height: 56)
                                    .background(Bee.muted, in: RoundedRectangle(cornerRadius: 10))
                            }
                            .accessibilityLabel("Attach images")
                        }
                        ForEach(attachments) { attachment in
                            Image(uiImage: attachment.thumbnail).resizable().scaledToFill()
                                .frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(alignment: .topTrailing) {
                                    Button {
                                        attachments.removeAll { $0.id == attachment.id }
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
                    .scrollClipDisabled()
                }
                if let error { Text(error).font(.subheadline).foregroundStyle(Bee.danger) }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(Bee.paper)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: close).disabled(busy) }
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
        .onChange(of: picks) { _, new in
            guard !new.isEmpty else { return }
            Task {
                for pick in new where attachments.count < maxImages {
                    if let data = try? await pick.loadTransferable(type: Data.self), let made = await ComposeAttachment.make(data) {
                        attachments.append(made)
                    }
                }
                picks = []
            }
        }
    }

    private func close() {
        if let onClose { onClose() } else { dismiss() }
    }

    private func send() {
        busy = true
        error = nil
        let originals = allowImages ? attachments.map(\.data) : []
        Task {
            do {
                try await onSubmit(kind, trimmed, await encodeUploads(originals))
                close()
            } catch {
                self.error = userMessage(error)
                busy = false
            }
        }
    }
}

/// Image bytes → JPEG uploads, scaled to 2048 px off the main thread so a
/// report with five photos stays far under the server's 10 MB / 50 MB caps.
func encodeUploads(_ originals: [Data]) async -> [Upload] {
    await Task.detached(priority: .userInitiated) {
        originals.enumerated().compactMap { index, data in
            ImageLoader.downsample(data, maxPixels: 2048)?.jpegData(compressionQuality: 0.85)
                .map { Upload(data: $0, mime: "image/jpeg", fileName: "image-\(index + 1).jpg") }
        }
    }.value
}
