# DXF Import Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-neutral, locally executed ASCII DXF importer that preserves the approved sample geometry and provenance in the canonical Drawing and makes it available to second-layer plugins through the public first-layer host contract.

**Architecture:** A new `@vectorai/dxf-import` package parses bytes into a canonical Drawing plus diagnostics. Generic source provenance lives in `drawing-core`; exact NURBS evaluation is shared by importing, rendering, bounds, and spatial sampling. The first-layer repository publishes a DXF import atomically and exposes it only through an explicit extension-host method, so ordinary uploads keep their existing behavior.

**Tech Stack:** TypeScript 5.8, Vitest 3, React 18 SVG rendering, Zod contracts, pnpm workspace, local Node.js file/byte APIs

**Spec:** `docs/superpowers/specs/2026-08-25-dxf-smart-partition-design.md`

## Global Constraints

- All processing is local; add no VectorAI cloud or Express service.
- DXF import is explicit and must not be triggered by generic chat attachments.
- DXF is parsed as vector geometry; do not rasterize or retrace it.
- Do not hard-code sample coordinates, handles, filenames, or entity ordering in production code.
- `SPLINE` calculations must evaluate the NURBS curve rather than its control polygon.
- Import publication is atomic: fatal validation leaves the previous drawing untouched.
- Preserve user changes outside the files named by this plan.

---

## File structure

Create `packages/dxf-import` with one responsibility per module:

- `src/group-pairs.ts`: strict ASCII DXF group-pair tokenizer.
- `src/sections.ts`: HEADER/TABLES/BLOCKS/ENTITIES section indexing.
- `src/entities.ts`: LINE, ARC, SPLINE, and HATCH adapters.
- `src/hatch.ts`: HATCH boundary/pattern projection into section-hatch segments.
- `src/import.ts`: orchestration, units, source metadata, IDs, bounds, diagnostics.
- `src/types.ts`: public import request/result and diagnostic contracts.
- `src/index.ts`: public exports only.

Shared NURBS evaluation belongs in `packages/drawing-core/src/geometry/spline.ts` so viewer and spatial code consume exactly the same curve.

### Task 1: Canonical source provenance

**Files:**
- Modify: `packages/drawing-core/src/document/types.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-core/src/document/document.test.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`

**Interfaces:**
- Produces: `DrawingSourceDescriptor`, `DrawingNodeSourceRef`, and a vector-capable `DrawingSourceRef`.
- Consumes: existing `DrawingDocument`, `BaseNode`, and `DrawingWorkspaceSnapshot`.

- [ ] **Step 1: Write failing source-provenance tests**

Add assertions that an optional DXF source survives the canonical document and strict wire schema:

```ts
const document = createEmptyDrawing({ idFactory, now: () => 1 });
document.sources = [{
  id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf',
  digest: 'sha256:abc', name: 'shaft.dxf', bytes: 123,
}];
document.geometry.push({
  id: 'line:10' as GeometryId, type: 'line', visible: true,
  quality: { status: 'confirmed', evidenceRefs: [] },
  sourceRef: { sourceId: 'source:dxf', objectId: '10', objectType: 'LINE', layer: 'OUTLINE' },
  start: [0, 0], end: [1, 0],
});
expect(drawingDocumentSchema.parse(document)).toEqual(document);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
pnpm --filter @vectorai/drawing-core test -- document.test.ts
pnpm --filter @vectorai/plugin-space-contracts test -- index.test.ts
```

Expected: TypeScript/schema failures because `sources`, `sourceRef`, and DXF source media are not defined.

- [ ] **Step 3: Add the canonical provenance types**

Add these exact shapes to `document/types.ts` and include `sourceRef?` on `BaseNode` and `sources` on `DrawingDocument`:

