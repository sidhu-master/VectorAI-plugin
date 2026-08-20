// SPDX-License-Identifier: Apache-2.0

import Darwin
import Foundation

struct DSHServerCommand {
    let executableURL: URL
    let arguments: [String]

    static func make(port: UInt16, npxURL: URL) -> DSHServerCommand {
        DSHServerCommand(
            executableURL: npxURL,
            arguments: [
                "--yes",
                "--package=@deepseek-ai/dsh@0.1.0-rc.8",
                "dsh",
                "web",
                "--host",
                "127.0.0.1",
                "--port",
                String(port),
                "--no-open",
            ]
        )
    }

    static func makeDirect(port: UInt16, dshURL: URL) -> DSHServerCommand {
        DSHServerCommand(
            executableURL: dshURL,
            arguments: [
                "web",
                "--host",
                "127.0.0.1",
                "--port",
                String(port),
                "--no-open",
            ]
        )
    }
}

struct WorkspacePatchCommand {
    let executableURL: URL
    let arguments: [String]

    static func make(nodeURL: URL, scriptURL: URL, dshURL: URL) -> WorkspacePatchCommand {
        WorkspacePatchCommand(
            executableURL: nodeURL,
            arguments: [scriptURL.path, "--dsh-bin", dshURL.path]
        )
    }
}

enum CachedDSHResolver {
    private static let pinnedVersion = "0.1.0-rc.8"

    static func find(in npxCacheDirectory: URL, fileManager: FileManager = .default) -> URL? {
        guard let cacheDirectories = try? fileManager.contentsOfDirectory(
            at: npxCacheDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else {
            return nil
        }

        for cacheDirectory in cacheDirectories.sorted(by: { $0.path < $1.path }) {
            let packageJSON = cacheDirectory
                .appendingPathComponent("node_modules/@deepseek-ai/dsh/package.json")
            let executable = cacheDirectory.appendingPathComponent("node_modules/.bin/dsh")
            guard
                fileManager.isExecutableFile(atPath: executable.path),
                let data = try? Data(contentsOf: packageJSON),
                let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                manifest["version"] as? String == pinnedVersion
            else {
                continue
            }
            return executable
        }
        return nil
    }
}

enum LocalPort {
    static func isAvailable(_ port: UInt16) -> Bool {
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = port.bigEndian
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

        let connectionProbe = socket(AF_INET, SOCK_STREAM, 0)
        guard connectionProbe >= 0 else { return false }
        let connectionResult = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(connectionProbe, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        close(connectionProbe)
        if connectionResult == 0 { return false }

        let bindProbe = socket(AF_INET, SOCK_STREAM, 0)
        guard bindProbe >= 0 else { return false }
        defer { close(bindProbe) }
        var reuse: Int32 = 1
        setsockopt(bindProbe, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

        return withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(bindProbe, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
            }
        }
    }
}

enum ManagedProcessError: LocalizedError {
    case alreadyRunning
    case couldNotOpenLog(String)
    case couldNotStart(String)

    var errorDescription: String? {
        switch self {
        case .alreadyRunning:
            return "The process is already running."
        case let .couldNotOpenLog(path):
            return "Could not open the log file at \(path)."
        case let .couldNotStart(message):
            return "Could not start the process: \(message)"
        }
    }
}

final class ManagedProcess {
    private let executableURL: URL
    private let arguments: [String]
    private let logURL: URL
    private let environmentOverrides: [String: String]
    private var activePID: pid_t = 0
    private var launchedPID: pid_t = 0

    init(
        executableURL: URL,
        arguments: [String],
        logURL: URL,
        environmentOverrides: [String: String] = [:]
    ) {
        self.executableURL = executableURL
        self.arguments = arguments
        self.logURL = logURL
        self.environmentOverrides = environmentOverrides
    }

    var processIdentifier: pid_t { launchedPID }

    var isRunning: Bool {
        reapIfExited()
        guard activePID > 0 else { return false }
        return kill(activePID, 0) == 0 || errno == EPERM
    }

    func start() throws {
        guard activePID == 0 else { throw ManagedProcessError.alreadyRunning }

        try FileManager.default.createDirectory(
            at: logURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let logDescriptor = open(logURL.path, O_WRONLY | O_CREAT | O_APPEND, S_IRUSR | S_IWUSR)
        guard logDescriptor >= 0 else {
            throw ManagedProcessError.couldNotOpenLog(logURL.path)
        }
        defer { close(logDescriptor) }

        var fileActions: posix_spawn_file_actions_t? = nil
        posix_spawn_file_actions_init(&fileActions)
        defer { posix_spawn_file_actions_destroy(&fileActions) }
        posix_spawn_file_actions_adddup2(&fileActions, logDescriptor, STDOUT_FILENO)
        posix_spawn_file_actions_adddup2(&fileActions, logDescriptor, STDERR_FILENO)
        posix_spawn_file_actions_addclose(&fileActions, logDescriptor)

        var attributes: posix_spawnattr_t? = nil
        posix_spawnattr_init(&attributes)
        defer { posix_spawnattr_destroy(&attributes) }
        posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_SETPGROUP))
        posix_spawnattr_setpgroup(&attributes, 0)

        let argumentStrings = [executableURL.path] + arguments
        let environment = ProcessInfo.processInfo.environment.merging(environmentOverrides) { _, override in override }
        let environmentStrings = environment.map { "\($0.key)=\($0.value)" }
        let argumentPointers = argumentStrings.map { strdup($0) } + [nil]
        let environmentPointers = environmentStrings.map { strdup($0) } + [nil]
        defer {
            argumentPointers.compactMap { $0 }.forEach { free($0) }
            environmentPointers.compactMap { $0 }.forEach { free($0) }
        }

        var pid: pid_t = 0
        let result = posix_spawn(
            &pid,
            executableURL.path,
            &fileActions,
            &attributes,
            argumentPointers,
            environmentPointers
        )
        guard result == 0 else {
            throw ManagedProcessError.couldNotStart(String(cString: strerror(result)))
        }

        activePID = pid
        launchedPID = pid
    }

    @discardableResult
    func stop(gracePeriod: TimeInterval) -> Bool {
        reapIfExited()
        guard activePID > 0 else { return true }
        let pid = activePID

        _ = kill(-pid, SIGTERM)
        if waitForExit(pid: pid, timeout: max(0, gracePeriod)) {
            return true
        }

        _ = kill(-pid, SIGKILL)
        return waitForExit(pid: pid, timeout: 2)
    }

    private func reapIfExited() {
        guard activePID > 0 else { return }
        var status: Int32 = 0
        let result = waitpid(activePID, &status, WNOHANG)
        if result == activePID || (result == -1 && errno == ECHILD) {
            activePID = 0
        }
    }

    private func waitForExit(pid: pid_t, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            var status: Int32 = 0
            let result = waitpid(pid, &status, WNOHANG)
            if result == pid || (result == -1 && errno == ECHILD) {
                activePID = 0
                return true
            }
            Thread.sleep(forTimeInterval: 0.03)
        } while Date() < deadline
        return false
    }

    deinit {
        _ = stop(gracePeriod: 0.3)
    }
}
