# Plugin-First Repository Baseline Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the retired Express/browser-Agent product line and historical documentation while preserving current plugin work and a service-free static Drawing Workspace preview site.

**Architecture:** `packages/` becomes the only Drawing and plugin implementation source. The website becomes a thin Vite host backed by a browser-local `DrawingWorkspacePort`; current DSH packages and the macOS launcher stay intact. Git records the pre-cleanup state, and active documentation is consolidated into five canonical documents plus two active specifications.

**Tech Stack:** TypeScript 5.8, React 18, Vite 6, Vitest 3, Zustand-backed `@vectorai/drawing-workspace`, pnpm workspaces, DeepSeek Harness rc.8, Swift Package Manager.

**Spec:** `docs/specs/repository-baseline-cleanup.md`

## Global Constraints

- Do not modify, stage, delete, or commit `video-assets/`, HyperFrames material, posters, or unrelated user files.
- Preserve all current public packages, DSH plugin artifacts, the macOS Launcher, current Host-owned Semantic Edit E2E, and Motion Rig E2E.
- Remove production Express, Vercel, HTTP Agent, `/api`, old Spatial Core, old browser Drawing, and duplicate Viewer paths completely; do not move them to an archive directory.
- Delete a legacy test only with the production owner it tests.
- The static website must use public package exports and a browser-local `DrawingWorkspacePort`; it must not import a raw package Store across an adapter boundary or make a network request.
- The pre-cleanup safety checkpoint must be a separate commit.
- Every destructive removal must remain recoverable from Git history; do not use broad reset or checkout commands.
- Planned Surface Registry features remain planned and are not implemented by this cleanup.

---

## File map

### Create

- `src/adapters/browser-local-drawing-workspace-port.ts`: browser-local Drawing authority, persistence, command application, subscriptions, Undo, and Redo.
- `src/adapters/browser-local-drawing-workspace-port.test.ts`: Adapter contract and persistence tests.
- `docs/README.md`: canonical documentation index.
- `docs/development.md`: plugin-first build, test, install, and debugging guide.

### Rewrite

- `src/pages/Home.tsx`: thin shared Drawing Workspace preview shell.
- `src/pages/Home.test.tsx`: verifies there is one shared Viewer and no assistant/API surface.
- `src/App.tsx`: direct preview-site root without React Router.
- `src/index.css`: minimal preview-site and shared Viewer styling imports.
- `package.json`: plugin-first scripts and root dependencies.
- `tsconfig.json`: active static site and current scripts only.
- `vite.config.ts`: no `/api` proxy.
- `README.md`: plugin-first entry and quick start.
- `docs/prd.md`: current product scope and two-layer plugin model.
- `docs/tech-architecture.md`: current/target packages, authority, routing, transactions, model boundary, and testing.

### Move

- `docs/superpowers/specs/2026-08-24-extensible-2d-space-surface-design.md` to `docs/specs/extensible-2d-space-surface.md`.

### Delete

- `api/`.
- Retired `src/core/`, `src/drawing/`, `src/contracts/`, `src/services/`, `src/hooks/`, `src/components/`, `src/lib/`, and `src/assets/`.
- `src/adapters/website-drawing-workspace-port.ts` and its test after the local Adapter replaces them.
- Retired benchmark, Python/vectorization, test2, region-edit, and visual-edit scripts listed in Task 4.
- All historical `docs/superpowers/plans/` and all old specs after the active Surface spec is moved.
- `docs/agent-execution-flow.md`, `docs/dsh-plugin-migration.md`, `docs/dsh-local-development.md`, and `docs/architecture/` after their stable facts are merged.

---

### Task 1: Verify and checkpoint the current plugin migration

**Files:**
- Stage only: `apps/dsh-launcher-macos/**`
- Stage only: `packages/**`
- Stage only: `scripts/dsh-inline-workspace-patch.mjs`
- Stage only: `scripts/dsh-inline-workspace-patch.test.ts`
- Do not stage: `video-assets/**`

