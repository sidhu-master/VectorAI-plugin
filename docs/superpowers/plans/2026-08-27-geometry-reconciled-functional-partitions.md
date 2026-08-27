# Geometry-Reconciled Functional Partitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the old Web semantic-selection/local-coordinate split and make the real shaft sample produce the five approved functional regions.

**Architecture:** Keep accepted shaft steps and continuous physical segments as the coordinate authority. Reconcile document semantics onto scored geometric ranges, let AI review every remaining unclassified physical segment, then derive a substantial bounded regular region only when the reviewer abstains.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, local DXF importer, DSH annotation Host and client.

**Spec:** `docs/superpowers/specs/2026-08-27-geometry-reconciled-functional-partitions-design.md`

## Global Constraints

- Models select semantic identities only; local code owns all numeric boundaries.
- The expected real-sample regions are `0–17`, `17–41.5`, `41.5–92`, `92–147`, and `150–173`.
- The `147–150` transition remains unclassified.
- Existing physical segment coverage, editing, undo/redo, and wire compatibility remain unchanged.
- No server or cloud dependency is introduced.

---

### Task 1: Freeze the Real Engineering Oracle

**Files:**
- Modify: `packages/engineering-annotation/src/partition/sample.integration.test.ts`
- Modify: `scripts/e2e-dxf-smart-partition.ts`

**Interfaces:**
- Consumes: `analyzeShaftPartition(request)` and functional semantic groups.
- Produces: one shared five-region behavioral oracle expressed in integration assertions.

- [ ] **Step 1: Replace the incorrect raw-document expectation with the approved result**

```ts
expect(functionalRanges(result.draft)).toEqual([
  ['左轴承位', 0, 17],
  ['外花键', 17, 41.5],
  ['常规区域', 41.5, 92],
  ['一级齿轮', 92, 147],
  ['右轴承位', 150, 173],
]);
```

- [ ] **Step 2: Assert that the gear conflict is diagnosed and no inner spline exists**

```ts
expect(result.draft.diagnostics).toContainEqual(
  expect.objectContaining({ code: 'DOCUMENT_REGION_RECONCILED' }),
);
expect(result.draft.semanticGroups.some(({ name }) => name === '内花键')).toBe(false);
```

- [ ] **Step 3: Run the focused test and verify the red state**

Run: `pnpm exec vitest run packages/engineering-annotation/src/partition/sample.integration.test.ts`

Expected: FAIL because the gear still uses `63.5–118.5` and no regular region exists.

### Task 2: Reconcile Document Semantics to Geometry

**Files:**
- Modify: `packages/engineering-annotation/src/partition/fuse.ts`
- Modify: `packages/engineering-annotation/src/partition/fuse.test.ts`

**Interfaces:**
- Consumes: `PartitionDraft`, `EngineeringRegionEvidence`, physical segments and profile summaries.
- Produces: `fuseDocumentRegions(draft, regions)` with geometry-owned ranges and `DOCUMENT_REGION_RECONCILED` diagnostics.

- [ ] **Step 1: Add focused matcher tests for center conflict and exact width/diameter agreement**

```ts
expect(group.range).toEqual({ zStart: 92, zEnd: 147 });
expect(group.segmentIds).toEqual(['segment:92-147']);
expect(result.diagnostics).toContainEqual(
  expect.objectContaining({ code: 'DOCUMENT_REGION_RECONCILED' }),
);
```

- [ ] **Step 2: Run the matcher tests and verify the red state**

Run: `pnpm exec vitest run packages/engineering-annotation/src/partition/fuse.test.ts`

Expected: FAIL because the group range is still the raw document interval.

- [ ] **Step 3: Make width, shoulder alignment, and diameter dominate center distance**

```ts
interface Match {
  segments: ShaftPartitionSegment[];
  cost: number;
  widthError: number;
  diameterError?: number;
}
```

Store the winning geometric `zStart/zEnd` when width and diameter meet the
high-confidence thresholds; preserve the raw interval only for unmatched cases.

- [ ] **Step 4: Run matcher and real-sample tests**

Run: `pnpm exec vitest run packages/engineering-annotation/src/partition/fuse.test.ts packages/engineering-annotation/src/partition/sample.integration.test.ts`

Expected: gear reconciliation passes; regular-region assertion remains red.

### Task 3: Review Unclassified Segments, Then Derive the Approved Regular Region

**Files:**
- Modify: `packages/engineering-annotation/src/partition/analyze.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-view-model.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts`

**Interfaces:**
- Consumes: reconciled document groups and the remaining physical segments.
- Produces: an AI work set containing every unclassified segment, followed by a
  deterministic `regular-shaft` fallback for substantial runs bounded by trusted
  document regions when the reviewer abstains.

- [ ] **Step 1: Add tests for a bounded regular run and preserved short transition**

```ts
expect(group).toMatchObject({
  name: '常规区域',
  semanticType: 'regular-shaft',
  range: { zStart: 41.5, zEnd: 92 },
});
expect(unclassifiedRanges).toContainEqual([147, 150]);
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run: `pnpm exec vitest run packages/engineering-annotation/src/partition/sample.integration.test.ts packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts`

Expected: FAIL because no deterministic regular region exists.

- [ ] **Step 3: Add deterministic regular-run inference after document fusion**

Infer only a substantial contiguous run bounded by reconciled document regions;
use geometry evidence and leave the `147–150` transition unclassified.

- [ ] **Step 4: Render deterministic `regular-shaft` groups in functional mode**

Keep generic AI proposals rejected. Update only the client filter so a
geometry-origin `regular-shaft` group remains visible.

- [ ] **Step 5: Run all partition and reviewer tests**

Run: `pnpm exec vitest run packages/engineering-annotation/src/partition packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts packages/plugin-dsh-annotation-client/src/partition-view-model.test.ts`

Expected: PASS.

### Task 4: Real End-to-End Comparison and Repository Verification

**Files:**
- Modify: `scripts/e2e-dxf-smart-partition.ts`
- Modify: `docs/superpowers/specs/2026-08-27-sparse-functional-partitions-design.md`

**Interfaces:**
- Consumes: real fixture files and the complete Host partition workflow.
- Produces: executable evidence that final functional bands equal the approved reference.

- [ ] **Step 1: Make the E2E script compare names, ranges, origins, and the empty transition**

```ts
assert.deepEqual(actualBands, expectedBands);
assert(!actualBands.some(({ name }) => name === '内花键'));
```

- [ ] **Step 2: Run the real local workflow**

Run: `pnpm e2e:dxf-smart-partition`

Expected: PASS with the five approved regions.

- [ ] **Step 3: Update the superseded sparse-design sample acceptance result**

Document that reconciled geometry overrides conflicting source coordinates and
that `常规区域` is post-review fused evidence rather than a generic AI filler.

- [ ] **Step 4: Run full verification**

Run: `pnpm test && pnpm build`

Expected: all tests and production builds pass.

- [ ] **Step 5: Commit and open the feature PR**

```bash
git add packages scripts docs
git commit -m "fix(annotation): reconcile functional regions with shaft geometry"
```
