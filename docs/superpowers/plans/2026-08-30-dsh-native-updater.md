# DSH Native Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native macOS toolbar update indicator that detects newer official DSH tags, installs the selected runtime side-by-side, and safely switches or rolls back without modifying DSH source or web UI.

**Architecture:** Keep the updater entirely inside `apps/dsh-launcher-macos`. Pure Foundation components parse versions, check GitHub tags, persist runtime state, and install a candidate runtime; AppKit code owns the toolbar and coordinates confirmation, relaunch, candidate health checks, and rollback. The existing DSH server remains unchanged and runs from the active runtime selected by an atomic local manifest.

**Tech Stack:** Swift 6 command-line compilation, AppKit, WebKit, Foundation `URLSession`, Foundation `Process`, Git, Corepack/pnpm, the existing shell build and test harness.

**Spec:** `docs/superpowers/specs/2026-08-30-dsh-native-updater-design.md`

## Global Constraints

- All updater code lives under `apps/dsh-launcher-macos`; do not modify DSH source, DSH web DOM, or plugin protocols.
- Check only official `deepseek-ai/deepseek-harness` tags matching `dsh-v<semver>`.
- Follow the current SemVer channel: stable installations ignore prereleases; prerelease installations may advance through prereleases and into a newer stable release.
- Check once after DSH loads and expose a manual retry; do not add periodic polling.
- Build candidates in a side-by-side runtime directory while the current DSH process remains available.
- Preserve `~/.dsh`, credentials, sessions, and plugin configuration.
- Switch only after candidate build completion; roll back automatically when candidate startup or plugin-tree health fails.
- Keep the current and previous stable runtimes; do not implement automatic historical-runtime cleanup.
- Show official release/tag and comparison links only; do not translate release notes.

---

### Task 1: Version and update-check domain

**Files:**
- Create: `apps/dsh-launcher-macos/Sources/DSHVersion.swift`
- Create: `apps/dsh-launcher-macos/Sources/UpdateChecker.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`
- Modify: `apps/dsh-launcher-macos/test.sh`

**Interfaces:**
- Produces: `DSHVersion.init?(_ raw: String)`, `Comparable`, `isPrerelease`, and `accepts(candidate:)`.
- Produces: `DSHTag(version: DSHVersion, name: String, commitSHA: String, tagURL: URL, compareURL: URL)`.
- Produces: `UpdateCheckResult.current`, `.available(DSHTag)`, and `.unavailable(String)`.
- Produces: `UpdateChecking.check(current:completion:)` and concrete `GitHubUpdateChecker`.

- [ ] **Step 1: Add failing version/channel tests**

Add cases to `LauncherCoreTests.swift` that assert parsing, SemVer precedence, and channel filtering:

```swift
private func testDSHVersionOrdersPrereleasesAndStableReleases() throws {
    let alpha1 = try requireVersion("0.1.2-alpha.1")
    let alpha2 = try requireVersion("0.1.2-alpha.2")
    let stable = try requireVersion("0.1.2")
    try expect(alpha1 < alpha2, "later alpha identifiers must sort higher")
    try expect(alpha2 < stable, "a stable version must sort above its prereleases")
}

private func testCurrentChannelFiltersCandidates() throws {
    let stable = try requireVersion("0.1.2")
    let alpha = try requireVersion("0.1.2-alpha.1")
    try expect(!stable.accepts(candidate: try requireVersion("0.1.3-alpha.1")), "stable must ignore prereleases")
    try expect(alpha.accepts(candidate: try requireVersion("0.1.3-alpha.1")), "prerelease may advance to a later prerelease")
    try expect(alpha.accepts(candidate: try requireVersion("0.1.2")), "prerelease may advance to stable")
}
```

- [ ] **Step 2: Run the launcher tests and confirm the new symbols fail to compile**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: compilation fails because `DSHVersion` and `requireVersion` do not exist.

- [ ] **Step 3: Implement strict SemVer parsing and comparison**

