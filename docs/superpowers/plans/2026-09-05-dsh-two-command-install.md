# DSH Two-Command Plugin Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare VectorAI's release pipeline so exact current DSH runtime imports become official Bundle dependencies, unavailable upstream packages block release before publication, and the final release is accepted from a fresh profile using only the two documented Bundle commands.

**Architecture:** `release/dsh-plugins.json` remains the single DSH coordinate source and gains a per-Bundle runtime-dependency inventory. Pure helpers validate and materialize that inventory into release package manifests; registry availability is checked before any publication. The release workflow publishes platform runtimes first, accepts the two local Bundle tarballs against exact DSH, then publishes Space and Annotation and repeats the public install check.

**Tech Stack:** Node.js ESM, TypeScript 5.8, Vitest 3, pnpm 11.7.0, DSH Bundle/Cordis plugin contracts, npm registry metadata.

**Spec:** `docs/superpowers/specs/2026-09-05-dsh-two-command-install-design.md`

## Global Constraints

- Target exactly DSH `0.1.3-alpha.1`, tag `dsh-v0.1.3-alpha.1`, commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`.
- Do not modify DSH source or generated DSH runtime output.
- End users install exactly two Bundles in order: Space, then Annotation.
- Keep `@deepseek-ai/cordis` as a required peer and never install or bundle a second Cordis copy.
- DSH packages used by built Host runtime imports become exact normal dependencies; type-only and Host-provided rows remain optional peers.
- Do not retain old DSH APIs, vendored DSH code, Python fallbacks, manual profile links, or Launcher-only dependency repair.
- Do not publish packages during this implementation.
- Preserve drawing, annotation, persistence, export, and session restoration behavior.

---

### Task 1: Make Bundle runtime dependencies authoritative

**Files:**
- Modify: `release/dsh-plugins.json`
- Modify: `scripts/dsh-runtime-manifest.mjs`
- Modify: `scripts/dsh-runtime-manifest.test.ts`
- Create: `scripts/dsh-bundle-runtime-dependencies.mjs`
- Create: `scripts/dsh-bundle-runtime-dependencies.test.ts`

**Interfaces:**
- Produces: `bundleRuntimeDependencies: Record<string, readonly string[]>` on the validated DSH manifest.
- Produces: `runtimeImports(source: string): string[]` and `inspectBundleRuntimeDependencyInventory({ root, release }): Promise<string[]>`.
- Consumes: built `packages/plugin-dsh-{space,annotation}/lib/index.js` files and `release.dsh.version`.

- [ ] **Step 1: Add failing manifest assertions**

Extend the runtime-manifest test to require:

```ts
expect(baseline.bundleRuntimeDependencies).toEqual({
  '@newwe/vectorai-plugin-dsh-space': [
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/dsh-typert-protocol',
  ],
  '@newwe/vectorai-plugin-dsh-annotation': [
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/dsh-typert-protocol',
  ],
});
```

Add table tests proving the inventory inspector reports a missing runtime dependency, an extra dependency, `@deepseek-ai/cordis` in the inventory, and a Bundle name not present in `release.bundles`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm vitest run scripts/dsh-runtime-manifest.test.ts scripts/dsh-bundle-runtime-dependencies.test.ts
```

Expected: failure because the validated manifest and dependency inspector do not expose the new inventory.

- [ ] **Step 3: Implement manifest validation and runtime-import inspection**

Add the exact dependency map under `release.dsh.bundleRuntimeDependencies`. Validate that every release Bundle appears exactly once, arrays are sorted unique `@deepseek-ai/dsh-*` package names, and Cordis is forbidden.

Implement runtime import extraction for static ESM imports in the built Host file:

```js
export function runtimeImports(source) {
  return [...source.matchAll(/\bfrom\s+['"](@deepseek-ai\/dsh-[^/'"]+)['"]/gu)]
    .map(([, name]) => name)
    .filter((name, index, values) => values.indexOf(name) === index)
    .sort();
}
```

