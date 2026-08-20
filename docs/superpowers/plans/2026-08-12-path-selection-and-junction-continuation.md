# Path Selection and Junction Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make annotations display-only, make canvas box selection follow real geometry paths, and reconstruct analytic continuations split at skeleton junctions.

**Architecture:** Keep topology-preserving skeleton tracing unchanged, then run a deterministic continuation-assembly pass before closed-cycle assembly. Move canvas selection geometry into a focused pure module; Canvas supplies geometry nodes only, while the shared scene renderer treats annotation primitives as non-interactive and visually subordinate.

**Tech Stack:** Python 3, NumPy/OpenCV/scikit-image, TypeScript, React/SVG, Vitest, unittest.

## Global Constraints

- No semantic special cases for test2 body parts.
- Thresholds use drawing scale, line width, or dimensionless angular continuity; no source-pixel constants.
- Drawing IR remains the authoritative selectable state; annotations remain in Drawing IR but are display-only on canvas.
- All new behavior requires a failing regression test before production code.

---

### Task 1: Display-only annotation plane

**Files:**
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/canvas/SceneNodeRenderer.tsx`
- Test: `src/components/canvas/SceneNodeRenderer.test.tsx`
- Test: `src/components/Canvas.test.tsx`

**Interfaces:**
- Consumes: `DrawingRenderable`, `selectedIds`, `onSelect`.
- Produces: `isCanvasSelectable(entity): entity is GeometryNode`; annotation scene roots with `pointer-events="none"` and muted palette.

- [ ] Write tests proving annotations have no interactive hit path and `isCanvasSelectable` accepts geometry but rejects text/dimension.
- [ ] Run the focused tests and confirm failures identify the missing boundary.
- [ ] Render selection handlers only for geometry and use muted annotation stroke/text/center colors.
- [ ] Run the focused tests to green.

### Task 2: Path-accurate box selection

**Files:**
- Create: `src/components/canvas/path-selection.ts`
- Create: `src/components/canvas/path-selection.test.ts`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Produces: `geometryIntersectsSelectionBox(entity: GeometryNode, box: BBox, viewBounds: BBox): boolean` and `selectGeometryIdsInBox(entities: readonly DrawingRenderable[], box: BBox, viewBounds: BBox): string[]`.
- Consumes: geometry node parameters and current canvas view bounds.

- [ ] Write literal geometry tests for line, circle interior false-positive, circle crossing, arc crossing, polyline, and annotation exclusion.
- [ ] Run tests and confirm the old AABB behavior fails the interior-circle case.
- [ ] Implement analytic point/line/circle/arc intersection plus adaptive flattening for remaining curves.
- [ ] Replace Canvas AABB selection with `selectGeometryIdsInBox` and run focused tests to green.

### Task 3: Smooth continuation assembly

**Files:**
- Modify: `python/vectorai_vectorizer.py`
- Modify: `python/tests/test_vectorai_vectorizer.py`
- Modify: `api/services/drawing-vectorization/types.ts`
- Modify: `api/services/drawing-vectorization/python-provider.ts`

**Interfaces:**
- Produces: `assemble_smooth_continuations(chains, median_line_width, drawing_diagonal) -> list[TracedChain]`.
- Adds optional `continuationAssembly` to segmentation audit.

- [ ] Write a synthetic T-junction test with two compatible arc halves and one branch, plus a non-smooth negative case.
- [ ] Run the Python tests and confirm both desired behaviors fail before implementation.
- [ ] Implement endpoint clustering, tangent continuity, whole-chain line/arc fit scoring, mutually exclusive greedy pairing, and audit propagation.
- [ ] Validate the new audit shape in the TypeScript provider and run Python/provider tests to green.

### Task 4: test2 regression and browser acceptance

**Files:**
- Modify: `api/services/drawing-vectorization/test2.integration.test.ts`

**Interfaces:**
- Consumes: real `test2.png` vectorization result.
- Verifies: the two source-space mouth halves become one `arc`; the attached branch remains a separate line; reconstructed circles remain circles.

- [ ] Add a source-relative test2 assertion for one continuous mouth arc and independent branch.
- [ ] Run it against the current pipeline and confirm failure.
- [ ] Run the full TypeScript and Python suites, typecheck, and `git diff --check`.
- [ ] Rebuild test2 through the real local Agent Workflow, refresh the app, box-select the mouth, inspect selected node IDs, and visually verify muted non-selectable annotations.
