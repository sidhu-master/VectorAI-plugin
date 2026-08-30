# Official DSH Plugin Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce exactly two private, prebuilt npm packages that install through DSH's official Bundle/Profile mechanism without exposing VectorAI TypeScript source or requiring the VectorAI repository.

**Architecture:** Keep the existing Host and Client source packages as private monorepo build inputs. Extend the current Vite build so each layer emits a dual-face DSH package into its existing Bundle directory: root Host export, `./client` browser export, `./typert` Host protocol export, one Bundle patch, and one `dsh.client` declaration. A release script packs and audits both artifacts before any explicit publish command.

**Tech Stack:** pnpm workspaces, Node.js 22, Vite/Rollup, TypeScript, npm package manifests, DSH `dsh.bundle`/`dsh.client` conventions.

**Spec:** `docs/superpowers/specs/2026-08-30-official-dsh-plugin-packaging-design.md`

## Global Constraints

- Publish exactly `@vectorai/plugin-dsh-space` and `@vectorai/plugin-dsh-annotation`.
- Do not publish the four internal Host/Client source packages or any other `@vectorai/*` library.
- Pack only prebuilt JS, the first-layer Python worker, Bundle patch, README, LICENSE, and package metadata.
- Do not include `src/`, tests, source maps, local paths, Git metadata, or local dependency protocols.
- Install and activate Bundles only through `dsh plugin --profile web add`.
- Keep the repository private and use `publishConfig.access = restricted`.
- Keep the first-layer Bundle before the second-layer Bundle.
- Do not modify DSH source, compiled assets, or user profiles during build and pack preparation.

---

### Task 1: Collapse each Bundle manifest to the official dual-face form

**Files:**
- Modify: `packages/plugin-dsh-space/package.json`
- Modify: `packages/plugin-dsh-space/cordis.patch.yml`
- Modify: `packages/plugin-dsh-annotation/package.json`
- Modify: `packages/plugin-dsh-annotation/cordis.patch.yml`
- Create: `scripts/dsh-release-manifest.test.ts`

**Interfaces:**
- Produces: `dsh.bundle.patch`, `dsh.client`, root/`./client`/`./typert` exports and restricted publish metadata on each Bundle.
- Consumes: current DSH peer versions and package-owned runtime dependencies from the four internal source manifests.

- [ ] **Step 1: Write the failing manifest contract test**

Create a table-driven test that loads both Bundle manifests and asserts:

```ts
expect(manifest.publishConfig).toEqual({ access: 'restricted' })
expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
expect(manifest.dsh.client.platform).toBe('web')
expect(manifest.exports['.'].default).toBe('./lib/index.js')
expect(manifest.exports['./client'].default).toBe('./lib/client.js')
expect(manifest.exports['./typert'].default).toBe('./lib/typert.js')
expect(JSON.stringify(manifest)).not.toMatch(/workspace:\*|link:|file:/)
expect(manifest.files).not.toContain('src/**/*.ts')
```

Also parse both patches and assert each contains exactly one VectorAI row whose `name` is the matching Bundle package name.

- [ ] **Step 2: Run the focused test and observe failure**

Run:

```bash
pnpm exec vitest run scripts/dsh-release-manifest.test.ts
```

Expected: failure because the current Bundle manifests depend on separate Host/Client workspace packages and do not expose dual faces.

- [ ] **Step 3: Implement the two dual-face manifests**

For each Bundle, add `main`, `exports`, `files`, `publishConfig`, and the matching `dsh.client` declaration copied from the internal Client package. Move the union of required DSH APIs to peer dependencies with the supported published DSH SDK range; keep `sharp` on the space package and `officeparser` on the annotation package as normal dependencies. Give annotation an exact-version peer on `@vectorai/plugin-dsh-space`.

Replace each patch's two internal rows with one root package row:

```yaml
- insert:
    - id: vectorai-space
      name: '@vectorai/plugin-dsh-space'
```