The inspector compares the extracted set with the configured set and returns deterministic diagnostics. It ignores type-only imports because they are absent from built JavaScript.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm vitest run scripts/dsh-runtime-manifest.test.ts scripts/dsh-bundle-runtime-dependencies.test.ts
```

Expected: both Bundle inventories exactly match their built Host imports.

- [ ] **Step 5: Commit the authoritative inventory**

```bash
git add release/dsh-plugins.json scripts/dsh-runtime-manifest.mjs scripts/dsh-runtime-manifest.test.ts scripts/dsh-bundle-runtime-dependencies.mjs scripts/dsh-bundle-runtime-dependencies.test.ts
git commit -m "build: classify DSH bundle runtime dependencies"
```

---

### Task 2: Materialize and audit official release dependency edges

**Files:**
- Modify: `scripts/set-dsh-release-version.mjs`
- Create: `scripts/set-dsh-release-version.test.ts`
- Modify: `scripts/dsh-package-audit.mjs`
- Modify: `scripts/dsh-release-manifest.test.ts`
- Modify: `scripts/dsh-plugin-bundle-boundary.test.ts`

**Interfaces:**
- Produces: `materializeBundleRuntimeDependencies(manifest, bundleName, baseline): object`.
- Consumes: `release.dsh.bundleRuntimeDependencies`, `release.dsh.version`, and a public Bundle manifest.
- Preserves: platform runtime optional dependencies and Annotation's exact Space peer.

- [ ] **Step 1: Write failing materialization tests**

Use plain manifest fixtures and assert:

```ts
const result = materializeBundleRuntimeDependencies(space, space.name, baseline);
expect(result.dependencies['@deepseek-ai/dsh-tools']).toBe('0.1.3-alpha.1');
expect(result.peerDependencies['@deepseek-ai/dsh-tools']).toBeUndefined();
expect(result.peerDependenciesMeta['@deepseek-ai/dsh-tools']).toBeUndefined();
expect(result.peerDependencies['@deepseek-ai/cordis']).toBe('4.0.2');
expect(result.peerDependenciesMeta['@deepseek-ai/cordis']).toBeUndefined();
```

Add a rejection test for a missing Bundle inventory and an audit test for a packed Host runtime import left as an optional peer.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run scripts/set-dsh-release-version.test.ts scripts/dsh-release-manifest.test.ts scripts/dsh-plugin-bundle-boundary.test.ts
```

Expected: failure because release materialization does not promote DSH runtime imports.

- [ ] **Step 3: Implement pure dependency materialization**

Move package-manifest transformation behind an exported pure function. For every configured runtime dependency it must:

```js
next.dependencies[name] = baseline.version;
delete next.peerDependencies?.[name];
delete next.peerDependenciesMeta?.[name];
```

Keep Cordis in peer dependencies, sort every dependency object, and remove an empty `peerDependenciesMeta`. Remove the obsolete source-text replacement for `RUNTIME_VERSION`; `scripts/vectorizer-runtime-config.mjs` already reads the release manifest directly.

- [ ] **Step 4: Strengthen packed-manifest audit**

Change `auditPackedManifest` to accept the authoritative release data and built Host source. Assert exact dependency classification and exact versions in addition to the existing platform-runtime and local-path checks. `auditTarball` reads `package/lib/index.js` from the archive and forwards it to the classifier.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm vitest run scripts/set-dsh-release-version.test.ts scripts/dsh-release-manifest.test.ts scripts/dsh-plugin-bundle-boundary.test.ts
pnpm check:dsh-runtime-baseline
```

Expected: materialized release fixtures match the official dependency boundary and the unprepared development manifests remain valid inputs.

- [ ] **Step 6: Commit release dependency materialization**

```bash
git add scripts/set-dsh-release-version.mjs scripts/set-dsh-release-version.test.ts scripts/dsh-package-audit.mjs scripts/dsh-release-manifest.test.ts scripts/dsh-plugin-bundle-boundary.test.ts
git commit -m "build: materialize official DSH dependency edges"
```

---

### Task 3: Block releases when exact upstream packages are unavailable

**Files:**
- Create: `scripts/check-dsh-registry-readiness.mjs`
- Create: `scripts/check-dsh-registry-readiness.test.ts`
- Modify: `scripts/release-dsh-plugins.mjs`
- Modify: `scripts/release-dsh-plugins.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `requiredDshRegistryPackages({ root, release }): { name: string; version: string }[]`.
- Produces: `checkDshRegistryReadiness({ root, release }, { lookup }): Promise<{ ready: true }>`; throws `DSH_REGISTRY_SDK_BASELINE_STALE:<actual>:<expected>`, `DSH_REGISTRY_PACKAGES_UNAVAILABLE:<names>`, or `DSH_REGISTRY_CHECK_FAILED:<name>`.
- Consumes: the per-Bundle runtime dependency inventory plus every `@deepseek-ai/dsh-*` dependency used by the four private build-input packages and the root development manifest.

