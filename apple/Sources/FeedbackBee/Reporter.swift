import Foundation

/// A `setContext` value. Literals work directly: `["plan": "pro", "build": 4211, "beta": true]`.
public enum ContextValue: Equatable, Sendable, ExpressibleByStringLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)

    public init(stringLiteral value: String) { self = .string(value) }
    public init(integerLiteral value: Int) { self = .int(value) }
    public init(floatLiteral value: Double) { self = .double(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
}

struct ReporterIdentity: Equatable, Sendable {
    let email: String?
    let name: String?
    let id: String?
}

/// Sticky reporter details and metadata set via `identify` / `setContext`. Safe from any thread.
final class Reporter: @unchecked Sendable {
    static let shared = Reporter()

    private let lock = NSLock()
    private var identity: ReporterIdentity?
    // Keys keep insertion order so the 20-key cap drops the newest keys, like Android's LinkedHashMap.
    private var keys: [String] = []
    private var values: [String: ContextValue] = [:]

    func identify(email: String?, name: String?, id: String?) {
        func clean(_ value: String?) -> String? {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
            return trimmed
        }
        let next = ReporterIdentity(email: clean(email), name: clean(name), id: clean(id))
        lock.lock(); defer { lock.unlock() }
        identity = next
    }

    func setContext(_ metadata: [String: ContextValue?]) {
        lock.lock(); defer { lock.unlock() }
        // Sorted so one call with several new keys stores them in a deterministic order.
        for key in metadata.keys.sorted() {
            if let value = metadata[key] ?? nil {
                if values[key] == nil { keys.append(key) }
                values[key] = value
            } else if values.removeValue(forKey: key) != nil {
                keys.removeAll { $0 == key }
            }
        }
    }

    func reset() {
        lock.lock(); defer { lock.unlock() }
        identity = nil
        keys.removeAll()
        values.removeAll()
    }

    func identityOrNil() -> ReporterIdentity? {
        lock.lock(); defer { lock.unlock() }
        guard let identity, identity.email != nil || identity.name != nil || identity.id != nil else { return nil }
        return identity
    }

    func context() -> [(String, ContextValue)] {
        lock.lock(); defer { lock.unlock() }
        return keys.compactMap { key in values[key].map { (key, $0) } }
    }
}
