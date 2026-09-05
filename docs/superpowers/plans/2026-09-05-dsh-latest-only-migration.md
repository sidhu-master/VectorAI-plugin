# DSH Latest-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run VectorAI's two local Bundles on exact upstream DSH `0.1.3-alpha.1`, migrate the changed attachment/session-facing contracts, and prove the real annotation workflow on an isolated profile.

**Architecture:** `release/dsh-plugins.json` is the only maintained DSH coordinate source. Generated TypeScript and Swift constants plus drift tests feed the recognition adapter and Launcher, while the source installer and probes read the manifest directly. Final Bundles externalize DSH; exact runtime peers are host-provided, and the temporary npm SDK lag is recorded separately and verified against the built upstream runtime.

**Tech Stack:** TypeScript 5.8, Vitest 3, Vite/Rollup, pnpm 11.7.0, Swift/AppKit/WKWebView, DSH source tag `dsh-v0.1.3-alpha.1`.

**Spec:** `docs/superpowers/specs/2026-09-05-dsh-latest-only-migration-design.md`

## Global Constraints

- Runtime version is exactly `0.1.3-alpha.1`, tag `dsh-v0.1.3-alpha.1`, commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`.
- npm SDK fallback is exactly `0.1.2-rc.1` only while matching `0.1.3-alpha.1` packages are unavailable.
- Support one DSH runtime baseline only; do not add an old-API fallback or dual-version branch.
- Keep the official `shell.overlay` integration and do not patch DSH source or generated runtime output.
- Keep exactly two ordered user-installable Bundles: Space, then Annotation.
- Do not publish packages in this migration.
- Preserve VectorAI drawing, partition, dimension-plan, annotation, export, and session-scoped state behavior.
- Do not add status pills, workflow badges, progress summaries, or migration UI.
- Run tests against copied or fresh DSH state; do not destructively migrate the user's only `~/.dsh` data.

---

### Task 1: Make the DSH baseline manifest authoritative

**Files:**
- Create: `scripts/dsh-runtime-manifest.mjs`
- Create: `scripts/sync-dsh-runtime-baseline.mjs`
- Create: `scripts/dsh-runtime-manifest.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/dsh-runtime-baseline.generated.ts`
- Create: `apps/dsh-launcher-macos/Sources/DSHRuntimeBaseline.generated.swift`
- Modify: `release/dsh-plugins.json`
- Modify: `scripts/dsh-release-manifest.test.ts`
- Modify: `packages/plugin-dsh-space/package.json`
- Modify: `packages/plugin-dsh-annotation/package.json`
- Modify: `packages/plugin-dsh-space-client/package.json`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Modify: `packages/plugin-dsh-annotation-client/package.json`
- Modify: `packages/plugin-dsh-annotation-host/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `readDshRuntimeManifest(root?): DshRuntimeManifest`, `assertDshRuntimeManifest(value): DshRuntimeManifest`, and generated constants `DSH_RUNTIME_VERSION`, `DSH_RUNTIME_TAG`, `DSH_RUNTIME_COMMIT`.
- Consumes: the existing release manifest and package manifests.

- [ ] **Step 1: Write failing manifest and drift tests**

Add assertions equivalent to:

```ts
const baseline = readDshRuntimeManifest(root);
expect(baseline).toEqual({
  version: '0.1.3-alpha.1',
  tag: 'dsh-v0.1.3-alpha.1',
  commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  registrySdkVersion: '0.1.2-rc.1',
  profile: 'web',
});
expect(await inspectDshRuntimeDrift(root)).toEqual([]);
```

The release-manifest test must assert exact runtime peers on both public Bundles,
optional peer metadata for every `@deepseek-ai/dsh-*` peer, and registry SDK
versions on private build-input packages.

- [ ] **Step 2: Run the focused tests and confirm baseline drift fails**

Run:

```bash
pnpm vitest run scripts/dsh-runtime-manifest.test.ts scripts/dsh-release-manifest.test.ts
```