**Interfaces:**
- Consumes: current dirty working tree and commit `361c7c9`.
- Produces: one safety commit containing the latest recoverable plugin/Launcher state.

- [ ] **Step 1: Inspect exact candidate paths**

Run:

```bash
git status --short
git diff -- apps/dsh-launcher-macos packages scripts/dsh-inline-workspace-patch.mjs scripts/dsh-inline-workspace-patch.test.ts
```

Expected: only recent Launcher, Drawing, Viewer, DSH Host/Client, protocol, and current adapter changes appear in the candidate set; `video-assets` is not part of the path-limited diff.

- [ ] **Step 2: Verify the pre-cleanup baseline**

Run:

```bash
pnpm exec vitest run --reporter=dot
pnpm exec tsc --noEmit --pretty false
pnpm build:dsh-space
pnpm test:dsh-launcher
```

Expected: root tests report 224 passing files and 1,381 passing tests or a higher count caused by already-added current tests; TypeScript, DSH build, and Launcher tests pass.

- [ ] **Step 3: Stage only current product work and inspect the index**

Run:

```bash
git add apps/dsh-launcher-macos packages scripts/dsh-inline-workspace-patch.mjs scripts/dsh-inline-workspace-patch.test.ts
git diff --cached --check
git diff --cached --name-status
```

Expected: no `video-assets/`, historical documentation, or unrelated path is staged.

- [ ] **Step 4: Commit the safety checkpoint**

Run:

```bash
git commit -m "chore checkpoint plugin migration before cleanup"
```

Expected: a new commit records all selected current product changes. Record its commit ID in the final handoff.

---

### Task 2: Build the browser-local Drawing Workspace Adapter with TDD

**Files:**
- Create: `src/adapters/browser-local-drawing-workspace-port.test.ts`
- Create: `src/adapters/browser-local-drawing-workspace-port.ts`

**Interfaces:**
- Consumes: `createEmptyDrawing` and Drawing node types from `@vectorai/drawing-core`; `DrawingWorkspacePort`, `DrawingWorkspaceCommand`, and snapshot/result types from `@vectorai/drawing-workspace`.
- Produces: `createBrowserLocalDrawingWorkspacePort(options?: BrowserLocalDrawingWorkspaceOptions): DrawingWorkspacePort` and `BROWSER_LOCAL_DRAWING_KEY`.

- [ ] **Step 1: Write failing Adapter lifecycle and persistence tests**

Add tests with an in-memory `Storage` face:

```ts
class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

it('creates and persists one canonical local Drawing', async () => {
  const storage = new MemoryStorage();
  const first = createBrowserLocalDrawingWorkspacePort({ storage, now: () => 1, id: () => 'local-drawing' });
  const initial = await first.load();
  const second = createBrowserLocalDrawingWorkspacePort({ storage, now: () => 2, id: () => 'unused' });
  expect((await second.load())?.ref).toEqual(initial?.ref);
  expect((await second.load())?.document.protocol).toBe('VectorAI-Drawing');
});
```

Also assert a malformed persisted value is replaced with a new valid Drawing and that `subscribe` fires once after a successful state change.

- [ ] **Step 2: Write failing atomic command and history tests**

Cover:

```ts
it('commits an expected update atomically and rejects a stale revision', async () => {
  const port = createFixturePortWithCircle();
  const committed = await port.commit({
    expectedRevision: 1,
    commands: [{ type: 'node.update', id: 'circle-1', changes: { radius: 9 }, expected: { radius: 5 } }],
  });
  expect(committed.status).toBe('committed');
  const stale = await port.commit({ expectedRevision: 1, commands: [{ type: 'node.delete', id: 'circle-1' }] });
  expect(stale.status).toBe('conflict');
});

it('supports undo and redo as new workspace revisions', async () => {
  const port = createFixturePortWithCircle();
  const changed = await commitRadius(port, 9);
  const undone = await port.undoLast!(changed.snapshot);
  const redone = undone.status === 'committed' ? await port.redoLast!(undone.snapshot) : undone;
  expect(snapshotRadius(undone)).toBe(5);
  expect(snapshotRadius(redone)).toBe(9);
});
```

