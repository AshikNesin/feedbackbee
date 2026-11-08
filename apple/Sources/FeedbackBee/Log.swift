import Foundation
#if canImport(os)
import os
#endif

enum Log {
    #if canImport(os)
    private static let logger = Logger(subsystem: "io.nesin.feedbackbee", category: "FeedbackBee")
    static func warn(_ message: String) { logger.warning("\(message, privacy: .public)") }
    static func info(_ message: String) { logger.info("\(message, privacy: .public)") }
    #else
    static func warn(_ message: String) { print("FeedbackBee: \(message)") }
    static func info(_ message: String) { print("FeedbackBee: \(message)") }
    #endif
}
