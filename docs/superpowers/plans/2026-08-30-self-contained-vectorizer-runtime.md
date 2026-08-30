# Self-contained Vectorizer Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship platform-matched, self-contained Python vectorization runtimes behind the two public VectorAI DSH bundles and make every package/release operation reproducible.

**Architecture:** The space Host resolves one exact-version platform runtime npm package and spawns its bundled PyInstaller executable through the existing JSON-lines protocol. A release manifest and scripts own version synchronization, artifact auditing, publication order, npm scan waiting, clean-profile DSH installation, and packaged-vectorizer smoke verification.

**Tech Stack:** TypeScript, Node.js, pnpm, Vitest, Python 3.12, PyInstaller, NumPy, OpenCV Headless, scikit-image, GitHub Actions, npm public scoped packages.

**Spec:** `docs/superpowers/specs/2026-08-30-self-contained-vectorizer-runtime-design.md`

## Global Constraints

- User-facing DSH installation remains exactly two Bundle packages under `@newwe`.
- Runtime packages never declare `dsh.bundle` and are never installed directly by users.
- Production execution never falls back to system Python, pip, or a user virtual environment.
- Runtime packages and both Bundle packages use one exact release version.
- Supported targets are darwin-arm64, darwin-x64, linux-arm64, linux-x64, and win32-x64.
- Publication order is runtime packages, space Bundle, then annotation Bundle.
- Existing uncommitted product changes are preserved and are not included in task commits unless a touched file necessarily overlaps them.

---

### Task 1: Define runtime identity, resolution, and stable failures

**Files:**
- Create: `packages/plugin-dsh-space-host/src/vectorizer-runtime.ts`
- Create: `packages/plugin-dsh-space-host/src/vectorizer-runtime.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/vectorizer.ts`
- Modify: `packages/plugin-dsh-space-host/src/local-python-vectorizer.ts`
- Modify: `packages/plugin-dsh-space-host/src/index.ts`

**Interfaces:**
- Produces: `resolveVectorizerRuntime(options?): Promise<ResolvedVectorizerRuntime>`.
- Produces: `ResolvedVectorizerRuntime { executablePath, manifest, source }`.
- Consumes: runtime-package `runtime.json` described in Task 3.

- [ ] **Step 1: Write failing platform-resolution tests**

  Test an injected resolver rather than the machine package store:

  ```ts
  expect(runtimePackageName('darwin', 'arm64'))
    .toBe('@newwe/vectorai-vectorizer-darwin-arm64');
  expect(() => runtimePackageName('aix', 'ppc64'))
    .toThrow('VECTORAI_VECTORIZER_PLATFORM_UNSUPPORTED aix-ppc64');
  ```

  Add cases for every supported pair, a missing optional package, invalid JSON,
  a platform mismatch, an executable outside the package directory, and a
  protocol/pipeline mismatch.

- [ ] **Step 2: Run the resolver tests and verify the missing module fails**

  Run:

  ```sh
  pnpm vitest run packages/plugin-dsh-space-host/src/vectorizer-runtime.test.ts
  ```

  Expected: FAIL because `vectorizer-runtime.ts` does not exist.

- [ ] **Step 3: Implement the runtime resolver**

  Define exact mappings and validate this manifest shape:

  ```ts
  export interface VectorizerRuntimeManifest {
    releaseVersion: string;
    protocolVersion: 'vectorai-vectorizer-1';
    pipelineVersion: 'clean-line-v5';
    platform: NodeJS.Platform;
    arch: string;
    pythonVersion: string;
    dependencies: Record<'numpy' | 'opencv-python-headless' | 'scikit-image', string>;
    executable: string;
    treeSha256: string;
  }
  ```

  Resolve package manifests with `createRequire(import.meta.url).resolve()`. An
  explicit `VECTORAI_VECTORIZER_RUNTIME` override returns `source: 'override'`
  and still requires the worker handshake. Do not inspect `PATH`.

- [ ] **Step 4: Generalize the worker process to an executable**

  Rename `LocalPythonVectorizerProcess` to `LocalVectorizerProcess` and replace
  `{ pythonPath, scriptPath }` with:

  ```ts
  { executablePath: string; args?: string[]; timeoutMs: number }
  ```

  Spawn the executable directly. Preserve JSON-lines request IDs, cancellation,
  timeout, stderr truncation, and graceful shutdown.

