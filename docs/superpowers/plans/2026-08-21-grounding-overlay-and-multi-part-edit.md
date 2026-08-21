# Grounding Overlay and Multi-part Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show exact AI Grounding on the shared canvas and atomically preview, evaluate, commit, and undo independent transforms for multiple grounded parts.

**Architecture:** Keep Grounding visualization as revision-bound transient Host state exposed through a read-only Remote and projected by the shared workspace store. Add a Host-neutral multi-part compiler that validates a set of exact Groundings, reuses the existing connected/rigid transform strategies, and emits one forward/inverse transaction consumed by the existing Preview and auto-safe pipeline.

**Tech Stack:** TypeScript 5.8, Zod 4, React 18, Zustand 5, Vitest 3, DSH rc.8 Remote/Tool APIs.

**Spec:** `docs/superpowers/specs/2026-08-21-grounding-overlay-and-multi-part-edit-design.md`

## Global Constraints

- Grounding Overlay is transient and never enters Canonical Drawing, commit history, candidate digest, or Undo.
- Multi-part edits compile into one Preview and one atomic forward/inverse transaction.
- Existing single-part tools and public contracts remain backward compatible.
- DSH global prompts are not modified; routing lives in strict tool schemas and tool-local workflow hints.
- No body-part, character, or named-action special cases may appear in Layer 1.
- Every production behavior starts with a failing test and completes with targeted plus full verification.

---

### Task 1: Freeze Overlay and Multi-part Protocols

**Files:**
- Create: `packages/drawing-edit-protocol/src/multi-part.ts`
- Modify: `packages/drawing-edit-protocol/src/index.ts`
- Modify: `packages/drawing-edit-protocol/src/protocol.test.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`

**Interfaces:**
- Produces: `multiPartTransformRequestSchema`, `MultiPartTransformRequest`.
- Produces: `drawingGroundingOverlaySchema`, `DrawingGroundingOverlay`, `DrawingGroundingOverlayGroup`.

- [ ] **Step 1: Write failing strict-codec tests**

Add tests proving a two-part request and two-group Overlay round-trip, while duplicate `groundingId`, rotation without pivot, unknown keys, stale enum values, and arrays above limits are rejected.

```ts
expect(multiPartTransformRequestSchema.parse({
  taskId: 'task-1', summary: 'Move two independent carriers',
  parts: [
    { groundingId: 'ground-left', translation: [3, -2] },
    { groundingId: 'ground-right', translation: [-3, -2], rotationRadians: 0.2, pivot: [10, 4] },
  ],
}).parts).toHaveLength(2);

expect(() => multiPartTransformRequestSchema.parse({
  taskId: 'task-1', summary: 'invalid',
  parts: [
    { groundingId: 'same', translation: [1, 0] },
    { groundingId: 'same', translation: [-1, 0] },
  ],
})).toThrow();
```

- [ ] **Step 2: Run protocol tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-edit-protocol test && pnpm --filter @vectorai/plugin-space-contracts test`

Expected: FAIL because the schemas are not exported.

- [ ] **Step 3: Implement strict schemas and exports**

Define finite Vec2 fields, 2..16 unique parts, paired `rotationRadians`/`pivot`, bounded strings, Overlay version/ref/groups, unique `partKey` and stable interface endpoint enums. Export protocol types from the package indexes.

- [ ] **Step 4: Run protocol tests and verify GREEN**

Run: `pnpm --filter @vectorai/drawing-edit-protocol test && pnpm --filter @vectorai/plugin-space-contracts test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/drawing-edit-protocol packages/plugin-space-contracts
git commit -m "feat: define grounding overlay and multi-part protocols"
```

### Task 2: Compile Multiple Exact Groundings Atomically

**Files:**
- Create: `packages/drawing-edit-core/src/multi-part-compiler.ts`
- Modify: `packages/drawing-edit-core/src/index.ts`
- Create: `packages/drawing-edit-core/src/multi-part-compiler.test.ts`

**Interfaces:**
- Consumes: `MultiPartTransformRequest`, existing `GroundedEditTarget`, `SpatialCompilation`, connected-transform compiler, transaction/inverse helpers.
- Produces: `MultiPartGroundedTarget`, `compileMultiPartTransform(input): SpatialCompilation`.

- [ ] **Step 1: Write failing compiler tests**

Use a generic fixture containing two circle carriers, two independent connector pairs, and an unrelated third geometry. Assert that opposing translations update both carriers/connectors in one compilation, preserve unrelated geometry, and round-trip through inverse.

```ts
const compiled = compileMultiPartTransform({
  document: fixture,
  baseRef: { drawingId: fixture.id, revision: 0 },
  objective: 'Move independent components toward the center',
  summary: 'Two component pose',
  parts: [
    { groundingId: 'g-a', grounding: targetA, translation: [4, -3] },
    { groundingId: 'g-b', grounding: targetB, translation: [-4, -3] },
  ],
  ports,
});
expect(compiled.actualEffect.updatedNodeIds).toEqual([
  'carrier-a', 'carrier-b', 'connector-a-1', 'connector-a-2', 'connector-b-1', 'connector-b-2',
].sort());
```

Add separate failing tests for overlapping target nodes, conflicting connector endpoint writes, stale drawing ref, a failed second part leaving the input document unchanged, deterministic digest, and a three-part non-domain fixture.

- [ ] **Step 2: Run the focused core test and verify RED**

Run: `pnpm --filter @vectorai/drawing-edit-core test -- multi-part-compiler.test.ts`

Expected: FAIL because `compileMultiPartTransform` does not exist.

- [ ] **Step 3: Implement global preflight and atomic compilation**

Validate all targets before applying commands. Build one complete transform program per part, compile it against a working clone, reject overlapping target sets and incompatible endpoint updates, merge commands deterministically, compute inverse from the canonical input, apply final hard validation, and return one `SpatialCompilation`.

Do not mutate input Groundings or document. Do not add action-specific strategy branches.

- [ ] **Step 4: Run core tests and verify GREEN**

Run: `pnpm --filter @vectorai/drawing-edit-core test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/drawing-edit-core
git commit -m "feat: compile atomic multi-part transforms"
```

### Task 3: Add Host Grounding Lifecycle and Multi-part Preview Tool

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`

