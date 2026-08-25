# Smart Shaft Partition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second-layer local workflow that combines an imported DXF with partial engineering data, discovers every shaft step, and lets the user edit, preview, confirm, cancel, undo, and redo a complete partition.

**Architecture:** Pure functions in `@vectorai/engineering-annotation` parse engineering data, resolve a shaft coordinate frame, detect geometric steps, fuse evidence, and validate immutable partition revisions. The annotation host owns durable draft/history state tied to a Drawing revision. The annotation client renders partition bands and editing handles over the controlled first-layer surface and invokes typed remotes; no partition is stored as fake DXF geometry.

**Tech Stack:** TypeScript 5.8, Vitest 3, React 18, SVG, Zod, DSH Cordis/Typert remotes, local JSON persistence

**Spec:** `docs/superpowers/specs/2026-08-25-dxf-smart-partition-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-25-dxf-import-foundation.md`

## Global Constraints

- Geometry supplies complete coverage; documents may describe only important regions.
- Missing document semantics are reviewed through a bounded AI call only after deterministic steps exist.
- The AI receives stable segment IDs plus a numbered visual observation and cannot return coordinates or geometry commands.
- Invalid or unavailable AI review leaves editable unclassified segments and does not fail deterministic partitioning.
- Physical partitions are sorted, continuous, non-overlapping, and cover the resolved shaft extent exactly once.
- Document regions spanning physical steps become semantic groups and do not erase those steps.
- Partition state is a second-layer semantic asset bound to an exact Drawing revision.
- Confirmation never mutates source DXF geometry.
- Generic uploads do not start this workflow; the user explicitly selects the DXF and optional engineering document.
- Cancel/Preview/Confirm use the established separate toolbar layout.
- All processing and persistence are local.

---

## File structure

Extend `packages/engineering-annotation/src` by domain responsibility:

- `partition/types.ts`: immutable evidence, axis, segment, group, draft, and revision types.
- `partition/invariants.ts`: coverage validation and diagnostics.
- `partition/edit.ts`: move/split/merge/rename/reclassify operations and snapping.
- `engineering-document/parser.ts`: strict INI-like data parser with source lines.
- `shaft/axis.ts`: shaft-view and forward/reverse coordinate resolution.
- `shaft/profile.ts`: outer-envelope sampling and candidate breakpoint extraction.
- `shaft/steps.ts`: persistent step scoring and clustering.
- `partition/fuse.ts`: document-to-geometry matching and semantic grouping.
- `partition/analyze.ts`: pure end-to-end analysis orchestration.

Host persistence and workflow coordination stay in `plugin-dsh-annotation-host`; React presentation stays in `plugin-dsh-annotation-client`.

### Task 1: Partition domain and invariant-preserving edits