```ts
export interface DrawingSourceDescriptor {
  id: string;
  kind: 'image' | 'dxf';
  mediaType: string;
  digest: string;
  name?: string;
  bytes?: number;
}

export interface DrawingNodeSourceRef {
  sourceId: string;
  objectId?: string;
  objectType?: string;
  layer?: string;
}

export interface BaseNode<TId extends string, TType extends string> {
  id: TId;
  type: TType;
  visible: boolean;
  quality: NodeQuality;
  sourceRef?: DrawingNodeSourceRef;
}

export interface DrawingDocument {
  // existing fields remain unchanged
  sources?: DrawingSourceDescriptor[];
}
```

Update `createEmptyDrawing` to initialize `sources: []`. Keep the field optional for
backward compatibility with persisted schema-1 drawings, but require every new DXF
import to populate it. Update the Zod node base shape and document schema with
matching strict schemas. Replace the image-only workspace source with this union:

```ts
export type DrawingSourceRef =
  | { id: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; bytes?: number; width: number; height: number; name?: string }
  | { id: string; mediaType: 'application/dxf'; bytes?: number; name?: string };
```

Existing image creation sites remain source-compatible; image width and height stay
required, while the DXF branch deliberately has no raster dimensions.

- [ ] **Step 4: Run provenance and compatibility tests**

Run:

```bash
pnpm --filter @vectorai/drawing-core test
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/drawing-workspace test
```

Expected: PASS, including existing image snapshot cases without migration.

- [ ] **Step 5: Commit**

```bash
git add packages/drawing-core packages/plugin-space-contracts packages/drawing-workspace
git commit -m "feat add canonical drawing source provenance"
```

### Task 2: Exact shared spline evaluation

**Files:**
- Create: `packages/drawing-core/src/geometry/spline.ts`
- Create: `packages/drawing-core/src/geometry/spline.test.ts`
- Create: `packages/drawing-core/src/geometry/index.ts`
- Modify: `packages/drawing-core/src/index.ts`
- Modify: `packages/drawing-viewer-react/src/canvas/EntityRenderer.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/geometry.ts`
- Modify: `packages/drawing-spatial/src/geometry-sampling.ts`
- Modify: `packages/drawing-spatial/src/query.ts`
- Modify: corresponding viewer and spatial tests

**Interfaces:**
- Produces: `evaluateSpline(node, parameter)`, `sampleSpline(node, options)`, and `splineBounds(node)`.
- Consumes: canonical `SplineGeometry` and `Vec2`.

- [ ] **Step 1: Write failing de Boor evaluation tests**

Cover endpoints, a rational quarter circle, and invalid knot data:

```ts
const quarter: SplineGeometry = {
  id: 's' as GeometryId, type: 'spline', visible: true,
  quality: { status: 'confirmed', evidenceRefs: [] },
  degree: 2,
  controlPoints: [[1, 0], [1, 1], [0, 1]],
  knots: [0, 0, 0, 1, 1, 1],
  weights: [1, Math.SQRT1_2, 1], closed: false, periodic: false,
};
expect(evaluateSpline(quarter, 0)).toEqual([1, 0]);
expect(evaluateSpline(quarter, 1)).toEqual([0, 1]);
expect(evaluateSpline(quarter, 0.5)[0]).toBeCloseTo(Math.SQRT1_2, 6);
expect(evaluateSpline(quarter, 0.5)[1]).toBeCloseTo(Math.SQRT1_2, 6);
```

- [ ] **Step 2: Run tests and verify the missing export**

Run `pnpm --filter @vectorai/drawing-core test -- spline.test.ts`.

Expected: FAIL because the spline geometry helpers do not exist.

- [ ] **Step 3: Implement homogeneous de Boor evaluation and adaptive sampling**

Use homogeneous coordinates `(x*w, y*w, w)`, clamp the public normalized parameter to `[0,1]`, map it to the valid knot domain `[knots[degree], knots[n + 1]]`, then run de Boor recursion. `sampleSpline` must subdivide until the midpoint-to-chord error is within `maxError`, with `maxDepth` as a deterministic guard:

```ts
export interface SplineSampleOptions { maxError: number; maxDepth?: number }

export function sampleSpline(
  node: SplineGeometry,
  { maxError, maxDepth = 12 }: SplineSampleOptions,
): Vec2[] {
  if (!(maxError > 0)) throw new TypeError('SPLINE_MAX_ERROR_INVALID');
  const output: Vec2[] = [evaluateSpline(node, 0)];
  subdivide(node, 0, 1, output[0], evaluateSpline(node, 1), 0, maxDepth, maxError, output);
  return output;
}
```

`splineBounds` unions adaptively sampled points with an error derived from the control-point span (`span * 1e-6`, minimum `1e-8`). Reject inconsistent degree, knot, weight, or non-finite data with stable error codes.

- [ ] **Step 4: Replace all control-polygon approximations**

In the viewer, generate `M/L` SVG path data from `sampleSpline`; in bounds and spatial packages, call `splineBounds` or `sampleSpline`. Remove the quadratic smoothing helper that currently treats control points as a path.

- [ ] **Step 5: Run all curve consumers**

Run:

```bash
pnpm --filter @vectorai/drawing-core test
pnpm --filter @vectorai/drawing-viewer-react test
pnpm --filter @vectorai/drawing-spatial test
```

Expected: PASS; rational test point and viewer/spatial bounds agree.

- [ ] **Step 6: Commit**

```bash
git add packages/drawing-core packages/drawing-viewer-react packages/drawing-spatial
git commit -m "feat evaluate canonical splines exactly"
```

### Task 3: DXF tokenizer and typed section reader

**Files:**
- Create: `packages/dxf-import/package.json`
- Create: `packages/dxf-import/tsconfig.json`
- Create: `packages/dxf-import/src/group-pairs.ts`
- Create: `packages/dxf-import/src/sections.ts`
- Create: `packages/dxf-import/src/types.ts`
- Create: `packages/dxf-import/src/index.ts`
- Create: `packages/dxf-import/src/group-pairs.test.ts`

**Interfaces:**
- Produces: `decodeDxfPairs(bytes)`, `indexDxfSections(pairs)`, `DxfPair`, `DxfImportDiagnostic`.
- Consumes: raw `Uint8Array`; no Node filesystem APIs.

- [ ] **Step 1: Write tokenizer and section-index tests**

Use inline CRLF/LF fixtures and assert stable line numbers:

```ts
const pairs = decodeDxfPairs(new TextEncoder().encode(
  '0\r\nSECTION\r\n2\r\nHEADER\r\n9\r\n$INSUNITS\r\n70\r\n4\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n',
));
expect(pairs[2]).toMatchObject({ code: 9, value: '$INSUNITS', line: 5 });
expect(indexDxfSections(pairs).header).toBeDefined();
```

Also assert odd line counts, invalid group codes, missing EOF, and NUL bytes produce explicit diagnostics.

- [ ] **Step 2: Run the new package test and verify failure**

Run `pnpm --filter @vectorai/dxf-import test`.

Expected: FAIL because the package and functions are absent.

- [ ] **Step 3: Implement strict decoding and section indexing**

Define:

```ts
export interface DxfPair { code: number; value: string; line: number }
export interface DxfImportDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  line?: number;
  sourceHandle?: string;
}
```

Decode UTF-8 with BOM support, preserve non-ASCII layer names, accept CRLF or LF,
and reject malformed pairs before entity parsing. `indexDxfSections` returns ranges
for HEADER, TABLES, BLOCKS, and ENTITIES without copying the full byte buffer.

- [ ] **Step 4: Run tokenizer tests and typecheck**

Run:

```bash
pnpm --filter @vectorai/dxf-import test
pnpm --filter @vectorai/dxf-import check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dxf-import pnpm-lock.yaml
git commit -m "feat add strict local DXF reader"
```

### Task 4: Entity adapters and canonical import

