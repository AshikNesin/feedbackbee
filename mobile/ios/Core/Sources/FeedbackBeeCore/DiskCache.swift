import Foundation

/// Last-known server data on disk, so a screen paints at once and refreshes
/// after (stale-while-revalidate). Reads and writes run off the main thread.
/// Signing out or switching servers wipes it.
public struct DiskCache: Sendable {
    private let directory: URL

    public init(directory: URL) { self.directory = directory }

    /// `Library/Caches/feedbackbee` in the app container.
    public static func standard() -> DiskCache {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return DiskCache(directory: base.appendingPathComponent("feedbackbee", isDirectory: true))
    }

    public func projects() async -> [Project]? { await read("projects.json") }
    public func saveProjects(_ projects: [Project]) async { await write("projects.json", projects) }

    /// The first page of a project's inbox, unfiltered.
    public func inbox(_ projectId: String) async -> FeedbackPage? { await read("inbox-\(safe(projectId)).json") }
    public func saveInbox(_ projectId: String, _ page: FeedbackPage) async { await write("inbox-\(safe(projectId)).json", page) }

    public func clear() async {
        let dir = directory
        await Task.detached(priority: .utility) { try? FileManager.default.removeItem(at: dir) }.value
    }

    private func read<T: Decodable & Sendable>(_ name: String) async -> T? {
        let url = directory.appendingPathComponent(name)
        return await Task.detached(priority: .userInitiated) { () -> T? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? Wire.decoder.decode(T.self, from: data)
        }.value
    }

    private func write<T: Encodable & Sendable>(_ name: String, _ value: T) async {
        let dir = directory
        await Task.detached(priority: .utility) {
            guard let data = try? Wire.encoder.encode(value) else { return }
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? data.write(to: dir.appendingPathComponent(name), options: .atomic)
        }.value
    }

    private func safe(_ id: String) -> String {
        id.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "_", options: .regularExpression)
    }
}
