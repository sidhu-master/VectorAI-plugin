# Extensible 2D Space Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the first-layer 2D Space plugin into a versioned surface platform that can host a separately packaged, sticky Engineering Annotation workspace while preserving one Drawing authority and the existing default UI.

**Architecture:** Add a host-neutral `drawing-surface-api` contract package, expose a readonly/action-only runtime from `drawing-workspace`, and refactor the React viewer into controlled primitives plus a compatibility composition. The first-layer DSH Client remains the sole `conversation.workspace` owner and elects registered contributions; the first-layer Host remains the only revision/Preview/Commit authority through a staged extension protocol.

**Tech Stack:** TypeScript 5.8, React 18, Zustand vanilla, Vitest, DSH/Cordis rc.8, pnpm workspaces, Zod/Typert strict codecs.

**Spec:** `docs/specs/extensible-2d-space-surface.md`

## Global Constraints

- One authoritative Drawing repository and revision history per DSH session.
- The first-layer DSH Client is the sole registrant of `conversation.workspace`.
- No Store, React Context, mutable snapshot, DSH type, or global singleton crosses a plugin contribution boundary.
- Workspace activation follows a successful explicit capability route, never message text, upload presence, or Drawing presence.
- A specialized session claim survives completed, canceled, failed, idle, needs-rebase, reload, and temporary contribution unavailability.
- Primary user selection, plugin attention, Preview, and formal annotation remain separate presentation channels.
- Only the first layer compiles, validates, assesses, finalizes, persists, and creates Undo/Redo history.
- Existing first-layer Viewer behavior and public exports remain compatible.
- All changes use TDD and each task ends with focused tests, checks, and a commit.

---

### Task 1: Versioned Drawing Surface API

**Files:**
- Create: `packages/drawing-surface-api/package.json`
- Create: `packages/drawing-surface-api/tsconfig.json`
- Create: `packages/drawing-surface-api/src/index.ts`
- Create: `packages/drawing-surface-api/src/index.test.ts`
- Create: `packages/drawing-surface-api/src/dependency-boundary.test.ts`

**Interfaces:**
- Consumes: type-only `DrawingWorkspaceSnapshot`, `DrawingWorkspaceViewport`, `DrawingWorkspaceCommitRequest`, and query contracts from public VectorAI packages.
- Produces: `DRAWING_SURFACE_API_VERSION`, `DrawingSurfaceObservable<T>`, `DrawingSurfaceRuntime`, `DrawingWorkspaceContribution`, `DrawingCanvasLayerContribution`, `DrawingInteractionToolContribution`, `DrawingWorkspaceClaim`, `Disposable`.

- [ ] **Step 1: Write contract tests**

Create tests proving an observable subscribes without exposing mutation, workspace contributions require `apiVersion: 1`, and deterministic election sorts by active claim epoch, priority, then ID. The fixture must include an unavailable contribution and assert fallback remains eligible.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/drawing-surface-api/src/index.test.ts`

Expected: FAIL because the package implementation does not exist.

- [ ] **Step 3: Implement the contract package**

Export these normative shapes:

```ts
export const DRAWING_SURFACE_API_VERSION = 1 as const;
export interface Disposable { dispose(): void }
export interface DrawingSurfaceObservable<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}
export interface DrawingWorkspaceClaim {
  active: boolean;
  activationEpoch: number;
}
export interface DrawingWorkspaceContribution<Props = DrawingSurfaceComponentProps> {
  id: string;
  apiVersion: 1;
  priority: number;
  claim: DrawingSurfaceObservable<DrawingWorkspaceClaim>;
  Component: DrawingSurfaceComponent<Props>;
}
export interface DrawingSurfaceRegistry {
  registerWorkspace(contribution: DrawingWorkspaceContribution): Disposable;
  getWorkspaceSnapshot(): DrawingWorkspaceRegistrySnapshot;
  subscribe(listener: () => void): () => void;
}
```

Define canvas-layer and interaction-tool contracts with namespaced IDs, ordered priority, explicit activation observables, pointer-result arbitration, and disposal. Keep React as type-only via a local component function signature rather than importing the React runtime.

- [ ] **Step 4: Add dependency-boundary tests**

Read all production source and reject runtime imports of React, Zustand, DSH, Node builtins, plugin packages, or browser globals.

- [ ] **Step 5: Verify GREEN and package check**

Run: `pnpm exec vitest run packages/drawing-surface-api/src && pnpm --filter @vectorai/drawing-surface-api check`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/drawing-surface-api pnpm-lock.yaml
git commit -m "feat add versioned drawing surface contracts"
```

