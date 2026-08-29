// SPDX-License-Identifier: Apache-2.0

import Darwin
import Foundation

private struct TestFailure: Error, CustomStringConvertible {
    let description: String
}

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw TestFailure(description: message)
    }
}

private func waitUntil(timeout: TimeInterval, _ predicate: () -> Bool) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if predicate() { return true }
        Thread.sleep(forTimeInterval: 0.03)
    }
    return predicate()
}

private func processExists(_ pid: pid_t) -> Bool {
    guard pid > 0 else { return false }
    return kill(pid, 0) == 0 || errno == EPERM
}

private func unusedLoopbackPort() throws -> UInt16 {
    let descriptor = socket(AF_INET, SOCK_STREAM, 0)
    guard descriptor >= 0 else {
        throw TestFailure(description: "could not create test socket")
    }
    defer { close(descriptor) }

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = 0
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

    let bindResult = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    guard bindResult == 0 else {
        throw TestFailure(description: "could not bind test socket")
    }

    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    let nameResult = withUnsafeMutablePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            getsockname(descriptor, $0, &length)
        }
    }
    guard nameResult == 0 else {
        throw TestFailure(description: "could not read test socket port")
    }
    return UInt16(bigEndian: address.sin_port)
}

private func testSourceDSHResolverSelectsOnlyPinnedExecutable() throws {
    let temporaryDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("dsh-cache-tests-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

    func createSourceDSH(version: String) throws -> URL {
        let packageDirectory = temporaryDirectory
        let binDirectory = temporaryDirectory.appendingPathComponent("apps/cli/lib", isDirectory: true)
        try FileManager.default.createDirectory(at: packageDirectory, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        try Data("{\"version\":\"\(version)\"}".utf8)
            .write(to: packageDirectory.appendingPathComponent("package.json"))
        let executable = binDirectory.appendingPathComponent("bin.js")
        try Data("#!/bin/sh\nexit 0\n".utf8).write(to: executable)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)
        return executable
    }

    let pinnedExecutable = try createSourceDSH(version: "0.1.2-alpha.1")

    let resolved = SourceDSHResolver.find(in: temporaryDirectory)
    try expect(resolved?.standardizedFileURL == pinnedExecutable.standardizedFileURL, "must resolve only the pinned alpha.1 source runtime")

    let command = DSHServerCommand.makeDirect(port: 43123, dshURL: pinnedExecutable)
    try expect(command.executableURL == pinnedExecutable, "direct launch must invoke the cached DSH executable")
    try expect(
        command.arguments == ["web", "--host", "127.0.0.1", "--port", "43123", "--no-open"],
        "direct launch must use the built source executable and suppress external browser launch"
    )
}

private func testReadyURLRequiresCurrentLoopbackToken() throws {
    let output = """
    dsh web: http://127.0.0.1:3079/?token=old
    dsh web: http://localhost:3080/?token=wrong-host
    dsh web: http://127.0.0.1:3080/
    dsh web: http://127.0.0.1:3080/?token=alpha-ready-token
    """
    try expect(
        DSHReadyURL.find(in: output, port: 3080)?.absoluteString
            == "http://127.0.0.1:3080/?token=alpha-ready-token",
        "launcher must load only the authenticated URL printed for its exact loopback port"
    )
    try expect(
        DSHReadyURL.find(in: "dsh web: http://127.0.0.1:3080/", port: 3080) == nil,
        "an unauthenticated alpha URL must never be treated as ready"
    )
}

private func testTitlebarDoubleClickRequestsWindowZoomOnlyInChrome() throws {
    try expect(
        WindowChromeInteraction.shouldZoom(
            clickCount: 2,
            locationY: 800,
            contentLayoutMaxY: 788
        ),
        "a titlebar double-click must request native window zoom"
    )
    try expect(
        !WindowChromeInteraction.shouldZoom(
            clickCount: 1,
            locationY: 800,
            contentLayoutMaxY: 788
        ),
        "a single titlebar click must remain available to the web view"
    )
    try expect(
        !WindowChromeInteraction.shouldZoom(
            clickCount: 2,
            locationY: 500,
            contentLayoutMaxY: 788
        ),
        "a canvas double-click must remain available to fit the drawing"
    )
}

private func testPortProbeRejectsAnOccupiedLoopbackPort() throws {
    let descriptor = socket(AF_INET, SOCK_STREAM, 0)
    guard descriptor >= 0 else {
        throw TestFailure(description: "could not create occupied-port socket")
    }
    defer { close(descriptor) }

    var reuse: Int32 = 1
    setsockopt(descriptor, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = 0
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
    let bindResult = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    guard bindResult == 0, listen(descriptor, 1) == 0 else {
        throw TestFailure(description: "could not occupy loopback port")
    }

    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    let nameResult = withUnsafeMutablePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            getsockname(descriptor, $0, &length)
        }
    }
    guard nameResult == 0 else {
        throw TestFailure(description: "could not inspect occupied port")
    }
    let port = UInt16(bigEndian: address.sin_port)

    try expect(!LocalPort.isAvailable(port), "must not take over an already occupied port")
}

