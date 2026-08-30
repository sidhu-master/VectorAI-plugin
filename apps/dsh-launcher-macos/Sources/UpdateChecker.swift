// SPDX-License-Identifier: Apache-2.0

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct DSHTag: Equatable {
    let version: DSHVersion
    let name: String
    let commitSHA: String
    let tagURL: URL
    let compareURL: URL
}

enum UpdateCheckResult {
    case current
    case available(DSHTag)
    case unavailable(String)
}

protocol UpdateChecking {
    func check(current: DSHVersion, completion: @escaping (UpdateCheckResult) -> Void)
}

final class GitHubUpdateChecker: UpdateChecking {
    private struct APICommit: Decodable { let sha: String }
    private struct APITag: Decodable { let name: String; let commit: APICommit }
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func check(current: DSHVersion, completion: @escaping (UpdateCheckResult) -> Void) {
        let url = URL(string: "https://api.github.com/repos/deepseek-ai/deepseek-harness/tags?per_page=100")!
        var request = URLRequest(url: url)
        request.setValue("DSH-macOS-launcher", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15
        session.dataTask(with: request) { data, response, error in
            let result: UpdateCheckResult
            if let error {
                result = .unavailable(error.localizedDescription)
            } else if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                result = .unavailable("GitHub HTTP \(http.statusCode)")
            } else if let data {
                do {
                    result = try Self.selectLatest(from: data, current: current).map(UpdateCheckResult.available) ?? .current
                } catch {
                    result = .unavailable(error.localizedDescription)
                }
            } else {
                result = .unavailable("Empty GitHub response")
            }
            DispatchQueue.main.async { completion(result) }
        }.resume()
    }

    static func selectLatest(from data: Data, current: DSHVersion) throws -> DSHTag? {
        let tags = try JSONDecoder().decode([APITag].self, from: data)
        return tags.compactMap { tag -> DSHTag? in
            guard tag.name.hasPrefix("dsh-v"), let version = DSHVersion(tag.name), current.accepts(candidate: version) else { return nil }
            let encoded = tag.name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tag.name
            let currentTag = "dsh-v\(current)"
            return DSHTag(
                version: version,
                name: tag.name,
                commitSHA: tag.commit.sha,
                tagURL: URL(string: "https://github.com/deepseek-ai/deepseek-harness/tree/\(encoded)")!,
                compareURL: URL(string: "https://github.com/deepseek-ai/deepseek-harness/compare/\(currentTag)...\(tag.name)")!
            )
        }.max { $0.version < $1.version }
    }
}