### Task 2: Readonly Drawing Surface Runtime

**Files:**
- Create: `packages/drawing-workspace/src/surface-runtime.ts`
- Create: `packages/drawing-workspace/src/surface-runtime.test.ts`
- Modify: `packages/drawing-workspace/src/index.ts`
- Modify: `packages/drawing-workspace/package.json`

**Interfaces:**
- Consumes: `DrawingWorkspaceStore` and Task 1 observable/action contracts.
- Produces: `createDrawingSurfaceRuntime(store): DrawingSurfaceRuntime` and `createStoreObservable(store, selector)`.

- [ ] **Step 1: Write failing authority tests**

Assert runtime snapshots are deeply cloned/readonly from the consumer perspective, subscriptions only fire when the selected projection changes, actions delegate to Store methods, query is unavailable unless injected, and no `setState`/Store API is present on the returned object.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/drawing-workspace/src/surface-runtime.test.ts`

Expected: FAIL on missing module/export.

- [ ] **Step 3: Implement observable projections and restricted actions**

Expose snapshot, viewport, selection and presentation observables. Actions contain only `setViewport`, `setSelection`, `stage`, `undo`, `redo`, plus an injected bounded query callback. Do not expose `getState`, `setState`, motion-rig internals, or the Port.

- [ ] **Step 4: Verify focused and package suites**

Run: `pnpm exec vitest run packages/drawing-workspace/src && pnpm --filter @vectorai/drawing-workspace check`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/drawing-workspace packages/drawing-surface-api/package.json pnpm-lock.yaml
git commit -m "feat expose restricted drawing surface runtime"
```

### Task 3: Controlled Canvas Primitives and Compatibility Composition

**Files:**
- Create: `packages/drawing-viewer-react/src/surface/DrawingSurface.tsx`
- Create: `packages/drawing-viewer-react/src/surface/layers.tsx`
- Create: `packages/drawing-viewer-react/src/surface/controllers.ts`
- Create: `packages/drawing-viewer-react/src/surface/DrawingSurface.test.tsx`
- Create: `packages/drawing-viewer-react/src/surface/controllers.test.ts`
- Modify: `packages/drawing-viewer-react/src/canvas/Canvas.tsx`
- Modify: `packages/drawing-viewer-react/src/DrawingWorkspace.tsx`
- Modify: `packages/drawing-viewer-react/src/index.ts`

**Interfaces:**
- Consumes: plain readonly snapshot/viewport/selection props and callback actions.
- Produces: `DrawingSurface`, `GridLayer`, `AxesLayer`, `SourceLayer`, `GeometryLayer`, `AnnotationLayer`, `RelationLayer`, `SelectionLayer`, `PreviewLayer`, `PanZoomController`, `SelectionController`.

- [ ] **Step 1: Add controlled-surface tests**

Render without `DrawingWorkspaceProvider`; assert geometry, grid, axes, source and selection render from props. Simulate blank click, node click, wheel zoom, Space/middle pan and box selection through callbacks. Assert a custom layer can render attention without changing `selectedIds`.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/drawing-viewer-react/src/surface`

Expected: FAIL because controlled exports do not exist.

- [ ] **Step 3: Extract layers and navigation controllers**

Move pure SVG assembly and event arbitration out of `Canvas.tsx`. Controllers receive an event DTO and return `{ handled: boolean; capture?: boolean }`; only one primary controller handles a left-button start, while wheel and middle/Space navigation remain shared.

- [ ] **Step 4: Rebuild compatibility wrappers**

Keep `Canvas` as a Provider-backed adapter that reads Store state and passes controlled props. Keep `DrawingWorkspace` behavior and exports unchanged. Compose Grounding and Motion Rig as optional first-layer layers/controllers included by the default wrapper.

- [ ] **Step 5: Verify parity**

Run: `pnpm exec vitest run packages/drawing-viewer-react/src && pnpm --filter @vectorai/drawing-viewer-react check`

Expected: existing and new tests pass, including blank deselection, pan/zoom, Motion Rig, Preview, activity bar, property editing, Undo/Redo.

- [ ] **Step 6: Commit**

```bash
git add packages/drawing-viewer-react
git commit -m "refactor expose controlled drawing surface primitives"
```

### Task 4: DSH Workspace Registry and Sticky Claim Election

**Files:**
- Create: `packages/plugin-dsh-space-client/src/surface-registry.ts`
- Create: `packages/plugin-dsh-space-client/src/surface-registry.test.ts`
- Create: `packages/plugin-dsh-space-client/src/DrawingSurfaceHost.tsx`
- Create: `packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Modify: `packages/plugin-dsh-space-client/src/index.ts`
- Modify: `packages/plugin-dsh-space-client/package.json`

