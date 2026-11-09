import Foundation

/// Last-known server data on disk, so a screen paints at once and refreshes
/// after (stale-while-revalidate). An actor, so reads, writes and the wipe run
/// off the main thread one at a time. One instance per session: signing out
/// retires it (later writes from that session are dropped) and wipes the files.
public actor DiskCache {
    private let directory: URL
    private var retired = false

    public init(directory: URL) { self.directory = directory }

    /// The cache the app and its Share Extension share (`AppGroup.cacheDirectory()`).
    public static func standard() -> DiskCache { DiskCache(directory: AppGroup.cacheDirectory()) }

    public func projects() async -> [Project]? { await read("projects.json") }
    public func saveProjects(_ projects: [Project]) async { await write("projects.json", projects) }

    /// The first page of a project's inbox, unfiltered.
    public func inbox(_ projectId: String) async -> FeedbackPage? { await read("inbox-\(safe(projectId)).json") }
    public func saveInbox(_ projectId: String, _ page: FeedbackPage) async { await write("inbox-\(safe(projectId)).json", page) }

    /// Wipe the files, keeping this cache usable (signing in to another account).
    public func clear() {
        try? FileManager.default.removeItem(at: directory)
    }

    /// Sign-out: drop every later write from this session, then wipe.
    public func retireAndClear() {
        retired = true
        clear()
    }

    private func read<T: Decodable & Sendable>(_ name: String) -> T? {
        guard !retired, let data = try? Data(contentsOf: directory.appendingPathComponent(name)) else { return nil }
        return try? Wire.decoder.decode(T.self, from: data)
    }

    private func write<T: Encodable & Sendable>(_ name: String, _ value: T) {
        guard !retired, let data = try? Wire.encoder.encode(value) else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: directory.appendingPathComponent(name), options: .atomic)
    }

    private nonisolated func safe(_ id: String) -> String {
        id.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "_", options: .regularExpression)
    }
}