- [ ] **Step 1: Write failing registry readiness tests**

Cover:

```ts
const packages = requiredDshRegistryPackages({ root, release });
expect(packages).toEqual([...packages].sort((left, right) => left.name.localeCompare(right.name)));
expect(packages).toEqual(expect.arrayContaining([
  { name: '@deepseek-ai/dsh-llm', version: '0.1.3-alpha.1' },
  { name: '@deepseek-ai/dsh-session', version: '0.1.3-alpha.1' },
  { name: '@deepseek-ai/dsh-tools', version: '0.1.3-alpha.1' },
  { name: '@deepseek-ai/dsh-typert-protocol', version: '0.1.3-alpha.1' },
]));
```

Use injected lookup functions to prove complete availability succeeds, npm 404 collects all missing packages, and a network/authentication error is not mislabeled as a missing release. A separate test sets `registrySdkVersion` to `0.1.2-rc.1` while the runtime is `0.1.3-alpha.1` and expects `DSH_REGISTRY_SDK_BASELINE_STALE`; release readiness requires those values to match even though ordinary development permits the temporary SDK baseline.

Add a release-workflow test using injected effects that records `registry-check` before the first `publish` event.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run scripts/check-dsh-registry-readiness.test.ts scripts/release-dsh-plugins.test.ts
```

Expected: failure because no registry gate exists.

- [ ] **Step 3: Implement the registry checker**

The default lookup runs:

```bash
npm view <name>@<version> version --json
```

It treats only npm `E404` as unavailable. It must not print npm credentials, environment variables, or response headers. Add `check:dsh-registry-readiness` as an explicit read-only command.

- [ ] **Step 4: Put the gate before release mutation and publication**

Refactor `runRelease` to accept injected operations for tests. The real path reads the current release manifest and completes registry readiness before `set-dsh-release-version`, artifact publication, or receipt mutation.

- [ ] **Step 5: Run tests and exercise the real expected block**

Run:

```bash
pnpm vitest run scripts/check-dsh-registry-readiness.test.ts scripts/release-dsh-plugins.test.ts
pnpm check:dsh-registry-readiness
```

Expected now: tests pass; the real command exits non-zero and names the currently unpublished DSH `0.1.3-alpha.1` packages. Verify `git status --short` is unchanged by the failed readiness command.

- [ ] **Step 6: Commit the registry release gate**

```bash
git add package.json scripts/check-dsh-registry-readiness.mjs scripts/check-dsh-registry-readiness.test.ts scripts/release-dsh-plugins.mjs scripts/release-dsh-plugins.test.ts
git commit -m "build: gate releases on DSH registry readiness"
```

---

### Task 4: Accept local Bundles before publishing them

**Files:**
- Modify: `scripts/verify-public-dsh-install.mjs`
- Create: `scripts/verify-dsh-install-plan.mjs`
- Create: `scripts/verify-dsh-install-plan.test.ts`
- Modify: `scripts/release-dsh-plugins.mjs`
- Modify: `scripts/release-dsh-plugins.test.ts`
- Modify: `docs/releasing-dsh-plugins.md`

**Interfaces:**
- Produces: `bundleInstallCommands({ release, sources }): string[][]`, where sources are either local tarballs or exact public package specifications.
- Produces: release phases `runtimes`, `local-bundle-acceptance`, `space`, `annotation`, `public-acceptance`.
- Consumes: exact DSH CLI/runtime, two local Bundle tarballs, published platform runtimes, and isolated `DSH_HOME`.

- [ ] **Step 1: Write failing install-plan and release-order tests**

Assert local tarball commands still contain exactly two `plugin add` invocations and preserve Annotation's `--allow-build=tesseract.js` argument. Assert the event order:

```ts
expect(events).toEqual([
  'registry-check',
  'publish:runtime-a',
  'publish:runtime-b',
  'accept:local-bundles',
  'publish:space',
  'publish:annotation',
  'accept:public-bundles',
]);
```

Add a failure test proving `accept:local-bundles` prevents both Bundle publications.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run scripts/verify-dsh-install-plan.test.ts scripts/release-dsh-plugins.test.ts
```

