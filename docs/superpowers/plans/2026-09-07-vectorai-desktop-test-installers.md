# VectorAI Desktop Test Installers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build self-contained Windows x64, macOS arm64, and macOS x64 VectorAI test installers that start the pinned DSH runtime with the two VectorAI Bundles and a ready-to-use “维构 AI” model.

**Architecture:** Add one Electron shell that owns a private DSH home, starts a bundled Node/DSH child process on loopback, and loads its token URL. A repository build script assembles a production-only DSH dependency closure, installs Space before Annotation into a staged profile, adds the matching vectorizer and Node runtime, and hands the immutable result to electron-builder. Native GitHub runners create the three installers from the same commit without publishing npm packages.

**Tech Stack:** TypeScript, Electron 44.2.0, electron-builder 26.15.3, Node.js 22.19.0, Vitest 3, DSH 0.1.3-alpha.1, pnpm 8.14.3 for this repository and Corepack pnpm 11.7.0 for DSH builds.

**Spec:** `docs/superpowers/specs/2026-09-07-vectorai-desktop-test-installers-design.md`

## Global Constraints

- Build `VectorAI-<version>-win-x64-setup.exe`, `VectorAI-<version>-mac-arm64.dmg`, and `VectorAI-<version>-mac-x64.dmg` only on their native target runners.
- Pin DSH to version `0.1.3-alpha.1`, tag `dsh-v0.1.3-alpha.1`, and commit `d347e703908d0406b7a7ef80e3a0e594d86b2215` from `release/dsh-plugins.json`.
- Pin the embedded Node runtime to `22.19.0`, satisfying DSH's `^22.19.0 || >=24.0.0` engine requirement.
- Build VectorAI runtime and Bundles only through `runtime:pack` and `pack:dsh-plugins`; never call a package-level publish command.
- Install exactly two VectorAI Bundles into the staged web profile, Space first and Annotation second; Annotation alone receives `--allow-build=tesseract.js`.
- End users do not install Node, Python, pnpm, DSH, or a platform vectorizer separately.
- Store mutable data under `~/Library/Application Support/VectorAI` on macOS and `%LOCALAPPDATA%\VectorAI` on Windows; never read or modify `~/.dsh`.
- Bind DSH only to `127.0.0.1` and load only the exact token URL emitted for the allocated port.
- Display the model as `维构 AI`; keep provider `deepseek-official`, model ID `doubao-seed-2.0-lite`, and base URL `https://ark.cn-beijing.volces.com/api/plan/v3`.
- Read the test key only from `VECTORAI_TEST_API_KEY` while assembling an installer. Never commit it or print it. Treat the generated installer resource as extractable.
- Preserve existing macOS developer launcher and DSH plugin release workflows.
- Packaging does not authorize npm publication or public installer release.

---

### Task 1: Desktop Runtime Contract and Workspace Skeleton

**Files:**
- Create: `apps/vectorai-desktop/package.json`
- Create: `apps/vectorai-desktop/tsconfig.json`
- Create: `apps/vectorai-desktop/src/runtime-contract.ts`
- Create: `apps/vectorai-desktop/src/runtime-contract.test.ts`
- Create: `apps/vectorai-desktop/resources/runtime/.gitkeep`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `release/dsh-plugins.json` as the single version and Bundle-order authority.
- Produces: `DesktopRuntimeManifest`, `parseDesktopRuntimeManifest(value)`, `runtimeTarget(platform, arch)`, and root scripts `build:desktop`, `test:desktop`, and `pack:desktop`.

- [ ] **Step 1: Write the failing runtime-contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseDesktopRuntimeManifest, runtimeTarget } from './runtime-contract.js';

