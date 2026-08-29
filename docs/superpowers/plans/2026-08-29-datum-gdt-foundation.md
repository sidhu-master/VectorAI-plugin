# Datum and Geometric Tolerance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned datum and GD&T semantics, persistence, grounded AI recommendations, editable preview UI, and golden-oracle safeguards without implementing production tolerance formulas.

**Architecture:** `@vectorai/engineering-annotation` owns GD&T meaning and validation; `@vectorai/plugin-space-contracts` serializes it; the annotation host owns recommendation grounding and revision persistence; the annotation client owns overlays and editing. Calculated and user-overridden values remain separate, and the golden drawing is used only by tests.

**Tech Stack:** TypeScript 5.8, Zod 4 contracts, Vitest 3, React 18, DSH Typert remote protocol, VectorAI drawing surface APIs.

**Spec:** `docs/superpowers/specs/2026-08-29-datum-gdt-foundation-design.md`

## Global Constraints

- AI may recommend controlled geometry IDs, datum geometry IDs, datum roles, and geometric characteristic types; AI may not produce coordinates or tolerance values.
- Recalculation updates `computed` only and never overwrites `override`.
- The effective value is `override?.value ?? computed.value`.
- Missing production calculation rules produce `pending-calculation`; they never fall back to an AI value.
- Existing version-1 annotation-plan files must load with `geometricTolerances: []`.
- Production code must not branch on golden fixture identity, file name, hash, coordinates, or expected values.
- The foundation golden test validates supplied semantics and supplied results; it does not claim automatic tolerance inference.
- Existing uncommitted diameter and viewer changes in the worktree are user-owned and must not be discarded or folded into unrelated commits.

---

## File Map

### Domain package

- Create `packages/engineering-annotation/src/gdt/types.ts`: GD&T semantic contracts and calculation-provider interfaces.
- Create `packages/engineering-annotation/src/gdt/value.ts`: effective-value and restore semantics.
- Create `packages/engineering-annotation/src/gdt/validate.ts`: datum/GD&T validation and confirmation diagnostics.
- Create `packages/engineering-annotation/src/gdt/edit.ts`: immutable edit command application.
- Create `packages/engineering-annotation/src/gdt/source-guard.test.ts`: runtime-source fixture-coupling guard.
- Modify `packages/engineering-annotation/src/dimension/types.ts`: add `geometricTolerances` to drafts and revisions.
- Modify `packages/engineering-annotation/src/dimension/validate.ts`: aggregate GD&T diagnostics.
- Modify `packages/engineering-annotation/src/index.ts`: export the GD&T module.

### Shared contracts

- Modify `packages/plugin-space-contracts/src/index.ts`: Zod schemas for GD&T records and edit commands; default empty collection for old files.
- Modify `packages/plugin-space-contracts/src/index.test.ts`: contract round-trip and migration coverage.

### Host

- Create `packages/plugin-dsh-annotation-host/src/gdt-grounding.ts`: validate geometry IDs and derive local anchors.
- Create `packages/plugin-dsh-annotation-host/src/gdt-service.ts`: start/update GD&T candidates through the existing dimension-plan store.
- Create `packages/plugin-dsh-annotation-host/src/gdt-service.test.ts`: grounding, pending calculation, and stale behavior.
- Modify `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`: persist/edit/confirm GD&T collections.
- Modify `packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`: round-trip, override, undo, and confirmation tests.
- Modify `packages/plugin-dsh-annotation-host/src/service.ts`: expose GD&T host methods.
- Modify `packages/plugin-dsh-annotation-host/src/tools.ts`: add the recommendation tool.
- Modify `packages/plugin-dsh-annotation-host/src/typert.ts`: expose remote GD&T edit operations.
- Modify `packages/plugin-dsh-annotation-host/src/index.ts`: export GD&T services and tool.

### Client

