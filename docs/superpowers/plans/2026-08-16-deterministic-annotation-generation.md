# Deterministic Annotation Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import `初始图.dxf` with its engineering document and generate every provable nominal annotation as formal Annotation IR, while withholding unsupported design intent and reporting complete coverage.

**Architecture:** Add a deterministic measurement → reconciliation → planning → layout → coverage pipeline beside the lossless DXF importer. Runtime code consumes only imported Drawing IR geometry and the engineering document; a test-only Oracle derived from `样本图001.dxf` classifies expected nominal facts and deferred design intent. The coordinator commits geometry, recognized features, and generated annotations atomically.

**Tech Stack:** TypeScript, Vitest, existing VectorAI Drawing IR/transaction engine, React/SVG shared scene renderer, local file stores.

## Global Constraints

- Do not create a branch or worktree.
- Do not call a model or CV service in this pipeline.
- Do not hard-code sample coordinates, handles, entity IDs, or Chinese layer names in production code.
- Runtime authority is initial DXF geometry plus the engineering document; the sample DXF is test-only.
- Unknown tolerance, roughness, datum, geometric tolerance, and section intent must not enter committed annotations.
- Every generated visible item belongs to the Annotation plane, remains globally hideable, and is not geometry-selectable.
- Preserve existing dirty-worktree changes and stage/commit only new isolated files unless explicitly reviewed.

---

### Task 1: Freeze the sample annotation Oracle and certainty boundary

**Files:**
- Create: `api/services/drawing-annotation/sample-oracle.test-fixture.ts`
- Create: `api/services/drawing-annotation/sample-oracle.test.ts`
- Test: `api/services/drawing-annotation/sample-oracle.test.ts`

**Interfaces:**
- Produces: `SAMPLE_NOMINAL_DIMENSIONS`, a literal test fixture containing the 28 sample nominal dimensions as `{ kind, value }` counts without tolerances or source IDs.
- Produces: `SAMPLE_DEFERRED_CATEGORIES`, the literal set `tolerance | roughness | datum | geometric-tolerance | section-marker | arbitrary-note`.
- The literal nominal sequence is:

```ts
[
  ['linear', 57.03], ['linear', 35], ['linear', 40], ['linear', 51],
  ['linear', 38], ['linear', 35], ['linear', 44.59], ['linear', 173],
  ['linear', 55], ['linear', 105], ['linear', 24.5], ['linear', 28],
  ['linear', 8], ['linear', 17], ['linear', 42.21], ['linear', 1],
  ['linear', 3], ['angular', 60], ['angular', 120], ['angular', 60],
  ['linear', 1], ['linear', 3], ['linear', 20], ['angular', 120],
  ['radius', 3], ['radius', 2], ['linear', 3], ['linear', 47.93],
]
```

- [ ] **Step 1: Write the failing Oracle characterization test**

```ts
it('extracts all 28 nominal dimension facts while separating unsupported design intent', () => {
  const result = inspectSampleAnnotationOracle('样本图001.dxf');
  expect(result.nominalDimensions).toEqual(SAMPLE_NOMINAL_DIMENSIONS);
  expect(result.deferredCategories).toEqual(SAMPLE_DEFERRED_CATEGORIES);
  expect(result.nominalDimensions).toHaveLength(28);
  expect(result.unreadableNominalHandles).toEqual([]);
});
```

The expected fixture contains 22 linear/diameter-like facts, 4 angular facts (`60, 120, 60, 120`) and 2 radius facts (`3, 2`). Tolerance suffixes are excluded from nominal values.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run api/services/drawing-annotation/sample-oracle.test.ts`

Expected: FAIL because the fixture and inspection API do not exist.

- [ ] **Step 3: Implement the test-only Oracle reader**

The Oracle reader may parse the real sample and inspect `DIMENSION`, `TEXT`, annotation `INSERT` records, and each DIMENSION's associated anonymous block. It reads angular/radius nominal text from the associated block when the DIMENSION record itself contains only `<>`. No production annotation planner may import the test fixture or reader.

- [ ] **Step 4: Run focused DXF and Oracle tests**

Run: `pnpm vitest run api/services/drawing-annotation/sample-oracle.test.ts`

Expected: PASS with 28 nominal facts and no placeholder label.

---

### Task 2: Extend Annotation IR for centerlines and leaders

**Files:**
- Modify: `src/drawing/document/types.ts`
- Modify: `src/drawing/validation/document.ts`
- Modify: `src/drawing/query/bounds.ts`
- Modify: `src/drawing/query/query.ts`
- Modify: `src/drawing/scene/compile.ts`
- Modify: `src/drawing/scene/types.ts`
- Test: `src/drawing/tests/validation.test.ts`
- Test: `src/drawing/tests/query.test.ts`
- Test: `src/drawing/tests/scene-compile.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LeaderAnnotation extends BaseNode<AnnotationId, 'leader'> {
  target: DimensionTarget;
  points: Vec2[];
  content: string;
  textHeight: number;
}

