# Default CAD Scale and Atomic Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist unscaled image drawings at a 500 mm page width and eliminate the visibility gap between provisional and committed entities.

**Architecture:** A focused perception coordinate-space helper owns the normalized-image to CAD-millimetre transform. The frontend preview reducer reconciles provisional IDs against each authoritative DrawingDocument snapshot, so promotion is driven by confirmed document contents rather than network timing.

**Tech Stack:** TypeScript, Node.js, React 18, Zustand 5, SVG, Vitest

## Global Constraints

- Preserve unrelated dirty-worktree changes.
- Stay on `main`; do not create a branch or sub-agent.
- Use exactly `500 mm` as the full-page default width when source scale is unavailable.
- Apply physical scale at the perception boundary, never in the renderer.
- Do not add timers or new dependencies.

---

### Task 1: Physical image-to-CAD transform

**Files:**
- Create: `api/services/drawing-perception/coordinate-space.ts`
- Modify: `api/services/drawing-perception/regions.ts`
- Modify: `api/services/drawing-perception/pipeline.ts`
- Test: `api/services/drawing-perception/regions.test.ts`
- Test: `api/services/drawing-perception/pipeline.test.ts`

**Interfaces:**
- Produces: `DEFAULT_UNSCALED_PAGE_WIDTH_MM = 500`
- Produces: `imageToCadTransform(heightToWidthRatio: number | undefined)` returning `{ scaleX, scaleY, offsetX, offsetY }`
- Region stitching consumes the same page width to transform geometry into millimetres.

- [x] **Step 1: Write failing physical-scale tests**

Update the asymmetric geometry assertion from normalized `[0.3, 1.4]` to literal CAD millimetres `[150, 700]`, radius `40`, and update the annotation pipeline assertion from `[0.2, 1.4]` to `[100, 700]` with text height `200`.

- [x] **Step 2: Run tests to verify RED**

Run: `npm test -- api/services/drawing-perception/regions.test.ts api/services/drawing-perception/pipeline.test.ts`

Expected: failures receive the existing normalized values.

- [x] **Step 3: Implement the shared transform**

Create the helper with:

```ts
export const DEFAULT_UNSCALED_PAGE_WIDTH_MM = 500;

export function imageToCadTransform(heightToWidthRatio: number | undefined) {
  const ratio = heightToWidthRatio ?? 1;
  return {
    scaleX: DEFAULT_UNSCALED_PAGE_WIDTH_MM,
    scaleY: -DEFAULT_UNSCALED_PAGE_WIDTH_MM * ratio,
    offsetX: 0,
    offsetY: DEFAULT_UNSCALED_PAGE_WIDTH_MM * ratio,
  };
}
```

Use the constant in region point/vector/radius conversion and import the shared annotation transform in the pipeline.

- [x] **Step 4: Run tests to verify GREEN**

Run: `npm test -- api/services/drawing-perception/regions.test.ts api/services/drawing-perception/pipeline.test.ts api/services/drawing-perception/build-patches.test.ts`

Expected: all focused perception tests pass.

### Task 2: Atomic provisional-to-authoritative promotion

**Files:**
- Modify: `src/drawing/preview/reducer.ts`
- Test: `src/drawing/tests/preview.test.ts`
- Modify: `src/hooks/useStore.ts`
- Test: `src/hooks/useStore.test.ts`

**Interfaces:**
- Produces: `retainUncommittedPromotions(state, delta, document)` for filtering premature promote removals.
- Produces: `reconcilePerceptionPreview(state, document)` for removing provisional IDs confirmed in authoritative geometry/annotations.
- Store applies ordinary observation deltas immediately and reconciles in the same state update as a refreshed workspace.

- [x] **Step 1: Write failing reducer and store tests**

Add reducer coverage proving `promote` keeps a preview ID absent from the document and reconciliation removes it after that ID exists. Add a store integration test that emits commit plus promotion before resolving `drawings.open`, asserts the preview remains, resolves the authoritative snapshot, and asserts the committed entity is present while the preview is gone.

- [x] **Step 2: Run tests to verify RED**

Run: `npm test -- src/drawing/tests/preview.test.ts src/hooks/useStore.test.ts`

Expected: the new reconciliation exports do not exist or the preview disappears before refresh.

- [x] **Step 3: Implement ID-based reconciliation**

Filter only `promote` removals against IDs already present in the current document. On successful drawing refresh, update the workspace and reconciled preview together in one Zustand `set(current => ...)` call. Keep reject/removal behavior unchanged.

- [x] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/drawing/tests/preview.test.ts src/hooks/useStore.test.ts`

Expected: all preview and store tests pass.

### Task 3: Regression and real-flow verification

**Files:**
- Verify all files above
- Verify: `.local/vectorai/runs/<new-run>/drawing/geometry.json`

**Interfaces:**
- Consumes: `test1.jpg` through the existing Agent workflow
- Produces: a new audit run with approximately 500 mm page width and stable progressive promotion

- [x] **Step 1: Run automated verification**

Run: `npm test`, `npm run check`, `npm run build`, and `git diff --check`.

- [x] **Step 2: Restart a single local development server**

Stop only the known VectorAI dev-server process group, start `npm run dev`, and verify ports 5173 and 3001 respond.

- [x] **Step 3: Run the real image flow**

Use `test1.jpg`, inspect the new run audit and finite Drawing bounds, and require a page-scale width near `500 mm`, visible 10/50 mm grid intervals, no preview-to-document disappearance, and stable pan.

- [x] **Step 4: Commit only focused changes**

Stage the scale helper, perception changes, preview reconciliation, focused tests, and this plan without staging unrelated dirty-worktree files or `test1.jpg`.