Create `DSHVersion.swift` with numeric major/minor/patch fields and dot-separated prerelease identifiers. Reject missing numeric core components, empty identifiers, and unrelated prefixes. Compare numeric prerelease identifiers numerically, text identifiers lexically, numeric identifiers below text identifiers, and stable above prerelease.

```swift
struct DSHVersion: Codable, Comparable, Hashable, CustomStringConvertible {
    let major: Int
    let minor: Int
    let patch: Int
    let prerelease: [PrereleaseIdentifier]

    init?(_ raw: String)
    var isPrerelease: Bool { !prerelease.isEmpty }
    func accepts(candidate: DSHVersion) -> Bool {
        candidate > self && (isPrerelease || !candidate.isPrerelease)
    }
}
```

- [ ] **Step 4: Add failing update-check selection tests using decoded tag fixtures**

Use an injected `URLSessionProtocol` closure or a small `GitHubTagSelecting` pure function so the test can provide tags without network access. Assert malformed tags are ignored and the highest accepted tag is selected.

```swift
let tags = [
    GitHubTagPayload(name: "not-dsh", sha: "x"),
    GitHubTagPayload(name: "dsh-v0.1.2-alpha.2", sha: "a2"),
    GitHubTagPayload(name: "dsh-v0.1.2", sha: "stable"),
]
let selected = GitHubTagSelector.latest(current: requireVersion("0.1.2-alpha.1"), tags: tags)
try expect(selected?.name == "dsh-v0.1.2", "highest compatible official tag must win")
```

- [ ] **Step 5: Implement GitHub tag decoding and asynchronous checking**

Use `https://api.github.com/repos/deepseek-ai/deepseek-harness/tags?per_page=100`, a 10-second request timeout, an explicit `Accept: application/vnd.github+json`, and a descriptive user agent. Build links as:

```swift
let tagURL = URL(string: "https://github.com/deepseek-ai/deepseek-harness/tree/\(tagName)")!
let compareURL = URL(string: "https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v\(current)...\(tagName)")!
```

Return `.unavailable` for transport, HTTP, decoding, or empty-compatible-result errors without throwing onto the main thread.

- [ ] **Step 6: Update `test.sh`, run the tests, and commit**

Compile all pure Swift sources needed by tests instead of only `LauncherCore.swift`:

```zsh
swiftc \
  "$APP_SOURCE_DIR/Sources/LauncherCore.swift" \
  "$APP_SOURCE_DIR/Sources/DSHVersion.swift" \
  "$APP_SOURCE_DIR/Sources/UpdateChecker.swift" \
  "$APP_SOURCE_DIR/Tests/LauncherCoreTests.swift" \
  -o "$BUILD_DIR/LauncherCoreTests"
```

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: all existing and new version-selection tests pass.

Commit:

```bash
git add apps/dsh-launcher-macos/Sources/DSHVersion.swift apps/dsh-launcher-macos/Sources/UpdateChecker.swift apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift apps/dsh-launcher-macos/test.sh
git commit -m "feat: detect official DSH updates"
```

### Task 2: Runtime registry and dynamic resolver

**Files:**
- Create: `apps/dsh-launcher-macos/Sources/RuntimeRegistry.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherCore.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherApp.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`

**Interfaces:**
- Consumes: `DSHVersion` from Task 1.
- Produces: `RuntimeRecord(version: DSHVersion, tag: String, commitSHA: String, directory: URL)`.
- Produces: `RuntimeState(active: RuntimeRecord, stable: RuntimeRecord, previousStable: RuntimeRecord?, pending: RuntimeRecord?)`.
- Produces: `RuntimeRegistry.loadOrBootstrap(bootstrap:)`, `beginSwitch(to:)`, `markPendingStable()`, and `rollbackPending()`.
- Changes: `SourceDSHResolver.find(in:expectedVersion:fileManager:)` removes the pinned-version constant.

- [ ] **Step 1: Add failing registry and resolver tests**

Cover bootstrap from the existing `0.1.2-alpha.1` runtime, atomic persistence, pending switch, successful stabilization, rollback, and rejection when `package.json` does not match the expected version.