**Files:**
- Create: `packages/dxf-import/src/entities.ts`
- Create: `packages/dxf-import/src/hatch.ts`
- Create: `packages/dxf-import/src/import.ts`
- Create: `packages/dxf-import/src/entities.test.ts`
- Create: `packages/dxf-import/src/import.test.ts`
- Modify: `packages/dxf-import/src/index.ts`

**Interfaces:**
- Produces: `importDxf(request: DxfImportRequest): DxfImportResult`.
- Consumes: tokenizer/sections from Task 3 and canonical types/spline validation from Tasks 1–2.

- [ ] **Step 1: Write failing adapter tests**

Add minimal valid entities for LINE, ARC, weighted SPLINE, and HATCH. Assert layer,
handle, source ID, units, and canonical plane:

```ts
const result = importDxf({
  bytes: fixtureBytes,
  source: { name: 'fixture.dxf', digest: 'sha256:fixture' },
  drawingId: 'drawing:fixture',
  now: () => 1,
});
expect(result.status).toBe('imported');
expect(result.document.geometry.map(({ type }) => type)).toEqual(['line', 'arc', 'spline']);
expect(result.document.annotations[0].type).toBe('section-hatch');
expect(result.document.geometry[0].sourceRef).toMatchObject({ objectType: 'LINE', layer: 'OUTLINE' });
```

- [ ] **Step 2: Run adapter tests and verify failure**

Run `pnpm --filter @vectorai/dxf-import test -- entities.test.ts import.test.ts`.

Expected: FAIL because no adapters or orchestrator exist.

- [ ] **Step 3: Implement entity record decoding**

Split ENTITIES at group code `0`; collect repeated codes without collapsing them.
Map:

- LINE: codes `10/20` and `11/21`;
- ARC: `10/20`, `40`, `50`, `51` with counter-clockwise DXF semantics;
- SPLINE: flags `70`, degree `71`, knots `40`, weights `41`, control points `10/20`;
- HATCH: pattern name `2`, angle `52`, scale/spacing data, and supported polyline/edge boundary paths.

Use stable node IDs from `sha256(sourceDigest + ':' + handle + ':' + occurrence)`.
Missing handles use the record index only as a source-local fallback. Filter paper-space
entities using group code `67`; emit an informational diagnostic for VIEWPORT and a
warning for unsupported drawable entity types.

- [ ] **Step 4: Implement the import transaction**

Define:

```ts
export interface DxfImportRequest {
  bytes: Uint8Array;
  source: { name?: string; digest: string };
  drawingId: string;
  now?: () => number;
}

export type DxfImportResult =
  | { status: 'imported'; document: DrawingDocument; bounds: Bounds2D; diagnostics: DxfImportDiagnostic[]; counts: Record<string, number> }
  | { status: 'rejected'; diagnostics: DxfImportDiagnostic[] };
```

Resolve `$INSUNITS` code `4` to `mm`, `5` to `cm`, and `6` to `m`. Reject absent or
unsupported units for this milestone. Compute bounds from imported drawable nodes,
not `$EXTMIN/$EXTMAX` or VIEWPORT. Validate the final document with the canonical
schema before returning `imported`.

- [ ] **Step 5: Run package tests**

Run `pnpm --filter @vectorai/dxf-import test && pnpm --filter @vectorai/dxf-import check`.

Expected: PASS with deterministic IDs and diagnostics.

- [ ] **Step 6: Commit**

```bash
git add packages/dxf-import
git commit -m "feat normalize DXF entities into canonical drawings"
```

### Task 5: Real sample regression fixture

**Files:**
- Create: `packages/dxf-import/test/fixtures/initial-shaft.dxf`
- Create: `packages/dxf-import/test/fixtures/initial-shaft-engineering.ini`
- Create: `packages/dxf-import/src/sample.integration.test.ts`