and:

```yaml
- insert:
    - id: vectorai-engineering-annotation
      name: '@vectorai/plugin-dsh-annotation'
```

- [ ] **Step 4: Run the focused test**

Run `pnpm exec vitest run scripts/dsh-release-manifest.test.ts`.

Expected: both Bundle contracts pass and no forbidden dependency protocol remains.

---

### Task 2: Emit both Host and Client faces into the Bundle directories

**Files:**
- Modify: `scripts/build-dsh-space.mjs`
- Modify: `scripts/dsh-release-manifest.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the existing Host entry `src/index.ts`, Host protocol entry `src/typert.ts`, Client entry `src/client.tsx`, and `python/vectorai_vectorizer.py`.
- Produces: `packages/plugin-dsh-{space,annotation}/lib/index.js`, `lib/typert.js`, `lib/client.js`, plus the first-layer `lib/vectorai_vectorizer.py`.

- [ ] **Step 1: Add failing artifact assertions**

After invoking the existing build command from the test, assert both Bundle directories contain all three JS faces, contain no `.map`, and the first layer contains the Python worker. Assert emitted JS contains no imports from any `@vectorai/*` package except the Bundle's own browser module ID string.

- [ ] **Step 2: Run the test and observe missing Bundle artifacts**

Run `pnpm exec vitest run scripts/dsh-release-manifest.test.ts`.

Expected: missing `packages/plugin-dsh-space/lib/index.js` and annotation equivalents.

- [ ] **Step 3: Redirect the existing build outputs**

Change `buildPluginPair` to accept separate source directories and one `outputDir`. Build the Host root, Host typert face, and wrapped browser Client into the Bundle's `lib/`. Copy the Python worker and repository `LICENSE` into the space Bundle; copy `LICENSE` into annotation. Keep all `@vectorai/*` source modules bundled and preserve the current DSH/React/Node externals.

- [ ] **Step 4: Ignore generated release artifacts**

Add the two Bundle `lib/` directories, copied package LICENSE files, and `dist/npm/` to `.gitignore`; published output must be reproducible and not committed.

- [ ] **Step 5: Run both build targets and focused assertions**

Run:

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm exec vitest run scripts/dsh-release-manifest.test.ts
```

Expected: both dual-face package artifacts exist and contain no source maps or unresolved VectorAI package imports.

---

### Task 3: Pack and audit exactly two private npm artifacts

**Files:**
- Create: `scripts/prepare-dsh-plugin-release.mjs`
- Create: `scripts/dsh-package-audit.mjs`
- Modify: `package.json`
- Modify: `scripts/dsh-release-manifest.test.ts`

**Interfaces:**
- Produces: `pnpm pack:dsh-plugins`, two `.tgz` files under `dist/npm/`, and `auditTarball(path)`.
- Consumes: built dual-face Bundle directories from Task 2.

- [ ] **Step 1: Add failing tarball audit cases**

Create temporary tarball-entry fixtures and assert the audit rejects:

```text
package/src/index.ts
package/lib/index.js.map
package/test/plugin.test.js
package/.git/config
```

Also assert it rejects packed manifests containing `workspace:`, `link:`, `file:`, `/Users/`, or missing `dsh.bundle`/`dsh.client`.

- [ ] **Step 2: Run the focused audit tests and observe failure**

Run `pnpm exec vitest run scripts/dsh-release-manifest.test.ts`.

Expected: audit module is missing.

- [ ] **Step 3: Implement the package audit**

Implement `auditTarball(path)` with `tar -tzf` and `tar -xOf ... package/package.json`. Permit only package metadata, README, LICENSE, `cordis.patch.yml`, `lib/**/*.js`, `lib/**/*.d.ts`, and the first-layer Python worker. Scan packed text payloads for absolute local paths and source-map references.

- [ ] **Step 4: Implement release preparation**

The preparation script removes only the explicit `dist/npm` directory, builds both targets, packs only the two Bundle directories with `pnpm pack --pack-destination`, verifies exactly two tarballs were produced, and audits both. It does not publish or touch `~/.dsh`.

Add root scripts:

```json
{
  "pack:dsh-plugins": "node scripts/prepare-dsh-plugin-release.mjs",
  "publish:dsh-plugins": "node scripts/publish-dsh-plugins.mjs"
}
```

- [ ] **Step 5: Run pack preparation**

Run `pnpm pack:dsh-plugins`.

Expected: exactly two audited tarballs under `dist/npm/`.

---

### Task 4: Add explicit private publication and official DSH installation docs

**Files:**
- Create: `scripts/publish-dsh-plugins.mjs`
- Modify: `packages/plugin-dsh-space/README.md`
- Modify: `packages/plugin-dsh-annotation/README.md`
- Modify: `docs/development.md`

**Interfaces:**
- Produces: explicit `pnpm publish:dsh-plugins -- --tag <tag>` command.
- Consumes: the two audited tarballs from `pnpm pack:dsh-plugins`.

- [ ] **Step 1: Implement guarded publication**

Require `npm whoami` to succeed and require both audited tarballs to exist. Publish the space tarball first and annotation tarball second with `pnpm publish <tarball> --access restricted --no-git-checks`, forwarding only an explicitly supplied dist-tag. Stop immediately on failure. Never read or write npm tokens.

- [ ] **Step 2: Update user installation docs**

Document registry authentication outside the repository and the official commands:

```bash
dsh plugin --profile web add @vectorai/plugin-dsh-space
dsh plugin --profile web add @vectorai/plugin-dsh-space @vectorai/plugin-dsh-annotation
```

Document offline installation from the two `.tgz` files in the same order. Remove the six-local-path command as the primary distribution flow, retaining it only as a clearly labeled source-development fallback if still needed.

- [ ] **Step 3: Document release operation**

Add the non-publishing preparation command, artifact location, explicit publish command, version synchronization rule, private scope requirement, and rollback via `dsh plugin --profile web remove`.

---

### Task 5: Verify official Bundle behavior without modifying the active profile

**Files:**
- Modify: `scripts/dsh-release-manifest.test.ts`
- Modify: `docs/superpowers/plans/2026-08-30-official-dsh-plugin-packaging.md`

**Interfaces:**
- Consumes: the two packed tarballs and the official DSH alpha runtime.
- Produces: release evidence that the packages are prebuilt, private, source-free, and ordered correctly.

- [ ] **Step 1: Run manifest, build, and tarball gates**

Run:

```bash
pnpm exec vitest run scripts/dsh-release-manifest.test.ts
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm pack:dsh-plugins
```

Expected: all commands exit zero and `dist/npm` contains exactly two tarballs.

- [ ] **Step 2: Inspect packed package metadata**

For each tarball, verify `dsh.bundle.patch`, `dsh.client.platform`, root/Client/typert exports, `publishConfig.access=restricted`, and absence of forbidden protocols.

- [ ] **Step 3: Verify official profile composition in an isolated DSH home**

Create a temporary directory with `mktemp -d`, set `DSH_HOME` only for the invoked official DSH CLI, install both tarballs through `dsh plugin --profile web add`, and run `dsh --profile web --dump-config`. Assert `vectorai-space` appears before `vectorai-engineering-annotation`. Remove the temporary directory afterward; do not touch the active `~/.dsh` profile.

- [ ] **Step 4: Review repository boundaries**

Run:

```bash
git diff --name-only | rg 'dsh-runtime|Library/Application Support|\.dsh/profiles' && exit 1 || true
git diff --check
```

Expected: no DSH runtime or active profile file is changed.

- [ ] **Step 5: Commit the implementation**

Stage only packaging scripts, the two Bundle packages, documentation, `.gitignore`, and package scripts. Do not stage unrelated annotation work.
