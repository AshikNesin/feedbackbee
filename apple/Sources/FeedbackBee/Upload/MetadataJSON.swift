import Foundation

/// Encodes `setContext` metadata with the rules the server enforces: keys `[A-Za-z0-9_.-]{1,40}`,
/// at most 20 keys, values a string ≤500 chars, a finite number or a boolean, 4 KB in total.
/// Anything else is dropped with a log, so a host-side bug can never block a user's report.
enum MetadataJSON {
    static let maxKeys = 20
    static let maxStringLength = 500

    static func encode(_ entries: [(String, ContextValue)]) -> String? {
        var fields: [String] = []
        for (key, value) in entries where fields.count < maxKeys {
            guard isValidKey(key), let json = encodeValue(value) else {
                Log.warn("setContext: dropped metadata key \"\(key)\" (key or value outside the contract limits)")
                continue
            }
            fields.append("\(quote(key)):\(json)")
        }
        // The server rejects the whole report over 4 KB; drop the newest keys instead.
        while !fields.isEmpty, ("{" + fields.joined(separator: ",") + "}").utf8.count > FeedbackLimits.maxMetadataBytes {
            fields.removeLast()
            Log.warn("setContext: dropped metadata keys over the 4 KB limit")
        }
        return fields.isEmpty ? nil : "{" + fields.joined(separator: ",") + "}"
    }

    static func isValidKey(_ key: String) -> Bool {
        guard (1...40).contains(key.count) else { return false }
        return key.unicodeScalars.allSatisfy { scalar in
            switch scalar {
            case "A"..."Z", "a"..."z", "0"..."9", "_", ".", "-": return true
            default: return false
            }
        }
    }

    private static func encodeValue(_ value: ContextValue) -> String? {
        switch value {
        case .string(let text):
            // The server counts UTF-16 code units (JavaScript string length).
            return text.utf16.count <= maxStringLength ? quote(text) : nil
        case .int(let number):
            return String(number)
        case .double(let number):
            guard number.isFinite else { return nil }
            if number == number.rounded(), abs(number) < 1e15 { return String(Int64(number)) }
            return String(number)
        case .bool(let flag):
            return flag ? "true" : "false"
        }
    }

    static func quote(_ text: String) -> String {
        var out = "\""
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case _ where scalar.value < 0x20:
                out += String(format: "\\u%04x", scalar.value)
            default:
                out.unicodeScalars.append(scalar)
            }
        }
        return out + "\""
    }
}