- Create `packages/plugin-dsh-annotation-client/src/gdt-controller.ts`: queued remote edits and preview state.
- Create `packages/plugin-dsh-annotation-client/src/GdtOverlay.tsx`: datum markers and feature-control frames.
- Create `packages/plugin-dsh-annotation-client/src/GdtInspector.tsx`: semantic editor and effective-value controls.
- Create `packages/plugin-dsh-annotation-client/src/GdtOverlay.test.tsx`: overlay and interaction coverage.
- Modify `packages/plugin-dsh-annotation-client/src/drawing-layers.ts`: datum and GD&T layers.
- Modify `packages/plugin-dsh-annotation-client/src/client.tsx`: controller/layer registration.
- Modify `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`: overlay, inspector, and toolbar integration.
- Modify `packages/plugin-dsh-annotation-client/src/client.css`: screen-stable CAD-style presentation.

### Acceptance

- Create `packages/engineering-annotation/src/gdt/golden.integration.test.ts`: semantic comparison against supplied golden expectations.
- Create `packages/engineering-annotation/src/gdt/metamorphic.test.ts`: translation, mirror, scale, and entity-order invariance.
- Create `scripts/e2e-datum-gdt-foundation.ts`: contract-to-host acceptance path with a deterministic test provider.
- Modify `package.json`: add `e2e:datum-gdt-foundation`.

---

### Task 1: GD&T Domain Types and Effective Value

**Files:**
- Create: `packages/engineering-annotation/src/gdt/types.ts`
- Create: `packages/engineering-annotation/src/gdt/value.ts`
- Create: `packages/engineering-annotation/src/gdt/value.test.ts`
- Modify: `packages/engineering-annotation/src/dimension/types.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Produces: `GeometricToleranceIntent`, `GeometricCharacteristic`, `DatumReference`, domain-only `GeometricToleranceEdit`, `GeometricToleranceRuleProvider`, `effectiveGeometricToleranceValue(intent)`, `clearGeometricToleranceOverride(intent)`.
- Consumes: existing `DrawingRef`, `DimensionTarget`, `EngineeringDatum`, and `EngineeringDiagnostic` types.

- [ ] **Step 1: Write the failing effective-value tests**

```ts
import { describe, expect, it } from 'vitest';
import { clearGeometricToleranceOverride, effectiveGeometricToleranceValue } from './value';
import type { GeometricToleranceIntent } from './types';

const intent = (changes: Partial<GeometricToleranceIntent> = {}): GeometricToleranceIntent => ({
  id: 'gdt:1', drawingRef: { drawingId: 'drawing:1', revision: 1 },
  characteristic: 'perpendicularity', controlledTargets: [],
  toleranceZone: { shape: 'linear' }, datumReferenceFrame: [],
  computed: { status: 'resolved', value: 0.02, unit: 'mm', diagnostics: [] },
  source: 'geometry', status: 'resolved', evidenceIds: [], ...changes,
});

