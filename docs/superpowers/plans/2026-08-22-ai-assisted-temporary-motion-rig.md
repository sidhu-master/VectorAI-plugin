# AI-Assisted Temporary Motion Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AI prepare a temporary fixed-anchor motion rig, then let the user drag its control body while a deterministic local solver reshapes connectors and the existing interactive commit path records one undoable change.

**Architecture:** `drawing-edit-core` owns pure role resolution and geometry solving. The DSH Host owns a revision-bound ephemeral rig and exposes a trusted projection through `drawing-workspace` contracts. The shared workspace store and canvas own local drag candidates, Preview confirmation, and selection-based correction; DSH contributes only a semantic activation tool and adapter methods.

**Tech Stack:** TypeScript 5.8, Vitest 3, React 18, Zustand 5, Zod 4, DSH Typert remote protocol

**Spec:** `docs/superpowers/specs/2026-08-22-ai-assisted-temporary-motion-rig-design.md`

## Global Constraints

- AI supplies semantic intent only; no model-visible node IDs, coordinates, translation vectors, or opaque rig handles.
- Pointer-time solving is synchronous and local; no model, Host, or network call occurs on pointer move.
- Version one translates the control body without rotating it and keeps every connector fixed endpoint unchanged.
- Invalid or unsupported connector geometry fails closed and never falls back to rigidly translating the connector.
- Rig state is ephemeral, revision-bound, absent from Drawing persistence and DXF export, and cleared after confirm or cancel.
- The feature is adapter-neutral and requires no DSH source modification or global prompt.
- Ordinary image upload does not create a rig, reveal a workspace, or trigger vectorization.

---

### Task 1: Pure motion-rig resolver and local solver

**Files:**
- Create: `packages/drawing-edit-core/src/motion-rig.ts`
- Create: `packages/drawing-edit-core/src/motion-rig.test.ts`
- Modify: `packages/drawing-edit-core/src/index.ts`

**Interfaces:**
- Consumes: `DrawingDocument`, `GeometryNode`, `Vec2`, and `DrawingTransactionCommand`.
- Produces: `resolveTranslationMotionRig(document, selectedNodeIds): MotionRigDefinition` and `solveTranslationMotionRig(document, rig, delta): MotionRigSolveResult`.

- [ ] **Step 1: Write failing resolver tests**

Add tests proving that a selected circular carrier plus two attached line connectors resolves one control body, two connector bindings, a centroid display anchor, and a carrier-center handle; include a selected multi-node control body and disconnected connector nodes.

```ts
const rig = resolveTranslationMotionRig(document, ['hand-outline', 'hand-detail']);
expect(rig.controlBodyNodeIds).toEqual(['hand-detail', 'hand-outline']);
expect(rig.connectors.map(({ nodeId }) => nodeId)).toEqual(['arm-a', 'arm-b']);
expect(rig.allowControlRotation).toBe(false);
```

- [ ] **Step 2: Run resolver tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-edit-core test -- motion-rig.test.ts`  
Expected: FAIL because `resolveTranslationMotionRig` is not exported.

- [ ] **Step 3: Implement the minimal resolver**

Define stable public types:

```ts
export interface MotionRigConnectorBinding {
  nodeId: string;
  movingEndpoint: 'start' | 'end' | 'first' | 'last';
  fixedPoint: Vec2;
}

