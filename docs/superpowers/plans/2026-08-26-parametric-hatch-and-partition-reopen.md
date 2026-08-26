# Parametric Hatch and Partition Reopen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve DXF HATCH semantics and render them with robust Clipper2 topology while adding an explicit, persistent confirmed-partition reopen workflow.

**Architecture:** `drawing-core` owns the versioned parametric data contract, a new host-neutral `drawing-hatch` package owns curve flattening and Clipper2 topology normalization, `dxf-import` only parses DXF semantics, and `drawing-viewer-react` produces the SVG render plan. Partition reopen is a named host/store/remote/controller operation, with the annotation sidebar switching between editable draft and confirmed revision views.

**Tech Stack:** TypeScript, React 18, SVG compound clip paths, `clipper2-ts`, Zod, Vitest, pnpm, DSH Cordis/Typert remotes.

**Spec:** `docs/superpowers/specs/2026-08-26-parametric-hatch-and-partition-reopen-design.md`

## Global Constraints

- All computation remains local; no server or Python runtime is introduced.
- New HATCH imports preserve boundary paths, pattern line families, hatch style, OCS metadata, pattern angle, scale, and double flag.
- Existing snapshots containing only materialized `segments` remain readable and renderable.
- Invalid HATCH topology emits a diagnostic and never creates a fabricated closing edge.
- Use `clipper2-ts` under Boost Software License 1.0 and record it in `NOTICE`/third-party notices.
- Do not make intermediate commits; include all tasks in the existing large feature commit/PR as requested by the user.

---

### Task 1: Versioned parametric HATCH contract

**Files:**
- Modify: `packages/drawing-core/src/document/types.ts`
- Modify: `packages/drawing-core/src/document/index.ts`
- Modify: `packages/drawing-core/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/drawing-core/src/io/dxf.test.ts`

**Interfaces:**
- Produces `HatchBoundaryEdge`, `HatchBoundaryPath`, `HatchPatternLine`, `ParametricHatch`, and backward-compatible `SectionHatchAnnotation`.
- `SectionHatchAnnotation` must contain either `hatch: ParametricHatch` or non-empty legacy `segments`, and may contain both during migration.

- [ ] **Step 1: Write failing contract tests**

Add a strict round-trip fixture to `plugin-space-contracts/src/index.test.ts`:

```ts
const hatch = {
  id: 'hatch-1', type: 'section-hatch', visible: true,
  pattern: 'ANSI31', angle: 45, spacing: 3.175,
  hatch: {
    version: 1, style: 'normal', elevation: 0, extrusion: [0, 0, 1],
    patternAngle: 0, patternScale: 25.4, double: false,
    boundaryPaths: [{ flags: 1, closed: true, edges: [
      { type: 'line', start: [0, 0], end: [10, 0] },
      { type: 'line', start: [10, 0], end: [10, 10] },
      { type: 'line', start: [10, 10], end: [0, 10] },
      { type: 'line', start: [0, 10], end: [0, 0] },
    ] }],
    patternLines: [{ angle: 45, base: [0, 0], offset: [0, 0.125], dashLengths: [] }],
  },
  quality: { status: 'confirmed', evidenceRefs: [] },
};
expect(drawingDocumentSchema.parse({ ...document, annotations: [hatch] }).annotations[0]).toEqual(hatch);
```

