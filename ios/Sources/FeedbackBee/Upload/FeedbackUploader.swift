#if canImport(Darwin)
import Foundation

/// Posts one report. The body is staged in a temporary file and streamed from disk by URLSession.
enum FeedbackUploader {
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 60
        configuration.waitsForConnectivity = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        return URLSession(configuration: configuration)
    }()

    static func upload(config: FeedbackConfig, request: UploadRequest) async -> UploadOutcome {
        if let problem = UploadRequestBuilder.preflight(request) { return .rejected(message: problem) }
        let bodyURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("feedbackbee-upload-\(UUID().uuidString).multipart")
        defer { try? FileManager.default.removeItem(at: bodyURL) }
        do {
            // Built off the main actor: copying a voice note into the body is file I/O.
            let body = UploadRequestBuilder.body(for: request)
            try await Task.detached(priority: .userInitiated) { try body.write(to: bodyURL) }.value

            var urlRequest = URLRequest(url: config.feedbackURL, timeoutInterval: 60)
            urlRequest.httpMethod = "POST"
            urlRequest.setValue(body.contentType, forHTTPHeaderField: "Content-Type")
            urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, response) = try await session.upload(for: urlRequest, fromFile: bodyURL, delegate: NoRedirects.shared)
            guard let http = response as? HTTPURLResponse else {
                return .rejected(message: "The server sent an unexpected response.")
            }
            return parseUploadResponse(status: http.statusCode, body: data.prefix(64 * 1024))
        } catch {
            return .rejected(message: "Couldn't reach the server (\(error.localizedDescription)). Check your connection.")
        }
    }
}

/// A redirect would drop the POST body; surface it as an error like the Android SDK does.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    static let shared = NoRedirects()

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}
#endif
