import Foundation

enum PartSource {
    case data(Data)
    case file(URL)
}

enum Part {
    case text(name: String, value: String)
    case file(name: String, filename: String, mimeType: String, source: PartSource)

    var name: String {
        switch self {
        case .text(let name, _), .file(let name, _, _, _): return name
        }
    }
}

/// Hand-rolled multipart/form-data, written to a temporary file so URLSession can stream the upload
/// from disk instead of holding a 200 MB recording in memory.
struct MultipartBody {
    let parts: [Part]
    var boundary: String = "FeedbackBee-" + UUID().uuidString.replacingOccurrences(of: "-", with: "")

    var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    func write(to url: URL) throws {
        guard FileManager.default.createFile(atPath: url.path, contents: nil) else {
            throw CocoaError(.fileWriteUnknown)
        }
        let out = try FileHandle(forWritingTo: url)
        defer { try? out.close() }
        for part in parts {
            out.write(header(part))
            switch part {
            case .text(_, let value):
                out.write(Data(value.utf8))
            case .file(_, _, _, .data(let data)):
                out.write(data)
            case .file(_, _, _, .file(let fileURL)):
                let input = try FileHandle(forReadingFrom: fileURL)
                defer { try? input.close() }
                while true {
                    let chunk = input.readData(ofLength: 64 * 1024)
                    if chunk.isEmpty { break }
                    out.write(chunk)
                }
            }
            out.write(Self.crlf)
        }
        out.write(Data("--\(boundary)--\r\n".utf8))
    }

    private func header(_ part: Part) -> Data {
        var text = "--\(boundary)\r\n"
        switch part {
        case .text(let name, _):
            text += "Content-Disposition: form-data; name=\"\(quote(name))\"\r\n"
        case .file(let name, let filename, let mimeType, _):
            text += "Content-Disposition: form-data; name=\"\(quote(name))\"; filename=\"\(quote(filename))\"\r\n"
            text += "Content-Type: \(mimeType)\r\n"
        }
        return Data((text + "\r\n").utf8)
    }

    private func quote(_ value: String) -> String {
        value.replacingOccurrences(of: "\"", with: "%22")
            .replacingOccurrences(of: "\r", with: "%0D")
            .replacingOccurrences(of: "\n", with: "%0A")
    }

    private static let crlf = Data("\r\n".utf8)
}