**Interfaces:**
- Consumes: Task 1 contribution contracts and Task 2 runtime.
- Produces: `createDrawingSurfaceRegistry()`, `DrawingSurfaceHost`, and a Cordis-injected `drawingSurfaceRegistry` service for independently loaded Client plugins.

- [ ] **Step 1: Write registry election/lifecycle tests**

Cover duplicate IDs, incompatible versions, inactive claims, greatest activation epoch, priority/ID tie-breaking, registration disposal, contribution render error containment, missing claimed contribution fallback, and re-registration restoration.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/plugin-dsh-space-client/src/surface-registry.test.ts packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx`

Expected: FAIL on missing registry/host.

- [ ] **Step 3: Implement session-scoped registry views**

The registry stores contribution definitions, while each `DrawingSurfaceHost` binds their claim observables for one session. Registration alone never activates a specialized UI. The built-in `DrawingWorkspace` is a non-removable fallback outside the contribution table.

- [ ] **Step 4: Replace direct default rendering**

`DrawingConversationView` creates one restricted runtime and renders `DrawingSurfaceHost`. Keep the existing rule that no Drawing and no active specialized claim renders nothing. Preserve upload behavior and resource cleanup.

- [ ] **Step 5: Verify Client package**

Run: `pnpm exec vitest run packages/plugin-dsh-space-client/src && pnpm --filter @vectorai/plugin-dsh-space-client check`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-space-client pnpm-lock.yaml
git commit -m "feat add session scoped drawing surface host"
```

### Task 5: Staged Host Extension Preview Protocol

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Create: `packages/plugin-dsh-space-host/src/extension-preview-service.ts`
- Create: `packages/plugin-dsh-space-host/src/extension-preview-service.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-host/src/index.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.test.ts`

**Interfaces:**
- Produces public `DrawingSpaceExtensionHost` with `createExtensionPreview`, `replaceExtensionPreview`, `assessExtensionPreview`, `finalizeExtensionPreview`, and `discardExtensionPreview`.
- Every request binds `extensionId`, `workflowId`, current Drawing ref, opaque preview token, and candidate digest.

- [ ] **Step 1: Write protocol and ownership tests**

Cover strict codecs and forbidden unknown fields, create/replace/assess/finalize/discard, extension/workflow isolation, stale revision, token expiry, digest mismatch, idempotent finalization, exactly one durable revision, and Undo.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/plugin-space-contracts/src/index.test.ts packages/plugin-dsh-space-host/src/extension-preview-service.test.ts`

Expected: FAIL on missing contracts/service.

- [ ] **Step 3: Implement staged service over existing repository authority**

Store opaque extension preview metadata in a session-scoped service, but keep candidate Commands in the first-layer repository Preview. Validate ownership before any operation. Replacing succeeds only after the replacement compiles; stale or rejected replacements leave the prior candidate intact. Finalize delegates to existing assessment and durable operation binding.

- [ ] **Step 4: Reimplement one-shot convenience method**

Keep `runExtensionProgram()` for compatibility, but implement it as create → assess → finalize/discard through the new interface.

- [ ] **Step 5: Verify Host and contract suites**

Run: `pnpm exec vitest run packages/plugin-space-contracts/src packages/plugin-dsh-space-host/src && pnpm --filter @vectorai/plugin-dsh-space-host check`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-space-host
git commit -m "feat add staged extension preview authority"
```

### Task 6: Packaged Annotation Workspace Contribution