Also retain the existing segments-only fixture and assert that neither `hatch` nor `segments` is rejected when the other is present, but the absence of both is rejected.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec vitest run packages/plugin-space-contracts/src/index.test.ts packages/drawing-core/src/io/dxf.test.ts
```

Expected: FAIL because the parametric HATCH types/schema do not exist.

- [ ] **Step 3: Add exact data types and strict schemas**

Define discriminated edge types for `line`, `arc`, `ellipse`, and `spline`; keep polyline bulges as arc edges after parsing. Update `SectionHatchAnnotation` to:

```ts
export interface SectionHatchAnnotation extends BaseNode<AnnotationId, 'section-hatch'> {
  pattern: string;
  angle: number;
  spacing: number;
  hatch?: ParametricHatch;
  segments?: SectionHatchSegment[];
}
```

Use a Zod `superRefine` check that adds `SECTION_HATCH_REPRESENTATION_REQUIRED` when both optional representations are absent.

- [ ] **Step 4: Run contract tests and typecheck**

```bash
pnpm exec vitest run packages/plugin-space-contracts/src/index.test.ts packages/drawing-core/src/io/dxf.test.ts
pnpm check
```

Expected: PASS.

---

### Task 2: Host-neutral Clipper2 HATCH geometry kernel

**Files:**
- Create: `packages/drawing-hatch/package.json`
- Create: `packages/drawing-hatch/tsconfig.json`
- Create: `packages/drawing-hatch/src/index.ts`
- Create: `packages/drawing-hatch/src/flatten.ts`
- Create: `packages/drawing-hatch/src/topology.ts`
- Create: `packages/drawing-hatch/src/render-plan.ts`
- Create: `packages/drawing-hatch/src/topology.test.ts`
- Create: `packages/drawing-hatch/src/render-plan.test.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `NOTICE`

**Interfaces:**
- Consumes `ParametricHatch` from `@vectorai/drawing-core`.
- Produces:

```ts
export interface NormalizedHatchRegion { contours: Vec2[][]; fillRule: 'evenodd' | 'nonzero'; bounds: Bounds2D }
export interface HatchRenderLine { start: Vec2; end: Vec2; dashArray: number[]; dashOffset: number }
export interface HatchRenderPlan { region: NormalizedHatchRegion; lines: HatchRenderLine[] }
export interface RigidTransform2D { translation: Vec2; rotationRadians: number; pivot: Vec2 }
export function normalizeHatchRegion(hatch: ParametricHatch, tolerance: number): HatchRegionResult;
export function createHatchRenderPlan(hatch: ParametricHatch, tolerance: number): HatchRenderPlanResult;
export function transformParametricHatch(hatch: ParametricHatch, transform: RigidTransform2D): ParametricHatch;
```

- [ ] **Step 1: Write failing topology tests**

Cover unordered and reversed square edges, a concave polygon, an outer loop with a hole, an island, a self-intersecting loop, and a 6.5-unit unclosed gap. Assert the valid cases produce closed contours with expected signed/absolute area, while the gap case returns:

```ts
expect(result).toEqual({ status: 'invalid', code: 'HATCH_BOUNDARY_OPEN' });
```

- [ ] **Step 2: Run topology tests and verify RED**

```bash
pnpm exec vitest run packages/drawing-hatch/src/topology.test.ts
```

Expected: FAIL because the package and normalizer do not exist.

- [ ] **Step 3: Implement adaptive flattening and strict endpoint graph assembly**

Use chord-error subdivision for arcs/ellipses and recursive knot-interval subdivision for NURBS. Set tolerance from drawing diagonal with a bounded formula:

```ts
const tolerance = Math.min(0.05, Math.max(1e-6, diagonal * 1e-6));
```

Build endpoint buckets using tolerance-sized integer keys, reverse edges when required, and require every contour vertex to have degree two. Never connect unmatched endpoints by nearest-distance fallback.

- [ ] **Step 4: Normalize contours through Clipper2**

Add `clipper2-ts` and choose an integer scale that keeps every coordinate below `Number.MAX_SAFE_INTEGER / 1024`. Use Clipper2 union/normalization with `FillRule.EvenOdd` for normal style; filter nesting depth for outer style; use outer boundaries without hole subtraction for ignore style. Return a diagnostic instead of geometry on overflow.

- [ ] **Step 5: Write failing render-plan tests**

For ANSI31, assert unique normal projections differ by exactly 3.175 within `1e-6`, line directions remain 45 degrees, dash phase is stable, and all generated lines span the region bounds before SVG clipping.

- [ ] **Step 6: Implement regular pattern-line generation**

Generate line indices from normal projections of the normalized region bounds. Preserve full DXF offset vectors: perpendicular offset determines spacing and the parallel component determines dash phase. Enforce `MAX_HATCH_RENDER_LINES = 20_000` and return `HATCH_PATTERN_DENSITY_LIMIT` instead of silently thinning the pattern.