Also cover `node.create`, `node.delete`, annotation text movement, expected-value mismatch, duplicate ID rejection, and no partial write when the second command fails.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run src/adapters/browser-local-drawing-workspace-port.test.ts
```

Expected: FAIL because the new Adapter module does not exist.

- [ ] **Step 4: Implement the persisted repository and command reducer**

Implement these public declarations:

```ts
export const BROWSER_LOCAL_DRAWING_KEY = 'vectorai.preview-workspace.v1';

export interface BrowserLocalDrawingWorkspaceOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  now?: () => number;
  id?: () => string;
  initialDocument?: DrawingDocument;
}

export function createBrowserLocalDrawingWorkspacePort(
  options: BrowserLocalDrawingWorkspaceOptions = {},
): DrawingWorkspacePort;
```

Use one versioned persisted envelope containing `document`, monotonically increasing `revision`, `past`, `future`, and `lastCommit`. Clone documents at every public boundary. Apply a command batch to a clone, validate every command and expected field, and publish only after the whole batch succeeds. Increment the revision for commit, Undo, and Redo. On storage failure, keep the in-memory authority and continue notifying subscribers.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/adapters/browser-local-drawing-workspace-port.test.ts
```

Expected: all local Adapter tests pass.

- [ ] **Step 6: Commit the Adapter**

Run:

```bash
git add src/adapters/browser-local-drawing-workspace-port.ts src/adapters/browser-local-drawing-workspace-port.test.ts
git commit -m "feat add service-free browser drawing adapter"
```

---

### Task 3: Replace the website with a thin shared Viewer host

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `createBrowserLocalDrawingWorkspacePort`, `createDrawingWorkspaceStore`, `DrawingWorkspaceProvider`, and `DrawingWorkspace`.
- Produces: `HomeWorkspace({ workspaceStore? })`, a static local preview page with no API or assistant surface.

- [ ] **Step 1: Rewrite the Home test to express the thin-host contract**

Use a loaded fixture Store and assert:

```ts
const html = renderToStaticMarkup(<HomeWorkspace workspaceStore={workspaceStore} />);
expect(html).toContain('aria-label="二维空间预览"');
expect(html).toContain('data-host-adapter="browser-local"');
expect(html).toContain('data-workspace-state="ready"');
expect(html).not.toContain('AI 助手');
expect(html).not.toContain('data-panel="assistant"');
expect(html).not.toContain('/api');
```

- [ ] **Step 2: Run the Home test and verify RED**

Run:

```bash
pnpm exec vitest run src/pages/Home.test.tsx
```

Expected: FAIL because the current page renders `AIDialog` and the website Store.

- [ ] **Step 3: Implement the thin page and direct App root**

`HomeWorkspace` creates one browser Port and one scoped workspace Store with `useMemo`, unless a test Store is passed. Render a small local-preview header plus one full-height `DrawingWorkspace`. Remove Router usage from `App.tsx`; it returns `<Home />` directly. Do not import anything from `src/hooks`, `src/services`, `src/contracts`, `src/drawing`, or `src/components`.

- [ ] **Step 4: Run focused website tests and build**

Run:

```bash
pnpm exec vitest run src/pages/Home.test.tsx src/adapters/browser-local-drawing-workspace-port.test.ts
pnpm exec vite build
```

Expected: tests pass and Vite produces the static site without resolving an API client.

- [ ] **Step 5: Commit the thin website shell**

Run:

```bash
git add src/App.tsx src/pages/Home.tsx src/pages/Home.test.tsx src/index.css
git commit -m "feat replace website with local drawing preview"
```

