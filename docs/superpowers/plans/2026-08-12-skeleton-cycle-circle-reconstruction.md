# Skeleton Cycle Circle Reconstruction Implementation Plan

> **For agentic workers:** Execute inline in the current session. Do not create a branch or sub-agent; the user explicitly requested the main flow.

**Goal:** Reconstruct a closed circular skeleton cycle that CV emitted as two complementary open chains, then emit one fitted Drawing IR Circle instead of two independent Arcs.

**Architecture:** Add a deterministic cycle-assembly stage between skeleton-chain extraction and primitive decomposition. Candidate open chains must share both endpoint neighborhoods, form one continuous closed sample loop, and pass a whole-loop circle fit under the existing drawing-scale tolerance; source junctions only assemble evidence and never force the fit. Ordinary adjacent arcs and tangent branches remain separate.

**Tech Stack:** Python, NumPy, scikit-image skeleton graph extraction, OpenCV fixtures, TypeScript/Vitest Drawing IR integration.

## Global Constraints

- Thresholds derive from drawing diagonal and median line width, never one fixed pixel constant.
- Do not merge from radius similarity alone.
- Preserve source evidence and stable audit data for the reconstructed cycle.
- `test2.png` is the acceptance fixture.

---

### Task 1: Reproduce the split cycle

**Files:**
- Modify: `python/tests/test_vectorai_vectorizer.py`
- Inspect: `python/vectorai_vectorizer.py`

- [ ] Add a synthetic mask containing a circle with graph junctions at two points that currently extracts two open complementary chains.
- [ ] Assert that production vectorization returns one closed chain with a Circle candidate.
- [ ] Run the focused Python test and confirm it fails because two Arc candidates are returned.

### Task 2: Assemble and validate closed cycles

**Files:**
- Modify: `python/vectorai_vectorizer.py`
- Test: `python/tests/test_vectorai_vectorizer.py`

- [ ] Build endpoint-neighborhood adjacency for open chains using adaptive line-width/drawing-scale tolerances.
- [ ] Join only complementary paths whose two endpoint neighborhoods match in opposite order.
- [ ] Fit the combined closed samples once and accept only a Circle under the existing robust fit threshold.
- [ ] Record the contributing source chain IDs and merge decision metrics in the output audit fields.
- [ ] Add a negative test proving ordinary arcs that share only one endpoint are not merged.
- [ ] Run the focused Python suite until both positive and negative cases pass.

### Task 3: Verify Drawing IR output and test2

**Files:**
- Modify if required: `api/services/drawing-vectorization/types.ts`
- Modify if required: `api/services/drawing-vectorization/build-steps.ts`
- Modify: `api/services/drawing-vectorization/test2.integration.test.ts`
- Modify: `scripts/benchmark-test2.ts`

- [ ] Assert `test2` emits a Circle near the selected source-space bounds and no pair of complementary Arcs at that location.
- [ ] Assert no missing chains, non-finite values, or junction gaps are introduced.
- [ ] Run `npm run benchmark:test2` and compare vectorization time and coverage with the prior baseline.

### Task 4: Regression and browser preview

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-adaptive-segmentation-and-topology-selection-design.md`

- [ ] Document closed-cycle reconstruction before per-chain decomposition.
- [ ] Run `npm run check`, the full Vitest suite, and the full Python vectorizer suite.
- [ ] Reload the local application, rebuild `test2`, and confirm the selected lower-left loop is one Circle with one radius annotation.
