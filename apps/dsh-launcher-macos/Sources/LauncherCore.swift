// SPDX-License-Identifier: Apache-2.0

import Darwin
import Foundation

struct DSHServerCommand {
    let executableURL: URL
    let arguments: [String]

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

enum WindowChromeInteraction {
    static func shouldZoom(
        clickCount: Int,
        locationY: Double,
        contentLayoutMaxY: Double
    ) -> Bool {
        clickCount == 2 && locationY >= contentLayoutMaxY
    }
}

enum SourceDSHResolver {
    private static let pinnedVersion = "0.1.2-alpha.5"

    static func find(in sourceDirectory: URL, expectedVersion: String = pinnedVersion, fileManager: FileManager = .default) -> URL? {
        let packageJSON = sourceDirectory.appendingPathComponent("package.json")
        let executable = sourceDirectory.appendingPathComponent("apps/cli/lib/bin.js")
        guard
            fileManager.isExecutableFile(atPath: executable.path),
            let data = try? Data(contentsOf: packageJSON),
            let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            manifest["version"] as? String == expectedVersion
        else {
            return nil
        }
        return executable
    }
}

enum DSHReadyURL {
    static func find(in output: String, port: UInt16) -> URL? {
        for line in output.split(whereSeparator: \Character.isNewline).reversed() {
            let prefix = "dsh web: "
            guard line.hasPrefix(prefix) else { continue }
            let candidate = line.dropFirst(prefix.count).split(whereSeparator: \Character.isWhitespace).first
            guard
                let candidate,
                let url = URL(string: String(candidate)),
                url.scheme == "http",
                url.host == "127.0.0.1",
                url.port == Int(port),
                let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                let queryItems = components.queryItems,
                queryItems.count == 1,
                queryItems[0].name == "token",
                let token = queryItems[0].value,
                !token.isEmpty
            else {
                continue
            }
            return url
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

    static func reclaim(_ port: UInt16, terminationGracePeriod: TimeInterval = 1) -> Bool {
        if isAvailable(port) { return true }

        let initialListeners = listenerProcessIdentifiers(port)
        guard !initialListeners.isEmpty else { return false }
        for pid in initialListeners where pid != getpid() {
            _ = kill(pid, SIGTERM)
        }
        if waitUntilAvailable(port, timeout: max(0, terminationGracePeriod)) {
            return true
        }

        let remainingListeners = listenerProcessIdentifiers(port)
        for pid in remainingListeners where pid != getpid() {
            _ = kill(pid, SIGKILL)
        }
        return waitUntilAvailable(port, timeout: 2)
    }

    private static func listenerProcessIdentifiers(_ port: UInt16) -> [pid_t] {
        let lsofURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        guard FileManager.default.isExecutableFile(atPath: lsofURL.path) else { return [] }

        let process = Process()
        let output = Pipe()
        process.executableURL = lsofURL
        process.arguments = ["-nP", "-t", "-iTCP:\(port)", "-sTCP:LISTEN"]
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return []
        }
        guard process.terminationStatus == 0 else { return [] }

        let data = output.fileHandleForReading.readDataToEndOfFile()
        guard let text = String(data: data, encoding: .utf8) else { return [] }
        return Array(Set(text
            .split(whereSeparator: \Character.isWhitespace)
            .compactMap { pid_t($0) }
            .filter { $0 > 1 }))
            .sorted()
    }

    private static func waitUntilAvailable(_ port: UInt16, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if isAvailable(port) { return true }
            Thread.sleep(forTimeInterval: 0.03)
        } while Date() < deadline
        return isAvailable(port)
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