export interface CenterlineAnnotation extends BaseNode<AnnotationId, 'centerline'> {
  targets: GeometryId[];
  start: Vec2;
  end: Vec2;
  extension: number;
}

export type AnnotationNode =
  | TextAnnotation
  | DimensionAnnotation
  | LeaderAnnotation
  | CenterlineAnnotation;
```

- [ ] **Step 1: Write failing validation, query, and scene tests**

Tests must prove a valid leader/centerline is accepted, a missing target is rejected, bounds include all points, and scene compilation emits annotation-plane primitives with semantic roles `leader-line`, `leader-text`, and `centerline`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/drawing/tests/validation.test.ts src/drawing/tests/query.test.ts src/drawing/tests/scene-compile.test.ts`

Expected: TypeScript/Vitest failure because the node variants are unknown.

- [ ] **Step 3: Implement types, validation, bounds, inspection, and shared scene compilation**

Centerlines compile to dashed annotation paths. Leaders compile to a polyline, filled terminal arrow, and text. Both keep `plane: 'annotation'`, which makes existing Canvas selection and global visibility policies apply automatically.

- [ ] **Step 4: Run Drawing IR regression tests**

Run: `pnpm vitest run src/drawing/tests src/components/canvas/SceneNodeRenderer.test.tsx src/components/Canvas.test.tsx`

Expected: PASS with no geometry-plane representation of leader or centerline annotations.

---

### Task 3: Build deterministic measurement facts from Drawing IR

**Files:**
- Create: `api/services/drawing-annotation/types.ts`
- Create: `api/services/drawing-annotation/measurement.ts`
- Create: `api/services/drawing-annotation/measurement.test.ts`
- Test: `api/services/drawing-annotation/measurement.test.ts`

**Interfaces:**
- Produces:

```ts
export type MeasurementFact =
  | { key: string; kind: 'centerline'; start: Vec2; end: Vec2; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] }
  | { key: string; kind: 'axial-length'; value: number; first: Vec2; second: Vec2; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] }
  | { key: string; kind: 'diameter'; value: number; center: Vec2; first: Vec2; second: Vec2; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] }
  | { key: string; kind: 'radius'; value: number; center: Vec2; edge: Vec2; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] }
  | { key: string; kind: 'angle'; value: number; vertex: Vec2; rays: [Vec2, Vec2]; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] }
  | { key: string; kind: 'chamfer'; value: number; angle: number; target: Vec2; sourceIds: GeometryId[]; evidenceRefs: EvidenceId[] };

export interface MeasurementResult {
  axis: { origin: Vec2; direction: Vec2; status: 'confirmed' | 'conflict' };
  facts: MeasurementFact[];
  conflicts: Array<{ code: string; message: string; sourceIds: string[] }>;
}

export function measureDeterministicAnnotations(input: {
  geometry: GeometryNode[];
  unit: 'mm' | 'cm' | 'm';
}): MeasurementResult;
```

- [ ] **Step 1: Write a failing analytic shaft test**

Use a hand-authored symmetric stepped shaft fixture. Assert literal facts for overall length, each unambiguous axial shoulder span, unique diameters, one radius, one chamfer angle, and one centerline. Mutating a shoulder X or one mirrored Y must change or invalidate the corresponding fact.

- [ ] **Step 2: Run the unit test and verify RED**

Run: `pnpm vitest run api/services/drawing-annotation/measurement.test.ts`

Expected: FAIL because the measurement API does not exist.

- [ ] **Step 3: Implement normalized-axis measurement**