```swift
let registry = RuntimeRegistry(stateURL: temporaryDirectory.appendingPathComponent("runtime-state.json"))
let initial = try registry.loadOrBootstrap(bootstrap: oldRuntime)
try registry.beginSwitch(to: newRuntime)
try expect(try registry.load().pending == newRuntime, "candidate must be durable before relaunch")
try registry.rollbackPending()
try expect(try registry.load().active == oldRuntime, "rollback must restore the stable runtime")
```

- [ ] **Step 2: Run tests and confirm failures**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: compilation fails because `RuntimeRegistry` and the parameterized resolver do not exist.

- [ ] **Step 3: Implement the runtime manifest with atomic writes**

Store `runtime-state.json` under `~/Library/Application Support/VectorAI/dsh-runtime`. Encode to a sibling temporary file, call `FileHandle.synchronize()`, then use `FileManager.replaceItemAt` or an atomic move for first creation. Validate that every stored runtime directory remains within the configured runtime root before returning it.

- [ ] **Step 4: Parameterize runtime resolution and bootstrap the current install**

Replace the pinned resolver with:

```swift
static func find(
    in sourceDirectory: URL,
    expectedVersion: DSHVersion,
    fileManager: FileManager = .default
) -> URL?
```

In `AppDelegate`, create a registry from the runtime root, bootstrap the current `0.1.2-alpha.1` directory when no manifest exists, and launch `state.active` rather than a hard-coded directory.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: registry, resolver, and all prior launcher tests pass.

Commit:

```bash
git add apps/dsh-launcher-macos/Sources/RuntimeRegistry.swift apps/dsh-launcher-macos/Sources/LauncherCore.swift apps/dsh-launcher-macos/Sources/LauncherApp.swift apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift
git commit -m "feat: select DSH runtime from durable state"
```

### Task 3: Side-by-side runtime installer

**Files:**
- Create: `apps/dsh-launcher-macos/Sources/RuntimeInstaller.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`
- Modify: `apps/dsh-launcher-macos/build.sh`
- Modify: `apps/dsh-launcher-macos/test.sh`

**Interfaces:**
- Consumes: `DSHTag` and `RuntimeRecord`.
- Produces: `RuntimeInstallStage` (`downloading`, `installingDependencies`, `building`, `validating`).
- Produces: `RuntimeInstalling.install(tag:runtimeRoot:progress:completion:)`.
- Produces: concrete `SourceRuntimeInstaller` with injectable `CommandRunning` for deterministic tests.

- [ ] **Step 1: Add failing command-plan and validation tests**

Assert the installer uses an explicit destination, exact tag, official repository, frozen lockfile, pinned pnpm `11.7.0`, and expected package/commit checks. Assert the destination is rejected when it escapes the runtime root.

```swift
let plan = RuntimeInstallPlan.make(tag: tag, runtimeRoot: root, temporaryRoot: temporary)
try expect(plan.clone.arguments.contains("--branch") && plan.clone.arguments.contains(tag.name), "clone must pin the exact tag")
try expect(plan.build.arguments.contains("pnpm@11.7.0"), "build must pin the package manager")
```

- [ ] **Step 2: Run tests and confirm failures**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: compilation fails because installer types do not exist.

- [ ] **Step 3: Implement fixed command construction and validation**

The installer must construct, not download, its commands:

```text
git clone --depth 1 --branch <tag> https://github.com/deepseek-ai/deepseek-harness.git <temp-source>
git -C <temp-source> rev-parse HEAD
corepack pnpm@11.7.0 --dir <temp-source> install --frozen-lockfile
corepack pnpm@11.7.0 --dir <temp-source> run build
chmod +x <temp-source>/apps/cli/lib/bin.js
```

Read the root `package.json`, require the expected version, require `rev-parse HEAD` to equal the GitHub tag SHA, then atomically move the completed source tree into `<runtimeRoot>/<version>`. If the validated destination already exists, return it without rebuilding.

- [ ] **Step 4: Run installation off the main thread with progress and a separate log**

Use a serial `DispatchQueue` and injected command runner. Write stdout/stderr to `~/Library/Logs/DSH/update.log`. Dispatch progress and completion callbacks to the main queue. Prevent two concurrent installs with an in-memory state guard.