---

### Task 4: Remove retired server, browser Agent, duplicate Drawing, tests, and scripts

**Files:**
- Delete: `api/**`
- Delete: `src/core/**`
- Delete: `src/drawing/**`
- Delete: `src/contracts/**`
- Delete: `src/services/**`
- Delete: `src/hooks/**`
- Delete: `src/components/**`
- Delete: `src/lib/**`
- Delete: `src/assets/**`
- Delete: `src/adapters/website-drawing-workspace-port.ts`
- Delete: `src/adapters/website-drawing-workspace-port.test.ts`
- Delete: retired scripts listed below.

**Interfaces:**
- Consumes: the service-free website from Task 3 and current package implementation.
- Produces: no active imports or tests owned by the retired product line.

- [ ] **Step 1: Prove active entrypoints no longer import retired paths**

Run:

```bash
rg -n "@/(components|hooks|services|contracts|drawing|core)|from ['\"].*(api|src/(core|drawing|services|contracts))" src packages apps scripts/build-dsh-space.mjs scripts/dsh-inline-workspace-patch.mjs scripts/e2e-host-owned-semantic-edit.ts scripts/e2e-temporary-motion-rig.ts
```

Expected: no match from the retained website and package entrypoints. Current E2E scripts may import package source explicitly, which is allowed.

- [ ] **Step 2: Remove retired tracked trees and scripts**

Run:

```bash
git rm -r api src/core src/drawing src/contracts src/services src/hooks src/components src/lib src/assets
git rm src/adapters/website-drawing-workspace-port.ts src/adapters/website-drawing-workspace-port.test.ts
git rm scripts/benchmark-agent-context.ts scripts/benchmark-test2.ts scripts/benchmark-vector-commit.ts
git rm scripts/check-hatch-overrun.ts scripts/e2e-region-hair-edit.ts scripts/e2e-test2-semantic-edit.ts
git rm scripts/e2e-visual-edit.ts scripts/setup-vectorization-python.sh scripts/test-drawing.ts scripts/test2-self-semantic-edit.ts
```

- [ ] **Step 3: Run structural and focused tests**

Run:

```bash
rg -n "from ['\"].*(api|src/(core|drawing|services|contracts|hooks|components))" src packages apps scripts -g '!**/lib/**'
pnpm exec vitest run packages src scripts/dsh-inline-workspace-patch.test.ts scripts/dsh-space-remote-parity.test.ts --reporter=dot
```

Expected: the import search returns no retired dependency; all retained tests pass.

- [ ] **Step 4: Commit implementation and test removal together**

Run:

```bash
git add -u api src scripts
git diff --cached --check
git commit -m "chore remove retired server and browser agent"
```

---

### Task 5: Shrink root configuration, dependencies, and commands

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: retained static site, packages, DSH scripts, and E2E scripts.
- Produces: canonical root commands with no server process or API proxy.

- [ ] **Step 1: Add a failing structural assertion through command-line checks**

Run:

```bash
node -e "const p=require('./package.json'); if (p.scripts['server:dev'] || /server:dev|concurrently/.test(p.scripts.dev || '')) process.exit(1)"
rg -n "target: 'http://localhost:3001'|'/api'" vite.config.ts
```

Expected: FAIL because server scripts and the Vite API proxy still exist.

- [ ] **Step 2: Rewrite scripts and TypeScript/Vite configuration**