**Files:**
- Create: `packages/plugin-dsh-annotation-client/package.json`
- Create: `packages/plugin-dsh-annotation-client/tsconfig.json`
- Create: `packages/plugin-dsh-annotation-client/src/index.ts`
- Create: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/client.test.tsx`
- Modify: `packages/plugin-dsh-annotation/src/index.ts`
- Modify: `packages/plugin-dsh-annotation/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation/src/tools.test.ts`
- Modify: `packages/plugin-dsh-annotation/package.json`
- Modify: `packages/plugin-dsh-space/package.json`
- Modify: `packages/plugin-dsh-space/cordis.patch.yml`

**Interfaces:**
- Consumes: public `DrawingSpaceExtensionHost` and Client `DrawingSurfaceRegistry` injection only.
- Produces: persistent `AnnotationSessionState { workspaceClaimed, activationEpoch, workflow }` and an independently built annotation Workspace contribution.

- [ ] **Step 1: Write routing and dependency tests**

Assert installation, upload, ordinary conversation, and basic first-layer tools do not claim. A successful annotation capability route claims. completed/canceled/failed/idle/needs-rebase keep the claim. Unload causes fallback; reload/reinstall restores the contribution. Reject imports of first-layer Store, repository, Client internals, or React Context.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run packages/plugin-dsh-annotation/src packages/plugin-dsh-annotation-client/src`

Expected: FAIL because claim projection and Client package do not exist.

- [ ] **Step 3: Implement durable Host claim projection**

Persist claim state per DSH session alongside annotation workflow state. Set it only after the annotation tool has validated a real Drawing and started/resumed the capability. Task terminal states update workflow but never clear `workspaceClaimed`.

- [ ] **Step 4: Implement minimal independent Client workspace**

Register through the injected registry. Render a namespaced annotation shell using controlled DrawingSurface primitives, an annotation rail, workflow status, and a temporary candidate layer. Do not cross a Store or Provider. This is a packaged test contribution, not the final production annotation UI.

- [ ] **Step 5: Verify packages and build artifact**

Run: `pnpm exec vitest run packages/plugin-dsh-annotation/src packages/plugin-dsh-annotation-client/src && pnpm --filter @vectorai/plugin-dsh-annotation check && pnpm --filter @vectorai/plugin-dsh-annotation-client check && pnpm build:dsh-space`

Expected: all pass and the bundle contains both first-layer fallback and annotation contribution registration.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-annotation packages/plugin-dsh-annotation-client packages/plugin-dsh-space pnpm-lock.yaml scripts/build-dsh-space.mjs
git commit -m "feat add sticky annotation workspace contribution"
```

### Task 7: Packaged Integration, Documentation, and Release Gate

**Files:**
- Create: `scripts/e2e-drawing-surface-contribution.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/development.md`
- Delete after completion: `docs/superpowers/plans/2026-08-24-extensible-2d-space-platform.md`

**Interfaces:**
- Consumes built Host/Client artifacts, not workspace source shortcuts.
- Produces one release command `e2e:drawing-surface` and stable current-state documentation.

- [ ] **Step 1: Write packaged lifecycle E2E**

Test this exact sequence: default UI → successful annotation capability → annotation UI → complete → annotation UI remains → cancel → annotation UI remains → reload → annotation UI remains → unload contribution → first-layer fallback → reinstall → annotation UI restored. Assert formal edits still create one first-layer revision and Undo record.

- [ ] **Step 2: Verify RED then GREEN**

Run before wiring: `pnpm e2e:drawing-surface`; expected FAIL because the command/artifact is absent. Add the script and package command, then rerun; expected PASS.

- [ ] **Step 3: Update canonical docs**

Move implemented Surface decisions from “planned” to “current”; keep production annotation recognition/layout explicitly planned. Document public package exports, claim lifecycle, staged extension protocol, package installation, and failure recovery.

- [ ] **Step 4: Run full release gate**

```bash
pnpm test
pnpm check
pnpm build
pnpm build:dsh-space
pnpm test:dsh-launcher
pnpm e2e:host-owned-semantic-edit
pnpm e2e:motion-rig
pnpm e2e:drawing-surface
```

Expected: every command exits 0.

- [ ] **Step 5: Remove the temporary plan and commit**

```bash
git rm docs/superpowers/plans/2026-08-24-extensible-2d-space-platform.md
git add README.md docs package.json scripts packages
git commit -m "docs complete extensible drawing surface platform"
```