export interface MotionRigDefinition {
  controlBodyNodeIds: string[];
  connectors: MotionRigConnectorBinding[];
  anchor: Vec2;
  handle: Vec2;
  keepAnchorFixed: true;
  keepControlBodyRigid: true;
  preserveConnectivity: true;
  allowControlRotation: false;
}
```

Resolve carrier contacts for line, open polyline, and open spline endpoints. Use Drawing-relative tolerance, choose one unambiguous circle/ellipse carrier among selected control nodes, include all selected non-connector nodes as the rigid control body, order IDs deterministically, and throw stable `MOTION_RIG_*` errors for missing, ambiguous, closed, degenerate, arc, ray, or xline cases.

- [ ] **Step 4: Run resolver tests and verify GREEN**

Run: `pnpm --filter @vectorai/drawing-edit-core test -- motion-rig.test.ts`  
Expected: PASS.

- [ ] **Step 5: Write failing solver tests**

Test a line, polyline, and spline connector. Assert the fixed endpoint is byte-for-byte unchanged, the control-side endpoint moves by the requested delta, intermediate points receive monotonic path-distance weights, and every selected control node receives a pure translation with no angle/axis mutation. Test that invalid deltas and unsupported arcs throw without returning commands.

```ts
const solved = solveTranslationMotionRig(document, rig, [20, 10]);
expect(update(solved.commands, 'arm-line').changes.start).toEqual([0, 0]);
expect(update(solved.commands, 'arm-line').changes.end).toEqual([40, 30]);
expect(update(solved.commands, 'hand').changes.center).toEqual([40, 30]);
```

- [ ] **Step 6: Run solver tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-edit-core test -- motion-rig.test.ts`  
Expected: FAIL because `solveTranslationMotionRig` is not implemented.

- [ ] **Step 7: Implement the minimal solver**

Return commands and a candidate generated with `applyDrawingTransaction`:

```ts
export interface MotionRigSolveResult {
  commands: DrawingTransactionCommand[];
  candidate: DrawingDocument;
}
```

Translate point, line, circle, arc, ellipse, polyline, and spline fields for control-body nodes. Deform line endpoints directly. For polyline and spline connectors, compute cumulative distance from the fixed endpoint and apply `delta * (distance / totalDistance)` to each intermediate point. Reject non-finite or zero-length geometry and verify the fixed endpoint after applying commands.

- [ ] **Step 8: Run the package test and typecheck suites**

Run: `pnpm --filter @vectorai/drawing-edit-core test && pnpm --filter @vectorai/drawing-edit-core check`  
Expected: all tests and typecheck pass.

- [ ] **Step 9: Commit the pure core**

```bash
git add packages/drawing-edit-core/src/motion-rig.ts packages/drawing-edit-core/src/motion-rig.test.ts packages/drawing-edit-core/src/index.ts
git commit -m "feat: add deterministic temporary motion rig solver"
```

### Task 2: Workspace contracts and local Preview state

**Files:**
- Modify: `packages/drawing-workspace/package.json`
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-workspace/src/store.ts`
- Modify: `packages/drawing-workspace/src/store.test.ts`

**Interfaces:**
- Consumes: `MotionRigDefinition` and `solveTranslationMotionRig` from Task 1.
- Produces: `DrawingMotionRigProjection`, Host port methods, and workspace actions used by the canvas.

- [ ] **Step 1: Write failing contract/store tests**

Cover loading a current rig, rejecting stale projections, rebuilding after selection changes, local pointer candidate updates without port calls, pointer-up Preview, confirm as one `port.commit`, cancel with no commit, and clearing after snapshot revision changes.

```ts
store.getState().beginMotionRigDrag([20, 20]);
store.getState().updateMotionRigDrag([30, 35]);
expect(port.commit).not.toHaveBeenCalled();
store.getState().finishMotionRigDrag();
expect(store.getState().motionRig?.phase).toBe('preview');
await store.getState().confirmMotionRig();
expect(port.commit).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run workspace tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-workspace test -- store.test.ts`  
Expected: FAIL because motion-rig state and actions are absent.

- [ ] **Step 3: Add contracts and port methods**

Add:

```ts
export interface DrawingMotionRigProjection extends MotionRigDefinition {
  version: 1;
  drawingRef: DrawingWorkspaceRef;
  state: 'ready' | 'needs-correction';
  message?: string;
}

export interface DrawingMotionRigWorkspaceState {
  projection: DrawingMotionRigProjection;
  phase: 'ready' | 'dragging' | 'preview';
  message?: string;
}

