// SPDX-License-Identifier: Apache-2.0

import AppKit
import Foundation
import WebKit

private enum LauncherConstants {
    static let port: UInt16 = 3080
    static let serverURL = URL(string: "http://127.0.0.1:3080/")!
    static let startupTimeout: TimeInterval = 90
    static let workspacePatchScript = Bundle.main.resourceURL!
        .appendingPathComponent("dsh-inline-workspace-patch.mjs")
}

private enum ExecutableResolver {
    static func nodeURL() -> URL? {
        resolveExecutable(
            environmentKey: "DSH_NODE_PATH",
            candidates: [
                "/opt/homebrew/bin/node",
                "/opt/homebrew/opt/node/bin/node",
                "/opt/homebrew/opt/node@22/bin/node",
                "/usr/local/bin/node",
                "/usr/bin/node",
            ],
            executableName: "node"
        )
    }

    static func npxURL() -> URL? {
        resolveExecutable(
            environmentKey: "DSH_NPX_PATH",
            candidates: [
                "/opt/homebrew/bin/npx",
                "/opt/homebrew/opt/node/bin/npx",
                "/opt/homebrew/opt/node@22/bin/npx",
                "/usr/local/bin/npx",
                "/usr/bin/npx",
            ],
            executableName: "npx"
        )
    }

    private static func resolveExecutable(
        environmentKey: String,
        candidates baseCandidates: [String],
        executableName: String
    ) -> URL? {
        let fileManager = FileManager.default
        var candidates: [String] = []
        if let explicitPath = ProcessInfo.processInfo.environment[environmentKey], !explicitPath.isEmpty {
            candidates.append(explicitPath)
        }
        candidates.append(contentsOf: baseCandidates)
        if let path = ProcessInfo.processInfo.environment["PATH"] {
            candidates.append(contentsOf: path.split(separator: ":").map { "\($0)/\(executableName)" })
        }

        for path in candidates where fileManager.isExecutableFile(atPath: path) {
            return URL(fileURLWithPath: path)
        }
        return nil
    }

    static func pathEnvironment(for npxURL: URL) -> String {
        let inherited = ProcessInfo.processInfo.environment["PATH"] ?? ""
        let entries = [
            npxURL.deletingLastPathComponent().path,
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
    private var healthRequestInFlight = false
    private var isShuttingDown = false
    private var titlebarMouseMonitor: Any?

    private lazy var logURL: URL = {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DSH", isDirectory: true)
            .appendingPathComponent("dsh.log")
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
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
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "DeepSeek Harness"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.minSize = NSSize(width: 900, height: 620)
        window.center()
        window.contentView = webView
        window.delegate = self
        window.isReleasedWhenClosed = false
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
        let npxCacheDirectory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".npm/_npx", isDirectory: true)
        let command: DSHServerCommand
        let pathAnchor: URL
        if let cachedDSH = CachedDSHResolver.find(in: npxCacheDirectory) {
            guard applyWorkspacePatch(to: cachedDSH) else { return }
            command = DSHServerCommand.makeDirect(port: LauncherConstants.port, dshURL: cachedDSH)
            pathAnchor = cachedDSH
        } else if let npxURL = ExecutableResolver.npxURL() {
            command = DSHServerCommand.make(port: LauncherConstants.port, npxURL: npxURL)
            pathAnchor = npxURL
        } else {
            showErrorPage(
                title: "找不到 DSH 或 npx",
                detail: "请先安装 Node.js 22；启动器会用 npx 获取固定版本 DSH 0.1.0-rc.8。"
            )
            return
        }

        let managedServer = ManagedProcess(
            executableURL: command.executableURL,
            arguments: command.arguments,
            logURL: logURL,
            environmentOverrides: ["PATH": ExecutableResolver.pathEnvironment(for: pathAnchor)]
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

    private func applyWorkspacePatch(to dshURL: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: LauncherConstants.workspacePatchScript.path) else {
            showErrorPage(
                title: "找不到 VectorAI 布局补丁",
                detail: "缺少：\(LauncherConstants.workspacePatchScript.path)"
            )
            return false
        }
        guard let nodeURL = ExecutableResolver.nodeURL() else {
            showErrorPage(title: "找不到 Node.js", detail: "无法在启动 DSH 前校验 VectorAI 会话工作区补丁。")
            return false
        }

        let command = WorkspacePatchCommand.make(
            nodeURL: nodeURL,
            scriptURL: LauncherConstants.workspacePatchScript,
            dshURL: dshURL
        )
        let process = Process()
        let output = Pipe()
        process.executableURL = command.executableURL
        process.arguments = command.arguments
        process.standardOutput = output
        process.standardError = output
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            showErrorPage(title: "VectorAI 布局校验失败", detail: error.localizedDescription)
            return false
        }
        guard process.terminationStatus == 0 else {
            let data = output.fileHandleForReading.readDataToEndOfFile()
            let detail = String(data: data, encoding: .utf8) ?? "补丁器退出码：\(process.terminationStatus)"
            showErrorPage(title: "DSH 版本与 VectorAI 布局不兼容", detail: detail)
            return false
        }
        return true
    }

    private func pollServer() {
        guard !isShuttingDown else { return }
        guard let server, server.isRunning else {
            stopStartupTimer()
            showErrorPage(
                title: "DSH 进程已退出",
                detail: "请查看启动日志：\(logURL.path)"
            )
            return
        }
        guard Date() < startupDeadline else {
            stopStartupTimer()
            showErrorPage(
                title: "DSH 启动超时",
                detail: "90 秒内未能连接本地服务。关闭窗口会停止后台进程。\n\n日志：\(logURL.path)"
            )
            return
        }
        guard !healthRequestInFlight else { return }
        healthRequestInFlight = true

        var request = URLRequest(url: LauncherConstants.serverURL)
        request.timeoutInterval = 1
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.healthRequestInFlight = false
                guard let response = response as? HTTPURLResponse, (200..<500).contains(response.statusCode) else {
                    return
                }
                self.stopStartupTimer()
                self.webView.load(URLRequest(url: LauncherConstants.serverURL))
            }
        }.resume()
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
