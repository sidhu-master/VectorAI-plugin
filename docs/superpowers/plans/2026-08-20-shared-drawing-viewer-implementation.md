# Shared Drawing Viewer Migration Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the temporary DSH SVG preview and the website-only drawing workspace with one reusable, host-neutral drawing workspace and React viewer, then connect it to both the standalone website and the DSH session repository without reintroducing a VectorAI cloud or Express dependency into the new architecture.

**Architecture:** Add a headless `@vectorai/drawing-workspace` package that owns scoped UI state and talks through a revision-aware `DrawingWorkspacePort`. Add `@vectorai/drawing-viewer-react` for the reusable Canvas, object browser, inspector, toolbar, source underlay, and status UI. The website supplies a compatibility port during migration; DSH supplies a strict TypeRT Remote port backed by the Host's session-scoped canonical repository. Automatic engineering annotation remains a second-layer plugin concern and integrates later through public transactions and preview contributions.

**Tech Stack:** TypeScript 5.8, React 18, Zustand 5 vanilla stores, SVG, Zod 4, DSH rc.8 TypeRT, Vite 6, Vitest 3, Testing Library, pnpm workspaces.

---

## Working rules

- Follow red-green-refactor for every behavior-bearing task: add a focused failing test, run it and confirm the expected failure, implement only enough production code, then rerun the focused test.
- Keep `@vectorai/drawing-workspace` free of React, DSH, Express, browser globals, and Node built-ins.
- Keep `@vectorai/drawing-viewer-react` free of the website singleton Store, website service clients, DSH SDK imports, Express, and application routes.
- Keep selection, viewport, toggles, pointer coordinates, and local errors client-local. Only document commands and revisions cross a host boundary.
- Preserve existing website Agent/chat code behind the website adapter. Do not move it into the shared packages.
- Do not improve the provisional vectorizer in this plan. Viewer parity and vectorization quality are separate slices.
- Commit after each completed task so regressions and architectural drift are easy to isolate.

### Task 1: Create the headless workspace package and wire model

**Files:**

- Create: `packages/drawing-workspace/package.json`
- Create: `packages/drawing-workspace/tsconfig.json`
- Create: `packages/drawing-workspace/src/index.ts`
- Create: `packages/drawing-workspace/src/contracts.ts`
- Create: `packages/drawing-workspace/src/store.ts`
- Create: `packages/drawing-workspace/src/commands.ts`
- Create: `packages/drawing-workspace/src/store.test.ts`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

**Step 1: Write failing contract and lifecycle tests**

Add tests proving that a new Store:

- starts in `idle` with no document;
- loads a complete snapshot through `DrawingWorkspacePort.load()`;
- retains only still-existing selected ids after an authoritative replacement;
- stores viewport, pointer, toggles, and selection locally;
- has no module-global state shared by two Store instances;
- exposes a cleanup that unsubscribes and releases any loaded source resource.

Define the wire-neutral public interfaces from the design document:

```ts
export interface DrawingWorkspacePort {
  load(signal?: AbortSignal): Promise<DrawingWorkspaceSnapshot | null>;
  commit(
    request: DrawingWorkspaceCommitRequest,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  loadSource?(
    source: DrawingSourceRef,
    signal?: AbortSignal,
  ): Promise<DrawingSourceResource>;
  subscribe?(listener: () => void): () => void;
}
```

Run: `pnpm vitest run packages/drawing-workspace/src/store.test.ts`

Expected: FAIL because the package and Store factory do not exist.

**Step 2: Implement the package contract and scoped Store**

Implement `createDrawingWorkspaceStore({ port })` with these state groups:

- authority: `snapshot`, `status`, `busy`, `error`;
- viewport: `x`, `y`, `scale`, `width`, `height`;
- interaction: `selectedIds`, `mouseWorld`, drag mode;
- display: grid, axes, relations, annotations, source underlay;
- actions: load, refresh, commit, select, toggle, set viewport, fit, clear error, destroy.

Use `zustand/vanilla`. Do not optimistically mutate the Drawing document. A successful commit replaces the entire authoritative snapshot returned by the port.

**Step 3: Add command builders and revision conflict behavior**

Write failing tests for property edit, visibility, delete, and annotation-text movement. Each action must produce canonical `drawing-core` commands and submit the current expected revision. Write a conflict test proving that a rejected stale revision triggers one reload and leaves a visible error instead of silently overwriting state.

Run: `pnpm vitest run packages/drawing-workspace/src/store.test.ts`

Expected: FAIL on command and conflict assertions.

Implement command builders by reusing existing transaction helpers where possible. Add stable workspace error codes (`load_failed`, `commit_failed`, `revision_conflict`, `source_failed`).

**Step 4: Verify package boundaries**