- [ ] **Step 7: Run package tests and checks**

```bash
pnpm exec vitest run packages/drawing-hatch/src
pnpm --filter @vectorai/drawing-hatch check
```

Expected: PASS.

---

### Task 3: Parse and export original DXF HATCH semantics

**Files:**
- Modify: `packages/dxf-import/package.json`
- Rewrite: `packages/dxf-import/src/hatch.ts`
- Create: `packages/dxf-import/src/hatch.test.ts`
- Modify: `packages/dxf-import/src/import.test.ts`
- Modify: `packages/dxf-import/src/sample.integration.test.ts`
- Modify: `packages/drawing-core/src/io/dxf.ts`
- Modify: `packages/drawing-core/src/io/dxf.test.ts`

**Interfaces:**
- Consumes the Task 1 HATCH contract and Task 2 normalization API.
- Produces a `SectionHatchAnnotation` with `hatch` as source of truth and no required pre-materialized segments.

- [ ] **Step 1: Write failing parser tests for every DXF edge and pattern field**

Assert group 75, 52, 41, 77, boundary flags, line/arc/ellipse/spline edges, line-family base/offset, and dash lengths survive parsing without transformation loss. Include a malformed open-loop fixture and assert a `DXF_HATCH_BOUNDARY_OPEN` diagnostic with no fabricated segment.

- [ ] **Step 2: Run importer tests and verify RED**

```bash
pnpm exec vitest run packages/dxf-import/src/hatch.test.ts packages/dxf-import/src/import.test.ts packages/dxf-import/src/sample.integration.test.ts
```

Expected: FAIL because the importer still emits only segments.

- [ ] **Step 3: Separate parsing from validation**

Replace the current `flattenBoundary`/`estimateFallbackJoinTolerance`/`clipPatternFamily` pipeline with:

```ts
const hatch = parseParametricHatch(record.pairs);
const validation = normalizeHatchRegion(hatch, hatchTolerance(hatch));
```

Keep the parsed HATCH when validation fails and attach an import diagnostic. Delete the large-gap fallback and debug logging tied to the old segment projection.

- [ ] **Step 4: Update DXF export to write HATCH entities**

When `node.hatch` exists, write `HATCH`, boundary paths, group 75/52/41/77 and all pattern definition lines. Use legacy LINE export only for old `segments`-only nodes. Add a parse → export → parse test asserting semantic equality of the parametric fields.

- [ ] **Step 5: Strengthen the real initial-shaft regression**

Assert both HATCH nodes retain ANSI31, `spacing === 3.175`, valid normalized regions, and no `HATCH_BOUNDARY_OPEN` diagnostic. Remove assertions that treat generated segments as imported truth.

- [ ] **Step 6: Run importer/export tests**

```bash
pnpm exec vitest run packages/dxf-import/src packages/drawing-core/src/io/dxf.test.ts
pnpm check
```

Expected: PASS.

---

### Task 4: SVG compound-path HATCH renderer

**Files:**
- Modify: `packages/drawing-viewer-react/package.json`
- Create: `packages/drawing-viewer-react/src/canvas/HatchRenderer.tsx`
- Create: `packages/drawing-viewer-react/src/canvas/HatchRenderer.test.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/EntityRenderer.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/geometry.ts`
- Modify: `packages/drawing-spatial/package.json`
- Modify: `packages/drawing-spatial/src/query.ts`
- Modify: `packages/drawing-spatial/src/query.test.ts`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Modify: `packages/plugin-dsh-space-host/src/review-renderer.ts`
- Modify: `packages/plugin-dsh-space-host/src/review-renderer.test.ts`
- Modify: `packages/drawing-edit-core/package.json`
- Modify: `packages/drawing-edit-core/src/compiler.ts`
- Modify: `packages/drawing-edit-core/src/compiler.test.ts`
- Modify: `packages/drawing-viewer-react/src/styles.css`

**Interfaces:**
- Consumes `createHatchRenderPlan()` from Task 2.
- `HatchRenderer` renders parametric HATCH; `EntityRenderer` retains the existing legacy segment branch.