private func testPortProbeAllowsImmediateRestartAfterServerCloses() throws {
    let listener = socket(AF_INET, SOCK_STREAM, 0)
    guard listener >= 0 else {
        throw TestFailure(description: "could not create restart-test listener")
    }
    var reuse: Int32 = 1
    setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = 0
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
    let bindResult = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(listener, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    guard bindResult == 0, listen(listener, 1) == 0 else {
        close(listener)
        throw TestFailure(description: "could not start restart-test listener")
    }

    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    _ = withUnsafeMutablePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            getsockname(listener, $0, &length)
        }
    }
    let port = UInt16(bigEndian: address.sin_port)

    let client = socket(AF_INET, SOCK_STREAM, 0)
    guard client >= 0 else {
        close(listener)
        throw TestFailure(description: "could not create restart-test client")
    }
    let connectResult = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            connect(client, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    guard connectResult == 0 else {
        close(client)
        close(listener)
        throw TestFailure(description: "could not connect restart-test client")
    }
    let accepted = accept(listener, nil, nil)
    guard accepted >= 0 else {
        close(client)
        close(listener)
        throw TestFailure(description: "could not accept restart-test client")
    }

    close(accepted)
    close(client)
    close(listener)

    try expect(LocalPort.isAvailable(port), "a recently closed DSH listener must be restartable immediately")
}

private func testOccupiedPortReclaimStopsOnlyItsListenerAndMakesThePortReusable() throws {
    let port = try unusedLoopbackPort()
    let listener = Process()
    listener.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
    listener.arguments = [
        "-c",
        "import signal,socket,sys,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); s=socket.socket(); s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); s.bind(('127.0.0.1',int(sys.argv[1]))); s.listen(); time.sleep(30)",
        String(port),
    ]
    try listener.run()
    let listenerPID = pid_t(listener.processIdentifier)
    defer {
        _ = kill(listenerPID, SIGKILL)
        listener.waitUntilExit()
    }

    let outsider = Process()
    outsider.executableURL = URL(fileURLWithPath: "/bin/sleep")
    outsider.arguments = ["30"]
    try outsider.run()
    defer {
        if outsider.isRunning { outsider.terminate() }
    }

    try expect(
        waitUntil(timeout: 2) { !LocalPort.isAvailable(port) },
        "the child must own the test port before reclaim"
    )
    try expect(
        LocalPort.reclaim(port, terminationGracePeriod: 0.1),
        "reclaim must force-stop a listener that ignores graceful termination"
    )
    try expect(LocalPort.isAvailable(port), "reclaim must make the occupied port reusable")
    try expect(outsider.isRunning, "reclaim must leave processes that do not listen on the target port alive")
}