Use document-relative tolerance `max(diagonal * 1e-6, 1e-5)`. Determine the horizontal axis from a confirmed xline when available; otherwise require reflected upper/lower envelope support. Cluster line/arc/polyline/spline endpoints and extrema by X. Emit a diameter only when upper/lower samples mirror around the axis within tolerance. Emit axial spans only between adjacent confirmed shoulder stations plus the overall envelope. Read radii only from analytic arcs/circles. Read angles/chamfers only from explicit non-degenerate line directions. Deduplicate by rounded fact key, not by node ID.

- [ ] **Step 4: Add and run the real initial-DXF integration test**

Parse/project `初始图.dxf`, measure it, and assert these independently hand-checked facts are present: overall length `173`, axial spans `55`, `24.5`, `17`, `8`, radii `3` and `2`, angles `60` and `120`, and a centerline at the symmetric axis. Also assert every fact carries source IDs/evidence and no fact has candidate quality.

Run: `pnpm vitest run api/services/drawing-annotation/measurement.test.ts`

Expected: PASS without reading the sample DXF.

---

### Task 4: Reconcile engineering regions and create the annotation plan

**Files:**
- Create: `api/services/drawing-annotation/planner.ts`
- Create: `api/services/drawing-annotation/planner.test.ts`
- Create: `api/services/drawing-annotation/layout.ts`
- Create: `api/services/drawing-annotation/layout.test.ts`
- Modify: `api/services/drawing-annotation/build-steps.ts`
- Test: `api/services/drawing-annotation/planner.test.ts`
- Test: `api/services/drawing-annotation/layout.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PendingAnnotation {
  key: string;
  category: 'tolerance' | 'roughness' | 'datum' | 'geometric-tolerance' | 'section-marker' | 'conflict';
  reason: string;
  requiredFields: string[];
}

export interface AnnotationPlan {
  annotations: AnnotationNode[];
  consumedFactKeys: string[];
  pendingAnnotations: PendingAnnotation[];
  conflicts: PendingAnnotation[];
}

export function planDeterministicAnnotations(input: {
  drawingId: DrawingId;
  geometry: GeometryNode[];
  measurements: MeasurementResult;
  engineeringDocument?: EngineeringDocument;
  engineeringEvidenceRef?: EvidenceId;
}): AnnotationPlan;
```

- [ ] **Step 1: Write failing planner tests**

Assert that confirmed facts become stable formal annotations, nominal dimensions do not inherit sample tolerances, the B01 region corroborates width `17` and diameter `35`, and the S01 outer diameter conflict (`45` versus measured geometry) produces no committed diameter annotation from the document.

- [ ] **Step 2: Run planner tests and verify RED**

Run: `pnpm vitest run api/services/drawing-annotation/planner.test.ts`

Expected: FAIL because the planner does not exist.

- [ ] **Step 3: Implement planning and deterministic lanes**

Generate centerline first, local diameter/radius/chamfer annotations second, adjacent axial dimensions third, documented region dimensions fourth, and overall length last. Layout offsets are proportional to drawing diagonal, with upper/lower lanes alternating by target bounds; lane index is sorted by span then fact key. Produce stable annotation IDs from `drawingId + factKey` and preserve all evidence refs.

- [ ] **Step 4: Run planner/layout tests and verify GREEN**

Run: `pnpm vitest run api/services/drawing-annotation/planner.test.ts api/services/drawing-annotation/layout.test.ts api/services/drawing-annotation/build-steps.test.ts`

Expected: PASS with deterministic IDs/coordinates and no duplicate fact keys.

---

### Task 5: Enforce annotation coverage before commit

**Files:**
- Create: `api/services/drawing-annotation/coverage.ts`
- Create: `api/services/drawing-annotation/coverage.test.ts`
- Test: `api/services/drawing-annotation/coverage.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AnnotationCoverageReport {
  valid: boolean;
  expectedFactKeys: string[];
  consumedFactKeys: string[];
  missingFactKeys: string[];
  duplicateFactKeys: string[];
  invalidAnnotationIds: string[];
  pendingAnnotations: PendingAnnotation[];
  conflicts: PendingAnnotation[];
}

export function evaluateAnnotationCoverage(input: {
  measurements: MeasurementResult;
  plan: AnnotationPlan;
  geometryIds: Set<string>;
}): AnnotationCoverageReport;
```

- [ ] **Step 1: Write failing missing/duplicate/reference tests**