Set root scripts to these active roles:

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "build:dsh-space": "node scripts/build-dsh-space.mjs",
  "build:dsh-launcher": "pnpm --filter @vectorai/dsh-launcher-macos build",
  "check": "tsc --noEmit",
  "test": "vitest run",
  "test:dsh-launcher": "pnpm --filter @vectorai/dsh-launcher-macos test",
  "e2e:host-owned-semantic-edit": "tsx scripts/e2e-host-owned-semantic-edit.ts",
  "e2e:motion-rig": "tsx scripts/e2e-temporary-motion-rig.ts",
  "patch:dsh-workspace": "node scripts/dsh-inline-workspace-patch.mjs",
  "preview": "vite preview",
  "lint": "eslint .",
  "test:watch": "vitest"
}
```

Limit root `tsconfig.json` to `src` and retained `scripts`; remove Express types. Remove the Vite `server.proxy` block.

- [ ] **Step 3: Remove retired root dependencies and refresh the lockfile**

Remove these direct root dependencies: `@techstark/opencv-js`, `clsx`, `cors`, `dotenv`, `express`, `lucide-react`, `react-router-dom`, `sharp`, `tailwind-merge`, `undici`, and `zustand`. The retained packages declare their own `lucide-react`, `sharp`, and `zustand` dependencies. Remove dev dependencies `@types/cors`, `@types/express`, `@vercel/node`, `concurrently`, and `nodemon`.

Run:

```bash
pnpm install --lockfile-only
```

Expected: lockfile updates without resolution errors.

- [ ] **Step 4: Verify configuration and all active TypeScript packages**

Run:

```bash
node -e "const p=require('./package.json'); if (p.scripts['server:dev'] || /server:dev|concurrently/.test(p.scripts.dev || '')) process.exit(1)"
! rg -n "localhost:3001|'/api'|express|@vercel/node" package.json tsconfig.json vite.config.ts
pnpm check
pnpm build
pnpm build:dsh-space
```

Expected: structural checks, site check/build, and DSH build pass.

- [ ] **Step 5: Commit configuration cleanup**

Run:

```bash
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts
git commit -m "build remove retired server toolchain"
```

---

### Task 6: Consolidate canonical documentation

**Files:**
- Create: `docs/README.md`
- Create: `docs/development.md`
- Move: active Surface spec to `docs/specs/extensible-2d-space-surface.md`
- Modify: `README.md`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Delete: historical plans, old specs, migration/flow/local-development documents, and `docs/architecture/`.

**Interfaces:**
- Consumes: the post-cleanup package list, commands, and two approved specifications.
- Produces: one explicit documentation index and current product/architecture/development sources of truth.

- [ ] **Step 1: Move the active Surface specification and remove historical documents**

Run:

```bash
git mv docs/superpowers/specs/2026-08-24-extensible-2d-space-surface-design.md docs/specs/extensible-2d-space-surface.md
git rm -r docs/superpowers/plans
find docs/superpowers/specs -type f -name '*.md' -print0 | xargs -0 git rm
git rm docs/agent-execution-flow.md docs/dsh-plugin-migration.md docs/dsh-local-development.md
git rm -r docs/architecture
```

Expected: only the two active files remain under `docs/specs`; `docs/superpowers` has no retained document.

- [ ] **Step 2: Rewrite the root README and documentation index**

`README.md` must contain these sections and current commands:

```markdown
# VectorAI
Plugin-first local 2D drawing infrastructure for DeepSeek Harness.

