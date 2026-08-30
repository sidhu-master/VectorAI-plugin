// SPDX-License-Identifier: Apache-2.0

import AppKit
import Foundation

final class UpdateToolbarController: NSObject, NSToolbarDelegate {
    private static let itemIdentifier = NSToolbarItem.Identifier("com.vectorai.dsh.update")
    private let versionButton = NSButton()
    private let dotView = NSView()
    private let container = NSView(frame: NSRect(x: 0, y: 0, width: 174, height: 30))
    private(set) var state: UpdateToolbarState
    private(set) var availableTag: DSHTag?
    var onCheck: (() -> Void)?
    var onInstall: ((DSHTag) -> Void)?

    init(currentVersion: DSHVersion) {
        self.state = UpdateToolbarState(currentVersion: currentVersion)
        super.init()
        configureView()
    }

    func install(on window: NSWindow) {
        let toolbar = NSToolbar(identifier: "com.vectorai.dsh.toolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        window.toolbar = toolbar
        window.toolbarStyle = .unified
    }

    func setChecking() {
        state.status = .checking
        availableTag = nil
        refresh()
    }

    func apply(_ result: UpdateCheckResult) {
        switch result {
        case .current:
            state.status = .current
            availableTag = nil
        case let .available(tag):
            state.status = .available(tag.version)
            availableTag = tag
        case let .unavailable(message):
            state.status = .failed(message)
            availableTag = nil
        }
        refresh()
    }

    func setInstalling(_ progress: String) {
        state.status = .installing(progress)
        refresh()
    }

    func setFailure(_ message: String) {
        state.status = .failed(message)
        refresh()
    }

    func setCurrentVersion(_ version: DSHVersion) {
        state.currentVersion = version
        state.status = .current
        availableTag = nil
        refresh()
    }

    private func configureView() {
        versionButton.title = state.buttonTitle
        versionButton.bezelStyle = .texturedRounded
        versionButton.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        versionButton.target = self
        versionButton.action = #selector(showMenu(_:))
        versionButton.frame = NSRect(x: 0, y: 1, width: 164, height: 28)
        container.addSubview(versionButton)

        dotView.wantsLayer = true
        dotView.layer?.backgroundColor = NSColor.systemRed.cgColor
        dotView.layer?.cornerRadius = 4
        dotView.frame = NSRect(x: 158, y: 20, width: 8, height: 8)
        dotView.isHidden = true
        container.addSubview(dotView)
    }

    private func refresh() {
        versionButton.title = state.buttonTitle
        versionButton.toolTip = statusText
        dotView.isHidden = !state.showsUpdateDot
    }

    private var statusText: String {
        switch state.status {
        case .idle: return "DSH update"
        case .checking: return "Checking for updates…"
        case .current: return "DSH is up to date"
        case let .available(version): return "DSH \(version) is available"
        case let .installing(progress): return progress
        case let .failed(message): return message
        }
    }

    @objc private func showMenu(_ sender: NSButton) {
        let menu = NSMenu()
        let current = NSMenuItem(title: "Current: \(state.currentVersion)", action: nil, keyEquivalent: "")
        current.isEnabled = false
        menu.addItem(current)

        if let tag = availableTag {
            let latest = NSMenuItem(title: "Available: \(tag.version)", action: nil, keyEquivalent: "")
            latest.isEnabled = false
            menu.addItem(latest)
            menu.addItem(.separator())
            menu.addItem(targetedItem(title: "View Official Tag", action: #selector(openTag)))
            menu.addItem(targetedItem(title: "Compare Changes", action: #selector(openComparison)))
            menu.addItem(.separator())
            menu.addItem(targetedItem(title: "Install Update…", action: #selector(confirmInstall)))
        } else {
            let status = NSMenuItem(title: statusText, action: nil, keyEquivalent: "")
            status.isEnabled = false
            menu.addItem(status)
        }
        menu.addItem(.separator())
        menu.addItem(targetedItem(title: "Check for Updates", action: #selector(checkAgain)))
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.height + 4), in: sender)
    }

    private func targetedItem(title: String, action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        return item
    }

    @objc private func openTag() {
        if let url = availableTag?.tagURL { NSWorkspace.shared.open(url) }
    }

    @objc private func openComparison() {
        if let url = availableTag?.compareURL { NSWorkspace.shared.open(url) }
    }

    @objc private func checkAgain() { onCheck?() }

    @objc private func confirmInstall() {
        guard let tag = availableTag else { return }
        let alert = NSAlert()
        alert.messageText = "Install DSH \(tag.version)?"
        alert.informativeText = "The new runtime will be built alongside the current version. Your ~/.dsh data and plugin configuration will not be changed."
        alert.addButton(withTitle: "Install")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        onInstall?(tag)
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, Self.itemIdentifier]
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, Self.itemIdentifier]
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        guard itemIdentifier == Self.itemIdentifier else { return nil }
        let item = NSToolbarItem(itemIdentifier: itemIdentifier)
        item.view = container
        item.label = "DSH Update"
        item.paletteLabel = "DSH Update"
        return item
    }
}
