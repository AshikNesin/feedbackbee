import Foundation

/// The server's base URL from what the owner typed: `bee.example.com`,
/// `https://bee.example.com/app/projects/x` and `https://bee.example.com/`
/// all become `https://bee.example.com`. Nil when it isn't a web address.
public func normalizeHost(_ input: String) -> URL? {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !trimmed.contains(where: \.isWhitespace) else { return nil }
    let withScheme = trimmed.range(of: "^[a-zA-Z][a-zA-Z0-9+.-]*://", options: .regularExpression) != nil
        ? trimmed : "https://\(trimmed)"
    guard let parts = URLComponents(string: withScheme),
          let scheme = parts.scheme?.lowercased(), scheme == "https" || scheme == "http",
          let host = parts.host?.lowercased(), !host.isEmpty
    else { return nil }
    var out = URLComponents()
    out.scheme = scheme
    out.host = host
    out.port = parts.port
    return out.url
}

/// Project id from a name, like the web's New project dialog: a-z, 0-9, inner hyphens, 3-40 chars.
public func slugify(_ name: String) -> String {
    var slug = name.lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
    slug = slug.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    slug = String(slug.prefix(40))
    while slug.hasSuffix("-") { slug.removeLast() }
    return slug
}

public func isValidSlug(_ slug: String) -> Bool {
    slug.range(of: "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$", options: .regularExpression) != nil
}

/// "now", "5m", "3h", "2d", then "Mar 4" (this year) or "Mar 4, 2025".
public func relativeTime(_ date: Date, now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) -> String {
    let seconds = Int(now.timeIntervalSince(date))
    switch seconds {
    case ..<60: return "now"
    case ..<3600: return "\(seconds / 60)m"
    case ..<86_400: return "\(seconds / 3600)h"
    case ..<(7 * 86_400): return "\(seconds / 86_400)d"
    default:
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = calendar.timeZone
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        formatter.setLocalizedDateFormatFromTemplate(sameYear ? "MMMd" : "MMMdyyyy")
        return formatter.string(from: date)
    }
}

/// `m:ss` for a recording or voice-note length.
public func clock(_ seconds: Double?) -> String {
    let s = max(0, Int((seconds ?? 0).rounded()))
    return "\(s / 60):" + String(format: "%02d", s % 60)
}

/// `host/path` of a page URL, for one-line display.
public func pagePath(_ url: String?) -> String? {
    guard let url else { return nil }
    guard let parts = URLComponents(string: url), let host = parts.host else { return url }
    return host + (parts.path == "/" ? "" : parts.path)
}