**Interfaces:**
- Consumes: `compileMultiPartTransform`, `MultiPartTransformRequest`, `DrawingGroundingOverlay`.
- Produces: `SemanticEditService.currentGroundingOverlay(sessionId)`.
- Produces: `SemanticEditService.previewMultiPartTransform(sessionId, request)`.
- Produces: model tool `drawing_preview_multi_part_transform` and read-only Host Remote `getGroundingOverlay`.

- [ ] **Step 1: Write failing Host lifecycle tests**

Cover legacy Grounding replacement, named group accumulation, same-`partKey` replacement, new-task clearing, revision-stale filtering, commit/discard clearing, and returned defensive clones.

```ts
service.ground('session-1', { ...leftInput, partKey: 'part-a', label: 'Part A' });
service.ground('session-1', { ...rightInput, partKey: 'part-b', label: 'Part B' });
expect(service.currentGroundingOverlay('session-1')?.groups.map(({ partKey }) => partKey))
  .toEqual(['part-a', 'part-b']);
```

- [ ] **Step 2: Write failing multi-part Preview/tool tests**

Assert two exact Groundings create one Preview and one candidate digest, stale/foreign/overlap failures preserve the previous Preview, and tool metadata exposes nested `parts.items` rather than opaque JSON. Assert `drawing_ground` accepts bounded `partKey`/`label` and returns workflow guidance for multiple parts.

- [ ] **Step 3: Run Host tests and verify RED**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test`

Expected: FAIL because Overlay state, service method, Remote, and tool do not exist.

- [ ] **Step 4: Implement Host lifecycle and preview service**

Store task-scoped groups in `SemanticEditService`; derive colors from stable group order; clear them only at the lifecycle boundaries in the spec. Resolve every `groundingId` to current task/base before calling the core compiler. Reuse the existing Preview repository, candidate budget, evaluation, finalize, operation ledger, and Undo path.

- [ ] **Step 5: Implement model-visible strict tool schemas**

Register `drawing_preview_multi_part_transform`. Describe when to use the single-part versus multi-part tool. Replace opaque `program: { type: 'json' }` metadata for `drawing_preview_program` with a complete nested DSH schema matching the Zod parser; parsing remains Host authoritative.

- [ ] **Step 6: Run Host tests and verify GREEN**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test && pnpm --filter @vectorai/plugin-dsh-space-host check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-dsh-space-host
git commit -m "feat: expose grounded multi-part preview workflow"
```

### Task 4: Carry Grounding Overlay Through the DSH Remote and Workspace Store

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.test.ts`
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-workspace/src/store.ts`
- Modify: `packages/drawing-workspace/src/store.test.ts`

**Interfaces:**
- Consumes: Host `getGroundingOverlay` Remote.
- Produces: optional `DrawingWorkspacePort.loadGroundingOverlay()`.
- Produces: `DrawingWorkspaceState.groundingOverlay`.

