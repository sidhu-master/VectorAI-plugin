// SPDX-License-Identifier: Apache-2.0

import AppKit
import Foundation
import WebKit

private enum LauncherConstants {
    static let port: UInt16 = 3080
    static let startupTimeout: TimeInterval = 90
    static let bootstrapVersion = "0.1.2-alpha.1"
    static let runtimeRoot = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/VectorAI/dsh-runtime", isDirectory: true)
}

private enum ExecutableResolver {
    static func pathEnvironment(for executableURL: URL) -> String {
        let inherited = ProcessInfo.processInfo.environment["PATH"] ?? ""
        let entries = [
            executableURL.deletingLastPathComponent().path,
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
            inherited,
        ]
        return entries.filter { !$0.isEmpty }.joined(separator: ":")
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: ManagedProcess?
    private var startupTimer: Timer?
    private var startupDeadline = Date.distantPast
    private var startupLogOffset: UInt64 = 0
    private var isShuttingDown = false
    private var titlebarMouseMonitor: Any?
    private var didCheckForUpdates = false
    private var switchingCandidate = false
    private let registry = RuntimeRegistry(rootDirectory: LauncherConstants.runtimeRoot)
    private let updateChecker = GitHubUpdateChecker()
    private let runtimeInstaller = RuntimeInstaller()
    private var updateToolbar: UpdateToolbarController!

    private lazy var logURL: URL = {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DSH", isDirectory: true)
            .appendingPathComponent("dsh.log")
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            try registry.bootstrap(version: LauncherConstants.bootstrapVersion)
            switchingCandidate = try registry.load().switchPending
        } catch {
            NSAlert(error: error).runModal()
        }
        installMainMenu()
        createWindow()
        showStartingPage(message: "正在启动本地 DSH…")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        removeTitlebarMouseMonitor()
        shutdownServer()
    }

    func windowWillClose(_ notification: Notification) {
        shutdownServer()
        NSApp.terminate(nil)
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DeepSeek Harness"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.minSize = NSSize(width: 1100, height: 700)
        window.center()
        window.contentView = webView
        window.delegate = self
        window.isReleasedWhenClosed = false
        let current = (try? registry.load().activeVersion).flatMap(DSHVersion.init) ?? DSHVersion(LauncherConstants.bootstrapVersion)!
        updateToolbar = UpdateToolbarController(currentVersion: current)
        updateToolbar.onCheck = { [weak self] in self?.checkForUpdates() }
        updateToolbar.onInstall = { [weak self] tag in self?.installUpdate(tag) }
        updateToolbar.install(on: window)
        installTitlebarMouseMonitor()
    }