- [ ] **Step 5: Compile all launcher sources, run tests, and commit**

Change `build.sh` to compile `Sources/*.swift` in a stable sorted order and change `test.sh` to include the new pure sources.

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: installer tests and the signed temporary App build pass.

Commit:

```bash
git add apps/dsh-launcher-macos/Sources/RuntimeInstaller.swift apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift apps/dsh-launcher-macos/build.sh apps/dsh-launcher-macos/test.sh
git commit -m "feat: install DSH runtimes side by side"
```

### Task 4: Candidate switch, health check, and rollback

**Files:**
- Create: `apps/dsh-launcher-macos/Sources/UpdateCoordinator.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherCore.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherApp.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`

**Interfaces:**
- Consumes: `RuntimeRegistry`, `RuntimeInstalling`, `ManagedProcess`, and `DSHReadyURL`.
- Produces: `UpdateCoordinatorState` (`idle`, `installing`, `readyToRestart`, `trialLaunching`, `rollingBack`, `failed`).
- Produces: `UpdateCoordinating.install(_:)`, `prepareRelaunch()`, `candidateDidBecomeHealthy()`, and `candidateDidFail(_:)`.
- Produces: `DSHStartupHealth.scan(logSlice:)` that rejects plugin-tree failures even when a ready URL exists.

- [ ] **Step 1: Add failing health and state-transition tests**

Cover ready URL plus healthy log, ready URL plus `plugin tree failed to load`, candidate process exit, startup timeout, successful stabilization, and rollback restoration.

```swift
let unhealthy = """
dsh web: http://127.0.0.1:3080/?token=abc
Error: dsh: plugin tree failed to load: failed to apply loader entry
"""
try expect(DSHStartupHealth.scan(logSlice: unhealthy, port: 3080).isFailure, "plugin tree failure must reject the candidate")
```

- [ ] **Step 2: Run tests and confirm failures**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: compilation fails because health and coordinator types do not exist.

- [ ] **Step 3: Implement update transaction transitions**

On successful install, call `registry.beginSwitch(to:)`, then relaunch the same App bundle. At launch, a state with `pending != nil` enters trial mode and launches the pending active runtime. A healthy trial calls `markPendingStable()`. A failed trial calls `rollbackPending()` and restarts the previous runtime in the same App process.

Keep `applicationWillTerminate` shutdown separate from a reusable `stopServer()` method so rollback can restart DSH without setting the permanent shutdown flag.

- [ ] **Step 4: Add plugin-tree-aware startup health**

Scan only the log bytes written after the current start offset. Treat these patterns as candidate failure before accepting readiness:

```text
plugin tree failed to load
failed to apply loader entry
failed to import loader entry
```

Do not persist ready URLs or tokens in updater logs or runtime state.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: all transition and existing process lifecycle tests pass.

Commit:

```bash
git add apps/dsh-launcher-macos/Sources/UpdateCoordinator.swift apps/dsh-launcher-macos/Sources/LauncherCore.swift apps/dsh-launcher-macos/Sources/LauncherApp.swift apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift
git commit -m "feat: roll back unhealthy DSH updates"
```

### Task 5: Native toolbar and update panel

**Files:**
- Create: `apps/dsh-launcher-macos/Sources/UpdateToolbarController.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherApp.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`
- Modify: `apps/dsh-launcher-macos/README.md`

**Interfaces:**
- Consumes: `UpdateChecking`, `UpdateCoordinating`, current `RuntimeRecord`, and `UpdateCheckResult`.
- Produces: `UpdateToolbarController` that owns one `NSToolbarItem`, its red-dot view, and an `NSPopover`/sheet.
- Produces: toolbar view states `current`, `available`, `checking`, `installing`, and `failed`.

- [ ] **Step 1: Add failing view-state tests**

Keep state formatting pure and test that only `.available` produces a red dot, version labels never contain commit hashes, and failure leaves the current version visible.

```swift
let state = UpdateToolbarPresentation.make(current: current, check: .available(tag))
try expect(state.showsUpdateDot, "an available official tag must show the red dot")
try expect(state.versionText == "DSH 0.1.3-alpha.1", "toolbar must show the target DSH version")
```

