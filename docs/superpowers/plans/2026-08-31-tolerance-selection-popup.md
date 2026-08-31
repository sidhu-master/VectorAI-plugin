# Tolerance and Fit Selection Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline GB/T 1800 tolerance and fit selector that opens as a non-modal popup over the engineering drawing, previews exact deviations, and applies single dimensions or paired fits without altering unrelated annotations.

**Architecture:** Extend the existing engineering-annotation tolerance model with a versioned standard provider and standard-backed selection metadata. The DSH annotation Host owns deterministic catalog queries and atomic edits; the annotation client owns transient popup state and preview. Confirmed values continue to project through first-layer `ToleranceProjection` for rendering and DXF export.

**Tech Stack:** TypeScript, React 18, Zod 4, Vitest, existing VectorAI drawing/annotation packages, DSH direct remotes, DXF R2018 writer.

**Spec:** `docs/superpowers/specs/2026-08-31-tolerance-selection-popup-design.md`

## Global Constraints

- GB/T 1800.1/2-2020 is the first provider; the initial bundled nominal-size range is `0 < D <= 500 mm`.
- All standard lookup and calculation run locally and synchronously; no network or service dependency is allowed.
- AI may recommend a designation but cannot supply confirmed numeric deviations.
- The popup opens at `760 × 520` CSS pixels, has a `560 × 380` minimum, and cannot exceed 80% of the drawing viewport.
- Popup interaction must not pan, zoom, resize, or refit the drawing viewport.
- Single edits and paired-fit edits are atomic undo entries and preserve every unrelated annotation family.
- Production code cannot read golden drawing IDs, hashes, coordinates, filenames, or expected tolerance values.
- Do not modify DSH source. Add only plugin contracts, Host remotes, and client UI owned by VectorAI packages.
- Do not add system-Python or platform-runtime fallbacks.
- Do not open or route this feature merely because a drawing or document was imported; entry requires an explicit user action or an annotation task already owned by the second-layer plugin.

---

## File Structure

### Engineering domain

- Create `packages/engineering-annotation/src/tolerance/standard-types.ts`: provider requests/results, standard references, catalog bands, single assignments, and paired fits.
- Create `packages/engineering-annotation/src/tolerance/feature-of-size.ts`: deterministic classification of internal, external, ambiguous, and unsupported dimension intents.
- Create `packages/engineering-annotation/src/tolerance/gbt1800-2020-data.ts`: normalized 0–500 mm interval dataset and preferred/common designation sets.
- Create `packages/engineering-annotation/src/tolerance/gbt1800-provider.ts`: GB/T 1800 catalog lookup, single-band resolution, and fit calculation.
- Create `packages/engineering-annotation/src/tolerance/edit.ts`: immutable application, override, restore, and pair-staleness operations.
- Modify `packages/engineering-annotation/src/dimension/types.ts`: standard-backed fields on `ToleranceSpec`, plus `FitAssignment[]` on drafts/revisions.
- Modify `packages/engineering-annotation/src/dimension/project.ts`: project effective calculated/override values and presentation preference.
- Modify `packages/engineering-annotation/src/index.ts`: export the new focused modules.

### Portable and wire contracts

- Modify `packages/drawing-core/src/document/types.ts`: portable standard reference, feature class, and display preference.
- Modify `packages/drawing-core/src/document/tolerance.ts`: validate/normalize the added optional fields.
- Modify `packages/plugin-space-contracts/src/index.ts`: schemas for persisted assignments, catalog queries, previews, and atomic edit commands.

### Host workflow

- Create `packages/plugin-dsh-annotation-host/src/tolerance-service.ts`: provider-backed query, preview, and apply orchestration.
- Modify `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`: atomic tolerance edits in the existing shared plan history.
- Modify `packages/plugin-dsh-annotation-host/src/service.ts`: direct remotes for catalog, preview, and edit.
- Modify `packages/plugin-dsh-annotation-host/src/typert.ts`: strict protocol descriptors.

### Canvas and client

- Modify `packages/drawing-viewer-react/src/surface/DrawingSurface.tsx` and `surface/layers.tsx`: optional annotation context-menu callback.
- Create `packages/plugin-dsh-annotation-client/src/tolerance-controller.ts`: remote state, dirty switching, and popup preferences.
- Create `packages/plugin-dsh-annotation-client/src/TolerancePopup.tsx`: non-modal draggable/resizable window and result inspector.
- Create `packages/plugin-dsh-annotation-client/src/ToleranceBandMatrix.tsx`: searchable/pannable/zoomable catalog grid.
- Modify `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx`: add `设置公差` without mixing closure choices across chains.
- Modify `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`: resolve selected dimensions, host popup, and render preview.
- Modify `packages/plugin-dsh-annotation-client/src/remote.ts` and `client.css`: remote descriptors and visual styling.

### DXF

- Modify `packages/drawing-core/src/io/dxf-profile.ts` and `io/dxf.ts`: emit native per-dimension tolerance overrides plus a stable text fallback for fit designations.

---

### Task 1: Standard Domain Types and Feature-of-Size Classification

**Files:**
- Create: `packages/engineering-annotation/src/tolerance/standard-types.ts`
- Create: `packages/engineering-annotation/src/tolerance/feature-of-size.ts`
- Test: `packages/engineering-annotation/src/tolerance/feature-of-size.test.ts`
- Modify: `packages/engineering-annotation/src/dimension/types.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `ToleranceStandardProvider`, `ToleranceBand`, `ResolvedStandardTolerance`, `ResolvedFit`, `FeatureOfSizeClass`, `classifyFeatureOfSize()`.
- Consumes: existing `DimensionIntent`, drawing target geometry types, and optional semantic facts from partitions.

- [ ] **Step 1: Write failing classification and type tests**

```ts
import { describe, expect, it } from 'vitest';
import { classifyFeatureOfSize } from './feature-of-size';