Use literal plans to prove that one omitted fact, one duplicated fact, or one missing geometry target makes `valid` false, while pending/conflict entries do not count as committed omissions.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run api/services/drawing-annotation/coverage.test.ts`

Expected: FAIL because coverage evaluation does not exist.

- [ ] **Step 3: Implement the pure coverage evaluator**

Compare sorted literal fact keys, validate every annotation target, and reject duplicate annotation IDs/fact consumption. Return data only; do not log or mutate the plan.

- [ ] **Step 4: Run and verify GREEN**

Run: `pnpm vitest run api/services/drawing-annotation/coverage.test.ts`

Expected: PASS for valid, missing, duplicate, and dangling-reference cases.

---

### Task 6: Integrate deterministic annotation into atomic DXF import

**Files:**
- Modify: `api/services/drawing-dxf/coordinator.ts`
- Modify: `api/services/drawing-dxf/coordinator.test.ts`
- Modify: `api/routes/drawings.ts`
- Modify: `api/routes/drawings.test.ts`
- Modify: `src/services/drawing-client.ts`
- Modify: `src/services/drawing-client.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`

**Interfaces:**
- Extends `DxfImportReceipt` with:

```ts
annotation: {
  generatedCount: number;
  pendingCount: number;
  conflictCount: number;
  coverage: AnnotationCoverageReport;
};
```

- [ ] **Step 1: Write failing coordinator and client tests**

Import the real initial DXF plus engineering document and assert: source geometry remains present, generated annotations are formal Annotation IR, no source sample annotation is required, coverage is valid, S01 is reported as conflict, and the transaction can be reverted in one operation.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run api/services/drawing-dxf/coordinator.test.ts api/routes/drawings.test.ts src/services/drawing-client.test.ts src/hooks/useStore.test.ts`

Expected: FAIL because the receipt and coordinator do not include deterministic annotations.

- [ ] **Step 3: Integrate the pipeline before transaction construction**

Run measurement, planner, layout, and coverage after projection/recognition. Reject with `DXF_IMPORT_REJECTED` if coverage is invalid. Commit `projection.geometry + recognition.geometry` and generated annotations in the same replacement transaction. Do not commit source annotations when importing an unannotated initial drawing; retain raw manifest regardless.

- [ ] **Step 4: Update UI receipt copy**

Report generated, pending, and conflict counts without exposing model names. Preserve existing DXF file cards and deterministic import route.

- [ ] **Step 5: Run integration tests and verify GREEN**

Run: `pnpm vitest run api/services/drawing-annotation api/services/drawing-dxf api/routes/drawings.test.ts src/services/drawing-client.test.ts src/hooks/useStore.test.ts src/components/AIDialog.test.tsx`

Expected: PASS with atomic import and truthful counts.

---

### Task 7: Real fixture, browser, and regression verification

**Files:**
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Test: existing project suites

- [ ] **Step 1: Add the real regression assertion**

The test imports `初始图.dxf` and the engineering document, compares the generated nominal fact multiset against the `derivable/document-confirmed` Oracle subset, and proves every deferred category is absent from committed annotations.

- [ ] **Step 2: Run focused quality gates**

Run:

```bash
pnpm eslint api/services/drawing-annotation api/services/drawing-dxf/coordinator.ts src/drawing src/services/drawing-client.ts src/hooks/useStore.ts
pnpm check
pnpm vitest run api/services/drawing-annotation api/services/drawing-dxf src/drawing/tests src/services/drawing-client.test.ts src/hooks/useStore.test.ts
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run full project tests and separate unrelated failures**

Run: `pnpm test`

Expected: all real assertions pass; if the existing empty HyperFrames `.test.mjs` discovery issue remains, report it separately and do not modify video assets as part of this feature.

- [ ] **Step 4: Browser acceptance**

Upload `初始图.dxf` and `样本图001# DXF工程数据文档.txt`. Verify the canvas progressively shows source geometry plus generated formal annotations, the annotation toggle hides all generated annotation primitives while preserving geometry, no deferred tolerance/roughness/datum/GD&T/section symbol appears, Undo removes the entire import, and the console has no errors.

- [ ] **Step 5: Update architecture documentation**

Document the runtime authority chain, Annotation Fact pipeline, pending/conflict boundary, and the rule that the sample DXF remains test-only.