export interface DrawingWorkspacePort {
  loadMotionRig?(signal?: AbortSignal): Promise<DrawingMotionRigProjection | null>;
  rebuildMotionRig?(ref: DrawingWorkspaceRef, nodeIds: string[], signal?: AbortSignal): Promise<DrawingMotionRigResult>;
  discardMotionRig?(ref: DrawingWorkspaceRef, signal?: AbortSignal): Promise<DrawingMotionRigDiscardResult>;
}
```

Add `@vectorai/drawing-edit-core` as a workspace dependency.

- [ ] **Step 4: Implement local motion-rig store state**

Add `motionRig`, `motionRigBaseSnapshot`, `motionRigCommands`, and actions:

```ts
rebuildMotionRigFromSelection(): Promise<boolean>;
beginMotionRigDrag(point: Vec2): void;
updateMotionRigDrag(point: Vec2): void;
finishMotionRigDrag(): void;
confirmMotionRig(): Promise<boolean>;
cancelMotionRig(): Promise<void>;
```

`updateMotionRigDrag` must call only the pure solver and update `displaySnapshot`. `finishMotionRigDrag` retains the candidate and changes the projection state to `preview`. `confirmMotionRig` calls the existing `commit({ commands })` exactly once, then discards Host rig state. `cancelMotionRig` restores the formal snapshot and asks the Host to discard the rig.

- [ ] **Step 5: Run workspace tests and typecheck**

Run: `pnpm --filter @vectorai/drawing-workspace test && pnpm --filter @vectorai/drawing-workspace check`  
Expected: all tests and typecheck pass.

- [ ] **Step 6: Commit workspace behavior**

```bash
git add packages/drawing-workspace/package.json packages/drawing-workspace/src/contracts.ts packages/drawing-workspace/src/store.ts packages/drawing-workspace/src/store.test.ts pnpm-lock.yaml
git commit -m "feat: add local motion rig preview state"
```

### Task 3: Host-owned rig service and semantic activation tool

**Files:**
- Create: `packages/plugin-dsh-space-host/src/motion-rig-service.ts`
- Create: `packages/plugin-dsh-space-host/src/motion-rig-service.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`

**Interfaces:**
- Consumes: current verified semantic parts or current canvas selection and `resolveTranslationMotionRig`.
- Produces: Host lifecycle methods plus the model-visible `drawing_create_motion_rig` tool.

- [ ] **Step 1: Write failing service tests**

Test creation from confirmed semantic selection, fallback to current canvas selection, correction rebuild, stale-revision invalidation, safe replacement, discard, and session disposal. Assert failed rebuilds retain the previous valid rig.

- [ ] **Step 2: Run service tests and verify RED**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test -- motion-rig-service.test.ts`  
Expected: FAIL because `MotionRigService` does not exist.

- [ ] **Step 3: Implement `MotionRigService`**

Use one private map keyed by trusted session ID. Expose:

```ts
create(sessionId: string, semanticNodeIds: string[]): DrawingCreateMotionRigResult;
current(sessionId: string): DrawingMotionRigProjection | null;
rebuild(sessionId: string, expectedRef: DrawingWorkspaceRef, nodeIds: string[]): DrawingMotionRigResult;
discard(sessionId: string, expectedRef?: DrawingWorkspaceRef): DrawingMotionRigDiscardResult;
disposeSession(sessionId: string): void;
```

Every method resolves the current repository snapshot and compares revisions before returning or mutating rig state.

- [ ] **Step 4: Write a failing semantic tool test**

Assert `drawing_create_motion_rig` has semantic string fields only, does not expose coordinates or node IDs, returns compact counts, refuses missing Drawings, and does not call import/vectorization.