**Files:**
- Create: `packages/engineering-annotation/src/partition/types.ts`
- Create: `packages/engineering-annotation/src/partition/invariants.ts`
- Create: `packages/engineering-annotation/src/partition/edit.ts`
- Create: `packages/engineering-annotation/src/partition/edit.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `PartitionDraft`, `PartitionRevision`, `validatePartition`, `moveBoundary`, `splitSegment`, `mergeBoundary`, `updateSegmentMetadata`.
- Consumes: `DrawingRef` from `@vectorai/drawing-edit-protocol`, geometry node IDs, and evidence IDs as strings.

- [ ] **Step 1: Write failing invariant and edit tests**

Use a three-segment `0..30` draft and assert shared-boundary movement, snapping,
manual override, split, merge, and invalid input:

```ts
const moved = moveBoundary(draft, {
  boundaryIndex: 1, requestedZ: 9.8,
  snapCandidates: [{ z: 10, score: 0.95, evidenceIds: ['step:10'] }],
  snapTolerance: 0.5,
});
expect(moved.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([
  [0, 10], [10, 20], [20, 30],
]);
expect(moved.evidence.at(-1)?.origin).toBe('manual');
expect(validatePartition(moved)).toEqual([]);
expect(() => moveBoundary(draft, { boundaryIndex: 1, requestedZ: 20.1, snapCandidates: [], snapTolerance: 0 })).toThrow('PARTITION_BOUNDARY_ORDER');
```

- [ ] **Step 2: Run tests and verify missing domain modules**

Run `pnpm --filter @vectorai/engineering-annotation test -- edit.test.ts`.

Expected: FAIL because the partition API does not exist.

- [ ] **Step 3: Define immutable domain types**

Use these public shapes:

```ts
export type EvidenceOrigin = 'document' | 'geometry' | 'fused' | 'ai' | 'manual';
export interface ShaftAxis { origin: Vec2; direction: Vec2; normal: Vec2; zMin: number; zMax: number; orientation: 'forward' | 'reversed' }
export interface StepCandidate { id: string; z: number; score: number; evidenceIds: string[]; accepted: boolean }
export interface ShaftProfileSummary { minRadius: number; maxRadius: number; sampleCount: number }
export interface PartitionDiagnostic { id: string; severity: 'info' | 'warning' | 'error'; code: string; message: string; segmentIds?: string[]; evidenceIds?: string[] }
export interface PartitionEvidence { id: string; origin: EvidenceOrigin; label: string; sourceLines?: number[]; geometryNodeIds?: string[] }
export interface ShaftPartitionSegment {
  id: string; zStart: number; zEnd: number; profile: ShaftProfileSummary;
  semanticType?: string; name?: string; boundaryConfidence: number; semanticConfidence?: number;
  geometryNodeIds: string[]; boundaryEvidenceIds: string[]; semanticEvidenceIds: string[]; diagnosticIds: string[];
}
export interface ShaftSemanticGroup { id: string; segmentIds: string[]; semanticType: string; name?: string; evidenceIds: string[] }
export interface PartitionDraft {
  version: 1; drawingRef: DrawingRef; axis: ShaftAxis;
  segments: ShaftPartitionSegment[]; semanticGroups: ShaftSemanticGroup[];
  stepCandidates: StepCandidate[]; evidence: PartitionEvidence[]; diagnostics: PartitionDiagnostic[];
  basePartitionRevisionId?: string;
}
export interface PartitionRevision extends Omit<PartitionDraft, 'stepCandidates' | 'basePartitionRevisionId'> {
  id: string; parentRevisionId?: string; confirmedAt: number;
}
```

- [ ] **Step 4: Implement validation and edit operations**

`validatePartition` checks finite coordinates, positive widths, sorted segments,
domain endpoints, gaps, overlaps, unique IDs, and valid references with an absolute
tolerance of `max(1e-8, (zMax-zMin)*1e-8)`. Pointer movement snaps to the highest
score candidate within tolerance, then nearest distance. Numeric override passes
`snapTolerance: 0` and records manual evidence at the requested coordinate.

`splitSegment` creates two new stable IDs derived from the old ID and boundary;
`mergeBoundary` retains both evidence lists and creates a manual merge record;
metadata editing changes only `name` and `semanticType`, never the origin evidence.

- [ ] **Step 5: Run domain tests and check**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test -- edit.test.ts
pnpm --filter @vectorai/engineering-annotation check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engineering-annotation
git commit -m "feat add editable shaft partition domain"
```

### Task 2: Engineering data parser with line evidence

**Files:**
- Create: `packages/engineering-annotation/src/engineering-document/parser.ts`
- Create: `packages/engineering-annotation/src/engineering-document/parser.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `parseEngineeringDocument(text)` returning typed drawing settings, region evidence, unknown metadata, and diagnostics.
- Consumes: no filesystem or model APIs.

- [ ] **Step 1: Write failing parser tests against the real fixture**

Load `packages/dxf-import/test/fixtures/initial-shaft-engineering.ini` and assert:

```ts
const parsed = parseEngineeringDocument(text);
expect(parsed.drawing).toMatchObject({ unit: 'mm', axisOrigin: 'left_end', orientation: 'auto' });
expect(parsed.regions.map(({ id, interval }) => [id, interval?.start, interval?.end])).toEqual([
  ['G01', 63.5, 118.5], ['S01', 17, 41.5], ['B01', 0, 17], ['B02', 150, 173],
]);
expect(parsed.regions.find(({ id }) => id === 'G01')?.outerDiameter).toBe(57.03);
expect(parsed.drawing.drawingName).toBe('样本图001.dxf');
```

Add inline cases for blank values, duplicate IDs, invalid numbers, negative width,
comments, unknown keys, and text that resembles instructions.

- [ ] **Step 2: Run parser tests and verify failure**

Run `pnpm --filter @vectorai/engineering-annotation test -- parser.test.ts`.

Expected: FAIL because the parser is absent.

- [ ] **Step 3: Implement the supported grammar**

Parse only `[drawing]` and `[region:type:id]` sections and `key=value` pairs.
Comments begin with `#` or `;`. Keep source line numbers. Define:

```ts
export interface ParsedEngineeringDocument {
  drawing: { drawingName?: string; unit?: 'mm' | 'cm' | 'm'; axisOrigin?: 'left_end' | 'right_end'; orientation?: 'auto' | 'forward' | 'reversed' };
  regions: EngineeringRegionEvidence[];
  unknown: Array<{ section: string; key: string; value: string; line: number }>;
  diagnostics: PartitionDiagnostic[];
}
```

Unknown content remains data in `unknown`; it cannot invoke tools, change prompts,
or control routing. Blank numeric values become `undefined`. Compute intervals only
when finite positive width and finite center are both present.

- [ ] **Step 4: Run parser and package tests**

Run `pnpm --filter @vectorai/engineering-annotation test && pnpm --filter @vectorai/engineering-annotation check`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engineering-annotation
git commit -m "feat parse local engineering region documents"
```

### Task 3: Shaft axis, outer profile, and persistent step detection

**Files:**
- Create: `packages/engineering-annotation/src/shaft/axis.ts`
- Create: `packages/engineering-annotation/src/shaft/profile.ts`
- Create: `packages/engineering-annotation/src/shaft/steps.ts`
- Create: `packages/engineering-annotation/src/shaft/shaft-analysis.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `resolveShaftAxis(document, hints)`, `extractShaftProfile(document, axis)`, `detectShaftSteps(profile)`.
- Consumes: canonical geometry and `sampleSpline` from drawing-core.

- [ ] **Step 1: Write synthetic forward/reversed and noise tests**

Construct symmetric stepped outlines from lines and one spline transition. Assert
the same physical breakpoints for forward and mirrored input, and no breakpoint for
a short interior detail:

```ts
const axis = resolveShaftAxis(document, { axisOrigin: 'left_end', orientation: 'auto', regions: [] });
const profile = extractShaftProfile(document, axis);
const steps = detectShaftSteps(profile);
expect(axis.direction[0]).toBeGreaterThan(0);
expect(steps.filter(({ accepted }) => accepted).map(({ z }) => z)).toEqual([0, 10, 25, 40]);
```

- [ ] **Step 2: Run analysis tests and verify failure**

Run `pnpm --filter @vectorai/engineering-annotation test -- shaft-analysis.test.ts`.

Expected: FAIL because analysis modules do not exist.

- [ ] **Step 3: Implement axis candidate scoring**

Generate candidates from drawing principal axes and long horizontal/vertical line
clusters. Score elongation, paired upper/lower envelope coverage, symmetry, and
document interval fit. Normalize direction. For `orientation=auto`, compare forward
and reversed mappings by document endpoint and diameter residuals; retain an
`ORIENTATION_AMBIGUOUS` diagnostic when scores differ by less than 5%.

- [ ] **Step 4: Implement outer-envelope extraction**

Sample lines, arcs, polylines, and splines into local `(z,r)` coordinates. Exclude
section hatches, annotations, invisible nodes, and short interior paths that do not
contribute to the maximum absolute radius in their z-bin. Use adaptive bin width:

```ts
const binWidth = Math.max(axisLength / 4096, unitMillimetres * 0.01);
```

Track contributing geometry IDs in every bin. Build upper and lower envelopes and
record missing coverage rather than interpolating across a gap longer than three bins.

- [ ] **Step 5: Implement persistent step candidates**

Create candidates from vertical shoulders, persistent radius jumps, and topology
endpoints. Cluster positions within `max(axisLength*1e-6, 0.01 mm)`. Reject a radius
jump unless it persists on both sides for `max(3 bins, axisLength*0.002)`. Store
accepted and rejected candidates with score/evidence; always include shaft endpoints.

- [ ] **Step 6: Run shaft tests**

Run `pnpm --filter @vectorai/engineering-annotation test -- shaft-analysis.test.ts`.

Expected: PASS for forward, reversed, spline, duplicate-noise, and interior-detail fixtures.

- [ ] **Step 7: Commit**

```bash
git add packages/engineering-annotation
git commit -m "feat detect shaft axes and persistent steps"
```

### Task 4: Document/geometry fusion and real sample analysis

**Files:**
- Create: `packages/engineering-annotation/src/partition/fuse.ts`
- Create: `packages/engineering-annotation/src/partition/analyze.ts`
- Create: `packages/engineering-annotation/src/partition/fuse.test.ts`
- Create: `packages/engineering-annotation/src/partition/sample.integration.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`
- Modify: `packages/engineering-annotation/package.json`

**Interfaces:**
- Produces: `analyzeShaftPartition({ document, drawingRef, engineeringText, sourceName })`.
- Consumes: Tasks 1–3 and real fixtures from the DXF plan.

- [ ] **Step 1: Write failing fusion tests**

Assert a document region spanning two physical segments becomes one semantic group,
and a diameter conflict remains diagnostic:

```ts
expect(result.draft.segments).toHaveLength(4);
expect(result.draft.semanticGroups[0].segmentIds).toEqual(['segment:10-20', 'segment:20-30']);
expect(result.draft.diagnostics).toContainEqual(expect.objectContaining({
  code: 'DOCUMENT_DIAMETER_CONFLICT', severity: 'warning',
}));
expect(validatePartition(result.draft)).toEqual([]);
```

- [ ] **Step 2: Run fusion tests and verify failure**

Run `pnpm --filter @vectorai/engineering-annotation test -- fuse.test.ts sample.integration.test.ts`.

Expected: FAIL because fusion/orchestration is absent.

- [ ] **Step 3: Implement deterministic evidence matching**

For each document interval and each contiguous segment range, compute a normalized cost:

```text
cost = 0.35 * endpointResidual
     + 0.20 * centerResidual
     + 0.15 * widthResidual
     + 0.20 * diameterResidual
     + 0.10 * orderingPenalty
```

Choose the lowest finite cost under the configured acceptance threshold; preserve
the next candidates in diagnostics when ambiguous. Exact documented endpoints may
add a candidate boundary but do not delete an accepted geometric boundary inside
the interval. A matched range receives a semantic group. Individual segments are
linked to boundary and semantic evidence separately, so document or AI semantics
can never be misread as the source of a numeric boundary.

- [ ] **Step 4: Implement end-to-end analysis**

Define:

```ts
export interface AnalyzeShaftPartitionRequest {
  document: DrawingDocument;
  drawingRef: DrawingRef;
  engineeringText?: string;
  drawingSourceName?: string;
}

export type AnalyzeShaftPartitionResult =
  | { status: 'drafted'; draft: PartitionDraft; unclassifiedSegmentIds: string[] }
  | { status: 'rejected'; diagnostics: PartitionDiagnostic[] };
```

Parse optional text, add a filename mismatch diagnostic when appropriate, resolve
axis/profile/steps, construct all physical segments, fuse document evidence, then
run `validatePartition`. `unclassifiedSegmentIds` contains every segment not covered
by a document/fused semantic group. Return `rejected` for no viable axis or invalid
coverage.

- [ ] **Step 5: Add the real sample integration test**

Import the real DXF through `@vectorai/dxf-import`, analyze it with the real INI,
and assert general invariants plus documented evidence:

```ts
expect(result.status).toBe('drafted');
if (result.status !== 'drafted') return;
expect(result.draft.axis.zMax - result.draft.axis.zMin).toBeCloseTo(173, 3);
expect(result.draft.segments.length).toBeGreaterThan(4);
expect(result.draft.segments[0].zStart).toBeCloseTo(result.draft.axis.zMin, 6);
expect(result.draft.segments.at(-1)?.zEnd).toBeCloseTo(result.draft.axis.zMax, 6);
expect(result.draft.semanticGroups.map(({ name }) => name)).toEqual(expect.arrayContaining([
  '一级齿轮', '外花键', '左轴承位', '右轴承位',
]));
expect(result.unclassifiedSegmentIds.length).toBeGreaterThan(0);
expect(result.draft.diagnostics).toContainEqual(expect.objectContaining({
  code: 'DOCUMENT_DRAWING_NAME_MISMATCH', severity: 'warning',
}));
expect(validatePartition(result.draft)).toEqual([]);
```

Do not assert the production algorithm against a hard-coded complete breakpoint
list until a human-reviewed golden result is captured from the UI.

- [ ] **Step 6: Run all analysis tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/engineering-annotation check
```

Expected: PASS without model or network calls.

- [ ] **Step 7: Commit**

```bash
git add packages/engineering-annotation pnpm-lock.yaml
git commit -m "feat fuse shaft geometry with engineering evidence"
```

### Task 5: Bounded visual AI semantic review

**Files:**
- Create: `packages/engineering-annotation/src/partition/semantic.ts`
- Create: `packages/engineering-annotation/src/partition/semantic.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.ts`
- Create: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/package.json`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `applySemanticProposals(draft, proposals)` and `createPartitionSemanticReviewer(ctx)`.
- Consumes: deterministic `unclassifiedSegmentIds`, first-layer bounded observation rendering, DSH attachments/subagents, and strict structured output.

- [ ] **Step 1: Write failing proposal-validation tests**

Assert that the pure domain function accepts only known, currently unclassified
segment IDs and never changes boundaries:

```ts
const beforeBounds = draft.segments.map(({ zStart, zEnd }) => [zStart, zEnd]);
const applied = applySemanticProposals(draft, [{
  segmentIds: ['segment:2'], semanticType: 'bearing-seat', name: '轴承位',
  confidence: 0.82, reason: 'constant diameter seat beside a shoulder',
  visualEvidenceIds: ['observation:segment:2'],
}]);
expect(applied.draft.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual(beforeBounds);
expect(applied.draft.evidence.at(-1)?.origin).toBe('ai');
expect(() => applySemanticProposals(draft, [{
  segmentIds: ['hallucinated'], semanticType: 'gear', confidence: 1,
  reason: 'unknown id', visualEvidenceIds: [],
}])).toThrow('AI_SEGMENT_ID_UNKNOWN');
```

Also reject duplicate incompatible assignments, already document-classified IDs,
confidence outside `[0,1]`, more than 64 proposals, and reason strings over 500 characters.

- [ ] **Step 2: Run proposal tests and verify failure**

Run `pnpm --filter @vectorai/engineering-annotation test -- semantic.test.ts`.

Expected: FAIL because semantic proposal handling is absent.

- [ ] **Step 3: Implement strict proposal application**

Define the only accepted AI output shape:

```ts
export interface SegmentSemanticProposal {
  segmentIds: string[];
  semanticType: string;
  name?: string;
  confidence: number;
  reason: string;
  visualEvidenceIds: string[];
}
```

`applySemanticProposals` validates the entire batch before changing a clone. It adds
`ai` evidence and semantic groups, leaves physical segment boundaries/profile/node
membership byte-for-byte unchanged, and returns rejected proposal diagnostics for
UI display. AI confidence remains candidate confidence and never becomes 1 merely
because the schema was valid.

- [ ] **Step 4: Write failing isolated-reviewer tests**

Use fake `drawingSpace.renderObservation`, attachments, agent, and subagent provider.
Assert the model prompt contains compact segment facts and one numbered image, has
an empty ambient tool allow-list, and contains no raw DXF or coordinate output fields:

```ts
expect(startRequest.toolFilter).toEqual({ allow: [] });
expect(JSON.stringify(startRequest.prompt)).toContain('segment:2');
expect(JSON.stringify(startRequest.prompt)).not.toContain('ENTITIES');
expect(startRequest.outputSchema.properties).not.toHaveProperty('zStart');
expect(startRequest.outputSchema.properties).not.toHaveProperty('commands');
```

- [ ] **Step 5: Implement the bounded reviewer**

Build a catalog containing only:

```ts
interface SegmentReviewItem {
  id: string;
  order: number;
  width: number;
  minDiameter: number;
  maxDiameter: number;
  previousId?: string;
  nextId?: string;
  deterministicSignals: string[];
  existingEvidence: Array<{ origin: 'document' | 'geometry' | 'fused'; label: string }>;
}
```

Translate the target intervals through the resolved axis into generic world-space
overlay polygons labeled `S1`, `S2`, and so on, while the JSON catalog maps each
label to the stable segment ID. Ask `drawingSpace.renderObservation` for a local PNG,
save it through DSH attachments, then start a depth-1 isolated subagent with
`toolFilter: { allow: [] }` and a strict output schema containing only
`segmentIds`, `semanticType`, `name`, `confidence`, `reason`, and
`visualEvidenceIds`.

Require provider capabilities `outputSchema`, `toolFilter`, and `depthLimit`, as the
existing drawing reviewer does. Cap the catalog at 128 items and the serialized
prompt at 64 KiB. On missing provider, timeout, invalid structured output, unknown
IDs, or abort, return an `AI_SEMANTIC_REVIEW_UNAVAILABLE`/`INVALID` diagnostic and
the unchanged draft.

- [ ] **Step 6: Run AI boundary tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test -- semantic.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-host test -- semantic-reviewer.test.ts
```

Expected: PASS for valid proposals, hallucinated IDs, unavailable provider, timeout,
and a result that attempts to include coordinates in free-form output.

- [ ] **Step 7: Commit**

```bash
git add packages/engineering-annotation packages/plugin-dsh-annotation-host pnpm-lock.yaml
git commit -m "feat add bounded visual AI partition semantics"
```

### Task 6: Typed partition wire contract and durable host store

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/partition-store.ts`
- Create: `packages/plugin-dsh-annotation-host/src/partition-store.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/session-state.ts`

**Interfaces:**
- Produces: Zod schemas for partition snapshots/commands/results and `PartitionSessionStore`.
- Consumes: domain types from `@vectorai/engineering-annotation` without importing React or first-layer concrete host classes.

- [ ] **Step 1: Write failing strict-schema round-trip tests**

Cover draft, confirmed revision, stale ref, and every edit command:

```ts
expect(partitionSessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
expect(partitionEditCommandSchema.parse({
  type: 'boundary.move', expectedDrawingRef: ref, boundaryIndex: 2,
  requestedZ: 41.5, snapTolerance: 0.5,
})).toMatchObject({ type: 'boundary.move' });
```

- [ ] **Step 2: Run contract/store tests and verify failure**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-annotation-host test -- partition-store.test.ts
```

Expected: FAIL because schemas/store do not exist.

- [ ] **Step 3: Add partition wire schemas**

Export schemas/types for:

```ts
type PartitionWorkflowPhase = 'idle' | 'analyzing' | 'editing' | 'confirmed' | 'needs-rebase' | 'failed';
type PartitionEditCommand =
  | { type: 'boundary.move'; expectedDrawingRef: DrawingRef; boundaryIndex: number; requestedZ: number; snapTolerance: number }
  | { type: 'segment.split'; expectedDrawingRef: DrawingRef; segmentId: string; z: number; snapTolerance: number }
  | { type: 'boundary.merge'; expectedDrawingRef: DrawingRef; boundaryIndex: number }
  | { type: 'segment.metadata'; expectedDrawingRef: DrawingRef; segmentId: string; name?: string; semanticType?: string };
```

`PartitionSessionSnapshot` contains `phase`, `drawingRef?`, `draft?`,
`confirmed?`, `canUndo`, `canRedo`, `message?`, and `updatedAt`.

- [ ] **Step 4: Implement a durable partition store**

Store one JSON file per hashed session ID under
`~/.dsh/vectorai/annotation-partitions`. Keep `draft`, confirmed revision history,
and redo entry. Methods are:

```ts
beginAnalysis(sessionId, drawingRef): PartitionSessionSnapshot
setDraft(sessionId, draft): PartitionSessionSnapshot
edit(sessionId, command): PartitionSessionSnapshot
confirm(sessionId, expectedDrawingRef): PartitionSessionSnapshot
cancel(sessionId, expectedDrawingRef): PartitionSessionSnapshot
undo(sessionId, expectedDrawingRef): PartitionSessionSnapshot
redo(sessionId, expectedDrawingRef): PartitionSessionSnapshot
markNeedsRebase(sessionId, currentRef): PartitionSessionSnapshot
```

All mutations clone, validate, save atomically via temp-file rename, then notify
subscribers. A new edit after undo clears redo. Undo of confirmation restores that
revision as an editable draft.

- [ ] **Step 5: Run schemas and store tests**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-annotation-host test -- partition-store.test.ts
```

Expected: PASS including restart persistence and stale-ref rejection.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-annotation-host
git commit -m "feat persist revision-bound partition workflows"
```

### Task 7: Explicit import/analyze, AI review, and edit remotes

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/partition-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.test.ts`

**Interfaces:**
- Produces: `importAndAnalyze`, `getPartitionState`, `editPartition`, `confirmPartition`, `cancelPartition`, `undoPartition`, `redoPartition` remotes.
- Consumes: first-layer `importDxf`/`renderObservation`, analyzer, bounded semantic reviewer, and `PartitionSessionStore`.

- [ ] **Step 1: Write failing service tests with a fake first-layer host**

Assert explicit bytes flow, bounded review of uncovered segments, sticky workspace
claim, and stale drawing handling:

```ts
const result = await service.importAndAnalyze(agent, {
  dxf: { name: 'shaft.dxf', digest: 'sha256:fixture', base64: encode(bytes) },
  engineeringDocument: { name: 'shaft.ini', text },
});
expect(space.importDxf).toHaveBeenCalledOnce();
expect(reviewer).toHaveBeenCalledWith(expect.objectContaining({
  segmentIds: expect.arrayContaining(['segment:unclassified']),
}));
expect(result.phase).toBe('editing');
expect(sessions.get(String(agent.id)).workspaceClaimed).toBe(true);
```

Add a fully documented fixture and assert the reviewer is not called when
`unclassifiedSegmentIds` is empty. Add an unavailable-reviewer case and assert the
result still enters `editing` with an `AI_SEMANTIC_REVIEW_UNAVAILABLE` diagnostic.

- [ ] **Step 2: Run host remote tests and verify failure**

Run `pnpm --filter @vectorai/plugin-dsh-annotation-host test -- partition-service.test.ts typert.test.ts`.

Expected: FAIL because methods and descriptors are absent.

- [ ] **Step 3: Implement explicit import and analysis**

Define strict request limits: DXF base64 decodes to at most 20 MiB; engineering text
is at most 2 MiB. Recompute SHA-256 after decoding and reject digest mismatch.
Call `drawingSpace.importDxf`, load its current snapshot, claim the annotation
workspace, and run `analyzeShaftPartition`. When unclassified IDs remain, call the
bounded reviewer once, validate/apply its proposals, then persist the resulting
draft. Do not register a pre-step hook or global prompt for this flow. Reviewer
failure is non-fatal and leaves those segments unclassified.

- [ ] **Step 4: Implement edit/finalize remotes**

Every request carries `expectedDrawingRef`. Compare it with
`drawingSpace.getSnapshot(agent)?.ref` before touching the store. A mismatch calls
`markNeedsRebase` and returns that state. Confirm validates the draft; cancel,
undo, and redo delegate to the store. All methods return the complete partition
session snapshot so the client does not reconstruct authoritative state.

- [ ] **Step 5: Add Typert descriptors and client declarations**

Use direct, agent-scoped invocations matching the existing
`getSessionState` descriptor. Schemas must be strict and result types must point to
exports from `@vectorai/plugin-space-contracts`.

- [ ] **Step 6: Run host/client remote tests and build**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- remote.test.ts
pnpm build:dsh-annotation
```

Expected: PASS; generated host/client bundles expose matching descriptors.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-dsh-annotation-host packages/plugin-dsh-annotation-client
git commit -m "feat connect explicit DXF partition workflow"
```

### Task 8: Observable client partition controller

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/partition-controller.ts`
- Create: `packages/plugin-dsh-annotation-client/src/partition-controller.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`

**Interfaces:**
- Produces: `PartitionController` with observable state and actions consumed by React.
- Consumes: typed annotation remote methods from Task 7.

- [ ] **Step 1: Write failing controller tests**

Use a fake remote and assert loading, edit serialization, stale state, abort, and
latest-response-wins behavior:

```ts
const controller = createPartitionController(remote);
await controller.actions.importFiles(dxfFile, engineeringFile);
expect(controller.state.getSnapshot().phase).toBe('editing');
await controller.actions.moveBoundary(1, 17.1, { snapTolerance: 0.5 });
expect(remote.editPartition).toHaveBeenLastCalledWith(expect.objectContaining({
  type: 'boundary.move', requestedZ: 17.1,
}));
```

- [ ] **Step 2: Run controller tests and verify failure**

Run `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- partition-controller.test.ts`.

Expected: FAIL because the controller is absent.

- [ ] **Step 3: Implement file encoding and observable actions**

Read the user-selected DXF as `ArrayBuffer`, compute SHA-256 with Web Crypto, encode
base64 in chunks to avoid argument-size overflow, and read the optional engineering
file as UTF-8 text. Reject client-side size violations before RPC. The controller
owns `busy`, `previewHeld`, `error`, and authoritative remote snapshot.

Serialize mutating actions through one promise queue. Attach a monotonically
increasing request epoch and ignore responses older than the current epoch.

- [ ] **Step 4: Wire controller creation to the annotation workspace registration**

Create one controller per DSH session and dispose it with the existing annotation
state source. Pass it to `AnnotationWorkspace`; do not put partition state into a
global React singleton.

- [ ] **Step 5: Run client tests**

Run `pnpm --filter @vectorai/plugin-dsh-annotation-client test && pnpm --filter @vectorai/plugin-dsh-annotation-client check`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-annotation-client
git commit -m "feat add observable partition editing controller"
```

### Task 9: Partition overlay, inspector, and action toolbar

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/PartitionOverlay.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/PartitionInspector.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/PartitionActionToolbar.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/PartitionOverlay.test.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/PartitionInteraction.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Produces: editable world-space partition overlay and accessible UI controls.
- Consumes: `PartitionController`, controlled `DrawingSurface`, and viewport transforms.

- [ ] **Step 1: Write failing rendering and interaction tests**

Assert evidence styles without relying on color, synchronized selection, persistent
toolbar during dragging, held preview, exact-coordinate edit, split/merge, and
confirm/cancel button placement. Include an AI proposal and assert it has a distinct
icon/label and `data-partition-origin="ai"`:

```ts
expect(root.findByProps({ 'data-partition-origin': 'document' }).props['data-line-style']).toBe('solid');
expect(root.findByProps({ 'data-partition-origin': 'ai' }).props['aria-label']).toContain('AI 候选');
expect(root.findByProps({ 'aria-label': '取消分区' })).toBeDefined();
expect(root.findByProps({ 'aria-label': '按住预览分区结果' })).toBeDefined();
expect(root.findByProps({ 'aria-label': '确认分区' })).toBeDefined();
act(() => boundary.props.onPointerUp(pointerEvent));
expect(root.findByProps({ 'aria-label': '确认分区' })).toBeDefined();
```

- [ ] **Step 2: Run UI tests and verify failure**

Run `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- PartitionOverlay.test.tsx PartitionInteraction.test.tsx`.

Expected: FAIL because components are absent.

- [ ] **Step 3: Implement world-space partition bands and handles**

Project each segment interval through `axis.origin + direction*z` and extend the
band across its profile radius plus a viewport-scaled margin. Render source state
with `data-partition-origin`, icon/label, stroke pattern, and accessible text.
Boundary handles use pointer capture and update a local transient z while dragging;
send one authoritative edit on pointer-up. Pointer-up does not exit edit mode.

- [ ] **Step 4: Implement inspector editing**

The inspector lists every physical segment in axial order and semantic groups
separately. It exposes exact start/end, profile diameters, origin, confidence,
evidence, and diagnostics. Controls call controller actions for numeric boundary
override, split, merge, name, and semantic type. Selection in list and overlay uses
the same `selectedSegmentId` state. AI semantics are visibly marked as candidates
until the user confirms or manually replaces them.

- [ ] **Step 5: Implement explicit import and the separate action toolbar**

When no drawing is loaded, show `导入 DXF` plus optional `工程数据文档` inputs in the
specialized workspace. Do not accept images. During editing, render a floating
toolbar above the existing general drawing toolbar:

- red X button, `aria-label="取消分区"`;
- neutral Eye button, `aria-label="按住预览分区结果"`;
- green Check button, `aria-label="确认分区"`.

While Preview is held, hide handles, snap candidates, warnings, and edit selection,
but keep clean partition bands and names. Release on pointer-up, pointer-cancel,
window blur, key-up, and component unmount.

- [ ] **Step 6: Add undo/redo behavior**

Route annotation-workspace undo/redo to the partition controller while a partition
history exists. Undo after confirm restores `phase: 'editing'` and the toolbar;
redo returns to `phase: 'confirmed'`. Do not call first-layer geometry undo for a
partition-only change.

- [ ] **Step 7: Run UI tests and accessibility assertions**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-client test
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

Expected: PASS; evidence remains distinguishable when CSS color values are removed from assertions.

- [ ] **Step 8: Commit**

```bash
git add packages/plugin-dsh-annotation-client
git commit -m "feat add interactive smart partition workspace"
```

### Task 10: End-to-end sample validation and documentation

**Files:**
- Create: `scripts/e2e-dxf-smart-partition.ts`
- Modify: `package.json`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/development.md`

**Interfaces:**
- Consumes: complete DXF import and partition workflow.
- Produces: reproducible, local acceptance evidence and updated product/technical docs.

- [ ] **Step 1: Add a real-fixture headless E2E script**

The script imports the approved fixture, analyzes it with the partial document,
runs a deterministic fake bounded reviewer for uncovered segments, prints a compact
JSON manifest, moves one boundary with snapping, confirms, undoes to editing, redoes,
cancels a new edit, and verifies the Drawing revision/geometry digest never changes
due to partition-only operations. A second no-document run verifies every semantic
proposal still references the precomputed segment catalog.

The manifest contains:

```ts
interface PartitionAcceptanceManifest {
  drawingRef: DrawingRef;
  entityCounts: Record<string, number>;
  axisLength: number;
  segmentCount: number;
  coveredLength: number;
  documentedGroups: string[];
  origins: Record<EvidenceOrigin, number>;
  diagnosticCodes: string[];
  lifecycle: ['editing', 'confirmed', 'editing', 'confirmed', 'editing'];
}
```

Add script `e2e:dxf-smart-partition` as `tsx scripts/e2e-dxf-smart-partition.ts`.

- [ ] **Step 2: Run the E2E and inspect its manifest**

Run `pnpm e2e:dxf-smart-partition`.

Expected:

- axis length approximately 173 mm;
- more physical segments than the four documented regions;
- exact full coverage with no gaps/overlaps;
- semantic groups include 一级齿轮、外花键、左轴承位、右轴承位 or explicit conflict diagnostics;
- uncovered and no-document segments receive only ID-bound AI candidate evidence;
- an unavailable-reviewer run remains editable with unclassified segments;
- lifecycle matches the declared sequence;
- no change to canonical Drawing geometry digest.

- [ ] **Step 3: Build both plugin layers**

Run:

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
```

Expected: both exit 0; the annotation bundle contains no machine-specific Downloads path.

- [ ] **Step 4: Run full repository verification**

Run:

```bash
git diff --check
pnpm test
pnpm check
pnpm lint
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm e2e:dxf-smart-partition
```

Expected: all exit 0. Record the test file count, test count, and E2E manifest in the handoff.

- [ ] **Step 5: Update product and technical documentation**

Document explicit paired/standalone DXF import, complete geometric partitioning,
bounded visual AI semantics for absent or partial documents, evidence-origin styles,
editing/snap behavior, semantic revision ownership, reviewer fallback,
failure/rebase behavior, and the exact local verification command. Remove statements
that still describe the second layer as an empty shell.

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-dxf-smart-partition.ts package.json docs
git commit -m "test validate local DXF smart partition workflow"
```