describe('feature-of-size classification', () => {
  it('classifies supported internal/external facts and rejects non-size dimensions', () => {
    expect(classifyFeatureOfSize({ dimensionKind: 'diameter', semanticRole: 'bore' }))
      .toEqual({ status: 'resolved', featureClass: 'internal' });
    expect(classifyFeatureOfSize({ dimensionKind: 'diameter', semanticRole: 'shaft' }))
      .toEqual({ status: 'resolved', featureClass: 'external' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear', opposedSurfaceRole: 'slot-width' }))
      .toEqual({ status: 'resolved', featureClass: 'internal' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear', opposedSurfaceRole: 'key-thickness' }))
      .toEqual({ status: 'resolved', featureClass: 'external' });
    expect(classifyFeatureOfSize({ dimensionKind: 'angular' }))
      .toEqual({ status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear' }))
      .toEqual({ status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' });
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `pnpm --filter @vectorai/engineering-annotation test -- feature-of-size.test.ts`

Expected: FAIL because `feature-of-size.ts` does not exist.

- [ ] **Step 3: Define the provider and assignment interfaces**

```ts
export type FeatureOfSizeClass = 'internal' | 'external';
export type ToleranceBandCategory = 'preferred' | 'common' | 'other';

export interface ToleranceStandardRef { id: string; edition: string }
export interface ToleranceBand {
  designation: string;
  featureClass: FeatureOfSizeClass;
  category: ToleranceBandCategory;
  available: boolean;
  unavailableCode?: 'TOLERANCE_SIZE_RANGE_UNSUPPORTED' | 'TOLERANCE_DESIGNATION_INVALID';
}
export interface ResolvedStandardTolerance {
  designation: string;
  featureClass: FeatureOfSizeClass;
  basicSize: number;
  unit: 'mm';
  upperDeviation: number;
  lowerDeviation: number;
  upperLimitSize: number;
  lowerLimitSize: number;
  standardRef: ToleranceStandardRef;
  ruleRef: { id: string; version: string; inputDigest: string };
}
export interface ResolvedFit {
  designation: string;
  basis: 'hole' | 'shaft';
  hole: ResolvedStandardTolerance;
  shaft: ResolvedStandardTolerance;
  fitType: 'clearance' | 'transition' | 'interference';
  minimumClearance: number;
  maximumClearance: number;
}
export interface ToleranceStandardProvider {
  readonly standardRef: ToleranceStandardRef;
  listBands(request: { basicSize: number; featureClass: FeatureOfSizeClass }): ToleranceBand[];
  resolveBand(request: { basicSize: number; featureClass: FeatureOfSizeClass; designation: string }): ResolvedStandardTolerance;
  resolveFit(request: { basicSize: number; basis: 'hole' | 'shaft'; designation: string }): ResolvedFit;
}
```

Extend `ToleranceSpec` with optional `featureClass`, `selection`, `standardRef`, `override`, and `fitGroupId`. Add `fitAssignments: FitAssignment[]` to `EngineeringAnnotationDraft` and `EngineeringAnnotationRevision`.

- [ ] **Step 4: Implement deterministic classification**

Implement `classifyFeatureOfSize(facts)` as a total switch: angular/radius/arc-length return unsupported; explicit bore/slot-width return internal; explicit shaft/key-thickness/part-thickness return external; supported kinds without semantic evidence return ambiguous. Do not guess from coordinate sign, filename, or golden geometry.

- [ ] **Step 5: Run domain typecheck and tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation check
pnpm --filter @vectorai/engineering-annotation test -- feature-of-size.test.ts
```

Expected: both PASS.

- [ ] **Step 6: Commit the domain boundary**

```bash
git add packages/engineering-annotation/src/tolerance/standard-types.ts \
  packages/engineering-annotation/src/tolerance/feature-of-size.ts \
  packages/engineering-annotation/src/tolerance/feature-of-size.test.ts \
  packages/engineering-annotation/src/dimension/types.ts \
  packages/engineering-annotation/src/index.ts
git commit -m "feat(annotation): define standard tolerance domain"
```

---

### Task 2: GB/T 1800.1/2-2020 Offline Provider

**Files:**
- Create: `packages/engineering-annotation/src/tolerance/gbt1800-2020-data.ts`
- Create: `packages/engineering-annotation/src/tolerance/gbt1800-provider.ts`
- Test: `packages/engineering-annotation/src/tolerance/gbt1800-provider.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Consumes: `ToleranceStandardProvider` from Task 1.
- Produces: `GBT_1800_2020_MANIFEST`, `createGbt1800Provider()`.

- [ ] **Step 1: Write exact-value and fit-classification tests**

```ts
describe('GB/T 1800.1/2-2020 provider', () => {
  const provider = createGbt1800Provider();

  it('resolves the 13 mm u6 reference value', () => {
    expect(provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'u6' }))
      .toMatchObject({ upperDeviation: 0.044, lowerDeviation: 0.033, upperLimitSize: 13.044, lowerLimitSize: 13.033 });
  });

  it('resolves H7/g6 and classifies the fit', () => {
    expect(provider.resolveFit({ basicSize: 13, basis: 'hole', designation: 'H7/g6' }))
      .toMatchObject({ fitType: 'clearance', minimumClearance: 0.006, maximumClearance: 0.035 });
  });

  it('uses the same table for opposed parallel surfaces', () => {
    expect(provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'h6' }))
      .toMatchObject({ upperDeviation: 0, lowerDeviation: -0.011 });
  });

  it('rejects out-of-range and wrong-case designations', () => {
    expect(() => provider.resolveBand({ basicSize: 501, featureClass: 'external', designation: 'h6' }))
      .toThrow('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'H7' }))
      .toThrow('TOLERANCE_DESIGNATION_INVALID');
  });
});
```

- [ ] **Step 2: Run the provider test and verify failure**

Run: `pnpm --filter @vectorai/engineering-annotation test -- gbt1800-provider.test.ts`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Add the normalized standard dataset**

Store the thirteen nominal intervals `(0,3]`, `(3,6]`, `(6,10]`, `(10,18]`, `(18,30]`, `(30,50]`, `(50,80]`, `(80,120]`, `(120,180]`, `(180,250]`, `(250,315]`, `(315,400]`, `(400,500]`. Each record contains integer micrometre deviations keyed by exact case-sensitive designation. Convert to millimetres only at the provider boundary.

```ts
export interface Gbt1800IntervalRecord {
  over: number;
  through: number;
  internal: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
  external: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
}

export const GBT_1800_2020_MANIFEST = {
  standardId: 'GB/T 1800', edition: '2020', minimumExclusive: 0, maximumInclusive: 500,
  datasetVersion: '1', sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
  checksum: canonicalRuleInputDigest({
    nominalValue: 500,
    unit: 'mm',
    inputs: { dataset: JSON.stringify(GBT_1800_2020_INTERVALS) },
  }),
} as const;
```

Populate every published designation used by the 0–500 mm selection chart. Keep preferred and common designation sets in separate exported constants so colors are metadata, not numeric policy. Add an integrity test that every interval is contiguous, each deviation pair is ordered, internal designations are uppercase, external designations are lowercase, and the manifest checksum matches the canonical serialized dataset.

Treat numeric table provenance as a release gate: transcribe/import values only
from an authorized GB/T 1800.2-2020 tabulation, record its edition and source-part
metadata in the manifest, and review the generated TypeScript diff. Do not fill
missing cells from the golden drawing, third-party calculators, or ISO 286 by
assumption because GB/T 1800.2-2020 is a modified adoption. If the authorized
tabulation is unavailable, the provider must return
`TOLERANCE_STANDARD_UNAVAILABLE` and the feature cannot be released as a
complete 0–500 mm provider.

- [ ] **Step 4: Implement lookup and fit arithmetic**

Resolve one interval, validate designation case, convert micrometres with `value / 1000`, and calculate limit sizes. For a fit calculate:

```ts
const minimumClearance = hole.lowerLimitSize - shaft.upperLimitSize;
const maximumClearance = hole.upperLimitSize - shaft.lowerLimitSize;
const fitType = minimumClearance >= 0 ? 'clearance'
  : maximumClearance <= 0 ? 'interference'
  : 'transition';
```

Generate `inputDigest` with the existing `canonicalRuleInputDigest()` using standard ID, edition, feature class, designation, and basic size.

Add interval-boundary tests at every `over`/`through` edge, plus at least one
clearance, transition, and interference fit. Create the provider twice and assert
identical catalog ordering, resolved values, standard identity, and digests. Add
a dependency/source test that the provider imports no network, DSH, model, or UI
module.

- [ ] **Step 5: Run exact, integrity, and package tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test -- gbt1800-provider.test.ts
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/engineering-annotation check
```

Expected: all PASS.

- [ ] **Step 6: Commit the provider**

```bash
git add packages/engineering-annotation/src/tolerance/gbt1800-2020-data.ts \
  packages/engineering-annotation/src/tolerance/gbt1800-provider.ts \
  packages/engineering-annotation/src/tolerance/gbt1800-provider.test.ts \
  packages/engineering-annotation/src/index.ts
git commit -m "feat(annotation): add GB T 1800 tolerance provider"
```

---

### Task 3: Persisted and Wire Contracts

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Test: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/drawing-core/src/document/types.ts`
- Modify: `packages/drawing-core/src/document/tolerance.ts`
- Test: `packages/drawing-core/src/document/tolerance.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `ToleranceCatalogRequest/Result`, `TolerancePreviewRequest/Result`, `ToleranceEditCommand`, and backward-compatible draft schemas.

- [ ] **Step 1: Write schema round-trip and compatibility tests**

```ts
it('round-trips a standard-backed tolerance and paired fit', () => {
  const parsed = engineeringAnnotationDraftSchema.parse({
    ...legacyDraft,
    tolerances: [{
      id: 'tol-1', dimensionIntentId: 'intent-1', mode: 'fit', source: 'manual',
      featureClass: 'external',
      selection: { designation: 'u6', source: 'manual', evidenceRefs: ['manual:tol-1'] },
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      inputs: {}, resolved: { upperDeviation: .044, lowerDeviation: .033, inputDigest: 'sha256:x', evaluatedAt: 1 },
      status: 'resolved', evidenceIds: ['manual:tol-1'], diagnostics: [],
    }],
    fitAssignments: [],
  });
  expect(parsed.tolerances[0]?.selection?.designation).toBe('u6');
});

it('defaults fitAssignments for existing persisted version-1 drafts', () => {
  expect(engineeringAnnotationDraftSchema.parse(legacyDraft).fitAssignments).toEqual([]);
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test -- index.test.ts
pnpm --filter @vectorai/drawing-core test -- tolerance.test.ts
```

Expected: FAIL on unknown fields/missing defaults.

- [ ] **Step 3: Extend portable tolerance projection**

Add optional fields without invalidating existing drawings:

```ts
interface ToleranceProjection {
  // existing fields remain
  featureClass?: 'internal' | 'external';
  standardRef?: { id: string; edition: string };
  displayPreference?: 'deviations' | 'designation' | 'both';
}
```

Validation requires non-empty standard ID/edition and forbids `featureClass` on angular units. Normalization clones the added nested object.

- [ ] **Step 4: Add strict request/result/edit schemas**

Define discriminated preview requests for `single` and `fit`, and edit commands:

```ts
export const toleranceEditCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('standard.single.apply'), expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema, featureClass: z.enum(['internal', 'external']), designation: z.string().min(2).max(8),
    selectionSource: z.enum(['rule', 'ai-recommended', 'manual']),
    displayPreference: z.enum(['deviations', 'designation', 'both']), evidenceRefs: z.array(idSchema) }).strict(),
  z.object({ type: z.literal('standard.fit.apply'), expectedDrawingRef: drawingRefSchema,
    holeDimensionIntentId: idSchema, shaftDimensionIntentId: idSchema, basis: z.enum(['hole', 'shaft']),
    designation: z.string().min(5).max(17), selectionSource: z.enum(['rule', 'ai-recommended', 'manual']),
    displayPreference: z.enum(['deviations', 'designation', 'both']), evidenceRefs: z.array(idSchema) }).strict(),
  z.object({ type: z.literal('standard.override.set'), expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema, upperDeviation: z.number().finite(), lowerDeviation: z.number().finite() }).strict(),
  z.object({ type: z.literal('standard.override.clear'), expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema }).strict(),
  z.object({ type: z.literal('manual.apply'), expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema, mode: z.enum(['unilateral', 'bilateral']),
    upperDeviation: z.number().finite().optional(), lowerDeviation: z.number().finite().optional(),
    displayPreference: z.enum(['deviations', 'designation', 'both']).default('deviations'),
    evidenceRefs: z.array(idSchema) }).strict(),
]);
```

Refine `manual.apply` so bilateral requires both deviations and unilateral
requires at least one. This command supports only dimension kinds already
accepted by the existing manual tolerance model; it does not make angular,
radius, or surface-texture annotations eligible for a standard tolerance band.

Add `.default([])` for `fitAssignments` so current version-1 envelopes remain readable.

- [ ] **Step 5: Run contract tests and typechecks**

Run:

```bash
pnpm --filter @vectorai/drawing-core test -- tolerance.test.ts
pnpm --filter @vectorai/plugin-space-contracts test -- index.test.ts
pnpm --filter @vectorai/drawing-core check
pnpm --filter @vectorai/plugin-space-contracts check
```

Expected: all PASS.

- [ ] **Step 6: Commit contracts**

```bash
git add packages/drawing-core/src/document/types.ts \
  packages/drawing-core/src/document/tolerance.ts \
  packages/drawing-core/src/document/tolerance.test.ts \
  packages/plugin-space-contracts/src/index.ts \
  packages/plugin-space-contracts/src/index.test.ts
git commit -m "feat(contracts): add standard tolerance selection protocol"
```

---

### Task 4: Immutable Tolerance Edits and Portable Projection

**Files:**
- Create: `packages/engineering-annotation/src/tolerance/edit.ts`
- Test: `packages/engineering-annotation/src/tolerance/edit.test.ts`
- Modify: `packages/engineering-annotation/src/dimension/project.ts`
- Test: `packages/engineering-annotation/src/dimension/project.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Consumes: resolved provider results and Task 3 persisted fields.
- Produces: `applySingleTolerance()`, `applyFitTolerance()`, `applyManualTolerance()`, `setToleranceOverride()`, `clearToleranceOverride()`, effective portable projections.

- [ ] **Step 1: Write preservation, pair, and override tests**

```ts
it('applies one tolerance without changing unrelated annotation families', () => {
  const before = sharedDraft();
  const after = applySingleTolerance(before, resolvedU6, {
    dimensionIntentId: 'intent-shaft', selectionSource: 'manual',
    displayPreference: 'both', evidenceRefs: ['manual:u6'],
  });
  expect(after.tolerances).toHaveLength(before.tolerances.length + 1);
  expect(after.datums).toEqual(before.datums);
  expect(after.geometricTolerances).toEqual(before.geometricTolerances);
  expect(after.chains).toEqual(before.chains);
});

it('applies and replaces one fit atomically', () => {
  const after = applyFitTolerance(sharedDraft(), resolvedH7g6, {
    fitGroupId: 'fit-1', holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft',
    selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit-1'],
  });
  expect(after.fitAssignments).toEqual([expect.objectContaining({ fitGroupId: 'fit-1', designation: 'H7/g6' })]);
  expect(after.tolerances.filter(({ fitGroupId }) => fitGroupId === 'fit-1')).toHaveLength(2);
});

it('keeps calculated values when an override is set and restores them when cleared', () => {
  const overridden = setToleranceOverride(draftWithU6(), 'intent-shaft', { upperDeviation: .05, lowerDeviation: .04 });
  expect(overridden.tolerances[0]?.resolved?.upperDeviation).toBe(.044);
  expect(clearToleranceOverride(overridden, 'intent-shaft').tolerances[0]?.override).toBeUndefined();
});
```

- [ ] **Step 2: Run the tests and verify missing edit functions**

Run: `pnpm --filter @vectorai/engineering-annotation test -- tolerance/edit.test.ts dimension/project.test.ts`

Expected: FAIL because the edit functions and extended projection are absent.

- [ ] **Step 3: Implement immutable edits**

Each function clones only changed arrays and records. Validate referenced intents, feature class, designation, finite/ordered deviations, and exact equal basic sizes for a fit. Replacing a tolerance for one intent must remove only the previous record with that `dimensionIntentId`; replacing a fit removes only records sharing that `fitGroupId`.

`applyManualTolerance()` creates or replaces only the target intent's manual
`ToleranceSpec`, validates unilateral/bilateral deviation completeness with the
existing evaluator rules, carries explicit manual evidence, and never creates a
standard reference or fit assignment.

An unapplied AI recommendation remains `source: 'ai-candidate'` with no resolved
numeric result. Applying that recommendation creates a deterministic
`source: 'standard'` spec whose `selection.source` is `ai-recommended`; the
provider result, rule reference, and digest are mandatory. This preserves the
recommendation trail without granting AI numeric authority.

- [ ] **Step 4: Project effective values**

In `projectTolerance()`, use `spec.override ?? spec.resolved` for upper/lower deviations, retain `selection.designation`, and include `standardRef`, `featureClass`, and `displayPreference`. A fit member projects its own numeric deviations plus the pair designation; unrelated projections remain untouched.

- [ ] **Step 5: Run domain tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test -- tolerance/edit.test.ts dimension/project.test.ts
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/engineering-annotation check
```

Expected: all PASS.

- [ ] **Step 6: Commit edit semantics**

```bash
git add packages/engineering-annotation/src/tolerance/edit.ts \
  packages/engineering-annotation/src/tolerance/edit.test.ts \
  packages/engineering-annotation/src/dimension/project.ts \
  packages/engineering-annotation/src/dimension/project.test.ts \
  packages/engineering-annotation/src/index.ts
git commit -m "feat(annotation): apply standard tolerances atomically"
```

---

### Task 5: Host Catalog, Preview, Apply, and History

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/tolerance-service.ts`
- Test: `packages/plugin-dsh-annotation-host/src/tolerance-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`
- Test: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.ts`
- Test: `packages/plugin-dsh-annotation-host/src/typert.test.ts`

**Interfaces:**
- Consumes: `createGbt1800Provider()`, Task 3 wire contracts, Task 4 edit functions.
- Produces remotes: `queryToleranceCatalog`, `previewTolerance`, `editTolerance`.

- [ ] **Step 1: Write Host service tests**

```ts
it('previews without mutating the plan and applies through shared undo history', () => {
  const before = plans.get('session');
  const preview = service.preview('session', {
    type: 'single', expectedDrawingRef: ref, dimensionIntentId: 'intent-shaft',
    featureClass: 'external', designation: 'u6',
  });
  expect(preview).toMatchObject({ status: 'resolved', result: { upperDeviation: .044, lowerDeviation: .033 } });
  expect(plans.get('session')).toEqual(before);

  service.edit('session', {
    type: 'standard.single.apply', expectedDrawingRef: ref, dimensionIntentId: 'intent-shaft',
    featureClass: 'external', designation: 'u6', selectionSource: 'manual',
    displayPreference: 'both', evidenceRefs: ['manual:u6'],
  });
  expect(plans.undo('session', ref)).toEqual(expect.objectContaining({ draft: before.draft }));
});
```

Add tests for out-of-range errors, stale drawing refs, unequal fit sizes, pair undo/redo, and preservation of datum/GD&T/opening-angle/diameter records.

Add recommendation tests proving that a validated designation without sufficient
evidence leaves the target `待选择`, that an AI candidate contains no confirmed
numeric fields, and that provider resolution happens again during Apply. Add a
persist/reload test proving a confirmed assignment retains its recorded provider
edition and values across session restart.

Add a recalculation test that changes one intent nominal value from 13 mm to 19
mm while preserving `u6`, then asserts new deviations and a new input digest. Add
a paired-fit test in which one member changes nominal size and the pair becomes
`stale` with `FIT_PAIR_BASIC_SIZE_MISMATCH` instead of retaining old values.

- [ ] **Step 2: Run focused Host tests and verify failure**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-host test -- tolerance-service.test.ts dimension-plan-store.test.ts`

Expected: FAIL because the service/remotes are missing.

- [ ] **Step 3: Implement provider-backed service methods**

`queryToleranceCatalog` validates the active drawing/intent and returns table entries plus the current selection and optional recommendation. `previewTolerance` resolves standard values but never calls `setDraft`. `editTolerance` resolves again, verifies the same input digest, then delegates one immutable edit to `DimensionPlanStore`.

- [ ] **Step 4: Add atomic store edit**

Add `editTolerance(sessionId, command, resolved)` to `DimensionPlanStore`. It creates an editable draft from a confirmed revision when necessary, applies the single/pair/override command, validates via `engineeringAnnotationDraftSchema`, and calls `#push` exactly once so pair edits are one undo entry.

Inject a deterministic `reconcileTolerances(draft)` port into
`DimensionPlanStore`. `setDraft` calls it before schema validation: standard-backed
single assignments whose nominal value changed are re-resolved with the preserved
designation; invalid ranges become `stale`; fit assignments are re-resolved only
when both member sizes remain equal and otherwise receive the stable mismatch
diagnostic. Manual overrides remain attached and are flagged for review rather
than overwritten.

Reconciliation is triggered by a changed nominal input, not merely by registering
a newer provider edition. A loaded confirmed assignment keeps its recorded
edition and resolved values until the underlying dimension changes or the user
explicitly reapplies a selection.

- [ ] **Step 5: Register strict remotes**

Add `@Remote` methods in `service.ts`, matching direct descriptors in `typert.ts`. Preview/query results use their own strict result schemas; edit returns `DimensionPlanSessionSnapshot`.

- [ ] **Step 6: Run Host tests and dependency checks**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test -- tolerance-service.test.ts dimension-plan-store.test.ts typert.test.ts dependency-boundary.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-host check
```

Expected: all PASS and no Host import from client/UI packages.

- [ ] **Step 7: Commit Host workflow**

```bash
git add packages/plugin-dsh-annotation-host/src/tolerance-service.ts \
  packages/plugin-dsh-annotation-host/src/tolerance-service.test.ts \
  packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts \
  packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts \
  packages/plugin-dsh-annotation-host/src/service.ts \
  packages/plugin-dsh-annotation-host/src/typert.ts \
  packages/plugin-dsh-annotation-host/src/typert.test.ts
git commit -m "feat(dsh): expose tolerance catalog and edits"
```

---

### Task 6: DrawingSurface Context-Menu Extension

**Files:**
- Modify: `packages/drawing-viewer-react/src/surface/DrawingSurface.tsx`
- Modify: `packages/drawing-viewer-react/src/surface/layers.tsx`
- Test: `packages/drawing-viewer-react/src/surface/DrawingSurface.test.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/EntityRenderer.tsx`

**Interfaces:**
- Produces: optional `onNodeContextMenu(nodeId, event)` on controlled `DrawingSurface`.
- Consumes: existing annotation/geometry entity rendering and selection callbacks.

- [ ] **Step 1: Write context-menu propagation/isolation tests**

```tsx
it('reports the exact annotation and does not start canvas panning', () => {
  const onNodeContextMenu = vi.fn();
  const onViewportChange = vi.fn();
  const root = renderSurface({ onNodeContextMenu, onViewportChange });
  root.root.findByProps({ 'data-entity-id': 'annotation-dimension-1' }).props.onContextMenu({
    preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 320, clientY: 180,
  });
  expect(onNodeContextMenu).toHaveBeenCalledWith('annotation-dimension-1', expect.objectContaining({ clientX: 320, clientY: 180 }));
  expect(onViewportChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the surface test and verify failure**

Run: `pnpm --filter @vectorai/drawing-viewer-react test -- DrawingSurface.test.tsx`

Expected: FAIL because the prop is not defined.

- [ ] **Step 3: Add the optional callback without changing default behavior**

Pass `onContextMenu` through `AnnotationLayer` and `GeometryLayer` to `EntityRenderer`. The handler calls `preventDefault()` and `stopPropagation()` before invoking the optional callback. When the callback is absent, preserve the browser/context behavior already used by consumers.

- [ ] **Step 4: Run viewer tests and interaction regression tests**

Run:

```bash
pnpm --filter @vectorai/drawing-viewer-react test -- DrawingSurface.test.tsx Canvas.interaction.test.tsx
pnpm --filter @vectorai/drawing-viewer-react check
```

Expected: all PASS; blank-canvas click still clears selection and double-click does not refit.

- [ ] **Step 5: Commit the generic surface extension**

```bash
git add packages/drawing-viewer-react/src/surface/DrawingSurface.tsx \
  packages/drawing-viewer-react/src/surface/layers.tsx \
  packages/drawing-viewer-react/src/surface/DrawingSurface.test.tsx \
  packages/drawing-viewer-react/src/canvas/EntityRenderer.tsx
git commit -m "feat(viewer): expose node context menus"
```

---

### Task 7: Client Controller and Popup Window

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/tolerance-controller.ts`
- Test: `packages/plugin-dsh-annotation-client/src/tolerance-controller.test.ts`
- Create: `packages/plugin-dsh-annotation-client/src/ToleranceBandMatrix.tsx`
- Test: `packages/plugin-dsh-annotation-client/src/ToleranceBandMatrix.test.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/TolerancePopup.tsx`
- Test: `packages/plugin-dsh-annotation-client/src/TolerancePopup.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes remotes from Task 5.
- Produces `createToleranceController()`, `TolerancePopup`, and a transient `TolerancePreview` for canvas display.

- [ ] **Step 1: Write controller state tests**

```ts
it('keeps one popup instance and requires a dirty-switch decision', async () => {
  const controller = createToleranceController({ remote, sessionId: 's', storage });
  await controller.actions.open({ dimensionIntentId: 'intent-1', anchor: { x: 300, y: 180 } });
  await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
  controller.actions.requestTarget({ dimensionIntentId: 'intent-2', anchor: { x: 410, y: 210 } });
  expect(controller.state.getSnapshot()).toMatchObject({ dirty: true, pendingTarget: { dimensionIntentId: 'intent-2' } });
  await controller.actions.applyAndSwitch();
  expect(controller.state.getSnapshot()).toMatchObject({ target: { dimensionIntentId: 'intent-2' }, dirty: false });
});
```

Add tests for discard-and-switch, clean close, dirty close, fit second-target selection, stored bounds clamping, and remote error retention.

- [ ] **Step 2: Run controller tests and verify failure**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- tolerance-controller.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement controller and remote descriptors**

Follow the existing observable controller pattern. Keep popup geometry, active tab, table zoom, current target, pending target, preview, dirty state, and errors client-side. Persist only `{x,y,width,height,tab,zoom,standardEdition}` in session storage; never persist preview values there.

- [ ] **Step 4: Write popup/matrix component tests**

```tsx
it('previews on click, applies with Command+Enter, and isolates wheel events', () => {
  const onPreview = vi.fn();
  const onApply = vi.fn();
  const tree = renderPopup({ bands: fixtureBands, onPreview, onApply });
  tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick();
  expect(onPreview).toHaveBeenCalledWith('u6');
  tree.root.findByProps({ 'data-tolerance-popup': true }).props.onKeyDown({ key: 'Enter', metaKey: true, preventDefault: vi.fn() });
  expect(onApply).toHaveBeenCalled();
});
```

Test preferred/common/unavailable styling, hover-inspector-only behavior, direct search, result values, internal/external tabs, fit status, keyboard-arrow navigation, Enter preview, Command+Enter and Control+Enter apply, drag-from-title-only, resize clamps, outside-click persistence, and explicit dirty close actions.

Test both entry behaviors from the approved design: right-click `设置公差` and
double-clicking an existing tolerance designation open the same controller and
retain exactly one popup instance. Test that the initial anchor is shifted just
far enough to avoid the selected annotation, while a user-dragged position is
never recomputed after canvas pan or zoom.

Also test the `仅偏差` / `仅代号` / `代号与偏差` display selector, direct manual
upper/lower override fields, `恢复标准值`, and `恢复自动推荐`. Overrides preview
through the Host result and never mutate the provider's calculated values.

For unsupported or ambiguous targets, test that the popup shows the stable
classification diagnostic and exposes the existing manual upper/lower-deviation
editor only when that annotation kind accepts a manual tolerance. If it does not,
disable Apply and perform no Host edit.

For an ambiguous but otherwise supported linear feature of size, show an explicit
`孔/内部尺寸` versus `轴/外部尺寸` choice before loading a standard catalog. The
choice is part of the preview/apply command and is never inferred from screen
position or designation letter case.

- [ ] **Step 5: Implement the window and matrix**

Render the popup as an absolutely positioned HTML sibling above `DrawingSurface`. Title-bar pointer capture updates screen coordinates. Edge handles update size. Root handlers stop pointer, mouse, context-menu, and wheel propagation. The matrix renders provider-returned categories and uses local view filtering only; it never computes deviations.

The result inspector owns display preference and override inputs. `恢复标准值`
clears only `override`; `恢复自动推荐` requests the validated recommendation and
restores its designation before creating a new preview.

- [ ] **Step 6: Run client component tests**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- tolerance-controller.test.ts ToleranceBandMatrix.test.tsx TolerancePopup.test.tsx remote.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

Expected: all PASS.

- [ ] **Step 7: Commit the popup subsystem**

```bash
git add packages/plugin-dsh-annotation-client/src/tolerance-controller.ts \
  packages/plugin-dsh-annotation-client/src/tolerance-controller.test.ts \
  packages/plugin-dsh-annotation-client/src/ToleranceBandMatrix.tsx \
  packages/plugin-dsh-annotation-client/src/ToleranceBandMatrix.test.tsx \
  packages/plugin-dsh-annotation-client/src/TolerancePopup.tsx \
  packages/plugin-dsh-annotation-client/src/TolerancePopup.test.tsx \
  packages/plugin-dsh-annotation-client/src/remote.ts \
  packages/plugin-dsh-annotation-client/src/client.css
git commit -m "feat(annotation-ui): add tolerance selection popup"
```

---

### Task 8: Workspace and Dimension-Chain Integration

**Files:**
- Modify: `packages/engineering-annotation/src/dimension-inference/project.ts`
- Test: `packages/engineering-annotation/src/dimension-inference/project.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx`
- Test: `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Test: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/index.ts`

**Interfaces:**
- Consumes: Task 6 context events and Task 7 controller/popup.
- Produces: right-click `设置公差` for projected annotations and each exact dimension-chain candidate.

- [ ] **Step 1: Export the stable candidate-to-intent mapping and test it**

Rename private `intentId(candidateId)` to exported `axialDimensionIntentId(candidateId)` and use it throughout projection. Test `axialDimensionIntentId('candidate:3') === 'dimension-intent:candidate:3'` so the UI and Host address the same intent without duplicating string policy.

- [ ] **Step 2: Write context-menu scope tests**

```tsx
it('offers tolerance for the exact chain candidate without adding another chain closure option', () => {
  const onSetTolerance = vi.fn();
  const tree = renderOverlay({ scheme: sharedCandidateScheme(), onSetTolerance });
  tree.root.findByProps({ 'data-dimension-candidate-id': 'candidate-3' }).props.onContextMenu(contextEvent);
  const menu = tree.root.findByProps({ 'data-dimension-context-menu': 'candidate-3' });
  expect(menu.findAllByProps({ 'data-action': 'set-tolerance' })).toHaveLength(1);
  expect(menu.findAllByProps({ 'data-closure-chain-id': 'chain-1' })).toHaveLength(0);
});
```

Retain existing closure tests to guarantee options remain scoped to the candidate's real chain memberships.

- [ ] **Step 3: Integrate annotation and dimension-chain entry points**

For a projected `DimensionAnnotation`, resolve `engineeringIntentId` from the clicked annotation ID and open a small HTML context menu at client coordinates. For a chain overlay candidate, call `axialDimensionIntentId(candidateId)` and add `设置公差` to the existing SVG menu. Double-clicking an existing projected tolerance designation opens the same controller directly. Unsupported standard-table targets still open from an existing tolerance so the popup can explain the reason and, where supported, expose manual upper/lower editing.

- [ ] **Step 4: Integrate popup and preview into the workspace**

Create one tolerance controller per session. Render `TolerancePopup` above the canvas. Preview overlays use a cloned dimension annotation with the returned `ToleranceProjection`; they do not alter `runtime.snapshot`, viewport, selected IDs, or the shared dimension plan until Apply succeeds. When Apply succeeds, refresh dimension/GD&T controllers through `runSharedAnnotationHistory` semantics.

In a fit tab, the first target remains highlighted while the workspace enters
`选择配合对象`. The next supported dimension becomes the second target; blank
canvas clicks cancel only this selection state. Incompatible or unequal-size
targets stay selected long enough to show the Host diagnostic and do not create a
preview.

- [ ] **Step 5: Add the left activity-bar reopen command**

Add a `公差与配合` activity item only when a supported dimension is selected or the popup has a remembered target. It reopens the same controller instance and does not create a side panel.

- [ ] **Step 6: Run integration tests**

Run:

```bash
pnpm --filter @vectorai/engineering-annotation test -- dimension-inference/project.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- DimensionChainOverlay.test.tsx AnnotationWorkspace.test.tsx client.test.tsx
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

Expected: all PASS, and viewport assertions remain byte-for-byte unchanged across popup open/preview/apply.

- [ ] **Step 7: Commit canvas integration**

```bash
git add packages/engineering-annotation/src/dimension-inference/project.ts \
  packages/engineering-annotation/src/dimension-inference/project.test.ts \
  packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx \
  packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.test.tsx \
  packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx \
  packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx \
  packages/plugin-dsh-annotation-client/src/index.ts
git commit -m "feat(annotation-ui): connect tolerance popup to drawing dimensions"
```

---

### Task 9: Native DXF Tolerance Semantics and End-to-End Verification

**Files:**
- Modify: `packages/drawing-core/src/io/dxf-profile.ts`
- Modify: `packages/drawing-core/src/io/dxf.ts`
- Test: `packages/drawing-core/src/io/dxf.test.ts`
- Test: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts`
- Test: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: confirmed portable `ToleranceProjection` from Task 4.
- Produces: native DXF tolerance overrides and stable fallback display for code-based fits.

- [ ] **Step 1: Write DXF semantic tests**

```ts
it('exports sign-spanning deviations as native dimension-style overrides', () => {
  const dxf = exportDrawing(drawingWithTolerance({
    mode: 'bilateral', upperDeviation: .02, lowerDeviation: -.01,
    unit: 'mm', status: 'confirmed', source: 'standard', evidenceRefs: ['standard:test'],
  }), { profile: GB_CAD_PROFILE });
  expect(dxf).toContain('1000\nDSTYLE');
  expect(dxf).toMatch(/1070\n71\n1070\n1/);   // DIMTOL enabled
  expect(dxf).toMatch(/1070\n47\n1040\n0\.02/); // DIMTP
  expect(dxf).toMatch(/1070\n48\n1040\n0\.01/); // DIMTM stores the non-negative magnitude
});

it('preserves same-sign u6 deviations with an exact text fallback and semantic xdata', () => {
  const dxf = exportDrawing(drawingWithTolerance({
    mode: 'fit', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
    unit: 'mm', status: 'confirmed', source: 'standard',
    standardRef: { id: 'GB/T 1800', edition: '2020' }, evidenceRefs: ['standard:u6'],
  }), { profile: GB_CAD_PROFILE });
  expect(dxf).toContain('\\S+0.044^+0.033;');
  expect(dxf).toContain('1001\nVECTORAI');
  expect(dxf).toContain('"designation":"u6"');
});
```

Add round-trip assertions for H7/g6 member deviations, manual overrides, designation-only display, and legacy tolerance data.

- [ ] **Step 2: Run DXF tests and verify missing native override failure**

Run: `pnpm --filter @vectorai/drawing-core test -- dxf.test.ts`

Expected: FAIL because current export writes presentation text without per-entity `DSTYLE` tolerance overrides.

- [ ] **Step 3: Implement exact native/fallback tolerance export**

Register `ACAD` and `VECTORAI` in the DXF APPID table. Follow Autodesk's
per-entity override sequence exactly: `1001 ACAD`, `1000 DSTYLE`, `1002 {`, then
dimvar-code/value pairs, followed by `1002 }`.

Use native DIMTOL only when `upperDeviation >= 0` and `lowerDeviation <= 0`:

- DIMTOL code 71 is integer 1;
- DIMTP code 47 is real `upperDeviation`;
- DIMTM code 48 is real `Math.abs(lowerDeviation)` because Autodesk requires both
  DIMTP and DIMTM to be non-negative;
- DIMTDEC code 272 is the profile tolerance decimal count.

When both deviations are positive (for example `u6`) or both are negative (for
example `g6`), native DIMTOL cannot preserve both signs. In that case do not emit
a misleading DIMTOL override. Emit the exact stacked MText override with explicit
signs and attach a `VECTORAI` XDATA payload containing designation, deviations,
feature class, and standard reference. Keep that payload below the 255-byte DXF
1000-string limit. Fit designation text remains in the visible override in both
paths.

Use the official Autodesk sequence and dimvar ranges documented at
`https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-6A4C31C0-4988-499C-B5A4-15582E433B0F.htm`
and
`https://help.autodesk.com/cloudhelp/2018/ENU/OARXMAC-RefGuide/files/OREFMAC-Dimension_Style_Overrides.html`.

- [ ] **Step 4: Verify complete workflow preservation**

Add one Host integration case that starts with a draft containing dimensions, chains, datums, GD&T, diameter, and opening-angle annotations; apply `u6`; export DXF; undo; redo; then assert only the target tolerance changes at each stage. Add one client case showing the popup preview before Apply and no popup-driven viewport change.

- [ ] **Step 5: Update architecture documentation**

Add the standard provider and popup flow to `docs/tech-architecture.md`, including the rule that numeric standard results are local/deterministic and that the first layer stores confirmed portable projection only.

- [ ] **Step 6: Run package and workspace verification**

Run:

```bash
pnpm --filter @vectorai/drawing-core test
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-client test
pnpm --filter @vectorai/drawing-viewer-react test
pnpm --filter @vectorai/drawing-core check
pnpm --filter @vectorai/engineering-annotation check
pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-annotation-host check
pnpm --filter @vectorai/plugin-dsh-annotation-client check
pnpm --filter @vectorai/drawing-viewer-react check
pnpm test
```

Expected: all commands PASS.

- [ ] **Step 7: Run golden-coupling guard searches**

Run:

```bash
rg -n "57f79b850e95e852e6ea4277|样本图001|初始图|gb-shaft-functional-baseline" \
  packages/engineering-annotation/src packages/plugin-dsh-annotation-host/src \
  packages/plugin-dsh-annotation-client/src packages/drawing-core/src
```

Expected: no production-source matches. Test fixture descriptions may refer to generic transformed/non-golden cases but cannot be imported by production modules.

- [ ] **Step 8: Commit final integration**

```bash
git add packages/drawing-core/src/io/dxf-profile.ts \
  packages/drawing-core/src/io/dxf.ts \
  packages/drawing-core/src/io/dxf.test.ts \
  packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts \
  packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx \
  docs/tech-architecture.md
git commit -m "feat(annotation): complete tolerance selection workflow"
```