- [ ] **Step 5: Run tool test and verify RED**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test -- tools.test.ts`  
Expected: FAIL because the tool is not registered.

- [ ] **Step 6: Register the semantic tool and service lifecycle**

Register:

```ts
drawing_create_motion_rig({
  target: string,
  controlRole?: string,
  fixedRole?: string,
  motion: 'translate',
})
```

The tool description must limit activation to explicit interactive articulation requests. It obtains exact nodes from `semantic.currentSelectedParts()` or `semantic.currentSelectionProjection()`, never from model arguments. Wire Host remote methods `getMotionRig`, `rebuildMotionRig`, and `discardMotionRig`, and clear the service on `session/disposed`.

- [ ] **Step 7: Run Host tests and typecheck**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test && pnpm --filter @vectorai/plugin-dsh-space-host check`  
Expected: all tests and typecheck pass.

- [ ] **Step 8: Commit Host behavior**

```bash
git add packages/plugin-dsh-space-host/src/motion-rig-service.ts packages/plugin-dsh-space-host/src/motion-rig-service.test.ts packages/plugin-dsh-space-host/src/semantic-tools.ts packages/plugin-dsh-space-host/src/tools.test.ts packages/plugin-dsh-space-host/src/service.ts
git commit -m "feat: expose host-owned temporary motion rigs"
```

### Task 4: Strict shared schemas and DSH remote adapter

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.test.ts`

**Interfaces:**
- Consumes: the workspace rig contracts and Host methods from Tasks 2–3.
- Produces: strict Zod codecs and a complete DSH `DrawingWorkspacePort` implementation.

- [ ] **Step 1: Write failing strict-schema tests**

Test valid ready/needs-correction projections, rebuild/discard results, and rejection of unknown properties. Explicitly assert that the model tool result schema contains neither node IDs nor a rig handle.

- [ ] **Step 2: Run schema tests and verify RED**

Run: `pnpm --filter @vectorai/plugin-space-contracts test`  
Expected: FAIL because rig schemas are absent.

- [ ] **Step 3: Implement and export strict rig schemas**

Add strict Zod schemas for connector bindings, projections, rebuild requests/results, and discard requests/results. Re-export all corresponding workspace TypeScript types.

- [ ] **Step 4: Write failing remote/adapter tests**

Assert all three methods are mounted with strict descriptors and that the DSH port forwards the trusted session ID, revision, and selection once per request.

- [ ] **Step 5: Run remote tests and verify RED**

Run: `pnpm --filter @vectorai/plugin-dsh-space-client test -- remote.test.ts dsh-workspace-port.test.ts`  
Expected: FAIL because the remote methods are absent.

- [ ] **Step 6: Implement DSH remote descriptors and port forwarding**

Add `drawingSpace/getMotionRig`, `drawingSpace/rebuildMotionRig`, and `drawingSpace/discardMotionRig` to module augmentation, descriptors, the client remote interface, and the workspace port.

- [ ] **Step 7: Run contract/client tests and typechecks**

Run: `pnpm --filter @vectorai/plugin-space-contracts test && pnpm --filter @vectorai/plugin-space-contracts check && pnpm --filter @vectorai/plugin-dsh-space-client test && pnpm --filter @vectorai/plugin-dsh-space-client check`  
Expected: all tests and typechecks pass.

- [ ] **Step 8: Commit adapter support**

```bash
git add packages/plugin-space-contracts/src packages/plugin-dsh-space-client/src
git commit -m "feat: transport temporary motion rigs to the canvas"
```

### Task 5: Canvas handle, direct selection correction, and contextual confirmation

**Files:**
- Create: `packages/drawing-viewer-react/src/canvas/MotionRigOverlay.tsx`
- Create: `packages/drawing-viewer-react/src/canvas/MotionRigOverlay.test.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/Canvas.tsx`
- Modify: `packages/drawing-viewer-react/src/panels/WorkspaceToolbar.tsx`
- Modify: `packages/drawing-viewer-react/src/panels/panels.interaction.test.tsx`
- Modify: `packages/drawing-viewer-react/src/styles.css`

**Interfaces:**
- Consumes: motion-rig store state/actions from Task 2.
- Produces: visible anchor/handle, handle drag interaction, direct-selection correction, and icon-only confirm/cancel controls.

- [ ] **Step 1: Write failing overlay and interaction tests**

Test a ready anchor and handle, accessible labels, handle pointer-down entering rig drag, pointer movement updating the local candidate, pointer-up entering Preview, selection changes calling `rebuildMotionRigFromSelection`, blank drag continuing to pan, blank click clearing only ordinary selection, and Escape's two-stage cancel behavior.

- [ ] **Step 2: Run viewer tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-viewer-react test -- MotionRigOverlay.test.tsx panels.interaction.test.tsx`  
Expected: FAIL because the overlay and actions are absent.