describe('geometric tolerance effective value', () => {
  it('prefers the user override without mutating the computed result', () => {
    const value = intent({ override: { value: 0.01 } });
    expect(effectiveGeometricToleranceValue(value)).toBe(0.01);
    expect(value.computed.value).toBe(0.02);
  });

  it('restores the computed value when the override is cleared', () => {
    expect(effectiveGeometricToleranceValue(clearGeometricToleranceOverride(
      intent({ override: { value: 0.01 } }),
    ))).toBe(0.02);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `pnpm vitest run packages/engineering-annotation/src/gdt/value.test.ts`

Expected: FAIL because `./value` and `./types` do not exist.

- [ ] **Step 3: Add the semantic types and value functions**

Define the exact unions from the design spec and add:

```ts
export function effectiveGeometricToleranceValue(intent: GeometricToleranceIntent): number | undefined {
  return intent.override?.value ?? intent.computed.value;
}

export function clearGeometricToleranceOverride(intent: GeometricToleranceIntent): GeometricToleranceIntent {
  const { override: _removed, ...rest } = intent;
  return structuredClone(rest) as GeometricToleranceIntent;
}
```

Add `geometricTolerances: GeometricToleranceIntent[]` to `EngineeringAnnotationDraft`; the revision type inherits it. Export all `gdt/` public interfaces from `src/index.ts`.

- [ ] **Step 4: Run the focused test and type check**

Run: `pnpm vitest run packages/engineering-annotation/src/gdt/value.test.ts && pnpm --filter @vectorai/engineering-annotation check`

Expected: PASS.

- [ ] **Step 5: Commit the domain contracts**

```bash
git add packages/engineering-annotation/src/gdt packages/engineering-annotation/src/dimension/types.ts packages/engineering-annotation/src/index.ts
git commit -m "feat(gdt): add semantic tolerance contracts"
```

---

### Task 2: Validation and Immutable Editing

**Files:**
- Create: `packages/engineering-annotation/src/gdt/validate.ts`
- Create: `packages/engineering-annotation/src/gdt/validate.test.ts`
- Create: `packages/engineering-annotation/src/gdt/edit.ts`
- Create: `packages/engineering-annotation/src/gdt/edit.test.ts`
- Modify: `packages/engineering-annotation/src/dimension/validate.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `validateGeometricTolerances({ datums, intents, geometryIds? })`, `applyGeometricToleranceEdit(intent, edit)`, and domain `GeometricToleranceEdit` variants `characteristic.set`, `controlled-targets.set`, `datum-frame.set`, `zone.set`, `override.set`, and `override.clear`.

- [ ] **Step 1: Write failing validation tests**

Cover these exact cases:

```ts
expect(codes(validate({ datums: [datum('A'), datum('A')] }))).toContain('GDT_DATUM_NAME_DUPLICATE');
expect(codes(validate({ intents: [gdt({ characteristic: 'flatness', datumReferenceFrame: [] })] }))).not.toContain('GDT_DATUM_REQUIRED');
expect(codes(validate({ intents: [gdt({ characteristic: 'perpendicularity', datumReferenceFrame: [] })] }))).toContain('GDT_DATUM_REQUIRED');
expect(codes(validate({ intents: [gdt({ override: { value: 0 } })] }))).toContain('GDT_VALUE_INVALID');
expect(codes(validate({ intents: [gdt({ controlledTargets: [target('missing')] })], geometryIds: ['edge:1'] }))).toContain('GDT_TARGET_UNKNOWN');
```

- [ ] **Step 2: Run validation tests and verify failure**

Run: `pnpm vitest run packages/engineering-annotation/src/gdt/validate.test.ts`

Expected: FAIL because `validateGeometricTolerances` is missing.

- [ ] **Step 3: Implement stable validation diagnostics**

Implement characteristic families as explicit sets:

```ts
const DATUM_OPTIONAL = new Set<GeometricCharacteristic>([
  'straightness', 'flatness', 'circularity', 'cylindricity',
]);
```

Reject duplicate datum names, missing datum IDs, repeated frame references, missing targets, non-finite/non-positive values, and confirmed records without an effective value. Return sorted diagnostics with stable IDs `gdt:<code>:<entity-id>`.

- [ ] **Step 4: Write failing immutable-edit tests**

```ts
const original = gdt({ computed: { status: 'resolved', value: 0.02, unit: 'mm', diagnostics: [] } });
const edited = applyGeometricToleranceEdit(original, { type: 'override.set', value: 0.01 });
expect(edited.override).toEqual({ value: 0.01 });
expect(edited.computed.value).toBe(0.02);
expect(original.override).toBeUndefined();
expect(applyGeometricToleranceEdit(edited, { type: 'override.clear' }).override).toBeUndefined();
```

- [ ] **Step 5: Implement edit commands and aggregate draft validation**

Each edit must return a structured clone. `override.set` rejects non-finite or non-positive values with `GDT_VALUE_INVALID`. Update `validateEngineeringDraft` to append structural GD&T diagnostics without pretending it has drawing geometry; Task 4 passes the authoritative geometry-ID set to target validation during host confirmation.

- [ ] **Step 6: Run domain tests**

Run: `pnpm vitest run packages/engineering-annotation/src/gdt packages/engineering-annotation/src/dimension/validate.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit validation and editing**

```bash
git add packages/engineering-annotation/src/gdt packages/engineering-annotation/src/dimension/validate.ts
git commit -m "feat(gdt): validate and edit tolerance intents"
```

---

### Task 3: Versioned Zod Contracts and Backward Loading

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: every `EngineeringAnnotationDraft` literal found by `rg -n "datums: \[|datums:" packages scripts --glob '*.ts' --glob '*.tsx'`

**Interfaces:**
- Consumes: Task 1 domain property names and Task 2 edit-command names.
- Produces: `geometricToleranceIntentSchema`, protocol `geometricToleranceEditCommandSchema`, inferred protocol types, and backward parsing with an empty GD&T collection. The protocol command wraps a domain edit with `intentId` and `expectedDrawingRef`.

- [ ] **Step 1: Write failing contract migration and rejection tests**

```ts
const parsed = engineeringAnnotationDraftSchema.parse({
  version: 1, drawingRef: { drawingId: 'drawing:1', revision: 1 },
  datums: [], intents: [], tolerances: [], chains: [], dependencies: [], diagnostics: [],
});
expect(parsed.geometricTolerances).toEqual([]);

expect(() => geometricToleranceIntentSchema.parse({
  ...validIntent, computed: { status: 'resolved', value: Number.NaN, unit: 'mm', diagnostics: [] },
})).toThrow();
```

- [ ] **Step 2: Run the contract tests and verify failure**

Run: `pnpm vitest run packages/plugin-space-contracts/src/index.test.ts`

Expected: FAIL because `geometricTolerances` and the exported schemas are absent.

- [ ] **Step 3: Add strict schemas**

Use discriminated unions and `.strict()` records. Add `geometricTolerances: z.array(geometricToleranceIntentSchema).default([])` to the draft schema. Export inferred `GeometricToleranceIntent` and `GeometricToleranceEditCommand` types. The edit command schema includes `expectedDrawingRef` on every variant.

- [ ] **Step 4: Update all domain draft constructors**

Run the `rg` command in the Files section, add `geometricTolerances: []` to production constructors and explicit test fixtures, and do not change unrelated assertions.

- [ ] **Step 5: Run contract tests and repository type check**

Run: `pnpm vitest run packages/plugin-space-contracts/src/index.test.ts && pnpm check`

Expected: PASS.

- [ ] **Step 6: Commit contracts and migrations**

```bash
git add packages/plugin-space-contracts packages/engineering-annotation packages/plugin-dsh-annotation-host scripts
git commit -m "feat(gdt): serialize versioned tolerance plans"
```

Before committing, inspect `git diff --cached --stat` and unstage any pre-existing diameter/viewer files not required by this task.

---

### Task 4: Host Grounding, Persistence, and Lifecycle

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/gdt-grounding.ts`
- Create: `packages/plugin-dsh-annotation-host/src/gdt-service.ts`
- Create: `packages/plugin-dsh-annotation-host/src/gdt-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/index.ts`

**Interfaces:**
- Consumes: `GeometricToleranceIntent`, `GeometricToleranceEditCommand`, `applyGeometricToleranceEdit`, and the active `DrawingWorkspaceSnapshot`.
- Produces: `GdtService.start(agent, recommendation)`, `GdtService.edit(agent, command)`, and confirmation checks against authoritative drawing geometry.

- [ ] **Step 1: Write failing grounding tests**

Create a drawing with two line geometry nodes and assert:

```ts
const result = groundGdtRecommendation(snapshot, {
  datums: [{ name: 'A', geometryId: 'edge:datum', role: 'primary' }],
  controls: [{ id: 'gdt:1', characteristic: 'perpendicularity', geometryIds: ['edge:controlled'], datumNames: ['A'], toleranceZoneShape: 'linear' }],
});
expect(result.datums[0]?.anchor.kind).toBe('nearest');
expect(result.geometricTolerances[0]?.computed.status).toBe('pending');
expect(result.geometricTolerances[0]?.override).toBeUndefined();
expect(() => groundGdtRecommendation(snapshot, badGeometryId)).toThrowError('GDT_GEOMETRY_UNKNOWN');
```

- [ ] **Step 2: Run the service tests and verify failure**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/gdt-service.test.ts`

Expected: FAIL because grounding and service modules do not exist.

- [ ] **Step 3: Implement local grounding**

Resolve IDs only from `snapshot.document.geometry`. Create anchors with `{ kind: 'nearest', point: locallyDerivedRepresentativePoint(node) }`; representative points are line midpoint, circle/arc center plus radius on +X, polyline first vertex, ellipse major-axis endpoint, spline first control point, and the node coordinate for points. Reject unsupported or invisible nodes.

- [ ] **Step 4: Extend the plan store**

Add `editGeometricTolerance(sessionId, command)` that edits exactly one intent and pushes undo history. Include `geometricTolerances` in revision creation and `editableDraftFrom`. In confirmation diagnostics, require every confirmed GD&T record to have a valid effective value and reject `conflict`/`stale`; allow `candidate` and `pending-calculation` drafts to remain editable but not confirm.

- [ ] **Step 5: Implement the host service**

`start` loads the active drawing, grounds recommendations, preserves the latest confirmed revision as the draft base, and appends/replaces candidates by ID. `edit` delegates to the store after checking `expectedDrawingRef`. `markStale` marks affected computed results stale when the drawing revision changes; it never rebinds geometry IDs.

- [ ] **Step 6: Add lifecycle tests**

Assert that undo restores a cleared override, redo reapplies it, confirmation persists both computed and override, recalculation changes computed while preserving override, and a deleted geometry ID blocks confirmation with `GDT_TARGET_UNKNOWN`.

- [ ] **Step 7: Run host tests**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/gdt-service.test.ts packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit host lifecycle support**

```bash
git add packages/plugin-dsh-annotation-host/src/gdt-* packages/plugin-dsh-annotation-host/src/dimension-plan-store* packages/plugin-dsh-annotation-host/src/service.ts packages/plugin-dsh-annotation-host/src/index.ts
git commit -m "feat(gdt): ground and persist tolerance candidates"
```

---

### Task 5: DSH Tool and Remote Edit Protocol

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/typert.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`

**Interfaces:**
- Consumes: Task 4 `GdtService`.
- Produces: AI tool `drawing_gdt_start` and remote invocation `editGeometricTolerance`.

- [ ] **Step 1: Write failing tool-authority tests**

Assert the tool schema accepts only:

```ts
{
  datums: [{ name: 'A', geometryId: 'edge:datum', role: 'primary' }],
  controls: [{
    id: 'gdt:1', characteristic: 'perpendicularity',
    geometryIds: ['edge:controlled'], datumNames: ['A'], toleranceZoneShape: 'linear',
  }],
}
```

Assert that fields named `value`, `x`, `y`, `point`, `computed`, and `override` are rejected by the strict schema.

- [ ] **Step 2: Run tool tests and verify failure**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/tools.test.ts packages/plugin-dsh-annotation-host/src/typert.test.ts`

Expected: FAIL because the tool and invocation are not registered.

- [ ] **Step 3: Register `drawing_gdt_start`**

Use a description that states the tool is called only for an explicit datum/GD&T request and that it recommends identities and types only. Return compact status fields: phase, datumCount, controlCount, pendingCalculationCount, diagnostics, and `nextAction: 'review-gdt-preview'`.

- [ ] **Step 4: Add remote methods**

Expose `getDimensionPlan`, the existing confirm/cancel/undo/redo methods, plus `editGeometricTolerance(sessionId, command)` using `geometricToleranceEditCommandSchema`. Reuse the existing dimension-plan snapshot response type.

- [ ] **Step 5: Run tool and Typert tests**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/tools.test.ts packages/plugin-dsh-annotation-host/src/typert.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit tool integration**

```bash
git add packages/plugin-dsh-annotation-host/src/tools* packages/plugin-dsh-annotation-host/src/typert* packages/plugin-dsh-annotation-host/src/service.ts
git commit -m "feat(gdt): expose grounded recommendation workflow"
```

---

### Task 6: Client Controller, Layers, Overlay, and Inspector

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/gdt-controller.ts`
- Create: `packages/plugin-dsh-annotation-client/src/gdt-controller.test.ts`
- Create: `packages/plugin-dsh-annotation-client/src/GdtOverlay.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/GdtInspector.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/GdtOverlay.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/drawing-layers.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes: `DimensionPlanSessionSnapshot`, `GeometricToleranceEditCommand`, and Task 5 remote method.
- Produces: `GdtController`, `GdtOverlay`, `GdtInspector`, `ANNOTATION_DATUM_LAYER`, and `ANNOTATION_GDT_LAYER`.

- [ ] **Step 1: Write failing controller tests**

Verify queued edits, error propagation, and exact command payloads:

```ts
await controller.actions.setOverride('gdt:1', 0.01);
expect(remote.editGeometricTolerance).toHaveBeenCalledWith('session:1', {
  type: 'override.set', intentId: 'gdt:1', value: 0.01,
  expectedDrawingRef: { drawingId: 'drawing:1', revision: 1 },
});
await controller.actions.clearOverride('gdt:1');
```

- [ ] **Step 2: Implement the controller and run its test**

Mirror the queue/error pattern in `dimension-chain-controller.ts`. Expose actions for characteristic, targets, datum frame, zone, set override, and clear override. Run `pnpm vitest run packages/plugin-dsh-annotation-client/src/gdt-controller.test.ts`; expect PASS.

- [ ] **Step 3: Write failing overlay tests**

Render a primary datum A and one perpendicularity control. Assert the output contains `data-datum-id="datum:A"`, `data-gdt-id="gdt:1"`, the characteristic symbol, the effective value, and ordered datum cells. Rerender with `previewHeld=true` and assert edit handles are hidden while semantic frames remain visible.

- [ ] **Step 4: Implement screen-stable overlay rendering**

Use SVG groups with `vector-effect="non-scaling-stroke"`; convert text sizes and frame padding through inverse viewport scale. Render calculated values normally, overridden values with an edited-state class, and pending values as `待计算` without substituting a number.

- [ ] **Step 5: Implement the inspector**

The inspector edits characteristic, controlled target, zone shape/modifiers, ordered datum references, and override. Show calculated and effective values separately. Disable confirmation when validation has error diagnostics. Provide a visible “恢复算法值” action only when `override` exists.

- [ ] **Step 6: Register and integrate layers**

Add `vectorai.annotation.datum` at order 125 and `vectorai.annotation.gdt` at order 130. Register both in `client.tsx`, add them to fallback definitions, and expose independent visibility toggles in the existing right-top layer manager. Reuse the existing preview/cancel/confirm toolbar and do not create another toolbar.

- [ ] **Step 7: Run client tests and build the plugin bundle**

Run: `pnpm vitest run packages/plugin-dsh-annotation-client/src/gdt-controller.test.ts packages/plugin-dsh-annotation-client/src/GdtOverlay.test.tsx && pnpm build:dsh-annotation`

Expected: PASS and refreshed host/client `lib` bundles.

- [ ] **Step 8: Commit client integration**

```bash
git add packages/plugin-dsh-annotation-client packages/plugin-dsh-annotation-host/lib
git commit -m "feat(gdt): add datum and tolerance editing UI"
```

Inspect the staged diff to ensure generated bundles correspond to the source changes in Tasks 4–6.

---

### Task 7: Golden Oracle, Generalization Guards, and Acceptance Script

**Files:**
- Create: `packages/engineering-annotation/src/gdt/golden.integration.test.ts`
- Create: `packages/engineering-annotation/src/gdt/metamorphic.test.ts`
- Create: `packages/engineering-annotation/src/gdt/source-guard.test.ts`
- Create: `scripts/e2e-datum-gdt-foundation.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: all prior public domain, host, and contract interfaces.
- Produces: acceptance evidence that semantic output is compatible with supplied golden records and invariant under representation changes.

- [ ] **Step 1: Write the production-source guard**

Read non-test TypeScript files in `src/gdt`, concatenate them, and reject `样本图001`, `golden-shaft-001`, fixture hashes, and the known golden datum/GD&T numeric literals stored by the test fixture. Also scan `plugin-dsh-annotation-host/src/gdt-*` for those tokens.

- [ ] **Step 2: Write the semantic golden oracle test**

Load the initial and target DXFs only through test-support code. Supply target-derived datum/GD&T records as explicit test input, round-trip them through domain and Zod contracts, and compare characteristic, controlled feature identity, effective value, datum order, and modifiers. Do not assert exact screen coordinates.

- [ ] **Step 3: Write metamorphic tests**

Apply translation `(37, -19)`, uniform scale `2`, X-axis mirror, and reversed geometry entity order to a non-golden synthetic shaft. Assert grounded semantic IDs/types and effective values remain equivalent after mapping transformed geometry IDs back to source IDs. Include a mutation where one supplied computed value changes and assert the serialized/rendered effective value changes with it.

- [ ] **Step 4: Run the guard and integration tests**

Run: `pnpm vitest run packages/engineering-annotation/src/gdt/source-guard.test.ts packages/engineering-annotation/src/gdt/golden.integration.test.ts packages/engineering-annotation/src/gdt/metamorphic.test.ts`

Expected: PASS.

- [ ] **Step 5: Add the end-to-end script**

The script creates a drawing, starts the GD&T recommendation workflow, verifies `computed.status === 'pending'`, applies a deterministic test provider result of `0.02 mm`, applies an override of `0.01 mm`, confirms, reloads persisted state, clears the override, and verifies the effective value returns to `0.02 mm`. It exits nonzero on any mismatch.

Add:

```json
"e2e:datum-gdt-foundation": "tsx scripts/e2e-datum-gdt-foundation.ts"
```

- [ ] **Step 6: Run focused and repository verification**

Run:

```bash
pnpm e2e:datum-gdt-foundation
pnpm --filter @vectorai/engineering-annotation test
pnpm check
pnpm build:dsh-annotation
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit acceptance coverage**

```bash
git add packages/engineering-annotation/src/gdt scripts/e2e-datum-gdt-foundation.ts package.json packages/plugin-dsh-annotation-host/lib packages/plugin-dsh-annotation-client/lib
git commit -m "test(gdt): verify golden-compatible rule boundaries"
```

---

## Final Review and Integration

- [ ] Review `git diff <base>...HEAD` for fixture identity or known expected-value branches in production files.
- [ ] Confirm every `EngineeringAnnotationDraft` constructor initializes or migrates `geometricTolerances`.
- [ ] Confirm generated DSH bundles contain `drawing_gdt_start`, `vectorai.annotation.datum`, and `vectorai.annotation.gdt`.
- [ ] Run `git status --short` and preserve unrelated user-owned modifications.
- [ ] Create one feature PR containing the task commits; after checks pass, merge it according to the repository policy and retain the PR record.