Add an import-boundary test that rejects imports containing `react`, `@deepseek`, `express`, `src/hooks/useStore`, and `src/services`.

Run:

```bash
pnpm --filter @vectorai/drawing-workspace check
pnpm --filter @vectorai/drawing-workspace test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/drawing-workspace tsconfig.json vite.config.ts pnpm-lock.yaml
git commit -m "feat: add headless drawing workspace"
```

### Task 2: Create the shared React viewer foundation

**Files:**

- Create: `packages/drawing-viewer-react/package.json`
- Create: `packages/drawing-viewer-react/tsconfig.json`
- Create: `packages/drawing-viewer-react/src/index.ts`
- Create: `packages/drawing-viewer-react/src/provider.tsx`
- Create: `packages/drawing-viewer-react/src/hooks.ts`
- Create: `packages/drawing-viewer-react/src/DrawingWorkspace.tsx`
- Create: `packages/drawing-viewer-react/src/styles.css`
- Create: `packages/drawing-viewer-react/src/provider.test.tsx`
- Modify: `vite.config.ts`

**Step 1: Write failing scoped-provider tests**

Test that `DrawingWorkspaceProvider`:

- creates or accepts exactly one scoped workspace Store;
- loads on mount and destroys on unmount;
- gives nested components selected slices without sharing state across two providers;
- renders explicit loading, empty, ready, busy, and error states;
- accepts optional preview-overlay contributions without granting Store mutation access.

Run: `pnpm vitest run packages/drawing-viewer-react/src/provider.test.tsx`

Expected: FAIL because the provider package does not exist.

**Step 2: Implement provider, hooks, shell, and standalone CSS**

Implement Store context using `useSyncExternalStore`. Export typed selector hooks and `DrawingWorkspace` composition slots. Define package-root CSS variables under `.vai-workspace` and plain emitted classes; do not rely on Tailwind utilities.

Run:

```bash
pnpm vitest run packages/drawing-viewer-react/src/provider.test.tsx
pnpm --filter @vectorai/drawing-viewer-react check
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/drawing-viewer-react vite.config.ts pnpm-lock.yaml
git commit -m "feat: add shared drawing viewer foundation"
```

### Task 3: Move geometry and SVG rendering into the shared viewer

**Files:**

- Move: `src/components/canvas/EntityRenderer.tsx` → `packages/drawing-viewer-react/src/canvas/EntityRenderer.tsx`
- Move: `src/components/canvas/SceneNodeRenderer.tsx` → `packages/drawing-viewer-react/src/canvas/SceneNodeRenderer.tsx`
- Move relevant pure helpers and tests from `src/components/canvas/` → `packages/drawing-viewer-react/src/canvas/`
- Create: `packages/drawing-viewer-react/src/canvas/Canvas.tsx`
- Create: `packages/drawing-viewer-react/src/canvas/Canvas.test.tsx`
- Create: `packages/drawing-viewer-react/src/canvas/SourceUnderlay.tsx`
- Modify website imports under: `src/components/**`

**Step 1: Establish render and interaction parity tests**

Port existing renderer/helper tests first. Add Canvas tests for:

- visible X/Y axes, grid labels, and deterministic grid pattern ids;
- pointer-centered wheel zoom with min/max scale;
- middle-button and Space+drag pan;
- fit-to-drawing from entity bounds;
- click, modifier multi-select, empty-background clear, and box selection;
- relation and annotation visibility filters;
- selected styling and annotation text drag commit;
- optional raster underlay behind vector entities.

Run: `pnpm vitest run packages/drawing-viewer-react/src/canvas`

Expected: FAIL while Canvas is absent and moved imports are unresolved.

**Step 2: Move pure renderers and implement controlled Canvas**

Use mechanical moves for the tested pure helpers, then replace singleton Store reads with shared selector hooks. Keep website Agent/partition preview layers out of the base Canvas. Render public `PreviewOverlayContribution` entries in a separate non-authoritative overlay group.

Keep all SVG coordinates in Drawing world space. Keep viewport transforms and drag transient state local. Accessibility: the Canvas container is focusable, exposes an accessible name, and supports Escape to clear an active box selection/drag.

**Step 3: Verify focused and legacy tests**

Run:

```bash
pnpm vitest run packages/drawing-viewer-react/src/canvas
pnpm vitest run src/components/canvas src/components/Canvas.test.tsx
```

Expected: PASS after compatibility re-exports/import updates.

**Step 4: Commit**

```bash
git add packages/drawing-viewer-react src/components
git commit -m "feat: share interactive drawing canvas"
```

### Task 4: Add shared object browser, inspector, toolbar, and status

**Files:**