- [ ] **Step 3: Implement `MotionRigOverlay`**

Render one non-scaling fixed anchor marker, one control handle with `aria-label="拖动可动部件"`, and one temporary movable-assembly highlight. Use a single non-orange/non-purple visual treatment and text/icon status so validity does not rely on color alone.

- [ ] **Step 4: Integrate the rig drag state into `Canvas`**

Extend `DragState` with:

```ts
| { kind: 'motion-rig'; startWorld: Vec2; currentWorld: Vec2 }
```

Handle events from the explicit rig markers before background pan/selection. Keep wheel zoom, double-click fit, blank pan, ordinary selection, and annotation dragging unchanged. Debounce only Host correction rebuilds; never debounce or remote-call pointer movement.

- [ ] **Step 5: Add icon-only contextual controls**

When rig state is `preview`, render Check and X buttons in the existing bottom toolbar with labels/tooltips “确认姿态” and “取消姿态”. Do not add hand/arm/shoulder role buttons.

- [ ] **Step 6: Run viewer tests and typecheck**

Run: `pnpm --filter @vectorai/drawing-viewer-react test && pnpm --filter @vectorai/drawing-viewer-react check`  
Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit viewer interaction**

```bash
git add packages/drawing-viewer-react/src
git commit -m "feat: add interactive temporary motion rig canvas"
```

### Task 6: Integrated self-test and packaged DSH build

**Files:**
- Create: `scripts/e2e-temporary-motion-rig.ts`
- Modify: `package.json`
- Modify: `docs/dsh-local-development.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a repeatable real-document smoke test and rebuilt packaged plugin artifacts.

- [ ] **Step 1: Write the failing end-to-end script**

Load a real vector fixture through the Host repository, create a rig from the actual hand/control selection, perform a nonzero drag, assert fixed connector endpoints, stage and apply one interactive commit, then undo and redo. Add negative checks for cancel and stale revision.

- [ ] **Step 2: Run the script and verify RED**

Run: `pnpm tsx scripts/e2e-temporary-motion-rig.ts`  
Expected: FAIL until the integrated Host and client paths are available.

- [ ] **Step 3: Complete script wiring and documentation**

Add `e2e:motion-rig` to root scripts and document the user flow: explicit AI rig request, direct canvas correction, drag, Preview, confirm/cancel, and temporary lifecycle.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
pnpm --filter @vectorai/drawing-edit-core test
pnpm --filter @vectorai/drawing-workspace test
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/drawing-viewer-react test
pnpm e2e:motion-rig
pnpm build:dsh-space
pnpm -r check
```

Expected: all tests, end-to-end assertions, build, and typechecks pass.

- [ ] **Step 5: Inspect packaged artifacts and dirty state**

Run: `git status --short && git diff --check`  
Expected: only intentional source, documentation, lockfile, and generated DSH plugin artifacts are modified; no temporary rig data or fixture output is present.

- [ ] **Step 6: Commit integration and generated artifacts**

```bash
git add package.json scripts/e2e-temporary-motion-rig.ts docs/dsh-local-development.md packages/plugin-dsh-space-client/lib packages/plugin-dsh-space-host/lib
git commit -m "test: verify temporary motion rig workflow"
```
