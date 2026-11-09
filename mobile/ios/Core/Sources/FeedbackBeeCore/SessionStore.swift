import Foundation
#if canImport(Security)
import Security
#endif

/// Where the session token is sealed. The app uses the Keychain; tests use memory.
public protocol SecretStorage: Sendable {
    func read(_ key: String) -> String?
    func write(_ key: String, _ value: String)
    func delete(_ key: String)
}

/// Who is signed in where. Host, email and the last project are plain
/// defaults; the token is in the Keychain, readable only after first unlock
/// on this device (never synced or backed up).
public final class SessionStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let secrets: SecretStorage

    public init(defaults: UserDefaults = .standard, secrets: SecretStorage) {
        self.defaults = defaults
        self.secrets = secrets
    }

    public func load() -> Session? {
        guard let raw = defaults.string(forKey: Keys.host), let host = URL(string: raw),
              let email = defaults.string(forKey: Keys.email),
              let token = secrets.read(Keys.token)
        else { return nil }
        return Session(host: host, email: email, token: token)
    }

    public func save(_ session: Session) {
        secrets.write(Keys.token, session.token)
        defaults.set(session.host.absoluteString, forKey: Keys.host)
        defaults.set(session.email, forKey: Keys.email)
    }

    /// Sign out: forget the token. Host and email stay to prefill the sign-in form.
    public func clear() {
        secrets.delete(Keys.token)
        defaults.removeObject(forKey: Keys.lastProject)
    }

    public var lastHost: String? { defaults.string(forKey: Keys.host) }
    public var lastEmail: String? { defaults.string(forKey: Keys.email) }

    public var lastProjectId: String? {
        get { defaults.string(forKey: Keys.lastProject) }
        set { defaults.set(newValue, forKey: Keys.lastProject) }
    }

    private enum Keys {
        static let host = "host"
        static let email = "email"
        static let token = "session.token"
        static let lastProject = "lastProject"
    }
}

public final class MemorySecrets: SecretStorage, @unchecked Sendable {
    private var values: [String: String] = [:]
    private let lock = NSLock()
    public init() {}
    public func read(_ key: String) -> String? { lock.withLock { values[key] } }
    public func write(_ key: String, _ value: String) { lock.withLock { values[key] = value } }
    public func delete(_ key: String) { _ = lock.withLock { values.removeValue(forKey: key) } }
}

/// The App Group the app and its Share Extension share: session defaults, the
/// Keychain item and the disk cache, so sharing works without signing in twice.
public enum AppGroup {
    public static let id = "group.io.nesin.feedbackbee"

    /// The group's defaults; the app's own when the group isn't available (tests, Linux).
    public static var defaults: UserDefaults { UserDefaults(suiteName: id) ?? .standard }

    /// `Library/Caches/feedbackbee` in the group container, else in the app container.
    public static func cacheDirectory() -> URL {
        #if os(iOS) || os(macOS)
        if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) {
            return group.appendingPathComponent("Library/Caches/feedbackbee", isDirectory: true)
        }
        #endif
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("feedbackbee", isDirectory: true)
    }
}

#if canImport(Security)
/// Generic-password Keychain items for this app, this device only. With an
/// access group (the App Group) the Share Extension reads the same item; if
/// the build lacks that entitlement, it falls back to the app's own group.
public struct KeychainSecrets: SecretStorage {
    private let service: String
    private let accessGroup: String?

    public init(service: String = "io.nesin.feedbackbee", accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    public func read(_ key: String) -> String? {
        for group in groups {
            var query = base(key, group)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var out: AnyObject?
            if SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data {
                return String(data: data, encoding: .utf8)
            }
        }
        return nil
    }

    public func write(_ key: String, _ value: String) {
        delete(key)
        for group in groups {
            var item = base(key, group)
            item[kSecValueData as String] = Data(value.utf8)
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            if SecItemAdd(item as CFDictionary, nil) != errSecMissingEntitlement { return }
        }
    }

    public func delete(_ key: String) {
        for group in groups { SecItemDelete(base(key, group) as CFDictionary) }
    }

    /// The shared group first, then the app's default group.
    private var groups: [String?] { accessGroup == nil ? [nil] : [accessGroup, nil] }

    private func base(_ key: String, _ group: String?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        if let group { query[kSecAttrAccessGroup as String] = group }
        return query
    }
}
#endif