describe('desktop runtime contract', () => {
  it('accepts the exact runtime inventory and ordered bundles', () => {
    expect(parseDesktopRuntimeManifest({
      schemaVersion: 1,
      vectoraiVersion: '0.1.0-alpha.1',
      dsh: { version: '0.1.3-alpha.1', commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215' },
      nodeVersion: '22.19.0',
      profile: 'web',
      bundles: ['@newwe/vectorai-plugin-dsh-space', '@newwe/vectorai-plugin-dsh-annotation'],
      platform: 'darwin', arch: 'arm64',
      entry: 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
    }).bundles).toEqual([
      '@newwe/vectorai-plugin-dsh-space',
      '@newwe/vectorai-plugin-dsh-annotation',
    ]);
  });

  it('rejects reversed bundles and unsupported targets', () => {
    expect(() => runtimeTarget('linux', 'x64')).toThrow('DESKTOP_RUNTIME_TARGET_UNSUPPORTED');
    expect(() => parseDesktopRuntimeManifest({ schemaVersion: 1, bundles: [
      '@newwe/vectorai-plugin-dsh-annotation', '@newwe/vectorai-plugin-dsh-space',
    ] })).toThrow('DESKTOP_RUNTIME_BUNDLE_ORDER_INVALID');
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run apps/vectorai-desktop/src/runtime-contract.test.ts`

Expected: FAIL because `runtime-contract.ts` does not exist.

- [ ] **Step 3: Add the desktop package and strict manifest parser**

Define this public contract in `runtime-contract.ts`:

```ts
export type DesktopPlatform = 'darwin' | 'win32';
export type DesktopArch = 'arm64' | 'x64';
export interface DesktopRuntimeManifest {
  schemaVersion: 1;
  vectoraiVersion: string;
  dsh: { version: string; commit: string };
  nodeVersion: '22.19.0';
  profile: 'web';
  bundles: readonly [
    '@newwe/vectorai-plugin-dsh-space',
    '@newwe/vectorai-plugin-dsh-annotation',
  ];
  platform: DesktopPlatform;
  arch: DesktopArch;
  entry: 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js';
}

export function parseDesktopRuntimeManifest(value: unknown): DesktopRuntimeManifest;
export function runtimeTarget(platform: NodeJS.Platform, arch: string):
  { platform: DesktopPlatform; arch: DesktopArch; id: 'darwin-arm64' | 'darwin-x64' | 'win32-x64' };
```

Add Electron 44.2.0 and electron-builder 26.15.3 to the workspace package, and add `yaml` 2.9.0 to the root development dependencies for build/config audits. Add `dist/desktop-runtime/`, `dist/desktop-installers/`, and `apps/vectorai-desktop/resources/runtime/*` to `.gitignore`, while retaining the `.gitkeep`. Root `pack:desktop` must delegate to the desktop package and must not alias any release command.

- [ ] **Step 4: Run the focused test and workspace typecheck**

Run: `pnpm vitest run apps/vectorai-desktop/src/runtime-contract.test.ts && pnpm --filter @vectorai/desktop typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add .gitignore package.json pnpm-lock.yaml apps/vectorai-desktop
git commit -m "feat: define desktop runtime contract"
```

### Task 2: First-Launch Settings and Credential Preparation

**Files:**
- Create: `apps/vectorai-desktop/resources/default-settings.yaml`
- Create: `apps/vectorai-desktop/src/user-home.ts`
- Create: `apps/vectorai-desktop/src/user-home.test.ts`
- Create: `scripts/prepare-desktop-credential.mjs`
- Create: `scripts/prepare-desktop-credential.test.mjs`

**Interfaces:**
- Consumes: Electron `app.getPath('userData')`, packaged `profile-seed/profiles`, packaged `default-settings.yaml`, the desktop runtime version, and build environment variable `VECTORAI_TEST_API_KEY`.
- Produces: `initializeUserHome({ userData, profileSeedPath, templatePath, runtimeVersion }): Promise<{ dshHome: string; logs: string }>` and generated `dist/desktop-runtime/<target>/secrets/vectorai-test-api-key`.

- [ ] **Step 1: Write failing bootstrap and secret-preparation tests**

```ts
it('creates settings once and preserves later user edits', async () => {
  const first = await initializeUserHome({ userData, profileSeedPath, templatePath, runtimeVersion: 'one' });
  await writeFile(join(first.dshHome, 'settings.yaml'), 'user-owned: true\n');
  await initializeUserHome({ userData, profileSeedPath, templatePath, runtimeVersion: 'two' });
  expect(await readFile(join(first.dshHome, 'settings.yaml'), 'utf8')).toBe('user-owned: true\n');
  expect(await readFile(join(first.dshHome, '.vectorai-profile-version'), 'utf8')).toBe('two\n');
});
```

```js
it('fails without a key and never prints the supplied key', () => {
  expect(() => prepareCredential({ key: '', output })).toThrow('VECTORAI_TEST_API_KEY_REQUIRED');
  prepareCredential({ key: 'test-secret-value', output });
  expect(capturedOutput).not.toContain('test-secret-value');
});
```

- [ ] **Step 2: Run both tests and verify they fail**

Run: `pnpm vitest run apps/vectorai-desktop/src/user-home.test.ts scripts/prepare-desktop-credential.test.mjs`

Expected: FAIL because the bootstrap and credential functions are missing.

- [ ] **Step 3: Implement idempotent user-home initialization**

The template must contain exactly this model entry, plus `maxTokens: 131072`, `contextWindow: 262144`, `inputModalities: [text, image]`, and `reasoningEffort: high`:

```yaml
llm-deepseek:
  apiKeyEnv: VECTORAI_TEST_API_KEY
  baseURL: https://ark.cn-beijing.volces.com/api/plan/v3
  maxTokens: 131072
  models:
    - id: doubao-seed-2.0-lite
      name: 维构 AI
      contextWindow: 262144
      inputModalities: [text, image]
agent-default-model:
  provider: deepseek-official
  model: doubao-seed-2.0-lite
  reasoningEffort: high
```

`initializeUserHome` creates `<userData>/dsh-home`, `<userData>/logs`, and `<userData>/workspace`. It copies settings only when `settings.yaml` is absent. On first launch and each desktop runtime version change, it replaces only `<dsh-home>/profiles` from the immutable packaged profile seed using a sibling temporary directory plus atomic rename, then writes `.vectorai-profile-version`; it preserves `settings.yaml`, `.credentials.yaml`, sessions, attachments, storages, and `vectorai/`. It must never inspect `homedir()/.dsh`.

- [ ] **Step 4: Implement build-time credential materialization**

Export this testable API from `prepare-desktop-credential.mjs`:

```js
export async function prepareCredential({ key, output }) {
  const normalized = key.trim();
  if (!normalized) throw new Error('VECTORAI_TEST_API_KEY_REQUIRED');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, normalized, { mode: 0o600 });
}
```

The executable entry reads the key from `process.env.VECTORAI_TEST_API_KEY`; console output may contain only the destination path and byte count.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run apps/vectorai-desktop/src/user-home.test.ts scripts/prepare-desktop-credential.test.mjs`

Expected: PASS, including preservation of existing settings and absence of the fixture key from captured output.

- [ ] **Step 6: Commit first-launch configuration**

```bash
git add apps/vectorai-desktop scripts/prepare-desktop-credential.mjs scripts/prepare-desktop-credential.test.mjs
git commit -m "feat: bootstrap desktop model settings"
```

### Task 3: Owned DSH Process Lifecycle

**Files:**
- Create: `apps/vectorai-desktop/src/process-manager.ts`
- Create: `apps/vectorai-desktop/src/process-manager.test.ts`
- Create: `apps/vectorai-desktop/src/ready-url.ts`
- Create: `apps/vectorai-desktop/src/ready-url.test.ts`

**Interfaces:**
- Consumes: bundled Node executable, DSH entry, private DSH home, workspace path, log path, and test key.
- Produces: `DSHProcessManager.start(): Promise<URL>`, `DSHProcessManager.stop(): Promise<void>`, `findReadyUrl(output, expectedPort): URL | undefined`, and `allocateLoopbackPort(): Promise<number>`.

- [ ] **Step 1: Write failing parser and lifecycle tests with a fake DSH child**

```ts
it('accepts only the token URL for the allocated loopback port', () => {
  const text = [
    'dsh web: http://localhost:3080/?token=wrong-host',
    'dsh web: http://127.0.0.1:3079/?token=wrong-port',
    'dsh web: http://127.0.0.1:3080/?token=ready-token',
  ].join('\n');
  expect(findReadyUrl(text, 3080)?.href).toBe('http://127.0.0.1:3080/?token=ready-token');
});

it('passes private state and credential only to its child and stops its tree', async () => {
  const manager = fixtureManager({ fakeDsh: 'ready-then-wait' });
  await expect(manager.start()).resolves.toMatchObject({ hostname: '127.0.0.1' });
  expect(await readFixtureEnvironment()).toMatchObject({ DSH_HOME: fixtureHome, VECTORAI_TEST_API_KEY: fixtureKey });
  await manager.stop();
  expect(await fixtureTreeIsAlive()).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm vitest run apps/vectorai-desktop/src/ready-url.test.ts apps/vectorai-desktop/src/process-manager.test.ts`

Expected: FAIL because the parser and process manager are missing.

- [ ] **Step 3: Implement port allocation and strict readiness parsing**

Allocate a server on `127.0.0.1` with port `0`, record its assigned port, close it, then start DSH immediately. Parse incremental stdout/stderr with a bounded 1 MiB buffer and a 45-second timeout. Accept only `http://127.0.0.1:<allocated>/?token=<non-empty>`.

- [ ] **Step 4: Implement current-run and stale-process cleanup**

Start the child with arguments:

```ts
['dsh/node_modules/@deepseek-ai/dsh/lib/bin.js', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open']
```

Set `cwd` to `<userData>/workspace`, `DSH_HOME` to `<userData>/dsh-home`, `VECTORAI_TEST_API_KEY` from the packaged credential, and `DSH_TELEMETRY_DISABLED=1`. Persist `owned-process.json` containing PID, executable path, DSH entry path, port, and launch timestamp. Before killing a stale PID, compare its executable and command line with the record using `ps -p <pid> -o command=` on macOS or a PowerShell CIM query on Windows; delete mismatched records without killing. Stop the owned tree with a process-group `SIGTERM`/`SIGKILL` fallback on macOS and `taskkill /PID <pid> /T /F` on Windows.

- [ ] **Step 5: Run lifecycle tests**

Run: `pnpm vitest run apps/vectorai-desktop/src/ready-url.test.ts apps/vectorai-desktop/src/process-manager.test.ts`

Expected: PASS for valid readiness, rejection of spoofed URLs, timeout cleanup, normal stop, and stale-record mismatch.

- [ ] **Step 6: Commit process ownership**

```bash
git add apps/vectorai-desktop/src
git commit -m "feat: manage the embedded DSH process"
```

### Task 4: Electron Window and Startup Experience

**Files:**
- Create: `apps/vectorai-desktop/src/main.ts`
- Create: `apps/vectorai-desktop/src/navigation.ts`
- Create: `apps/vectorai-desktop/src/navigation.test.ts`
- Create: `apps/vectorai-desktop/src/loading.html`
- Create: `apps/vectorai-desktop/src/error-page.ts`
- Create: `apps/vectorai-desktop/src/error-page.test.ts`

**Interfaces:**
- Consumes: `initializeUserHome`, `parseDesktopRuntimeManifest`, and `DSHProcessManager`.
- Produces: the executable Electron main process and `isAllowedInAppNavigation(candidate, readyOrigin): boolean`.

- [ ] **Step 1: Write failing navigation and redaction tests**

```ts
it('keeps only the ready loopback origin in the app', () => {
  const origin = new URL('http://127.0.0.1:3080/?token=secret');
  expect(isAllowedInAppNavigation(new URL('http://127.0.0.1:3080/session/1'), origin)).toBe(true);
  expect(isAllowedInAppNavigation(new URL('https://example.com'), origin)).toBe(false);
});

it('renders a useful error without credentials or token URLs', () => {
  const html = renderStartupError(new Error('key=secret token=abc'), '/tmp/vectorai.log');
  expect(html).toContain('/tmp/vectorai.log');
  expect(html).not.toMatch(/secret|token=abc/);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run apps/vectorai-desktop/src/navigation.test.ts apps/vectorai-desktop/src/error-page.test.ts`

Expected: FAIL because the window helpers are missing.

- [ ] **Step 3: Implement the BrowserWindow security and lifecycle**

Create one maximized `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and no preload bridge. Load `loading.html`, validate the packaged manifest and secret, initialize the private home, start DSH, then load the ready URL. Open external HTTP(S) destinations with `shell.openExternal`; deny unexpected `file:`, `javascript:`, non-ready loopback origins, popups, and permission requests. Preserve DSH's normal browser file upload and download behavior.

- [ ] **Step 4: Wire deterministic shutdown and startup errors**

On `before-quit`, await `DSHProcessManager.stop()` once. If validation or startup fails, stop any child, keep the window open on a local error page, and show the redacted log path plus a “重试启动” button implemented by relaunching the application. Do not expose a new workflow status badge inside DSH.

- [ ] **Step 5: Run desktop tests and a development boot**

Run: `pnpm --filter @vectorai/desktop test && VECTORAI_DESKTOP_RUNTIME_DIR="$PWD/dist/desktop-runtime/darwin-arm64" pnpm --filter @vectorai/desktop dev`

Expected: tests PASS; the development app shows loading, then the DSH web UI, and quitting releases the selected port.

- [ ] **Step 6: Commit the Electron shell**

```bash
git add apps/vectorai-desktop
git commit -m "feat: add the VectorAI desktop shell"
```

### Task 5: Production DSH Runtime Assembler

**Files:**
- Create: `scripts/desktop-runtime-plan.mjs`
- Create: `scripts/desktop-runtime-plan.test.mjs`
- Create: `scripts/build-desktop-runtime.mjs`
- Create: `scripts/verify-desktop-runtime.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: clean repository checkout, `release/dsh-plugins.json`, `DSH_SOURCE_DIR` only as an explicit local-development source override, `runtime:pack`, `pack:dsh-plugins`, and Node 22.19.0 official archives.
- Produces: `dist/desktop-runtime/<target>/runtime-manifest.json`, `node/`, `dsh/`, `profile-seed/profiles/`, `secrets/`, and `licenses/`.

- [ ] **Step 1: Write failing assembly-plan tests**

```js
it('uses the approved build and install sequence', () => {
  expect(createDesktopRuntimePlan(release, 'darwin-arm64').steps.map(step => step.id)).toEqual([
    'verify-clean-source', 'build-vectorizer', 'pack-vectorai-bundles', 'checkout-dsh',
    'build-dsh', 'pack-dsh-families', 'install-dsh-closure', 'install-space',
    'install-annotation', 'write-settings', 'write-manifest', 'audit-runtime',
  ]);
});
```

Also assert that Space has no `--allow-build` flag, Annotation has only `--allow-build=tesseract.js`, and the target map contains only `darwin-arm64`, `darwin-x64`, and `win32-x64`.

- [ ] **Step 2: Run the plan tests and verify they fail**

Run: `pnpm vitest run scripts/desktop-runtime-plan.test.mjs`

Expected: FAIL because the plan module is missing.

- [ ] **Step 3: Implement exact source and Node acquisition**

Clone DSH by the manifest tag into a temporary directory, verify the full commit, run its source-runtime checks, install with Corepack pnpm 11.7.0, and build it. For local iteration, accept `DSH_SOURCE_DIR` only after the same version/commit/build validation. Download the exact official Node 22.19.0 archive for the native target and verify it against the matching line from Node's official `SHASUMS256.txt`; never search `PATH` for an end-user runtime.

- [ ] **Step 4: Assemble a production-only DSH closure**

Inside the verified DSH checkout, run its official `release:pack --family vendor` and `release:pack --family dsh`. Create `dsh/package.json` whose dependencies map every packed package name to its local tarball, then run `npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --package-lock=false`. Use the staged Node binary to verify `@deepseek-ai/dsh/lib/bin.js --version` equals `0.1.3-alpha.1`. Do not copy the DSH `.git`, source trees, tests, caches, or development `node_modules`.

- [ ] **Step 5: Build and install VectorAI artifacts in the required order**

Run `pnpm runtime:pack`, then `pnpm pack:dsh-plugins`. Initialize a temporary assembly home as `DSH_HOME`, and invoke the staged Node plus DSH entry twice:

```text
plugin --profile web add <absolute-space-tarball>
plugin --profile web add --allow-build=tesseract.js <absolute-annotation-tarball>
```

The package manager used during this build remains a build dependency; no pnpm executable is required after the composed profile exists. Copy only the resulting `profiles/` tree to `profile-seed/profiles/`; mutable settings and session directories never enter the seed.

- [ ] **Step 6: Add the runtime audit**

`verify-desktop-runtime.mjs` must assert exact manifest values, Node and DSH versions, Bundle order from `--dump-config`, the target vectorizer `runtime.json`, vectorizer health with a PATH that contains no Python, absence of source/development directories, license inventory, no absolute builder path, and no key-like text outside `secrets/vectorai-test-api-key`. Print paths, versions, file counts, and total bytes only.

- [ ] **Step 7: Run the current-platform assembler and audit**

Run: `VECTORAI_TEST_API_KEY=fixture-key-for-local-build pnpm build:desktop-runtime && pnpm verify:desktop-runtime`

Expected: PASS; `runtime-manifest.json` reports the native target, DSH 0.1.3-alpha.1, Node 22.19.0, and the two Bundles in the required order. The resulting tree is materially smaller than the 1.6 GB development checkout.

- [ ] **Step 8: Commit the assembler**

```bash
git add package.json scripts/desktop-runtime-plan.mjs scripts/desktop-runtime-plan.test.mjs scripts/build-desktop-runtime.mjs scripts/verify-desktop-runtime.mjs
git commit -m "build: assemble the desktop DSH runtime"
```

### Task 6: Native Installer Configuration

**Files:**
- Create: `apps/vectorai-desktop/electron-builder.yml`
- Create: `apps/vectorai-desktop/build/entitlements.mac.plist`
- Create: `apps/vectorai-desktop/build/installer.nsh`
- Create: `apps/vectorai-desktop/README.md`
- Modify: `apps/vectorai-desktop/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: compiled Electron files and `dist/desktop-runtime/<target>`.
- Produces: the three filenames defined in Global Constraints under `dist/desktop-installers/`.

- [ ] **Step 1: Write a failing configuration audit**

Add `scripts/desktop-builder-config.test.mjs` that parses `electron-builder.yml` and asserts `appId: ai.weigou.vectorai`, `productName: VectorAI`, `asar: true`, runtime under `extraResources`, mac targets `dmg` for `arm64` and `x64`, Windows target `nsis` for `x64`, per-user Windows install, and artifact-name templates matching the spec.

- [ ] **Step 2: Run the configuration test and verify it fails**

Run: `pnpm vitest run scripts/desktop-builder-config.test.mjs`

Expected: FAIL because the builder configuration is missing.

- [ ] **Step 3: Implement installer metadata and resource layout**

Keep Electron application code in ASAR and the mutable executable runtime under `resources/runtime`. Set macOS minimum system version 13, hardened runtime configuration ready for later signing, and `identity: null` for the closed test build. Configure NSIS as a per-user, non-elevated installer in `%LOCALAPPDATA%`. Copy the runtime manifest, Node, DSH closure, composed profile seed, generated credential, licenses, and notices through explicit `extraResources` entries.

- [ ] **Step 4: Add prepack and artifact checks**

`pack:desktop` must run desktop compilation, `verify:desktop-runtime`, then electron-builder for only the current native target. After build, assert there is exactly one expected artifact and that its name contains the VectorAI version and architecture. The installer command must fail if the credential resource is absent.

- [ ] **Step 5: Build and inspect the native macOS installer**

Run: `VECTORAI_TEST_API_KEY=fixture-key-for-local-build pnpm pack:desktop`

Expected on Apple Silicon: `dist/desktop-installers/VectorAI-0.1.0-alpha.1-mac-arm64.dmg` exists; mounting it reveals one `VectorAI.app` whose resources contain the audited arm64 runtime.

- [ ] **Step 6: Commit installer configuration**

```bash
git add package.json pnpm-lock.yaml apps/vectorai-desktop scripts/desktop-builder-config.test.mjs
git commit -m "build: package native VectorAI installers"
```

### Task 7: Native Three-Target CI Packaging

**Files:**
- Create: `.github/workflows/vectorai-desktop-test-build.yml`
- Create: `scripts/verify-desktop-artifact-set.mjs`
- Create: `scripts/verify-desktop-artifact-set.test.mjs`

**Interfaces:**
- Consumes: manual workflow input `version`, repository source, and secret `VECTORAI_TEST_API_KEY`.
- Produces: one private GitHub Actions artifact containing all three audited installers and `desktop-artifacts.json`.

- [ ] **Step 1: Write a failing artifact-inventory test**

```js
it('requires exactly the three native installers from one commit', () => {
  expect(verifyDesktopArtifacts(records, { version: '0.1.0-alpha.1', commit: 'abc' })
    .map(record => record.target)).toEqual(['darwin-arm64', 'darwin-x64', 'win32-x64']);
  expect(() => verifyDesktopArtifacts(records.slice(1), expected)).toThrow('DESKTOP_ARTIFACT_MISSING');
});
```

- [ ] **Step 2: Run the inventory test and verify it fails**

Run: `pnpm vitest run scripts/verify-desktop-artifact-set.test.mjs`

Expected: FAIL because the inventory verifier is missing.

- [ ] **Step 3: Implement the manual native matrix workflow**

Use `workflow_dispatch` with required version and no publish switch. Matrix entries are `macos-14/darwin-arm64`, `macos-15-intel/darwin-x64`, and `windows-2025/win32-x64`. Every job checks out the same commit, installs pnpm 8.14.3, Node 22, and Python 3.13.2, runs `pnpm install --frozen-lockfile --ignore-scripts`, verifies the input version equals `release/dsh-plugins.json`, builds the runtime, packages one installer, hashes it, and uploads an architecture-specific artifact. Pass the secret only to the runtime/package step.

- [ ] **Step 4: Aggregate and audit all target artifacts**

The final Ubuntu job downloads all three outputs, verifies exact filename/version/target coverage, SHA-256 digests, nonzero sizes, source commit equality, and absence of unexpected files, then writes `desktop-artifacts.json`. Upload the aggregate with a 7-day retention and a name containing `closed-test`; do not create a GitHub Release and do not publish npm packages.

- [ ] **Step 5: Validate workflow syntax and tests**

Run: `pnpm vitest run scripts/verify-desktop-artifact-set.test.mjs scripts/desktop-builder-config.test.mjs`

Expected: PASS and the workflow contains neither `npm publish` nor `release:dsh-plugins`.

- [ ] **Step 6: Commit CI packaging**

```bash
git add .github/workflows/vectorai-desktop-test-build.yml scripts/verify-desktop-artifact-set.mjs scripts/verify-desktop-artifact-set.test.mjs
git commit -m "ci: build closed-test desktop installers"
```

### Task 8: End-to-End Desktop Acceptance

**Files:**
- Create: `apps/vectorai-desktop/src/desktop-smoke.test.ts`
- Create: `scripts/desktop-clean-machine-checklist.md`
- Modify: `apps/vectorai-desktop/README.md`

**Interfaces:**
- Consumes: installed application, generated installer, `external-golden-001` fixtures, and an independent CAD viewer.
- Produces: automated boot/quit evidence plus a completed manual acceptance record for each target.

- [ ] **Step 1: Add a packaged-runtime smoke test**

Launch the packaged Electron executable with a fresh temporary user-data directory and a fake OpenAI-compatible loopback endpoint substituted through a test-only settings file. Assert the model list contains `维构 AI`, the fake endpoint receives wire model `doubao-seed-2.0-lite`, the DSH page becomes ready, a session survives relaunch, and the recorded DSH PID is gone after quit.

- [ ] **Step 2: Run automated desktop acceptance**

Run: `pnpm --filter @vectorai/desktop test:packaged`

Expected: PASS without system Node, Python, pnpm, or ambient `~/.dsh` in the spawned process environment.

- [ ] **Step 3: Execute the closed-test workflow with the temporary key**

Add `VECTORAI_TEST_API_KEY` as an Actions secret from the dedicated low-budget test project, then manually run `VectorAI desktop closed-test build` for `0.1.0-alpha.1`. Download the aggregate artifact and verify `desktop-artifacts.json` covers the three installers from the exact source commit.

- [ ] **Step 4: Complete clean-machine checks on all three targets**

For Windows x64, macOS arm64, and macOS x64, record PASS/FAIL for: install without developer tools; first launch; visible model name `维构 AI`; one real model response; import the `external-golden-001` DXF and technical document; perform recognition, partition, annotation, and confirmation; export DXF; inspect critical entities in the independent CAD viewer; quit with no listener or DSH/Node child; relaunch with session/settings intact; and overwrite-install with data retained.

- [ ] **Step 5: Audit secret and license boundaries**

Run repository and ordinary-log scans for the real key and confirm zero matches. Inspect each installed application for DSH, Node, Electron, VectorAI, and third-party notices. Confirm the key occurs only in the intentionally extractable packaged credential resource and never in Git, workflow logs, manifests, receipts, or crash output.

- [ ] **Step 6: Run final repository verification**

Run: `pnpm test:desktop && pnpm check:dsh-runtime-baseline && pnpm test:cad-export && git diff --check`

Expected: PASS. No public release or npm publication is performed.

- [ ] **Step 7: Commit acceptance documentation**

```bash
git add apps/vectorai-desktop scripts/desktop-clean-machine-checklist.md
git commit -m "test: document desktop installer acceptance"
```