- [ ] **Step 1: Write failing renderer tests**

Render a region with a hole and assert markup contains one annotation-scoped `clipPath`, a compound path with `clip-rule="evenodd"`, uniformly indexed pattern lines, preserved `stroke-dasharray`, and no pre-clipped outlier segment. Render a segments-only legacy node and assert its old `<line>` output remains.

- [ ] **Step 2: Run renderer tests and verify RED**

```bash
pnpm exec vitest run packages/drawing-viewer-react/src/canvas/HatchRenderer.test.tsx
```

Expected: FAIL because `HatchRenderer` does not exist.

- [ ] **Step 3: Implement deterministic clip-path rendering**

Generate a stable ID from the annotation ID, emit normalized contours as a compound SVG path, apply the render plan lines inside a clipped `<g>`, and set `vectorEffect="non-scaling-stroke"`. Memoize by HATCH object identity plus tolerance; do not reparse DXF or mutate document state.

- [ ] **Step 4: Verify zoom invariance**

Add a test rendering at viewport scales 1 and 8. Assert world-coordinate endpoints and normal projection gaps are identical, while only stroke presentation changes.

- [ ] **Step 5: Migrate non-React geometry consumers**

Use normalized HATCH region bounds in `drawing-spatial/query.ts`. In the host-side review renderer, materialize a deterministic render plan and emit its lines inside the same compound clip region; retain the segment-only fallback. Update `drawing-edit-core` to transform parametric boundary edges, pattern bases/offsets, angles, extrusion orientation, and any legacy segments together via `transformParametricHatch`. Add tests proving spatial bounds include parametric paths, semantic edits preserve hatch alignment, and review PNG/SVG generation no longer dereferences missing `segments`.

- [ ] **Step 6: Run viewer, spatial, and review-renderer tests**

```bash
pnpm exec vitest run packages/drawing-viewer-react/src packages/drawing-spatial/src/query.test.ts packages/drawing-edit-core/src/compiler.test.ts packages/plugin-dsh-space-host/src/review-renderer.test.ts
pnpm --filter @vectorai/drawing-viewer-react check
pnpm --filter @vectorai/drawing-spatial check
pnpm --filter @vectorai/drawing-edit-core check
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: PASS.

---

### Task 5: Explicit persistent partition reopen use case

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/partition-store.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-store.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-controller.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-controller.test.ts`

**Interfaces:**
- Produces `reopenPartition(sessionId, expectedDrawingRef)` across host, Typert remote, and client controller.
- Store envelope gains `lastConfirmedDraft?: PartitionDraft` as internal persisted state, not public session schema.

- [ ] **Step 1: Write failing store lifecycle tests**

Cover `confirm → reopen → edit → cancel`, `confirm → reopen → edit → confirm`, reload from persisted envelope, legacy envelope reconstruction, idempotent reopen while editing, stale drawing ref, and missing confirmed revision. Assert cancellation restores the original confirmed ID and reconfirm sets `parentRevisionId`.

- [ ] **Step 2: Run store tests and verify RED**

```bash
pnpm exec vitest run packages/plugin-dsh-annotation-host/src/partition-store.test.ts
```

Expected: FAIL because `reopen` is absent.

- [ ] **Step 3: Implement persisted confirmed-draft restoration**

On confirm, store a clone of the validating draft in `lastConfirmedDraft`. Implement:

```ts
reopen(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot
```

Set `basePartitionRevisionId` to the confirmed ID. For legacy envelopes, rebuild step candidates from internal segment boundaries with deterministic IDs and add a warning diagnostic `PARTITION_REOPEN_DRAFT_RECONSTRUCTED`.

- [ ] **Step 4: Add service and remote plumbing tests**

Assert `PartitionWorkflowService.reopen()` checks the active drawing revision, starts annotation workflow status, and returns editing. Assert host/client Typert descriptor lists include `reopenPartition` with a strict `DrawingRef` parameter.

- [ ] **Step 5: Implement service, descriptors, and controller action**

