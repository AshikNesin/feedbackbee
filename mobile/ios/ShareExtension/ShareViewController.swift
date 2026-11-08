import FeedbackBeeCore
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// "Share → FeedbackBee" from Photos, a screenshot, Safari or any app: shows
/// the quick-file sheet prefilled with the shared images and text, files the
/// issue as the owner signed in to the app, then closes.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        Task { @MainActor in
            let shared = await SharedContent.load(from: items)
            let host = UIHostingController(rootView: ShareView(
                model: AppModel.shared(),
                attachments: shared.attachments,
                text: shared.text
            ) { [weak self] _ in
                self?.extensionContext?.completeRequest(returningItems: nil)
            })
            addChild(host)
            host.view.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(host.view)
            NSLayoutConstraint.activate([
                host.view.topAnchor.constraint(equalTo: view.topAnchor),
                host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            ])
            host.didMove(toParent: self)
        }
    }
}

/// What the host app shared: up to five images and any text or link.
struct SharedContent {
    var attachments: [ComposeAttachment] = []
    var text = ""

    static func load(from items: [NSExtensionItem]) async -> SharedContent {
        var out = SharedContent()
        var texts: [String] = []
        for item in items {
            if let note = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                texts.append(note)
            }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier), out.attachments.count < maxImages {
                    if let data = await imageData(provider), let attachment = await ComposeAttachment.make(data) {
                        out.attachments.append(attachment)
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                        texts.append(url.absoluteString)
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if let string = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                        texts.append(string)
                    }
                }
            }
        }
        out.text = String(texts.reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }.joined(separator: "\n\n").prefix(5000))
        return out
    }

    /// Image bytes, whether the host shares a file, raw data or a UIImage (the screenshot editor does).
    private static func imageData(_ provider: NSItemProvider) async -> Data? {
        let item = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier)
        switch item {
        case let url as URL: return try? Data(contentsOf: url)
        case let data as Data: return data
        case let image as UIImage: return image.pngData()
        default: return nil
        }
    }
}