    private func installTitlebarMouseMonitor() {
        titlebarMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) {
            [weak self] event in
            guard
                let self,
                event.window === self.window,
                WindowChromeInteraction.shouldZoom(
                    clickCount: event.clickCount,
                    locationY: Double(event.locationInWindow.y),
                    contentLayoutMaxY: Double(self.window.contentLayoutRect.maxY)
                )
            else {
                return event
            }
            self.window.zoom(nil)
            return nil
        }
    }

    private func removeTitlebarMouseMonitor() {
        guard let titlebarMouseMonitor else { return }
        NSEvent.removeMonitor(titlebarMouseMonitor)
        self.titlebarMouseMonitor = nil
    }

    private func startServer() {
        if !LocalPort.isAvailable(LauncherConstants.port) {
            showStartingPage(message: "正在关闭占用 3080 端口的旧进程…")
        }
        guard LocalPort.reclaim(LauncherConstants.port) else {
            showErrorPage(
                title: "无法释放 3080 端口",
                detail: "启动器未能终止监听 127.0.0.1:3080 的进程。请检查该进程是否属于其他用户，然后重新打开 DSH。"
            )
            return
        }
        guard let state = try? registry.load() else {
            showErrorPage(title: "Runtime state is unavailable", detail: "The local DSH runtime manifest could not be read.")
            return
        }
        let runtimeDirectory = LauncherConstants.runtimeRoot.appendingPathComponent(state.activeVersion, isDirectory: true)
        guard let sourceDSH = SourceDSHResolver.find(in: runtimeDirectory, expectedVersion: state.activeVersion) else {
            showErrorPage(
                title: "DSH runtime is unavailable",
                detail: "Missing built runtime: \(runtimeDirectory.path)"
            )
            return
        }
        let command = DSHServerCommand.makeDirect(port: LauncherConstants.port, dshURL: sourceDSH)
        startupLogOffset = ((try? FileManager.default.attributesOfItem(atPath: logURL.path)[.size]) as? NSNumber)?.uint64Value ?? 0

        let managedServer = ManagedProcess(
            executableURL: command.executableURL,
            arguments: command.arguments,
            logURL: logURL,
            environmentOverrides: ["PATH": ExecutableResolver.pathEnvironment(for: sourceDSH)]
        )
        do {
            try managedServer.start()
            server = managedServer
        } catch {
            showErrorPage(title: "DSH 启动失败", detail: "\(error.localizedDescription)\n\n日志：\(logURL.path)")
            return
        }

        startupDeadline = Date().addingTimeInterval(LauncherConstants.startupTimeout)
        startupTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in
            self?.pollServer()
        }
        pollServer()
    }

    private func pollServer() {
        guard !isShuttingDown else { return }
        guard let server, server.isRunning else {
            stopStartupTimer()
            if rollbackCandidateIfNeeded(reason: "The updated DSH process exited during startup.") { return }
            showErrorPage(
                title: "DSH 进程已退出",
                detail: "请查看启动日志：\(logURL.path)"
            )
            return
        }
        guard Date() < startupDeadline else {
            stopStartupTimer()
            if rollbackCandidateIfNeeded(reason: "The updated DSH runtime did not become ready in time.") { return }
            showErrorPage(
                title: "DSH 启动超时",
                detail: "90 秒内未能连接本地服务。关闭窗口会停止后台进程。\n\n日志：\(logURL.path)"
            )
            return
        }
        guard
            let data = try? Data(contentsOf: logURL),
            UInt64(data.count) >= startupLogOffset,
            let output = String(data: data.dropFirst(Int(startupLogOffset)), encoding: .utf8),
            let readyURL = DSHReadyURL.find(in: output, port: LauncherConstants.port)
        else {
            return
        }
        stopStartupTimer()
        webView.load(URLRequest(url: readyURL))
    }

    private func stopStartupTimer() {
        startupTimer?.invalidate()
        startupTimer = nil
    }

    private func shutdownServer() {
        guard !isShuttingDown else { return }
        isShuttingDown = true
        stopStartupTimer()
        webView?.stopLoading()
        _ = server?.stop(gracePeriod: 1.5)
        server = nil
    }

    private func stopServerForRestart() {
        stopStartupTimer()
        webView?.stopLoading()
        _ = server?.stop(gracePeriod: 1.5)
        server = nil
    }

    private func checkForUpdates() {
        guard let state = try? registry.load(), let current = DSHVersion(state.activeVersion) else { return }
        updateToolbar.setChecking()
        updateChecker.check(current: current) { [weak self] result in self?.updateToolbar.apply(result) }
    }

    private func installUpdate(_ tag: DSHTag) {
        let updateLog = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DSH/update.log")
        updateToolbar.setInstalling("Preparing DSH \(tag.version)…")
        runtimeInstaller.install(
            tag: tag,
            rootDirectory: LauncherConstants.runtimeRoot,
            logURL: updateLog,
            progress: { [weak self] text in self?.updateToolbar.setInstalling(text) }
        ) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success:
                do {
                    try self.registry.stageCandidate(version: tag.version.description)
                    try self.registry.beginCandidateSwitch()
                    self.switchingCandidate = true
                    self.updateToolbar.setInstalling("Starting DSH \(tag.version)…")
                    self.stopServerForRestart()
                    self.startServer()
                } catch {
                    self.updateToolbar.setFailure(error.localizedDescription)
                }
            case let .failure(error):
                self.updateToolbar.setFailure(error.localizedDescription)
            }
        }
    }

    private func rollbackCandidateIfNeeded(reason: String) -> Bool {
        guard switchingCandidate else { return false }
        switchingCandidate = false
        do {
            try registry.rollbackCandidate()
            updateToolbar.setFailure("Update rolled back: \(reason)")
            stopServerForRestart()
            startServer()
        } catch {
            updateToolbar.setFailure("Rollback failed: \(error.localizedDescription)")
        }
        return true
    }

    private func showStartingPage(message: String) {
        showStatusPage(
            symbol: "DSH",
            title: message,
            detail: "模型与会话服务正在本机运行，首次启动可能需要下载组件。",
            isError: false
        )
    }

    private func showErrorPage(title: String, detail: String) {
        showStatusPage(symbol: "!", title: title, detail: detail, isError: true)
    }

    private func showStatusPage(symbol: String, title: String, detail: String, isError: Bool) {
        let safeTitle = htmlEscaped(title)
        let safeDetail = htmlEscaped(detail).replacingOccurrences(of: "\n", with: "<br>")
        let accent = isError ? "#ef4444" : "#4f46e5"
        let animation = isError ? "" : "animation: pulse 1.5s ease-in-out infinite;"
        let html = """
        <!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark">
        <style>
        *{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;background:#0b0d12;color:#f4f4f5;height:100vh;display:grid;place-items:center}
        main{text-align:center;max-width:620px;padding:44px}.mark{width:66px;height:66px;margin:0 auto 24px;border-radius:20px;display:grid;place-items:center;background:\(accent);color:white;font-weight:750;font-size:20px;box-shadow:0 18px 50px \(accent)55;\(animation)}
        h1{font-size:24px;margin:0 0 14px;letter-spacing:-.02em}p{margin:0;color:#a1a1aa;line-height:1.7;font-size:14px;word-break:break-word}@keyframes pulse{50%{transform:scale(.96);opacity:.78}}
        </style></head><body><main><div class="mark">\(symbol)</div><h1>\(safeTitle)</h1><p>\(safeDetail)</p></main></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    private func htmlEscaped(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func installMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 DSH", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 DSH", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        NSApp.mainMenu = mainMenu
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "about" || url.host == "127.0.0.1" || url.host == "localhost" {
            decisionHandler(.allow)
            return
        }
        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url?.host == "127.0.0.1" || webView.url?.host == "localhost" else { return }
        if switchingCandidate {
            switchingCandidate = false
            if let state = try? registry.load(), let version = DSHVersion(state.activeVersion) {
                try? registry.confirmCandidate()
                updateToolbar.setCurrentVersion(version)
            }
        }
        guard !didCheckForUpdates else { return }
        didCheckForUpdates = true
        checkForUpdates()
    }
}

@main
private struct DSHLauncherMain {
    static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.setActivationPolicy(.regular)
        application.delegate = delegate
        application.run()
        _ = delegate
    }
}