Expected: failure because the manifest lacks tag/commit/SDK coordinates and
active consumers still contain `0.1.2-alpha.5`.

- [ ] **Step 3: Implement manifest parsing and synchronization**

`scripts/dsh-runtime-manifest.mjs` validates exact strings, tag/version
agreement, a 40-character lowercase commit, and the profile. The synchronizer:

```js
const baseline = readDshRuntimeManifest(root);
await updateBuildInputDependencies(baseline.registrySdkVersion);
await updateBundlePeers(baseline.version, { optional: true });
await writeGeneratedTypeScript(baseline);
await writeGeneratedSwift(baseline);
```

The drift inspector renders expected generated files in memory and reports
paths whose committed content or package coordinates differ. Historical specs,
plans, and migration test fixtures are not active consumers.

- [ ] **Step 4: Update the release manifest and generate every consumer**

Set:

```json
"dsh": {
  "version": "0.1.3-alpha.1",
  "tag": "dsh-v0.1.3-alpha.1",
  "commit": "d347e703908d0406b7a7ef80e3a0e594d86b2215",
  "registrySdkVersion": "0.1.2-rc.1",
  "profile": "web",
  "installArgs": {
    "@newwe/vectorai-plugin-dsh-annotation": ["--allow-build=tesseract.js"]
  }
}
```

Run:

```bash
node scripts/sync-dsh-runtime-baseline.mjs
pnpm install --lockfile-only
```

- [ ] **Step 5: Run the focused tests and drift scan**

Run:

```bash
pnpm vitest run scripts/dsh-runtime-manifest.test.ts scripts/dsh-release-manifest.test.ts
rg -n "0\.1\.2-alpha\.5" release scripts apps/dsh-launcher-macos packages/plugin-dsh-* docs/development.md docs/tech-architecture.md docs/prd.md
```

Expected: tests pass; active paths contain no old baseline except explicit
negative/migration fixtures.

- [ ] **Step 6: Commit the authoritative baseline task**

```bash
git add release/dsh-plugins.json scripts/dsh-runtime-manifest.mjs scripts/sync-dsh-runtime-baseline.mjs scripts/dsh-runtime-manifest.test.ts scripts/dsh-release-manifest.test.ts packages/plugin-dsh-* apps/dsh-launcher-macos/Sources/DSHRuntimeBaseline.generated.swift pnpm-lock.yaml
git commit -m "build: centralize DSH runtime baseline"
```

---

### Task 2: Migrate drawing uploads to the DSH generic attachment API

**Files:**
- Create: `packages/plugin-dsh-space-client/src/dsh-draft-attachments.ts`
- Create: `packages/plugin-dsh-space-client/src/dsh-draft-attachments.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/client-view.test.tsx`

**Interfaces:**
- Produces: `stageDraftAttachments(input): boolean`, `DshDraftConversation`, and `DshInputActions`.
- Consumes: DSH `ConversationController.createDrafts(sessionId, files)`, `releaseDraftAttachments(drafts)`, and `InputActions.addAttachments(ids)`.

- [ ] **Step 1: Write failing attachment bridge tests**

Cover success, refusal cleanup, empty input, ordered IDs, and session ownership:

```ts
expect(stageDraftAttachments({
  sessionId: 'session-1', files: [first, second], conversation, inputActions,
})).toBe(true);
expect(conversation.createDrafts).toHaveBeenCalledWith('session-1', [first, second]);
expect(inputActions.addAttachments).toHaveBeenCalledWith(['draft-1', 'draft-2']);

inputActions.addAttachments.mockReturnValue(false);
expect(stageDraftAttachments(input)).toBe(false);
expect(conversation.releaseDraftAttachments).toHaveBeenCalledWith(drafts);
```

- [ ] **Step 2: Run focused client tests and confirm the old API fails**

```bash
pnpm --filter @vectorai/plugin-dsh-space-client test -- dsh-draft-attachments.test.ts client.test.ts client-view.test.tsx
```

Expected: failure because only `createDraftImages`/`addImages` exist in VectorAI.

