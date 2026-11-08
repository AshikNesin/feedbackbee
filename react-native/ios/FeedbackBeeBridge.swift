import Foundation

/// Objective-C facade over the vendored Swift SDK for `FeedbackBeeModule.mm`.
@objc(FeedbackBeeBridge)
public final class FeedbackBeeBridge: NSObject {
    @objc public static func configure(projectId: String, endpoint: String, shake: Bool) -> String? {
        do {
            try FeedbackBee.configure(projectId: projectId, endpoint: endpoint, shake: shake)
            return nil
        } catch let error as FeedbackBeeConfigurationError {
            return error.message
        } catch {
            return error.localizedDescription
        }
    }

    @objc public static func open(kind: String?, lockKind: Bool, text: String) {
        FeedbackBee.open(OpenOptions(kind: kind.flatMap(FeedbackKind.init(rawValue:)), lockKind: lockKind, text: text))
    }

    @objc public static func identify(email: String?, name: String?, reporterId: String?) {
        FeedbackBee.identify(email: email, name: name, id: reporterId)
    }

    @objc public static func setContext(_ context: [String: Any]) {
        var values: [String: ContextValue?] = [:]
        for (key, raw) in context {
            switch raw {
            case is NSNull:
                values[key] = .some(nil)
            case let number as NSNumber where CFGetTypeID(number) == CFBooleanGetTypeID():
                values[key] = .bool(number.boolValue)
            case let number as NSNumber:
                values[key] = .double(number.doubleValue)
            case let text as String:
                values[key] = .string(text)
            default:
                Log.warn("setContext: dropped metadata key \"\(key)\" (values must be strings, numbers or booleans)")
            }
        }
        FeedbackBee.setContext(values)
    }

    @objc public static func reset() {
        FeedbackBee.reset()
    }
}