Add `reopenPartition` to both Typert maps and descriptors and expose `controller.actions.reopen()`. Do not implement it as a client-side alias for Undo.

- [ ] **Step 6: Run host/client partition tests**

```bash
pnpm exec vitest run packages/plugin-dsh-annotation-host/src/partition-store.test.ts packages/plugin-dsh-annotation-host/src/partition-service.test.ts packages/plugin-dsh-annotation-host/src/typert.test.ts packages/plugin-dsh-annotation-client/src/remote.test.ts packages/plugin-dsh-annotation-client/src/partition-controller.test.ts
pnpm check
```

Expected: PASS.

---

### Task 6: Confirmed partition sidebar and editing restoration UI

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes `PartitionSessionSnapshot.confirmed` and `controller.actions.reopen()` from Task 5.
- Produces a permanent read-only confirmed structure view and explicit “重新编辑分区” action.

- [ ] **Step 1: Write failing confirmed-sidebar tests**

Render a confirmed snapshot and assert the structure panel shows revision ID, formatted confirmation time, every segment name/range/diameter, and a button with `aria-label="重新编辑分区"`. Click it and assert `reopen()` is called once. Editing snapshots must still render `PartitionInspector`.

- [ ] **Step 2: Run UI tests and verify RED**

```bash
pnpm exec vitest run packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.test.tsx packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx
```

Expected: FAIL because confirmed inspection and reopen action are absent.

- [ ] **Step 3: Implement the confirmed inspector**

Use the existing opaque overlay panel and visual language. Disable the reopen button while controller state is busy. Route errors through the existing canvas error pill. Keep the sidebar entry visible in editing and confirmed phases.

- [ ] **Step 4: Verify action toolbar restoration**

Update the workspace test observable after the mocked reopen response and assert the partition overlay plus cancel/preview/confirm toolbar appear again. Assert cancel returns the read-only confirmed inspector.

- [ ] **Step 5: Run annotation client tests**

```bash
pnpm exec vitest run packages/plugin-dsh-annotation-client/src
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

Expected: PASS.

---

### Task 7: End-to-end migration and visual verification

**Files:**
- Modify: `scripts/e2e-dxf-smart-partition.ts`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/prd.md`
- Modify: generated local DSH plugin bundles under `packages/plugin-dsh-*/lib/`

**Interfaces:**
- Consumes all prior tasks.
- Produces the shippable local DSH build and evidence for the feature PR.

- [ ] **Step 1: Extend the end-to-end script**

Import `initial-shaft.dxf`, assert two parametric HATCH nodes, normalize both successfully, verify ANSI31 normal-projection gaps equal 3.175mm, then execute partition `confirm → reopen → move boundary → cancel` and assert the original confirmed revision is restored.

- [ ] **Step 2: Run focused end-to-end verification**

```bash
pnpm e2e:dxf-smart-partition
```

Expected: PASS with parametric hatch count 2, spacing 3.175, and reopen lifecycle in the JSON summary.

- [ ] **Step 3: Update current architecture and product docs**

Document parametric HATCH ownership in the first layer, Clipper2 local computation, legacy compatibility, and the second-layer confirmed/reopen UI. Remove statements that describe section hatch as display-only precomputed segments.

- [ ] **Step 4: Run the complete verification gate**

```bash
pnpm test
pnpm check
pnpm e2e:dxf-smart-partition
pnpm build:dsh-space
pnpm build:dsh-annotation
git diff --check
```

Expected: all tests pass, typecheck exits 0, E2E exits 0, both bundles build, and diff check is empty.

- [ ] **Step 5: Restart DSH and perform real UI checks**

Verify in the local app that the confirmed structure remains reachable, reopen restores overlays and action toolbar, cancel restores the confirmed view, the initial shaft hatch is uniform and fully clipped inside material, zoom does not change world spacing, and no old import sidebar returns.

- [ ] **Step 6: Create the single feature commit**

```bash
git add packages docs scripts pnpm-lock.yaml THIRD_PARTY_NOTICES.md
git commit -m "feat: preserve parametric hatch and reopen partitions"
```

Do not push or open the PR until requested or until the existing feature branch completion step is reached.