- [ ] **Step 3: Implement the latest-only bridge**

Use narrow local contracts:

```ts
export interface DshDraftAttachment { readonly id: string }
export interface DshDraftConversation {
  createDrafts(sessionId: string, files: readonly File[]): readonly DshDraftAttachment[];
  releaseDraftAttachments(drafts: readonly DshDraftAttachment[]): void;
}
export interface DshInputActions {
  addAttachments(ids: readonly string[]): boolean;
  setDraft(text: string): void;
  submit(): void;
}
```

Return false for no drafts or refused insertion. Release every newly created
draft on refusal. Do not probe for or call the old method names.

- [ ] **Step 4: Wire the Space view and update its tests**

Capture `conversation` as `DshDraftConversation`, pass `sessionId` into the
bridge, rename fixtures to `createDrafts`/`addAttachments`, and keep the existing
explicit import prompt plus one `submit()` only after successful staging.

- [ ] **Step 5: Run the Space client test and build cycle**

```bash
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm build:dsh-space
```

Expected: all Space client tests pass and the built client contains
`createDrafts`/`addAttachments` but no `createDraftImages`/`addImages`.

- [ ] **Step 6: Commit the attachment migration**

```bash
git add packages/plugin-dsh-space-client packages/plugin-dsh-space/lib
git commit -m "fix(space): migrate DSH draft attachments"
```

---

### Task 3: Move the recognition boundary to the new exact runtime

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts`
- Modify: `scripts/probe-dsh-recognition-runtime.mjs`
- Modify: `scripts/probe-dsh-recognition-runtime.test.mjs`
- Create: `scripts/check-dsh-source-runtime.mjs`
- Create: `scripts/check-dsh-source-runtime.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `checkDshSourceRuntime({ root, sourceDirectory })` returning exact version, tag commit, package versions, and required capability facts.
- Consumes: generated `DSH_RUNTIME_VERSION`, upstream package manifests/source tree, and the existing `DshRecognitionBridge`.

- [ ] **Step 1: Write failing source-runtime and recognition version tests**

The source check must reject a wrong root version, wrong git commit, mismatched
agent/LLM/session/subagent package versions, and missing latest attachment API.
The recognition adapter tests must expect `0.1.3-alpha.1` through the generated
constant and keep the existing capability, correlation, timeout, cancellation,
and disposal assertions.

- [ ] **Step 2: Run focused tests and confirm the old recognition baseline fails**

```bash
node --test scripts/check-dsh-source-runtime.test.mjs scripts/probe-dsh-recognition-runtime.test.mjs
pnpm vitest run packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts
```

- [ ] **Step 3: Implement exact source-runtime validation**

Validate:

```js
assert.equal(rootManifest.version, baseline.version);
assert.equal(await gitHead(sourceDirectory), baseline.commit);
for (const packageName of ['dsh-agent', 'dsh-llm', 'dsh-session', 'dsh-subagent']) {
  assert.equal(readPackageVersion(packageName), baseline.version);
}
assert.match(conversationServiceSource, /createDrafts\(sessionId:/);
assert.match(inputContractSource, /addAttachments\(ids:/);
```

Return structured facts without including environment variables, prompts,
credentials, attachments, or user data.

- [ ] **Step 4: Update the recognition adapter and probe**

Import `DSH_RUNTIME_VERSION` from the generated file, remove the duplicated
`model` assignment in `createAgentOptions`, and retain one forward implementation
of `ctx.subagents.start()`. The probe reads the authoritative manifest and checks
all runtime observations against its exact version.

- [ ] **Step 5: Run focused tests and rebuild Annotation**

```bash
node --test scripts/check-dsh-source-runtime.test.mjs scripts/probe-dsh-recognition-runtime.test.mjs
pnpm vitest run packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts
pnpm build:dsh-annotation
```

- [ ] **Step 6: Commit the recognition migration**