**Interfaces:**
- Consumes: `importDxf` from Task 4.
- Produces: reproducible sample evidence for this plan and the partition plan.

- [ ] **Step 1: Copy the approved inputs into neutral fixture names**

Run:

```bash
cp "/Users/sidhu/Downloads/初始图.dxf" packages/dxf-import/test/fixtures/initial-shaft.dxf
cp "/Users/sidhu/Downloads/样本图001# DXF工程数据文档.txt" packages/dxf-import/test/fixtures/initial-shaft-engineering.ini
```

Verify:

```bash
shasum -a 256 packages/dxf-import/test/fixtures/initial-shaft.dxf packages/dxf-import/test/fixtures/initial-shaft-engineering.ini
```

Expected digests:

```text
57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2
d77749c6add4eef47c2db4f18dcd494976252338e1b4345ca2ad3b42c42abe65
```

- [ ] **Step 2: Write the real import test**

```ts
expect(result.status).toBe('imported');
if (result.status !== 'imported') return;
expect(result.counts).toMatchObject({ LINE: 89, SPLINE: 33, ARC: 12, HATCH: 2, VIEWPORT: 1 });
expect(result.document.geometry.filter(({ type }) => type === 'line')).toHaveLength(89);
expect(result.document.geometry.filter(({ type }) => type === 'spline')).toHaveLength(33);
expect(result.document.geometry.filter(({ type }) => type === 'arc')).toHaveLength(12);
expect(result.document.annotations.filter(({ type }) => type === 'section-hatch')).toHaveLength(2);
expect(new Set(allNodes(result.document).map((node) => node.sourceRef?.layer))).toEqual(
  new Set(['0', '1轮廓实线层', '5剖面线层']),
);
expect(result.document.unitSystem.length).toBe('mm');
expect(result.bounds.maxX - result.bounds.minX).toBeCloseTo(173, 6);
```

- [ ] **Step 3: Run the real fixture test**

Run `pnpm --filter @vectorai/dxf-import test -- sample.integration.test.ts`.

Expected: PASS. Any unsupported sample data must appear in asserted diagnostics, not console output.

- [ ] **Step 4: Commit**

```bash
git add packages/dxf-import/test packages/dxf-import/src/sample.integration.test.ts
git commit -m "test add real shaft DXF regression fixture"
```

### Task 6: Atomic first-layer DXF publication

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Modify: `packages/plugin-dsh-space-host/src/repository.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository-persistence.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/dependency-boundary.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/review-renderer.ts`
- Modify: `packages/plugin-dsh-space-host/src/review-renderer.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.ts` only if the first-layer client also needs direct DXF import; otherwise keep the method host-internal.

**Interfaces:**
- Produces: `DrawingSpaceExtensionHost.importDxf(session, request, signal)`, `DrawingSpaceExtensionHost.renderObservation(session, request, signal)`, and `InMemoryDrawingRepository.importDxf`.
- Consumes: `importDxf` from `@vectorai/dxf-import`.

- [ ] **Step 1: Write failing repository publication tests**

Test successful replacement, duplicate digest reuse, persistence, abort, and atomic rejection:

```ts
const first = await drawings.importDxf('session-a', {
  bytes, name: 'shaft.dxf', digest: 'sha256:fixture', signal: AbortSignal.timeout(1_000),
});
expect(first.status).toBe('imported');
const before = drawings.getSnapshot('session-a');
await expect(drawings.importDxf('session-a', invalidRequest)).rejects.toThrow('DXF_IMPORT_REJECTED');
expect(drawings.getSnapshot('session-a')).toEqual(before);
```

- [ ] **Step 2: Run focused host tests and verify failure**

Run `pnpm --filter @vectorai/plugin-dsh-space-host test -- repository.test.ts repository-persistence.test.ts`.

Expected: FAIL because `importDxf` is absent.

- [ ] **Step 3: Add the public extension-host request**

Add to `plugin-space-contracts`:

```ts
export interface DrawingDxfImportRequest {
  bytes: Uint8Array;
  name?: string;
  digest: string;
}

export interface DrawingObservationOverlay {
  id: string;
  label: string;
  polygon: Vec2[];
}

export interface DrawingObservationRequest {
  ref: DrawingWorkspaceRef;
  overlays?: DrawingObservationOverlay[];
}

export type DrawingObservationResult =
  | { status: 'rendered'; png: Uint8Array; contentDigest: string; width: number; height: number }
  | { status: 'stale'; currentRef: DrawingWorkspaceRef }
  | { status: 'rejected'; code: string; message: string };

export interface DrawingSpaceExtensionHost<TSession = unknown> {
  getSnapshot(session: TSession): DrawingWorkspaceSnapshot | null;
  importDxf(session: TSession, request: DrawingDxfImportRequest, signal?: AbortSignal): Promise<DrawingImportResult>;
  renderObservation(session: TSession, request: DrawingObservationRequest, signal?: AbortSignal): Promise<DrawingObservationResult>;
  runExtensionProgram(session: TSession, request: DrawingExtensionProgramRequest, signal?: AbortSignal): Promise<DrawingExtensionProgramWorkflow>;
}
```

This is an in-process plugin host contract. Do not expose DXF bytes in model context
or add a global prompt. Observation overlays are generic bounded world-space
polygons, not partition-specific first-layer state.

- [ ] **Step 4: Implement atomic repository publication**

`InMemoryDrawingRepository.importDxf` computes/validates the digest, runs the importer
before changing maps or storage, then publishes a revision-1 `DrawingEntry` with
`source.mediaType = 'application/dxf'`, no underlay dimensions, `provisional` based on diagnostics,
and cleared previews/motion rigs. Duplicate current source digest returns
`already-imported` without reparsing.

- [ ] **Step 5: Implement the host method and lifecycle cleanup**

`DrawingSpaceHostService.importDxf` delegates using `String(agent.id)` and the caller's
abort signal. It must not register a generic agent tool or pre-step router. The second
layer will call this contract only from its explicit import workflow.

- [ ] **Step 6: Expose bounded local observation rendering**

Extend `renderDrawingObservation` to accept at most 128 overlay polygons, each with
at most 16 finite points and an 80-character label. Render translucent polygons,
non-scaling borders, and labels into the same deterministic SVG/PNG pipeline used
by first-layer visual review. `DrawingSpaceHostService.renderObservation` validates
the Drawing ref before rendering and returns PNG bytes plus digest; it does not save
an attachment or call a model. Add tests for overlay labels, digest stability,
invalid polygons, and stale refs.

- [ ] **Step 7: Run host, contract, persistence, and existing image-import tests**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: PASS. Existing `drawing_import` remains image-only and explicitly routed.

- [ ] **Step 8: Commit**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-space-host pnpm-lock.yaml
git commit -m "feat expose explicit local DXF import to plugins"
```

### Task 7: Foundation verification gate

**Files:**
- Modify: `docs/development.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: all deliverables in Tasks 1–6.
- Produces: documented local verification and first-layer extension contract.

- [ ] **Step 1: Document explicit DXF import and sample test command**

Add the package boundary, supported sample entities, no-auto-route rule, and these commands:

```bash
pnpm --filter @vectorai/dxf-import test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm check
pnpm test
pnpm build:dsh-space
```

- [ ] **Step 2: Run whitespace and dependency checks**

Run:

```bash
git diff --check
pnpm --filter @vectorai/drawing-core check
pnpm --filter @vectorai/drawing-spatial check
pnpm --filter @vectorai/drawing-viewer-react check
pnpm --filter @vectorai/dxf-import check
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: all exit 0.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build:dsh-space
```

Expected: all exit 0 and the real sample integration test reports the approved entity counts.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/development.md docs/tech-architecture.md
git commit -m "docs describe local DXF import boundary"
```
