// SPDX-License-Identifier: Apache-2.0

import Foundation

struct RuntimeState: Codable, Equatable {
    var activeVersion: String
    var previousVersion: String?
    var candidateVersion: String?
    var switchPending: Bool
}

final class RuntimeRegistry {
    let rootDirectory: URL
    private let manifestURL: URL
    private let fileManager: FileManager

    init(rootDirectory: URL, fileManager: FileManager = .default) {
        self.rootDirectory = rootDirectory
        self.manifestURL = rootDirectory.appendingPathComponent("runtime-state.json")
        self.fileManager = fileManager
    }

    func bootstrap(version: String) throws {
        if
            fileManager.fileExists(atPath: manifestURL.path),
            let state = try? load(),
            state.activeVersion == version,
            state.previousVersion == nil,
            state.candidateVersion == nil,
            !state.switchPending
        {
            return
        }
        try save(RuntimeState(activeVersion: version, previousVersion: nil, candidateVersion: nil, switchPending: false))
    }

    func load() throws -> RuntimeState {
        try JSONDecoder().decode(RuntimeState.self, from: Data(contentsOf: manifestURL))
    }

    func activeRuntimeURL() throws -> URL {
        rootDirectory.appendingPathComponent(try load().activeVersion, isDirectory: true)
    }

    func stageCandidate(version: String) throws {
        var state = try load()
        state.candidateVersion = version
        try save(state)
    }

    func beginCandidateSwitch() throws {
        var state = try load()
        guard let candidate = state.candidateVersion else { return }
        state.previousVersion = state.activeVersion
        state.activeVersion = candidate
        state.switchPending = true
        try save(state)
    }

    func confirmCandidate() throws {
        var state = try load()
        state.candidateVersion = nil
        state.switchPending = false
        try save(state)
    }

    func rollbackCandidate() throws {
        var state = try load()
        if let previous = state.previousVersion { state.activeVersion = previous }
        state.candidateVersion = nil
        state.switchPending = false
        try save(state)
    }

    private func save(_ state: RuntimeState) throws {
        try fileManager.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(state)
        try data.write(to: manifestURL, options: .atomic)
    }
}