```bash
git add package.json scripts/check-dsh-source-runtime.mjs scripts/check-dsh-source-runtime.test.mjs scripts/probe-dsh-recognition-runtime.mjs scripts/probe-dsh-recognition-runtime.test.mjs packages/plugin-dsh-annotation-host packages/plugin-dsh-annotation/lib
git commit -m "fix(annotation): target DSH 0.1.3 runtime"
```

---

### Task 4: Upgrade the source installer and Launcher baseline

**Files:**
- Modify: `scripts/install-dsh-alpha-runtime.sh`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherCore.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherApp.swift`
- Modify: `apps/dsh-launcher-macos/Sources/UpdateChecker.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests.swift`
- Modify: `apps/dsh-launcher-macos/build.sh`
- Modify: `apps/dsh-launcher-macos/test.sh`
- Modify: `apps/dsh-launcher-macos/README.md`
- Modify: `docs/development.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/prd.md`

**Interfaces:**
- Produces: generated Swift `DSHRuntimeBaseline.version/tag/commit`, manifest-driven source installation, and an update selector capped at the tested baseline.
- Consumes: `scripts/dsh-runtime-manifest.mjs`, `DSHVersion`, `RuntimeRegistry`, and the existing side-by-side runtime installer.

- [ ] **Step 1: Write failing Launcher baseline and update-cap tests**

Assert that `SourceDSHResolver` accepts `0.1.3-alpha.1`, the bootstrap runtime is
the generated baseline, and tag selection cannot activate a version newer than
the tested maximum:

```swift
let selected = try GitHubUpdateChecker.selectLatest(
    from: payload,
    current: requireVersion("0.1.2-alpha.5"),
    maximum: requireVersion(DSHRuntimeBaseline.version)
)
try expect(selected?.version.description == "0.1.3-alpha.1", "must select tested baseline")
```

- [ ] **Step 2: Run Launcher tests and confirm the alpha.5 pin fails**

```bash
pnpm test:dsh-launcher
```

Expected: baseline assertions fail before source installation/build is updated.

- [ ] **Step 3: Make the installer consume the manifest**

Use the manifest CLI to load version, tag, and commit; clone that exact tag,
verify `git rev-parse HEAD` plus root/package versions with
`check-dsh-source-runtime.mjs`, then build using upstream's declared
`pnpm@11.7.0`. Keep versioned runtime directories and never overwrite another
version.

- [ ] **Step 4: Wire generated Swift and cap automatic activation**

Compile `DSHRuntimeBaseline.generated.swift` in both `build.sh` and `test.sh`.
Replace `pinnedVersion` and `bootstrapVersion` literals with the generated
constant. `GitHubUpdateChecker` may select only candidates satisfying:

```swift
current.accepts(candidate: version) && version <= maximum
```

The install callback must also reject a tag whose version differs from the
generated tested baseline.

- [ ] **Step 5: Update maintained documentation and run Launcher tests**

```bash
pnpm test:dsh-launcher
```

Document exact source version, official extension points, two-Bundle ordering,
and the registry SDK lag. Expected: Launcher tests and application build pass.

- [ ] **Step 6: Commit the Launcher migration**

```bash
git add scripts/install-dsh-alpha-runtime.sh apps/dsh-launcher-macos docs/development.md docs/tech-architecture.md docs/prd.md
git commit -m "build(launcher): install tested latest DSH"
```

---

### Task 5: Build the exact upstream runtime and verify both Bundles

**Files:**
- Modify when generated: `packages/plugin-dsh-space/lib/*`
- Modify when generated: `packages/plugin-dsh-annotation/lib/*`
- Create runtime evidence under ignored path: `.local/dsh-0.1.3-alpha.1-verification/*`

**Interfaces:**
- Produces: a built exact upstream runtime and local Space/Annotation artifacts validated against it.
- Consumes: `pnpm install:dsh-alpha`, `pnpm build:dsh-space`, `pnpm build:dsh-annotation`, `checkDshSourceRuntime`, and Bundle freshness checks.

- [ ] **Step 1: Install/build the exact source runtime**

```bash
pnpm install:dsh-alpha
```

Expected: installer prints the executable path under
`~/Library/Application Support/VectorAI/dsh-runtime/0.1.3-alpha.1` after exact
tag, commit, package, and API checks pass.

- [ ] **Step 2: Run repository and Bundle gates**

```bash
pnpm test
pnpm check
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm check:dsh-build-freshness
pnpm test:dsh-launcher
```

Expected: all commands pass.

- [ ] **Step 3: Verify built artifacts do not contain an old DSH implementation**

```bash
rg -n "createDraftImages|addImages|0\.1\.2-alpha\.5" packages/plugin-dsh-space/lib packages/plugin-dsh-annotation/lib
rg -n "from ['\"]@deepseek-ai/|require\(['\"]@deepseek-ai/" packages/plugin-dsh-space/lib packages/plugin-dsh-annotation/lib
```

Expected: first scan has no matches; the second shows only external host imports
where the server bundle requires DSH at runtime.

- [ ] **Step 4: Commit rebuilt local artifacts**

```bash
git add packages/plugin-dsh-space/lib packages/plugin-dsh-annotation/lib
git commit -m "build: rebuild plugins for DSH 0.1.3"
```

---

### Task 6: Run isolated runtime and real annotation acceptance

**Files:**
- Create runtime state only under ignored path: `.local/dsh-0.1.3-alpha.1-acceptance/`
- Modify only if a migration defect is found: the smallest owning source and its focused test.

**Interfaces:**
- Produces: acceptance evidence for startup, two-Bundle load, attachment drafting, partition confirmation, complete annotation, persistence, export, and session restoration.
- Consumes: exact built DSH CLI, local Bundle directories, existing production-shaped DXF/document fixtures, and the host-owned recognition contracts.

- [ ] **Step 1: Create isolated DSH state and install Bundles in order**

Set `DSH_HOME` to `.local/dsh-0.1.3-alpha.1-acceptance/home`, initialize the web
profile with the exact new CLI, then run:

```bash
dsh plugin --profile web add --ignore-workspace-root-check ./packages/plugin-dsh-space
dsh plugin --profile web add --ignore-workspace-root-check ./packages/plugin-dsh-annotation
```

using the exact CLI executable and isolated environment. Verify the profile
lists Space before Annotation and host fallbacks resolve `0.1.3-alpha.1`.

- [ ] **Step 2: Start DSH and run the recognition capability probe**

```bash
VECTORAI_DSH_CLI="$HOME/Library/Application Support/VectorAI/dsh-runtime/0.1.3-alpha.1/apps/cli/lib/bin.js" pnpm probe:dsh-recognition
```

Expected: `compatible=true`, exact agent/LLM/subagent versions, a completed
structured result, sanitized observations, and no prompt/persona output.

- [ ] **Step 3: Run deterministic production-shaped annotation contracts**

```bash
pnpm e2e:drawing-surface
pnpm e2e:dxf-smart-partition
pnpm e2e:golden-dimension-chain
pnpm test:cad-export
```

Expected: all existing golden and product-shaped contracts pass unchanged apart
from the DSH runtime fingerprint.

- [ ] **Step 4: Exercise the real web workflow**

Open the isolated web profile, create a new session, insert one DXF plus its
supporting document/image through the actual composer, confirm the partition
prompt once, complete the remaining dimension-chain/GD&T/tolerance/roughness
annotations, drag one supported annotation, save, export DXF, reopen the session,
and verify the drawing plus annotations persist.

Capture the runtime log and exported DXF under the ignored acceptance directory.
Do not alter the user's primary `~/.dsh` session state.

- [ ] **Step 5: Rehearse Session v2 restoration on copied state**

Copy the user's DSH home into a new ignored rehearsal directory, start the new
runtime against the copy, and verify one existing VectorAI session opens. If DSH
migrates it, restart the runtime and verify the same session opens a second time.
Retain the untouched source state and timestamped copy until acceptance ends.

- [ ] **Step 6: Run final verification and record repository state**

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: no uncommitted source changes, no publication receipt, and no user
state or `.local` evidence staged in git.