- [ ] **Step 2: Run tests and confirm failures**

Run: `pnpm --filter @vectorai/dsh-launcher-macos test`

Expected: compilation fails because toolbar presentation types do not exist.

- [ ] **Step 3: Add a native trailing toolbar version item**

Create an `NSToolbar` in `AppDelegate.createWindow()`. The trailing custom item contains a compact version button and an 8-point red circle aligned to the button's top-right corner. It must not overlay the WebView or intercept titlebar dragging outside the control.

The item shows:

```text
DSH 0.1.2-alpha.1       (current)
DSH 0.1.3-alpha.1  ●    (update available)
正在安装 DSH…           (installing)
```

- [ ] **Step 4: Implement the native update panel and actions**

The panel displays current and target versions, “查看官方版本” and “查看版本对比” links, “重新检查”, “稍后”, and “更新”. “更新” presents an `NSAlert` confirmation before invoking the coordinator. Disable update/retry controls while installing. Show progress stage text without blocking the DSH WebView.

- [ ] **Step 5: Start one background check after the DSH page finishes loading**

Trigger the initial check from `WKNavigationDelegate.webView(_:didFinish:)` only once per App launch. Manual retry remains available from the panel. Do not schedule timers.

- [ ] **Step 6: Document operation and run the complete launcher verification**

Update `README.md` with the tag source, toolbar behavior, runtime manifest path, update log path, side-by-side installation, and rollback behavior.

Run:

```bash
pnpm --filter @vectorai/dsh-launcher-macos test
pnpm --filter @vectorai/dsh-launcher-macos build
codesign --verify --deep --strict apps/dsh-launcher-macos/Build/DSH.app
```

Expected: launcher tests pass, the App builds, and code signing verification exits successfully.

- [ ] **Step 7: Perform the final native smoke test and commit**

Launch the built App with a test checker fixture or a temporary injected tag response. Verify the toolbar does not alter DSH web layout, the red dot opens the native panel, cancellation preserves the running process, and a forced candidate-health failure rolls back to the previous runtime.

Commit:

```bash
git add apps/dsh-launcher-macos/Sources/UpdateToolbarController.swift apps/dsh-launcher-macos/Sources/LauncherApp.swift apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift apps/dsh-launcher-macos/README.md
git commit -m "feat: add native DSH update controls"
```

### Task 6: Final integration audit

**Files:**
- Modify only files required to correct issues found by the audit.

**Interfaces:**
- Consumes all components from Tasks 1–5.
- Produces a distributable `DSH.app` whose updater remains outside DSH and whose last stable runtime is recoverable.

- [ ] **Step 1: Verify spec coverage and repository boundaries**

Run:

```bash
rg -n "UpdateChecker|RuntimeInstaller|RuntimeRegistry|UpdateCoordinator|UpdateToolbar" apps/dsh-launcher-macos
git diff --name-only HEAD~5..HEAD | rg 'dsh-runtime|\.dsh/profiles|packages/plugin-dsh|Library/Application Support/VectorAI/dsh-runtime' && exit 1 || true
```

Expected: updater implementation appears only under `apps/dsh-launcher-macos` plus its documentation; no DSH source or plugin package is modified for the updater.

- [ ] **Step 2: Run all launcher checks once more**

Run:

```bash
pnpm --filter @vectorai/dsh-launcher-macos test
pnpm --filter @vectorai/dsh-launcher-macos build
codesign --verify --deep --strict apps/dsh-launcher-macos/Build/DSH.app
```

Expected: every command exits successfully.

- [ ] **Step 3: Review logs and persisted state for secrets**

Inspect a test update log and runtime manifest. Confirm neither contains a ready URL token, credentials, `~/.dsh` contents, or model configuration.

- [ ] **Step 4: Commit final integration corrections**

```bash
git add apps/dsh-launcher-macos docs/superpowers/plans/2026-08-30-dsh-native-updater.md
git commit -m "chore: complete native DSH updater integration"
```