- [ ] **Step 5: Make `LocalCleanLineVectorizer` use only the resolver**

  Remove `.local/vectorai/cv-venv`, `python3`, and source-script fallback logic.
  Resolve the runtime, create the process, validate its health response, then
  vectorize as before.

- [ ] **Step 6: Run focused TypeScript tests**

  ```sh
  pnpm vitest run \
    packages/plugin-dsh-space-host/src/vectorizer-runtime.test.ts \
    packages/plugin-dsh-space-host/src/local-vectorizer.integration.test.ts
  ```

  Expected: resolver tests PASS; integration test skips until a packaged runtime
  is supplied by Task 3.

- [ ] **Step 7: Commit the runtime boundary**

  ```sh
  git add packages/plugin-dsh-space-host/src/vectorizer-runtime.ts \
    packages/plugin-dsh-space-host/src/vectorizer-runtime.test.ts \
    packages/plugin-dsh-space-host/src/vectorizer.ts \
    packages/plugin-dsh-space-host/src/local-python-vectorizer.ts \
    packages/plugin-dsh-space-host/src/index.ts
  git commit -m "feat: resolve self-contained vectorizer runtimes"
  ```

### Task 2: Version and validate the packaged worker protocol

**Files:**
- Modify: `python/vectorai_vectorizer.py`
- Modify: `python/tests/test_vectorai_vectorizer.py`
- Create: `python/requirements-vectorization.lock`
- Modify: `python/requirements-vectorization.txt`

**Interfaces:**
- Consumes: `operation: "health"` JSON-lines request.
- Produces: `VectorizerHealth` matching Task 1's manifest protocol fields.

- [ ] **Step 1: Write failing health-metadata tests**

  Assert `health()` returns:

  ```python
  {
      "protocolVersion": "vectorai-vectorizer-1",
      "pipelineVersion": "clean-line-v5",
      "pythonVersion": "3.12.x",
      "dependencies": {
          "numpy": "...",
          "opencv-python-headless": "...",
          "scikit-image": "...",
      },
  }
  ```

  The test checks concrete installed values, not ellipses; the snippet only
  illustrates keys.

- [ ] **Step 2: Run the Python test and confirm it fails on missing metadata**

  ```sh
  .local/vectorai/cv-venv/bin/python -m pytest \
    python/tests/test_vectorai_vectorizer.py -q
  ```

- [ ] **Step 3: Implement health metadata without changing vectorization output**

  Use `sys.version_info` and `importlib.metadata.version()` for dependency
  versions. Keep `PIPELINE_VERSION = "clean-line-v5"` and add
  `PROTOCOL_VERSION = "vectorai-vectorizer-1"`.

- [ ] **Step 4: Replace ranges with an exact build lock**

  Keep `requirements-vectorization.txt` as human-readable direct requirements
  and generate `requirements-vectorization.lock` with exact versions and hashes
  for Python 3.12. The lock includes PyInstaller as a build-only dependency and
  records all transitive wheels used by the five runners.

- [ ] **Step 5: Run the complete Python vectorizer suite**

  ```sh
  .local/vectorai/cv-venv/bin/python -m pytest python/tests -q
  ```

  Expected: PASS with existing geometry results unchanged.

- [ ] **Step 6: Commit the protocol and lock**

  ```sh
  git add python/vectorai_vectorizer.py python/tests/test_vectorai_vectorizer.py \
    python/requirements-vectorization.txt python/requirements-vectorization.lock
  git commit -m "feat: version vectorizer runtime protocol"
  ```

### Task 3: Build and package the current platform runtime