Expected: failure because the workflow currently publishes every artifact before its only install verification.

- [ ] **Step 3: Extract the two-command verifier**

Make the verifier accept exact sources and a DSH executable while always creating its own fresh `DSH_HOME`. It installs only Space and Annotation, lists the profile, starts an exact runtime health/boot probe, resolves the platform vectorizer, and retains the failed profile for diagnosis.

- [ ] **Step 4: Reorder release phases**

Publish and wait for all platform runtimes first. Run local Bundle acceptance. Only then publish Space and Annotation in order, followed by public acceptance. Preserve receipt-based retry behavior so already-integrity-confirmed runtimes are not republished.

- [ ] **Step 5: Update the release runbook**

Document the upstream registry gate, the pre-Bundle local acceptance, the two-command invariant, the absence of DSH source patching, and the fact that a failed upstream readiness check is expected while exact DSH packages are missing.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
pnpm vitest run scripts/verify-dsh-install-plan.test.ts scripts/release-dsh-plugins.test.ts scripts/dsh-release-manifest.test.ts
```

Expected: release ordering and two-command behavior pass without publishing anything.

- [ ] **Step 7: Commit pre-publication acceptance**

```bash
git add scripts/verify-public-dsh-install.mjs scripts/verify-dsh-install-plan.mjs scripts/verify-dsh-install-plan.test.ts scripts/release-dsh-plugins.mjs scripts/release-dsh-plugins.test.ts docs/releasing-dsh-plugins.md
git commit -m "build: verify DSH bundles before publication"
```

---

### Task 5: Run migration and product regression gates

**Files:**
- Modify only if verification exposes a defect: the smallest owning source and its focused test.
- Generate only ignored evidence under: `.local/dsh-two-command-acceptance/`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: repository and product-level evidence; no publication receipt.

- [ ] **Step 1: Run repository and Bundle verification**

Run:

```bash
pnpm test
pnpm check
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm check:dsh-build-freshness
pnpm check:dsh-runtime-baseline
pnpm check:dsh-source-runtime
pnpm test:dsh-launcher
```

Expected: every command passes; the real vectorizer integration may skip without its explicit development override.

- [ ] **Step 2: Run product-shaped annotation contracts**

Run:

```bash
pnpm e2e:drawing-surface
pnpm e2e:dxf-smart-partition
pnpm e2e:golden-dimension-chain
pnpm test:cad-export
```

Expected: drawing lifecycle, partition, golden dimension chain, and CAD export remain unchanged.

- [ ] **Step 3: Run real runtime probes**

Run the local vectorizer integration against the packaged current-platform executable and run `pnpm probe:dsh-recognition` against the isolated exact DSH profile. Expected: both pass with exact version observations and no sensitive output.

- [ ] **Step 4: Confirm the upstream gap is fail-closed**

Run:

```bash
pnpm check:dsh-registry-readiness
git status --short
```

Expected while upstream packages remain unpublished: readiness exits non-zero with exact missing package names, no release command runs, no receipt is created, and only the implementation commits appear in repository history.

- [ ] **Step 5: Record final repository state**

Run:

```bash
git diff --check
git status --short
git log --oneline -10
```

Expected: clean worktree, no publication receipt, and no `.local` state tracked.