private func testManagedProcessStopsItsWholeGroupAndLeavesOutsidersAlive() throws {
    let temporaryDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("dsh-launcher-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

    let childPIDFile = temporaryDirectory.appendingPathComponent("child.pid")
    let logFile = temporaryDirectory.appendingPathComponent("server.log")
    let outsider = Process()
    outsider.executableURL = URL(fileURLWithPath: "/bin/sleep")
    outsider.arguments = ["30"]
    try outsider.run()
    defer {
        if outsider.isRunning { outsider.terminate() }
    }

    let managed = ManagedProcess(
        executableURL: URL(fileURLWithPath: "/bin/sh"),
        arguments: ["-c", "sleep 30 & echo $! > '\(childPIDFile.path)'; wait"],
        logURL: logFile
    )
    try managed.start()

    let childPIDWasWritten = waitUntil(timeout: 2) {
        FileManager.default.fileExists(atPath: childPIDFile.path)
    }
    try expect(childPIDWasWritten, "managed child must start")
    let childPIDText = try String(contentsOf: childPIDFile, encoding: .utf8)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard let childPID = pid_t(childPIDText) else {
        throw TestFailure(description: "managed child PID must be readable")
    }
    let parentPID = managed.processIdentifier
    try expect(processExists(parentPID), "managed parent must be running before stop")
    try expect(processExists(childPID), "managed child must be running before stop")

    try expect(managed.stop(gracePeriod: 1), "managed process group must stop within grace period")
    try expect(waitUntil(timeout: 2) { !processExists(parentPID) }, "managed parent must exit")
    try expect(waitUntil(timeout: 2) { !processExists(childPID) }, "managed child must exit")
    try expect(outsider.isRunning, "stopping DSH must not terminate unrelated processes")
}

private func testManagedProcessPassesEnvironmentOverridesToChild() throws {
    let temporaryDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("dsh-launcher-env-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

    let logFile = temporaryDirectory.appendingPathComponent("environment.log")
    let managed = ManagedProcess(
        executableURL: URL(fileURLWithPath: "/usr/bin/env"),
        arguments: [],
        logURL: logFile,
        environmentOverrides: ["DSH_LAUNCHER_ENV_TEST": "homebrew-path-is-present"]
    )
    try managed.start()
    try expect(waitUntil(timeout: 2) { !managed.isRunning }, "environment probe must exit")

    let output = try String(contentsOf: logFile, encoding: .utf8)
    try expect(
        output.contains("DSH_LAUNCHER_ENV_TEST=homebrew-path-is-present"),
        "environment overrides must reach the spawned DSH process"
    )
}

@main
private struct LauncherCoreTestRunner {
    static func main() {
        let tests: [(String, () throws -> Void)] = [
            ("source DSH resolver selects only pinned executable", testSourceDSHResolverSelectsOnlyPinnedExecutable),
            ("alpha ready URL requires current loopback token", testReadyURLRequiresCurrentLoopbackToken),
            ("titlebar double-click zooms only in native chrome", testTitlebarDoubleClickRequestsWindowZoomOnlyInChrome),
            ("port probe rejects occupied loopback port", testPortProbeRejectsAnOccupiedLoopbackPort),
            ("port probe allows immediate restart after close", testPortProbeAllowsImmediateRestartAfterServerCloses),
            ("occupied port reclaim stops only its listener", testOccupiedPortReclaimStopsOnlyItsListenerAndMakesThePortReusable),
            ("managed process stops its group and leaves outsiders alive", testManagedProcessStopsItsWholeGroupAndLeavesOutsidersAlive),
            ("managed process passes environment overrides", testManagedProcessPassesEnvironmentOverridesToChild),
        ]

        var failures = 0
        for (name, test) in tests {
            do {
                try test()
                print("PASS: \(name)")
            } catch {
                failures += 1
                fputs("FAIL: \(name): \(error)\n", stderr)
            }
        }

        if failures > 0 {
            exit(1)
        }
    }
}