- [ ] **Step 1: Write failing Remote/port tests**

Assert the Remote descriptor is strict, the DSH port unwraps the exact Overlay, abort checks are honored, and no write or authority fields are present.

- [ ] **Step 2: Write failing store tests**

Assert initial load and refresh read snapshot/Preview/Overlay together; matching Overlay is stored; drawingId/revision mismatch is discarded; revision change clears old Overlay; Overlay never changes `selectedIds` or `selectionProjection`.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-workspace test && pnpm --filter @vectorai/plugin-dsh-space-client test`

Expected: FAIL because the load method and state field do not exist.

- [ ] **Step 4: Implement Remote, port, and store projection**

Add strict descriptors and typings. Load all transient view state in one refresh generation so stale asynchronous results cannot overwrite a newer snapshot. Store structured clones and filter against the formal snapshot ref.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter @vectorai/drawing-workspace test && pnpm --filter @vectorai/plugin-dsh-space-client test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-space-client packages/drawing-workspace
git commit -m "feat: project grounding overlays into the workspace"
```

### Task 5: Render Grounded Groups Without Breaking Canvas Interaction

**Files:**
- Create: `packages/drawing-viewer-react/src/canvas/GroundingOverlay.tsx`
- Create: `packages/drawing-viewer-react/src/canvas/GroundingOverlay.test.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/Canvas.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/Canvas.interaction.test.tsx`
- Modify: `packages/drawing-viewer-react/src/panels/ObjectList.tsx`
- Modify: `packages/drawing-viewer-react/src/panels/panels.test.tsx`
- Modify: `packages/drawing-viewer-react/src/styles.css`

**Interfaces:**
- Consumes: `DrawingWorkspaceState.groundingOverlay` and current display snapshot/viewport.
- Produces: SVG group outlines, labels, endpoint markers, and ObjectList group indicators.

- [ ] **Step 1: Write failing visual rendering tests**

Render two generic groups and assert `data-grounding-group`, `data-grounding-label`, `data-grounding-node`, and `data-grounding-interface` markers exist with consistent color indexes. Assert missing nodes are skipped without hiding valid group members.

- [ ] **Step 2: Write failing interaction regression tests**

Assert Overlay SVG uses `pointer-events="none"`, wheel zoom still updates viewport, drag pan still works, blank click clears Selection, and AI Grounding never populates `selectedIds`.

- [ ] **Step 3: Run viewer tests and verify RED**

Run: `pnpm --filter @vectorai/drawing-viewer-react test`

Expected: FAIL because Grounding Overlay is not rendered.

- [ ] **Step 4: Implement rendering and styles**

Compute group bounds using existing `nodeBounds`, render non-scaling outlines and endpoint markers inside the world transform, render readable labels in screen orientation, and add a fixed accessible palette. Selection and Preview classes retain higher visual priority. Add matching non-interactive ObjectList indicators.

- [ ] **Step 5: Run viewer tests and verify GREEN**

Run: `pnpm --filter @vectorai/drawing-viewer-react test && pnpm --filter @vectorai/drawing-viewer-react check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/drawing-viewer-react
git commit -m "feat: visualize exact AI grounding on the canvas"
```

### Task 6: Full Regression, DSH Package, and Real Smoke Test

**Files:**
- Modify only if a failing integration assertion exposes a defect in Tasks 1-5.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: rebuilt local DSH plugin/app and verification evidence.

- [ ] **Step 1: Run all package and root verification**

```bash
pnpm test
pnpm check
pnpm build:dsh-space
pnpm test:dsh-launcher
```

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 2: Verify absence of domain special cases**

Run:

```bash
rg -n "双手|左手|右手|交叉|打招呼|wave|hand|arm" packages/drawing-edit-core packages/drawing-edit-protocol packages/plugin-dsh-space-host/src
```

Expected: no new production strategy branch or opcode; fixture/test prose is allowed.

- [ ] **Step 3: Rebuild and install the local DSH app/plugin**

Use the repository's existing build/install path, preserve the launcher icon, codesign the resulting app, and restart DSH only after a successful package build.

- [ ] **Step 4: Run a real-session smoke test**

In a session with a generic multi-component Drawing, verify: Grounding groups visibly appear; opposing component transforms produce one Preview; visual evaluation runs; one commit increments revision once; Undo restores the prior semantic Drawing. Also verify an ordinary image-only conversation does not open the Drawing workspace.

- [ ] **Step 5: Record final status and commit any test-only integration adjustment**

```bash
git status --short
git log --oneline -8
```

Expected: clean worktree and focused commits for protocol, core, Host, workspace transport, and viewer.