**Files:**
- Create: `python/vectorai_vectorizer.spec`
- Create: `scripts/vectorizer-runtime-config.mjs`
- Create: `scripts/build-vectorizer-runtime.mjs`
- Create: `scripts/vectorizer-runtime-audit.mjs`
- Create: `scripts/vectorizer-runtime-audit.test.ts`
- Create: `packages/vectorizer-runtime-template/package.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `dist/vectorizer-runtime/<platform>-<arch>/package/`.
- Produces: one audited `@newwe/vectorai-vectorizer-<platform>-<arch>` tarball.

- [ ] **Step 1: Write failing runtime audit tests**

  Cover accepted metadata, wrong platform, wrong release, executable traversal,
  missing executable, changed file digest, unexpected `dsh.bundle`, and
  unpinned dependencies.

- [ ] **Step 2: Run the audit tests and verify failure**

  ```sh
  pnpm vitest run scripts/vectorizer-runtime-audit.test.ts
  ```

- [ ] **Step 3: Add the PyInstaller one-directory spec**

  Set `console=True`, include the OpenCV and scikit-image data collected through
  PyInstaller hooks, exclude test packages, and name the executable
  `vectorai-vectorizer` (`vectorai-vectorizer.exe` on Windows).

- [ ] **Step 4: Implement deterministic package generation**

  `build-vectorizer-runtime.mjs` must:

  1. require Python 3.12;
  2. create a temporary virtual environment outside the repository;
  3. install only `requirements-vectorization.lock` with hashes;
  4. run Python tests;
  5. execute PyInstaller with clean work and dist directories;
  6. smoke-test `health` and one fixture vectorization;
  7. copy output into a generated npm package;
  8. generate a sorted file digest manifest and `runtime.json`;
  9. set package `os`, `cpu`, `files`, `license`, and `publishConfig.access`;
  10. run `pnpm pack` and the runtime audit.

- [ ] **Step 5: Add the local command**

  Add:

  ```json
  "runtime:pack": "node scripts/build-vectorizer-runtime.mjs"
  ```

- [ ] **Step 6: Build the current macOS arm64 runtime**

  ```sh
  pnpm runtime:pack
  ```

  Expected: one darwin-arm64 tarball and a successful health/vectorization smoke
  result while `PATH` excludes `python` and `python3` during the smoke step.

- [ ] **Step 7: Commit the runtime builder**

  ```sh
  git add python/vectorai_vectorizer.spec scripts/vectorizer-runtime-config.mjs \
    scripts/build-vectorizer-runtime.mjs scripts/vectorizer-runtime-audit.mjs \
    scripts/vectorizer-runtime-audit.test.ts \
    packages/vectorizer-runtime-template/package.json package.json .gitignore
  git commit -m "build: package vectorizer runtime binaries"
  ```

### Task 4: Connect platform runtimes to the space Bundle

**Files:**
- Modify: `packages/plugin-dsh-space/package.json`
- Modify: `packages/plugin-dsh-space/README.md`
- Modify: `scripts/build-dsh-space.mjs`
- Modify: `scripts/dsh-package-audit.mjs`
- Modify: `scripts/dsh-release-manifest.test.ts`
- Modify: `scripts/dsh-plugin-bundle-boundary.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: exact runtime package names and versions from release config.
- Produces: a space Bundle with five exact optional dependencies and no Python source.

- [ ] **Step 1: Change release tests to require platform packages**

  Assert the space manifest has all five `optionalDependencies` at the Bundle's
  exact version. Assert `files` excludes `lib/vectorai_vectorizer.py` and that
  package audit rejects Python source in Bundle tarballs.

- [ ] **Step 2: Run release tests and verify failure**

  ```sh
  pnpm vitest run scripts/dsh-release-manifest.test.ts \
    scripts/dsh-plugin-bundle-boundary.test.ts
  ```

- [ ] **Step 3: Update the Bundle manifest and build**

  Add exact optional dependencies, remove Python script copying from
  `build-dsh-space.mjs`, and remove the script from the Bundle `files` array.
  Keep only the `sharp` and `zod` regular dependencies.

- [ ] **Step 4: Tighten tarball audits**

  Validate platform-package coverage and exact-version equality. Reject `.py`,
  `.pyc`, local paths, source maps, workspace protocols, missing license, and
  unexpected lifecycle scripts in both DSH Bundle tarballs.

- [ ] **Step 5: Regenerate the lockfile and run packaging tests**

  ```sh
  pnpm install --lockfile-only
  pnpm vitest run scripts/dsh-release-manifest.test.ts \
    scripts/dsh-plugin-bundle-boundary.test.ts
  ```

