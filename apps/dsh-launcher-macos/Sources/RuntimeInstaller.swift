// SPDX-License-Identifier: Apache-2.0

import Foundation

struct InstallerCommand {
    let executable: URL
    let arguments: [String]
    let workingDirectory: URL?
}

struct RuntimeInstallPlan {
    let destination: URL
    let temporaryDestination: URL
    let steps: [InstallerCommand]
}

enum RuntimeInstallError: LocalizedError {
    case commandFailed(String)
    case commitMismatch(expected: String, actual: String)
    case invalidRuntime(String)

    var errorDescription: String? {
        switch self {
        case let .commandFailed(message): return message
        case let .commitMismatch(expected, actual): return "Commit mismatch: expected \(expected), got \(actual)"
        case let .invalidRuntime(message): return message
        }
    }
}

final class RuntimeInstaller {
    static func commandPlan(for tag: DSHTag, rootDirectory: URL) -> RuntimeInstallPlan {
        let destination = rootDirectory.appendingPathComponent(tag.version.description, isDirectory: true)
        let temporary = rootDirectory.appendingPathComponent(".install-\(tag.version)-\(UUID().uuidString)", isDirectory: true)
        return RuntimeInstallPlan(destination: destination, temporaryDestination: temporary, steps: [
            InstallerCommand(executable: URL(fileURLWithPath: "/usr/bin/git"), arguments: ["clone", "--depth", "1", "--branch", tag.name, "https://github.com/deepseek-ai/deepseek-harness.git", temporary.path], workingDirectory: nil),
            InstallerCommand(executable: URL(fileURLWithPath: "/usr/bin/env"), arguments: ["corepack", "pnpm@11.7.0", "install", "--frozen-lockfile"], workingDirectory: temporary),
            InstallerCommand(executable: URL(fileURLWithPath: "/usr/bin/env"), arguments: ["corepack", "pnpm@11.7.0", "run", "build"], workingDirectory: temporary),
            InstallerCommand(executable: URL(fileURLWithPath: "/bin/chmod"), arguments: ["+x", temporary.appendingPathComponent("apps/cli/lib/bin.js").path], workingDirectory: nil),
        ])
    }

    func install(tag: DSHTag, rootDirectory: URL, logURL: URL, progress: @escaping (String) -> Void, completion: @escaping (Result<URL, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let plan = Self.commandPlan(for: tag, rootDirectory: rootDirectory)
            do {
                try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
                if FileManager.default.fileExists(atPath: plan.destination.path) {
                    try Self.validate(runtime: plan.destination, tag: tag)
                    DispatchQueue.main.async { completion(.success(plan.destination)) }
                    return
                }
                try? FileManager.default.removeItem(at: plan.temporaryDestination)
                defer { try? FileManager.default.removeItem(at: plan.temporaryDestination) }
                for (index, command) in plan.steps.enumerated() {
                    DispatchQueue.main.async { progress("Step \(index + 1)/\(plan.steps.count)") }
                    try Self.run(command, logURL: logURL)
                }
                try Self.validate(runtime: plan.temporaryDestination, tag: tag)
                try FileManager.default.moveItem(at: plan.temporaryDestination, to: plan.destination)
                DispatchQueue.main.async { completion(.success(plan.destination)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(error)) }
            }
        }
    }

    private static func run(_ command: InstallerCommand, logURL: URL) throws {
        try FileManager.default.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
        let handle = try FileHandle(forWritingTo: logURL)
        defer { try? handle.close() }
        try handle.seekToEnd()
        let process = Process()
        process.executableURL = command.executable
        process.arguments = command.arguments
        process.currentDirectoryURL = command.workingDirectory
        process.standardOutput = handle
        process.standardError = handle
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw RuntimeInstallError.commandFailed("Update command failed (\(process.terminationStatus)). See \(logURL.path)")
        }
    }

    private static func validate(runtime: URL, tag: DSHTag) throws {
        let executable = runtime.appendingPathComponent("apps/cli/lib/bin.js")
        guard FileManager.default.isExecutableFile(atPath: executable.path) else {
            throw RuntimeInstallError.invalidRuntime("Built DSH executable is missing")
        }
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = ["-C", runtime.path, "rev-parse", "HEAD"]
        process.standardOutput = pipe
        try process.run()
        process.waitUntilExit()
        let actual = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard actual == tag.commitSHA else { throw RuntimeInstallError.commitMismatch(expected: tag.commitSHA, actual: actual) }
    }
}