- Create: `packages/drawing-viewer-react/src/panels/ObjectList.tsx`
- Create: `packages/drawing-viewer-react/src/panels/PropertyInspector.tsx`
- Create: `packages/drawing-viewer-react/src/panels/WorkspaceToolbar.tsx`
- Create: `packages/drawing-viewer-react/src/panels/WorkspaceStatus.tsx`
- Create: `packages/drawing-viewer-react/src/panels/panels.test.tsx`
- Modify: `packages/drawing-viewer-react/src/DrawingWorkspace.tsx`
- Modify: `packages/drawing-viewer-react/src/styles.css`

**Step 1: Write failing behavior tests**

Test object grouping, select/multi-select, visibility, and delete. Test property editing for supported entity and annotation fields, read-only display for unsupported fields, annotation text editing, display toggles, fit action, cursor coordinates, scale percentage, drawing id, revision, busy state, and error banner.

Run: `pnpm vitest run packages/drawing-viewer-react/src/panels/panels.test.tsx`

Expected: FAIL because panels are absent.

**Step 2: Implement the complete shared workspace composition**

Compose a stable three-region layout: object browser, central Canvas, property inspector; add compact toolbar and status bar. Make side panels collapsible for narrow DSH panes. Disable mutating controls from snapshot capabilities or while a commit is busy.

Run:

```bash
pnpm vitest run packages/drawing-viewer-react/src
pnpm --filter @vectorai/drawing-viewer-react check
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/drawing-viewer-react
git commit -m "feat: complete shared drawing workspace UI"
```

### Task 5: Connect the standalone website through a compatibility port

**Files:**

- Create: `src/adapters/website-drawing-workspace-port.ts`
- Create: `src/adapters/website-drawing-workspace-port.test.ts`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/components/TopToolbar.tsx`
- Modify: `src/index.css`
- Modify as required: `src/hooks/useStore.ts`

**Step 1: Write failing adapter tests**

Prove that the website port:

- maps the current local Drawing/revision into a full workspace snapshot;
- delegates commands through the existing canonical Drawing action path;
- emits subscription changes when imports, Agent tool edits, undo, or reset replace the Drawing;
- never calls Express solely for viewport, selection, or manual UI state;
- maps a local imported image to a disposable source resource rather than copying it into each snapshot.

Run: `pnpm vitest run src/adapters/website-drawing-workspace-port.test.ts`

Expected: FAIL because the adapter does not exist.

**Step 2: Implement the strangler adapter**

Wrap the existing Store narrowly. If the existing action surface cannot commit a generic command batch, add one canonical `commitDrawingCommands` action and test it; do not expose the entire Store to the shared Viewer.

**Step 3: Replace the website workspace UI**

Render the shared `DrawingWorkspace` in `Home.tsx` while retaining the website AI chat as a sibling host panel. Remove duplicate website-only object browser/inspector/canvas rendering from the active path. Register website-only preview overlays through the public contribution slot where they remain useful.

**Step 4: Verify website behavior**

Run:

```bash
pnpm vitest run src/adapters src/pages/Home.test.tsx src/components/TopToolbar.test.tsx src/hooks/useStore.test.ts
pnpm check
pnpm build
```

Expected: PASS, with no shared-package import of website services or singleton state.

**Step 5: Commit**

```bash
git add src package.json pnpm-lock.yaml
git commit -m "refactor: run website on shared drawing viewer"
```

### Task 6: Upgrade DSH contracts and Host repository to full snapshots and commits

**Files:**

- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`

**Step 1: Write failing full-snapshot schema tests**

Replace the projection-only schema expectations with strict Zod schemas for the complete Drawing snapshot, source reference, capabilities, command request, successful commit, and stable conflict/error results. Reject unknown keys and invalid revisions.

Run: `pnpm vitest run packages/plugin-space-contracts packages/plugin-dsh-space-host/src/repository.test.ts`

Expected: FAIL against the old projection and repository surface.

**Step 2: Implement canonical Host commits**

Keep one authoritative Drawing repository per DSH session. The repository accepts only expected-revision command requests, attaches the actor from Host scope, validates through `drawing-core`, stores the authoritative new revision, and notifies subscribers. Existing `drawing_import` and future tools must use the same commit path.

**Step 3: Implement session-scoped TypeRT methods**

Expose snapshot and commit methods whose session identity comes from the DSH Remote scope, not a client-provided arbitrary id. Add changed notification support if the rc.8 API exposes it; otherwise use a bounded client refresh triggered by known tool/session events and document that compatibility path.