- [ ] **Step 6: Commit Bundle integration**

  ```sh
  git add packages/plugin-dsh-space/package.json \
    packages/plugin-dsh-space/README.md scripts/build-dsh-space.mjs \
    scripts/dsh-package-audit.mjs scripts/dsh-release-manifest.test.ts \
    scripts/dsh-plugin-bundle-boundary.test.ts pnpm-lock.yaml
  git commit -m "build: attach platform runtimes to space plugin"
  ```

### Task 5: Make packaging and publication one guarded workflow

**Files:**
- Create: `release/dsh-plugins.json`
- Create: `scripts/set-dsh-release-version.mjs`
- Create: `scripts/wait-for-npm-package.mjs`
- Create: `scripts/verify-public-dsh-install.mjs`
- Create: `scripts/release-dsh-plugins.mjs`
- Modify: `scripts/prepare-dsh-plugin-release.mjs`
- Modify: `scripts/publish-dsh-plugins.mjs`
- Modify: `package.json`
- Create: `scripts/release-dsh-plugins.test.ts`

**Interfaces:**
- Produces: `pnpm release:dsh-plugins -- --version <semver> --tag <tag>`.
- Produces: `dist/releases/<version>/release-receipt.json`.

- [ ] **Step 1: Write failing release-state tests**

  Test clean-worktree enforcement, semver validation, unused npm versions,
  version synchronization, missing platform artifacts, publication ordering,
  scan polling timeout, two-command DSH install order, and resumable receipt
  behavior using injected command and registry adapters.

- [ ] **Step 2: Run the release tests and verify failure**

  ```sh
  pnpm vitest run scripts/release-dsh-plugins.test.ts
  ```

- [ ] **Step 3: Add one canonical release manifest**

  `release/dsh-plugins.json` records release version, DSH compatibility,
  protocol/pipeline versions, Python/build dependency versions, package names,
  target matrix, and npm tag. Scripts read this file rather than duplicating
  names or versions.

- [ ] **Step 4: Implement version synchronization**

  `set-dsh-release-version.mjs` updates both Bundle manifests, all generated
  runtime manifests, the annotation-to-space peer, and space optional
  dependencies in one atomic operation. It exits before writing if any target
  version already exists on npm.

- [ ] **Step 5: Implement package and publish orchestration**

  `pack:dsh-plugins` verifies the current-platform runtime and builds two Bundle
  tarballs without mutation. `release:dsh-plugins` requires all target tarballs,
  publishes in the required order, polls `npm pack <name>@<version>` until npm
  scanning finishes, and records every integrity and command result.

- [ ] **Step 6: Implement fresh-profile verification**

  Create a temporary `DSH_HOME`; run two separate `dsh plugin add` commands;
  assert space precedes annotation; dump the composed config; execute the
  installed runtime smoke fixture with `PATH` stripped of Python; remove the
  temporary home on success and retain it with its path in the receipt on failure.

- [ ] **Step 7: Run release workflow unit tests**

  ```sh
  pnpm vitest run scripts/release-dsh-plugins.test.ts \
    scripts/dsh-release-manifest.test.ts
  ```

- [ ] **Step 8: Commit the release orchestrator**

  ```sh
  git add release/dsh-plugins.json scripts/set-dsh-release-version.mjs \
    scripts/wait-for-npm-package.mjs scripts/verify-public-dsh-install.mjs \
    scripts/release-dsh-plugins.mjs scripts/release-dsh-plugins.test.ts \
    scripts/prepare-dsh-plugin-release.mjs scripts/publish-dsh-plugins.mjs \
    package.json
  git commit -m "build: automate DSH plugin releases"
  ```

### Task 6: Add the cross-platform build and publish workflow

**Files:**
- Create: `.github/workflows/vectorai-dsh-release.yml`
- Create: `scripts/verify-runtime-artifact-set.mjs`
- Create: `scripts/verify-runtime-artifact-set.test.ts`

**Interfaces:**
- Consumes: five runtime npm tarballs from one commit and version.
- Produces: verified artifacts passed to the guarded release command.

