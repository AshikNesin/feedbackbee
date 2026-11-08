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

#if canImport(Security)
/// Generic-password Keychain items for this app, this device only.
public struct KeychainSecrets: SecretStorage {
    private let service: String
    public init(service: String = "io.nesin.feedbackbee") { self.service = service }

    public func read(_ key: String) -> String? {
        var query = base(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func write(_ key: String, _ value: String) {
        delete(key)
        var item = base(key)
        item[kSecValueData as String] = Data(value.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    public func delete(_ key: String) { SecItemDelete(base(key) as CFDictionary) }

    private func base(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    }
}
#endif
