import ImageIO
import SwiftUI
import UIKit

/// Report media loader. `/f/<key>` is immutable, so responses live in a large
/// URLCache on disk, and decoded images are downsampled to the size they're
/// shown at (ImageIO thumbnails, off the main thread) and kept in memory.
actor ImageLoader {
    static let shared = ImageLoader()

    /// Debug demo mode serves media from its fake server (FeedbackBee/DemoMode.swift).
    nonisolated(unsafe) static var protocolClasses: [AnyClass] = []

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        if !ImageLoader.protocolClasses.isEmpty { config.protocolClasses = ImageLoader.protocolClasses }
        config.urlCache = URLCache(memoryCapacity: 16 << 20, diskCapacity: 256 << 20, directory: nil)
        config.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: config)
    }()
    private let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 64 << 20
        return cache
    }()
    private var inFlight: [String: Task<UIImage?, Never>] = [:]

    func image(_ url: URL, maxPixels: Int) async -> UIImage? {
        let key = "\(url.absoluteString)#\(maxPixels)"
        if let hit = memory.object(forKey: key as NSString) { return hit }
        if let running = inFlight[key] { return await running.value }
        let session = session
        let task = Task.detached(priority: .userInitiated) { () -> UIImage? in
            guard let (data, _) = try? await session.data(from: url) else { return nil }
            return Self.downsample(data, maxPixels: maxPixels)
        }
        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        if let image {
            let cost = Int(image.size.width * image.size.height * image.scale * image.scale * 4)
            memory.setObject(image, forKey: key as NSString, cost: cost)
        }
        return image
    }

    nonisolated static func downsample(_ data: Data, maxPixels: Int) -> UIImage? {
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, options) else { return nil }
        let thumb = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ] as CFDictionary
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, thumb) else { return nil }
        return UIImage(cgImage: image)
    }
}

/// An image from the server, decoded at the pixel size of its frame.
struct RemoteImage: View {
    let url: URL
    /// Longest edge in points; nil decodes for the full screen.
    var maxPoints: CGFloat?
    var contentMode: ContentMode = .fill
    @Environment(\.displayScale) private var scale
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Bee.muted
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            }
        }
        .task(id: url) {
            image = nil
            let points = maxPoints ?? max(UIScreen.main.bounds.width, UIScreen.main.bounds.height)
            let loaded = await ImageLoader.shared.image(url, maxPixels: Int(points * scale))
            if !Task.isCancelled { image = loaded } // the url changed meanwhile: keep the newer image
        }
    }
}

/// Full-screen viewer: pinch to zoom, double-tap to reset, swipe down or Close to dismiss.
struct ImageViewer: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var zoom: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1
    @State private var offset: CGSize = .zero
    @GestureState private var drag: CGSize = .zero

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            RemoteImage(url: url, contentMode: .fit)
                .background(Color.black)
                .scaleEffect(zoom * pinch)
                .offset(x: offset.width + drag.width, y: offset.height + drag.height)
                .gesture(
                    MagnifyGesture()
                        .updating($pinch) { value, state, _ in state = value.magnification }
                        .onEnded { zoom = min(6, max(1, zoom * $0.magnification)) }
                )
                .onTapGesture(count: 2) { withAnimation { zoom = 1; offset = .zero } }
                // Zoomed in, a drag pans; at 1x, a long swipe down closes.
                .simultaneousGesture(
                    DragGesture()
                        .updating($drag) { value, state, _ in if zoom > 1 { state = value.translation } }
                        .onEnded { value in
                            if zoom > 1 {
                                offset.width += value.translation.width
                                offset.height += value.translation.height
                            } else if value.translation.height > 120 {
                                dismiss()
                            }
                        }
                )
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).foregroundStyle(.white)
                    .padding(12).background(.white.opacity(0.15), in: Circle())
            }
            .padding()
            .accessibilityLabel("Close")
        }
    }
}
