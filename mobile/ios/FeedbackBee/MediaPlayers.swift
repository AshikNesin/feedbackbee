import AVKit
import FeedbackBeeCore
import SwiftUI
import WebKit

/// AVFoundation plays AAC/m4a, MP3 and MP4; WebM and Ogg (web recordings and
/// browser voice notes) play in a web view instead.
func playsNatively(_ url: URL) -> Bool { !["webm", "ogg"].contains(url.pathExtension.lowercased()) }

/// An inline voice-note player: play/pause, a scrubber and the time. The
/// player is created on first play and stopped when the row goes away.
struct AudioPlayerRow: View {
    let url: URL
    let duration: Double?
    @State private var player: AVPlayer?
    @State private var observer: Any?
    @State private var playing = false
    @State private var position: Double = 0
    @State private var total: Double = 0
    @State private var webFallback = false

    init(url: URL, duration: Double?) {
        self.url = url
        self.duration = duration
        _total = State(initialValue: duration ?? 0)
    }

    var body: some View {
        HStack(spacing: 12) {
            Button(action: toggle) {
                Image(systemName: playing ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 30)).foregroundStyle(Bee.ink)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playing ? "Pause voice note" : "Play voice note")
            VStack(alignment: .leading, spacing: 2) {
                Text("Voice note").font(.subheadline).foregroundStyle(Bee.inkMuted)
                Slider(value: Binding(get: { position }, set: seek), in: 0...max(total, 0.1))
                    .tint(Bee.ink)
                    .disabled(player == nil)
            }
            Text("\(clock(position)) / \(clock(total))").font(.caption.monospacedDigit()).foregroundStyle(Bee.inkMuted)
        }
        .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification)) { note in
            guard let item = note.object as? AVPlayerItem, item === player?.currentItem else { return }
            playing = false
            position = 0
            player?.seek(to: .zero)
        }
        .onDisappear(perform: stop)
        .sheet(isPresented: $webFallback) {
            WebMediaSheet(title: "Voice note", url: url, tag: "audio").presentationDetents([.height(200)])
        }
    }

    private func toggle() {
        guard playsNatively(url) else { webFallback = true; return }
        let p = player ?? makePlayer()
        if playing { p.pause() } else { p.play() }
        playing.toggle()
    }

    private func makePlayer() -> AVPlayer {
        try? AVAudioSession.sharedInstance().setCategory(.playback) // play with the ringer off
        let p = AVPlayer(url: url)
        observer = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.2, preferredTimescale: 600), queue: .main) { time in
            position = time.seconds
            if let d = p.currentItem?.duration.seconds, d.isFinite, d > 0 { total = d }
        }
        player = p
        return p
    }

    private func seek(_ seconds: Double) {
        position = seconds
        player?.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
    }

    private func stop() {
        player?.pause()
        if let observer { player?.removeTimeObserver(observer) }
        observer = nil
        player = nil
        playing = false
    }
}

/// What's open full screen from a report.
enum MediaSheet: Identifiable {
    case replay(URL)
    case video(URL)

    var id: String {
        switch self {
        case .replay(let url), .video(let url): url.absoluteString
        }
    }
}

/// A session replay (rrweb) played by the server's own replay page, or a
/// screen recording in the system player (WebM in a web view).
struct MediaSheetView: View {
    let sheet: MediaSheet
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var player: AVPlayer?

    var body: some View {
        NavigationStack {
            Group {
                switch sheet {
                case .replay(let url):
                    WebView(source: .url(url)).ignoresSafeArea(edges: .bottom)
                case .video(let url):
                    if playsNatively(url) {
                        VideoPlayer(player: player)
                            .onAppear {
                                let p = AVPlayer(url: url)
                                player = p
                                p.play()
                            }
                            .onDisappear { player?.pause() }
                    } else {
                        WebView(source: .media(url, tag: "video"))
                    }
                }
            }
            .background(Color.black)
            .navigationTitle(isReplay ? "Session replay" : "Screen recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    Button { openURL(url) } label: { Image(systemName: "safari") }.accessibilityLabel("Open in browser")
                }
            }
        }
    }

    private var isReplay: Bool { if case .replay = sheet { true } else { false } }
    private var url: URL { switch sheet { case .replay(let u), .video(let u): u } }
}

/// Audio or video in an HTML5 element, for formats AVFoundation can't play.
struct WebMediaSheet: View {
    let title: String
    let url: URL
    let tag: String
    var body: some View {
        NavigationStack {
            WebView(source: .media(url, tag: tag))
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct WebView: UIViewRepresentable {
    enum Source {
        case url(URL)
        /// A bare `<audio>` / `<video>` element playing `url`.
        case media(URL, tag: String)
    }

    let source: Source

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        switch source {
        case .url(let url):
            view.load(URLRequest(url: url))
        case .media(let url, let tag):
            let src = url.absoluteString.replacingOccurrences(of: "\"", with: "%22")
            let html = """
            <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:transparent}
            video{width:100%;max-height:100%}audio{width:92%}</style>
            <\(tag) src="\(src)" controls autoplay playsinline></\(tag)>
            """
            view.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}
