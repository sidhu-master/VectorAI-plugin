# Canvas Pan and Coordinate Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render perceived drawings upright and pan dense SVG drawings without global per-frame re-renders.

**Architecture:** Image observations are converted once into canonical CAD Y-up coordinates at the perception boundary. Canvas panning uses a small interaction controller that previews SVG transforms directly and commits the final Zustand transform once.

**Tech Stack:** TypeScript, React 18, Zustand 5, SVG, Vitest

## Global Constraints

- Preserve all existing dirty-worktree changes outside the focused lines.
- Do not add dependencies or change the Drawing schema.
- Keep the implementation in the main flow without branches or sub-agents.

---

### Task 1: Canonical image-to-CAD orientation

**Files:**
- Modify: `api/services/drawing-perception/regions.ts`
- Modify: `api/services/drawing-perception/pipeline.ts`
- Test: `api/services/drawing-perception/regions.test.ts`
- Test: `api/services/drawing-perception/pipeline.test.ts`

**Interfaces:**
- Consumes: normalized image/page coordinates and `heightToWidthRatio`
- Produces: CAD coordinates where +Y is upward

- [x] **Step 1: Write failing asymmetric-Y tests**

Use a crop point whose page Y is not `0.5`, and assert the literal CAD result `ratio * (1 - pageY)`. Assert annotation preview/output uses the same result.

- [x] **Step 2: Run RED**

Run `npm test -- api/services/drawing-perception/regions.test.ts api/services/drawing-perception/pipeline.test.ts`; expect the new Y assertions to receive the old downward values.

- [x] **Step 3: Implement boundary conversion**

Change stitched point/vector Y conversion, reflect arc direction, and use `{ scaleX: 1, scaleY: -ratio, offsetX: 0, offsetY: ratio }` for annotations.

- [x] **Step 4: Run GREEN**

Run the same focused tests and require zero failures.

### Task 2: Transient SVG pan

**Files:**
- Create: `src/components/canvas/pan-interaction.ts`
- Create: `src/components/canvas/pan-interaction.test.ts`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Produces: `createCanvasPanSession(startPointer, startTransform)` with `preview(pointer)` and `finish()`
- Canvas consumes preview transforms for direct SVG attributes and commits `finish()` once

- [x] **Step 1: Write a failing controller test**

Assert two preview moves return literal offsets without invoking the commit callback, then `finish()` invokes it once with the last transform.

- [x] **Step 2: Run RED**

Run `npm test -- src/components/canvas/pan-interaction.test.ts`; expect failure because the controller does not exist.

- [x] **Step 3: Implement and integrate the controller**

Preview the world-group transform and overlay delta imperatively, commit once on pan end, and allow entity mouse-down to bubble.

- [x] **Step 4: Run GREEN**

Run the controller and Canvas tests and require zero failures.

### Task 3: Regression and local verification

**Files:**
- Verify all focused files above

**Interfaces:**
- Consumes: built application at `http://localhost:5173/`
- Produces: evidence that draw orientation and pan stability work together

- [x] **Step 1: Run full automated verification**

Run `npm test`, `npm run check`, `npm run build`, and `git diff --check`.

- [x] **Step 2: Run a local browser drag**

Record entity count and world transform before/after a multi-point drag. Require unchanged entity count, changed transform, and no console errors.

- [x] **Step 3: Commit only focused changes**

Stage the coordinate, pan, focused test, design, and plan files without staging `test1.jpg` or unrelated dirty-worktree files.