## Packages
## Quick start
## Verify
## Documentation
## License
```

`docs/README.md` must list exactly `prd.md`, `tech-architecture.md`, `development.md`, and the two active specs, and state that package exports/tests override stale prose.

- [ ] **Step 3: Rewrite PRD as current product scope**

Use these normative sections:

```markdown
# VectorAI Product Requirements
## Product direction
## Users and jobs
## Layer 1: 2D Space
## Layer 2: Engineering Annotation
## Host model: DSH and static web preview
## Core user flows
## Data ownership and privacy
## Current capabilities
## Planned capabilities
## Non-goals
## Product acceptance
```

State explicitly: no VectorAI cloud/Express service; uploads do not imply vectorization; DSH owns chat; first layer owns Drawing authority; second layer owns annotation workflow/UI; Surface takeover is session-sticky once the capability is used.

- [ ] **Step 4: Rewrite technical architecture with implemented/planned status**

Use these sections:

```markdown
# VectorAI Technical Architecture
## Status legend
## System context
## Package dependency graph
## Drawing document and revision authority
## Host adapters
## DSH plugin lifecycle and chat boundary
## Semantic edit and temporary Motion Rig
## Engineering Annotation boundary
## Extensible Surface architecture (planned)
## Local persistence and resources
## Security and failure handling
## Testing and release gates
```

Copy stable rules from the approved Surface spec without claiming the Registry or staged extension protocol is already implemented.

- [ ] **Step 5: Write the development guide from real commands**

Document prerequisites, `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm check`, `pnpm build`, `pnpm build:dsh-space`, DSH plugin artifact paths, `pnpm patch:dsh-workspace`, Launcher build/test, both retained E2Es, and recovery by explicit Git path/commit. Do not mention Express, Vercel, Python vectorization setup, or deleted scripts.

- [ ] **Step 6: Validate document structure and links**

Run:

```bash
find docs -type f -name '*.md' | sort
rg -n "docs/superpowers|dsh-plugin-migration|agent-execution-flow|dsh-local-development|docs/architecture|server:dev|Express" README.md docs
```

Expected: the first command lists the agreed canonical set plus this temporary implementation plan; the second has no stale path or retired startup reference, except a deliberate statement that the product has no Express service.

- [ ] **Step 7: Commit documentation consolidation**

Run:

```bash
git add README.md docs
git diff --cached --check
git commit -m "docs consolidate plugin-first product architecture"
```

---

### Task 7: Final structural, automated, and runtime verification

**Files:**
- No planned production modification; a failed gate returns to the task that owns the failing file before verification continues.
- Delete: `docs/plans/repository-baseline-cleanup.md` after all tasks pass, because active plans are not part of the canonical documentation baseline.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a clean plugin-first baseline and evidence-backed completion report.

- [ ] **Step 1: Run structural absence checks**

Run:

```bash
test ! -d api
test ! -d src/core
test ! -d src/drawing
test ! -d src/services
test ! -d src/contracts
! rg -n "express|@vercel/node|localhost:3001|/api/agent|/api/drawings" src packages apps scripts package.json vite.config.ts -g '!**/lib/**'
```

Expected: every command succeeds with no retired production reference.

- [ ] **Step 2: Run the active fast suite and type/build gates**

Run:

```bash
pnpm test
pnpm check
pnpm build
pnpm build:dsh-space
```

Expected: all retained tests, TypeScript, static web build, and DSH build pass.

- [ ] **Step 3: Run current integration and Launcher gates**

Run:

```bash
pnpm e2e:host-owned-semantic-edit
pnpm e2e:motion-rig
pnpm test:dsh-launcher
```

Expected: both current Drawing E2Es and the Launcher suite pass.

- [ ] **Step 4: Verify the static site without a server**

Run Vite preview, open the local page, and inspect the browser network log. Verify the shared Drawing Workspace renders, local edits persist across reload, Undo/Redo work, and no request path begins with `/api`.

- [ ] **Step 5: Verify documentation and ignored user content**

Run:

```bash
find docs -type f -name '*.md' | sort
git status --short
```

Expected: canonical docs only; unrelated `video-assets`/HyperFrames changes remain untouched and uncommitted if they were present before cleanup.

- [ ] **Step 6: Remove the temporary implementation plan and commit final cleanup**

Run:

```bash
git rm docs/plans/repository-baseline-cleanup.md
git commit -m "chore finalize plugin-first repository baseline"
```

Expected: the plan remains recoverable in Git history but is absent from the final canonical documentation tree.

- [ ] **Step 7: Record final evidence**

Capture commit IDs, retained test counts, build results, E2E results, Launcher results, canonical document paths, and any untouched unrelated working-tree paths in the handoff.
