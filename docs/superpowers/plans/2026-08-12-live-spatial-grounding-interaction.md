# Live Spatial Grounding Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project every real semantic grounding attempt, anchor snap and topology traversal onto the canvas while removing accidental selection bias and sampled-curve budget inflation.

**Architecture:** Extend the existing perception preview overlay as an ephemeral, audit-aligned runtime projection. The server emits proposal and resolution deltas at the point each result exists; the client reducer stores only the newest attempt and the SVG layer renders its evidence. Selection strength and topology complexity are resolved server-side before planning and traversal.

**Tech Stack:** TypeScript, React 18, Zustand, SVG, Express SSE, Vitest.

## Global Constraints

- DrawingDocument remains the only authoritative drawing state.
- Runtime overlays never grant write permission or enter Drawing IR history.
- No action-specific rules or test2 coordinates.
- Every behavior change follows a red-green test cycle.
- Existing dirty user changes must remain intact.

---

### Task 1: Runtime overlay protocol and renderer

**Files:**
- Modify: `src/drawing/preview/types.ts`
- Modify: `src/drawing/preview/reducer.ts`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/Canvas.test.tsx`
- Modify: `src/drawing/tests/preview.test.ts`

**Interfaces:**
- Produces: `SpatialRegionPreviewOverlay.status`, `.attempt`, `.paths`, enriched `.anchors`.
- Consumes: existing `PerceptionPreviewDelta.regionOverlay` SSE payload.

- [ ] Write failing render and reducer tests for proposed, snapped, traced, accepted and rejected evidence.
- [ ] Run `npx vitest run src/components/Canvas.test.tsx src/drawing/tests/preview.test.ts` and verify the new assertions fail.
- [ ] Add the protocol fields, attempt replacement semantics and SVG evidence rendering.
- [ ] Re-run the focused tests and `npm run check`.

### Task 2: Real-time grounding event projection

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`

**Interfaces:**
- Consumes: `SemanticRegion`, `TopologyPartResolution`, `GeometryTopologyGraph`.
- Produces: ordered `region_overlay`, `topology_resolved` and `search_envelope_rejected` events carrying real deltas.

- [ ] Write a failing runtime test that requires a proposed overlay before topology validation and a rejected overlay before retry.
- [ ] Run the focused runtime test and verify it fails because rejected attempts have no deltas.
- [ ] Build overlay deltas directly from the current region, snapped anchors and selected graph segments.
- [ ] Publish each phase and append the same payload summary to the audit stream.
- [ ] Re-run runtime and progress tests.

### Task 3: Explicit versus incidental selection

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/model-adapters.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-agent/model-adapters.test.ts`

**Interfaces:**
- Produces: `referencesCurrentSelection(goal: string): boolean`.
- Consumes: raw goal text and current `selectedIds`.

- [ ] Write failing tests proving incidental selection does not enter planner instructions or target bounds while explicit “修改选中的对象” does.
- [ ] Run the tests and verify current unconditional selection behavior fails them.
- [ ] Gate hard selection scope and update the vision prompt to describe ordinary selection as visual context.
- [ ] Re-run focused tests.

### Task 4: Analytic traversal budget

**Files:**
- Modify: `api/services/drawing-spatial/topology-part-resolver.ts`
- Modify: `api/services/drawing-spatial/topology-part-resolver.test.ts`
- Modify: `api/services/drawing-spatial/atomic-graph.test.ts`

**Interfaces:**
- Produces: topology resolution `complexityCost` and audit trace entry.
- Consumes: atomic segments and their source Drawing IR node types.

- [ ] Write a failing test where a 64-sample arc resolves under a one-member budget.
- [ ] Run the focused test and verify the current raw segment-count budget rejects it.
- [ ] Charge one unit for continuous parameter ranges from the same analytic node and retain per-vertex polyline charging.
- [ ] Re-run spatial tests.

### Task 5: Terminal retention and end-to-end verification

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`

**Interfaces:**
- Consumes: rejected runtime overlay and terminal progress event.
- Produces: retained diagnostic overlay with no provisional geometry after failure.

- [ ] Write a failing store test for retaining only the rejected evidence overlay on failure.
- [ ] Run the focused test and verify the current terminal reset fails it.
- [ ] Preserve the diagnostic overlay while clearing provisional nodes and hidden committed IDs.
- [ ] Run `npm test`, `npm run check`, and `git diff --check`.
- [ ] Run the real browser workflow and inspect the live overlay phase sequence on the canvas.