**Step 4: Verify Host and contracts**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-space-host
git commit -m "feat: expose full DSH drawing workspace API"
```

### Task 7: Replace the DSH preview with the shared Viewer

**Files:**

- Create: `packages/plugin-dsh-space-client/src/dsh-workspace-port.ts`
- Create: `packages/plugin-dsh-space-client/src/dsh-workspace-port.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/DrawingCanvas.tsx`
- Modify: `packages/plugin-dsh-space-client/src/DrawingCanvas.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.test.ts`
- Modify: `packages/plugin-dsh-space-client/package.json`
- Modify: `scripts/build-dsh-space.mjs`

**Step 1: Write failing Remote-port and mount tests**

Test load/commit/result mapping, conflict mapping, abort handling, source cleanup, refresh subscription behavior, and session isolation. Update the client mount test to require the full shared workspace rather than the old projection SVG.

Run: `pnpm vitest run packages/plugin-dsh-space-client/src`

Expected: FAIL because the Remote port and shared workspace mount are absent.

**Step 2: Implement the DSH port and shared mount**

Create one port and scoped Store per DSH conversation view mount. Render the shared `DrawingWorkspace`, import its package CSS, keep DSH-specific empty-state guidance at the host edge, and destroy the Store/resources/style element on unmount.

**Step 3: Bundle all runtime dependencies**

Update `scripts/build-dsh-space.mjs` so the lazy DSH client artifact includes the shared Viewer code and standalone CSS without unresolved pnpm workspace imports. Keep React/DSH runtime dependencies external only where required by DSH.

**Step 4: Verify package and artifact**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/plugin-dsh-space-client check
pnpm build:dsh-space
rg "DrawingWorkspace|vai-workspace" packages/plugin-dsh-space/dist
```

Expected: PASS and generated Host/client artifacts contain the shared workspace integration.

**Step 5: Commit**

```bash
git add packages/plugin-dsh-space-client packages/plugin-dsh-space scripts/build-dsh-space.mjs
git commit -m "feat: mount shared drawing viewer in DSH"
```

### Task 8: Document second-layer extension and remove active-path duplication

**Files:**

- Create: `docs/architecture/drawing-workspace.md`
- Create: `docs/architecture/engineering-annotation-plugin.md`
- Modify: `README.md`
- Modify/delete only when proven unused: legacy active-path UI files under `src/components/`

**Step 1: Add an architectural dependency test**

Add or extend tests proving:

- first-layer shared packages never import second-layer engineering annotation code;
- second-layer preview contributions receive immutable document/viewport inputs;
- website and DSH adapters depend inward on shared contracts;
- uninstalling the second layer does not affect committed annotation rendering/editing.

Run: `pnpm vitest run src/drawing/tests/dependency-boundary.test.ts packages/drawing-workspace packages/drawing-viewer-react`

Expected: PASS after enforcing boundaries.

**Step 2: Write operator and contributor documentation**

Document local-only ownership, repository independence between website and DSH, the port contract, DSH session scope, source-resource lifetime, transaction/conflict semantics, preview contribution API, and how the future Engineering Annotation plugin consumes the first layer without private imports.

Remove duplicate legacy UI files only after `rg` proves no imports remain and the full test/build suite remains green. Preserve unrelated HyperFrames code as previously directed.

**Step 3: Commit**

```bash
git add docs README.md src packages
git commit -m "docs: define drawing plugin extension boundary"
```

### Task 9: Full regression and local DSH acceptance

**Files:**

- Modify if needed: `packages/plugin-dsh-space/README.md`
- Modify if needed: migration/acceptance notes under `docs/`

**Step 1: Run repository verification from a clean build state**

Run:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm build:dsh-space
git diff --check
git status --short
```

Expected: all tests, type checks, lint, website build, plugin build, and whitespace checks pass; only intentional generated/plugin files appear.

**Step 2: Install/mount the local DSH bundle and smoke test**

Use the existing local DSH executable/profile and the documented local bundle installation path. Start on a non-conflicting temporary port with logs captured to a temporary directory. Verify:

- DSH starts and the conversation view mounts without a black terminal window requirement;
- paste/import accepts the configured 20 MiB and 16,384-pixel limits;
- imported provisional entities appear on the same shared workspace used by the website;
- axes, grid, pan, zoom, fit, selection, object list, visibility/delete, inspector edits, annotation controls, coordinates, and revision status operate;
- closing/unmounting the view releases its Store and source resource;
- no VectorAI Express or cloud process is needed.

Stop only the temporary validation process started for this task. Do not stop an unrelated user DSH process.

**Step 3: Record exact evidence**

Update acceptance notes with commands, test counts, artifact locations, the temporary port used, and any rc.8 compatibility limitation. Do not claim unverified UI behavior.

**Step 4: Final commit**

```bash
git add docs packages/plugin-dsh-space/README.md
git commit -m "test: verify shared viewer migration"
```

**Step 5: Branch handoff check**

Run:

```bash
git status --short
git log --oneline --decorate -12
```

Expected: clean working tree and an auditable sequence of migration commits on `codex/dsh-plugin-migration`.