- [ ] **Step 1: Write failing artifact-set tests**

  Test a complete matrix and reject duplicate targets, missing targets, differing
  commits, differing versions, differing protocols, and changed digests.

- [ ] **Step 2: Run the artifact-set tests and verify failure**

  ```sh
  pnpm vitest run scripts/verify-runtime-artifact-set.test.ts
  ```

- [ ] **Step 3: Implement artifact-set validation**

  Read `runtime.json` and tarball digests without executing binaries. Emit one
  sorted JSON inventory used by the publish job and release receipt.

- [ ] **Step 4: Add a manual GitHub Actions release workflow**

  `workflow_dispatch` accepts `version`, `tag`, and `publish`. Matrix jobs use
  native macOS arm64/x64, Linux arm64/x64, and Windows x64 runners. Each runs
  `runtime:pack`, uploads its audited tarball and metadata, and never receives
  npm credentials. The final job downloads all artifacts, verifies the set,
  packs the DSH Bundles, and only publishes when `publish` is true.

- [ ] **Step 5: Validate workflow syntax and scripts locally**

  ```sh
  pnpm vitest run scripts/verify-runtime-artifact-set.test.ts
  node scripts/verify-runtime-artifact-set.mjs --fixtures scripts/test-fixtures/runtime-artifacts
  ```

- [ ] **Step 6: Commit CI release support**

  ```sh
  git add .github/workflows/vectorai-dsh-release.yml \
    scripts/verify-runtime-artifact-set.mjs \
    scripts/verify-runtime-artifact-set.test.ts
  git commit -m "ci: build platform vectorizer runtimes"
  ```

### Task 7: Record the permanent operator workflow and verify a local package

**Files:**
- Create: `docs/releasing-dsh-plugins.md`
- Create: `AGENTS.md`
- Modify: `docs/development.md`
- Modify: `packages/plugin-dsh-annotation/README.md`

**Interfaces:**
- Produces: the authoritative human and agent release runbook.

- [ ] **Step 1: Write the release runbook**

  Document prerequisites, exact pack and release commands, why installation is
  two commands, version/tag policy, npm scan delays, partial-release recovery,
  artifact and receipt locations, trusted-publisher setup, token safety, and
  unsupported-platform diagnostics. Do not document manual publish commands as
  an alternative to the release script.

- [ ] **Step 2: Add repository agent instructions**

  `AGENTS.md` directs every request containing “打包”, “发布”, “release”, “publish”,
  or a DSH plugin version bump to read `docs/releasing-dsh-plugins.md` and use
  only the authoritative scripts. It also forbids system-Python fallback and
  publishing with a dirty worktree.

- [ ] **Step 3: Update user installation documentation**

  Show two separate commands and state that the platform vectorizer runtime is
  selected automatically. Remove all Python/pip prerequisites from end-user
  instructions while retaining contributor build prerequisites in the runbook.

- [ ] **Step 4: Run current-platform package verification**

  ```sh
  pnpm runtime:pack
  pnpm pack:dsh-plugins
  node scripts/verify-public-dsh-install.mjs --tarballs dist/npm
  ```

  Expected: clean temporary DSH profile, correct Bundle order, successful config
  dump, and real image vectorization with no system Python visible in `PATH`.

- [ ] **Step 5: Run the focused release test suite**

  ```sh
  pnpm vitest run \
    packages/plugin-dsh-space-host/src/vectorizer-runtime.test.ts \
    scripts/vectorizer-runtime-audit.test.ts \
    scripts/dsh-release-manifest.test.ts \
    scripts/dsh-plugin-bundle-boundary.test.ts \
    scripts/release-dsh-plugins.test.ts \
    scripts/verify-runtime-artifact-set.test.ts
  ```

- [ ] **Step 6: Commit the permanent workflow documentation**

  ```sh
  git add docs/releasing-dsh-plugins.md AGENTS.md docs/development.md \
    packages/plugin-dsh-annotation/README.md
  git commit -m "docs: record DSH plugin release workflow"
  ```

- [ ] **Step 7: Stop before public publication**

  Report the locally verified tarballs, current-platform runtime size, test
  evidence, and remaining CI target status. Do not publish a new npm version
  until the user explicitly asks to “发布新版”.

