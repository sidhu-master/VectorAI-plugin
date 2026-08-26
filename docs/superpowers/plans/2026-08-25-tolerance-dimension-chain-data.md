# Tolerance and Dimension-Chain Data Foundation Implementation Plan

Status: Completed on 2026-08-25; production tolerance formulas remain an extension point.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build the portable tolerance contracts and second-layer dimension-chain domain needed for later production formulas, deterministic annotation order, durable review, and first-layer projection.

**Architecture:** drawing-core stores only portable confirmed tolerance results and datum references. engineering-annotation owns intents, datums, rule inputs, chains, dependency ordering, validation, and projection; DSH packages only persist and expose this state.

**Tech Stack:** TypeScript, Zod, Vitest, React, pnpm workspace packages, existing Drawing and DSH plugin contracts.

**Spec:** docs/superpowers/specs/2026-08-25-tolerance-dimension-chain-data-design.md

## Global Constraints

- Do not ship production tolerance formulas in this milestone.
- Never accept an AI-generated numeric tolerance as confirmed engineering data.
- Store rule ID, immutable rule version, canonical input digest, and resolved result; never store executable formula source in a Drawing.
- Formula evaluation must be deterministic, synchronous, host-neutral, and unable to access DSH, models, the network, or mutable Drawing state.
- First-layer documents must remain compatible with the legacy upper/lower tolerance object.
- Dimension order comes from an acyclic dependency graph, never array position.
- Confirmation must be revision-safe and atomic.
- All processing remains local; add no VectorAI cloud or Express service.

---

### Task 1: Portable tolerance and datum contracts

**Files:**
- Modify: packages/drawing-core/src/document/types.ts
- Create: packages/drawing-core/src/document/tolerance.ts
- Create: packages/drawing-core/src/document/tolerance.test.ts
- Modify: packages/drawing-core/src/document/index.ts
- Modify: packages/drawing-core/src/index.ts
- Modify: packages/plugin-space-contracts/src/index.ts
- Modify: packages/plugin-space-contracts/src/index.test.ts

**Interfaces:**
- Consumes: existing DimensionAnnotation, DimensionTarget, EntityAnchor, EvidenceId, and GeometryId.
- Produces: ToleranceProjection, DatumReference, normalizeToleranceProjection(), and wire schemas embedded in annotationSchema.

- [ ] **Step 1: Write failing drawing-core compatibility and validation tests**

Add tests covering a bilateral projection, a fit projection, legacy upper/lower
normalization, inverted limits, non-finite values, and confirmed data without
evidence.

~~~ts
expect(normalizeToleranceProjection({
  legacy: { upper: 0.02, lower: -0.01 },
  unit: 'mm',
})).toMatchObject({
  mode: 'bilateral',
  upperDeviation: 0.02,
  lowerDeviation: -0.01,
  source: 'manual',
  status: 'confirmed',
});

expect(() => validateToleranceProjection({
  mode: 'limits',
  lowerLimit: 12,
  upperLimit: 11,
  unit: 'mm',
  source: 'document',
  status: 'resolved',
  evidenceRefs: [],
})).toThrow('TOLERANCE_LIMIT_ORDER');
~~~

- [ ] **Step 2: Run the focused test and verify failure**

Run: pnpm exec vitest run packages/drawing-core/src/document/tolerance.test.ts

Expected: FAIL because the tolerance module and exported functions do not exist.

- [ ] **Step 3: Add focused portable types and pure validation**

Define ToleranceProjection with none, bilateral, unilateral, limits, and fit
modes; DatumReference with stable geometry anchors; and these functions:

~~~ts
export function validateToleranceProjection(value: ToleranceProjection): void;
export function normalizeToleranceProjection(input: {
  projection?: ToleranceProjection;
  legacy?: { upper?: number; lower?: number };
  unit: LengthUnit | 'deg';
}): ToleranceProjection | undefined;
~~~

Legacy normalization must use source manual, status confirmed, and a deterministic
legacy evidence reference. It must not invent a ruleRef.

- [ ] **Step 4: Extend DimensionAnnotation without removing legacy fields**

Add optional toleranceProjection, datumReferences, engineeringIntentId,
engineeringChainIds, and generationOrder fields. Keep the existing tolerance field
readable.

- [ ] **Step 5: Extend plugin-space-contracts schemas and round-trip tests**

Add strict schemas for the portable projection, datum references, immutable
ruleRef, and new DimensionAnnotation fields. Test valid bilateral/fit examples and
reject NaN, inverted limits, unknown keys, and malformed anchors.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/drawing-core/src/document/tolerance.test.ts packages/plugin-space-contracts/src/index.test.ts
    pnpm --filter @vectorai/drawing-core check
    pnpm --filter @vectorai/plugin-space-contracts check

Expected: all tests and both type checks pass.

- [ ] **Step 7: Commit the portable contract**

Commit message: feat: add portable tolerance and datum contracts

---

### Task 2: Engineering intents, datums, tolerances, and chain validation

**Files:**
- Create: packages/engineering-annotation/src/dimension/types.ts
- Create: packages/engineering-annotation/src/dimension/schema.ts
- Create: packages/engineering-annotation/src/dimension/validate.ts
- Create: packages/engineering-annotation/src/dimension/validate.test.ts
- Modify: packages/engineering-annotation/src/index.ts
- Modify: packages/plugin-space-contracts/src/index.ts
- Modify: packages/plugin-space-contracts/src/index.test.ts

**Interfaces:**
- Consumes: DrawingRef, DimensionTarget, EntityAnchor, and portable tolerance enums.
- Produces: DimensionIntent, EngineeringDatum, ToleranceSpec, DimensionChain, EngineeringAnnotationDraft, validateEngineeringDraft(), and strict wire schemas.

- [ ] **Step 1: Write failing domain invariant tests**

Cover duplicate IDs, missing intent targets, stale datum references, a chain whose
closure intent is not a member, coefficients outside 1 and -1, a confirmed
tolerance without resolved output, a rule result whose input digest is absent, and
a valid complete draft.

~~~ts
const diagnostics = validateEngineeringDraft({
  ...validDraft(),
  chains: [{
    ...validChain(),
    members: [{ dimensionIntentId: 'intent-a', coefficient: 0, role: 'component' }],
  }],
});
expect(diagnostics).toContainEqual(expect.objectContaining({
  code: 'DIMENSION_CHAIN_COEFFICIENT_INVALID',
  severity: 'error',
}));
~~~

- [ ] **Step 2: Run the focused test and verify failure**

Run: pnpm exec vitest run packages/engineering-annotation/src/dimension/validate.test.ts

Expected: FAIL because the dimension domain does not exist.

- [ ] **Step 3: Define versioned domain types**

Define version 1 types for EngineeringDiagnostic, DimensionIntent,
EngineeringDatum, ToleranceSpec, DimensionChainMember, DimensionChain,
AnnotationDependency, EngineeringAnnotationDraft, and
EngineeringAnnotationRevision. Use explicit candidate, resolved, confirmed,
conflict, and stale states where required by the spec.

- [ ] **Step 4: Implement pure invariant validation**

Implement:

~~~ts
export function validateEngineeringDraft(
  draft: EngineeringAnnotationDraft,
): EngineeringDiagnostic[];
~~~

Validation must be side-effect free and report all detectable errors in stable
code/ID order rather than stopping at the first issue.

- [ ] **Step 5: Add strict Zod wire schemas**

Mirror the domain in plugin-space-contracts. Every object must be strict, every
number finite, coefficients restricted to 1 or -1, IDs bounded, inputs restricted
to number/string/boolean, and status unions explicit.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/engineering-annotation/src/dimension/validate.test.ts packages/plugin-space-contracts/src/index.test.ts
    pnpm --filter @vectorai/engineering-annotation check
    pnpm --filter @vectorai/plugin-space-contracts check

Expected: all pass.

- [ ] **Step 7: Commit the engineering domain**

Commit message: feat: add dimension-chain engineering domain

---

### Task 3: Deterministic tolerance rule provider boundary

**Files:**
- Create: packages/engineering-annotation/src/tolerance/rules.ts
- Create: packages/engineering-annotation/src/tolerance/digest.ts
- Create: packages/engineering-annotation/src/tolerance/evaluate.ts
- Create: packages/engineering-annotation/src/tolerance/evaluate.test.ts
- Modify: packages/engineering-annotation/src/index.ts
- Modify: packages/engineering-annotation/src/dependency-boundary.test.ts

**Interfaces:**
- Consumes: DimensionIntent, ToleranceSpec, and the host-neutral portable output modes.
- Produces: ToleranceRuleDescriptor, ToleranceRuleProvider, canonicalRuleInputDigest(), and resolveToleranceSpec().

- [ ] **Step 1: Write failing deterministic provider tests**

Use an explicitly named FixtureToleranceRuleProvider. Verify:

- reordered input keys produce the same SHA-256 digest;
- a changed value changes the digest;
- the same rule/version/input returns the same resolved output;
- unknown rule and version mismatch return explicit diagnostics;
- NaN, Infinity, inverted limits, and undeclared output modes are rejected;
- AI candidate values cannot be promoted by the evaluator.

~~~ts
expect(canonicalRuleInputDigest({
  nominalValue: 20,
  unit: 'mm',
  inputs: { grade: 'A', process: 2 },
})).toBe(canonicalRuleInputDigest({
  nominalValue: 20,
  unit: 'mm',
  inputs: { process: 2, grade: 'A' },
}));
~~~

- [ ] **Step 2: Run the focused test and verify failure**

Run: pnpm exec vitest run packages/engineering-annotation/src/tolerance/evaluate.test.ts

Expected: FAIL because the provider boundary does not exist.

- [ ] **Step 3: Implement canonical digesting**

Canonicalize object keys recursively, reject non-finite numbers and unsupported
input values, serialize as UTF-8 JSON, and return sha256 followed by the lowercase
hex digest. Keep this utility independent of DSH and browser globals.

- [ ] **Step 4: Implement the provider interface and resolver**

Define:

~~~ts
export interface ToleranceRuleProvider {
  listRules(): ToleranceRuleDescriptor[];
  evaluate(request: ToleranceRuleRequest): ToleranceRuleResult;
}

export function resolveToleranceSpec(input: {
  intent: DimensionIntent;
  spec: ToleranceSpec;
  provider: ToleranceRuleProvider;
  now: () => number;
}): { spec: ToleranceSpec; diagnostics: EngineeringDiagnostic[] };
~~~

The resolver must validate descriptor, version, declared input schema, output mode,
finite result, limit order, deterministic digest, and source policy before
returning resolved state.

- [ ] **Step 5: Enforce dependency boundaries**

Extend dependency-boundary tests to prove tolerance modules do not import
deepseek-ai, plugin-dsh packages, React, network clients, or Node file-system APIs.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/engineering-annotation/src/tolerance/evaluate.test.ts packages/engineering-annotation/src/dependency-boundary.test.ts
    pnpm --filter @vectorai/engineering-annotation check

Expected: all pass.

- [ ] **Step 7: Commit the rule boundary**

Commit message: feat: add deterministic tolerance rule provider

---

### Task 4: Dimension dependency graph and stable ordering

**Files:**
- Create: packages/engineering-annotation/src/dimension/order.ts
- Create: packages/engineering-annotation/src/dimension/order.test.ts
- Create: packages/engineering-annotation/src/dimension/chain.ts
- Create: packages/engineering-annotation/src/dimension/chain.test.ts
- Modify: packages/engineering-annotation/src/index.ts

**Interfaces:**
- Consumes: DimensionIntent, DimensionChain, AnnotationDependency, and EngineeringDiagnostic.
- Produces: orderDimensionIntents() and analyzeDimensionChain().

- [ ] **Step 1: Write failing topological-order tests**

Cover datum before dependent, overall before functional, component before closure,
explicit document order, deterministic tie-breaking, duplicate edges, unknown IDs,
and a three-node cycle.

~~~ts
const result = orderDimensionIntents({
  intents: [
    intent('closure', 'closure'),
    intent('datum', 'datum'),
    intent('component', 'process'),
  ],
  dependencies: [
    edge('datum', 'component', 'datum-before-dependent'),
    edge('component', 'closure', 'component-before-closure'),
  ],
});
expect(result.orderedIntentIds).toEqual(['datum', 'component', 'closure']);
~~~

- [ ] **Step 2: Run order tests and verify failure**

Run: pnpm exec vitest run packages/engineering-annotation/src/dimension/order.test.ts

Expected: FAIL because orderDimensionIntents is missing.

- [ ] **Step 3: Implement stable Kahn topological sorting**

Reject unknown IDs, normalize duplicate edges, use functional-role rank then stable
geometry target key then intent ID as the ready-queue comparator, and emit
DIMENSION_DEPENDENCY_CYCLE with every blocked intent ID when no node is ready.

- [ ] **Step 4: Write failing chain-analysis tests**

Cover nominal closure calculation, worst-case upper/lower accumulation with positive
and negative coefficients, missing tolerance, conflicting member state, and
reference-only mode.

- [ ] **Step 5: Implement chain analysis**

Define:

~~~ts
export function analyzeDimensionChain(input: {
  chain: DimensionChain;
  intents: DimensionIntent[];
  tolerances: ToleranceSpec[];
}): DimensionChainAnalysis;
~~~

Only worst-case and reference-only are calculated in this milestone. Statistical
mode returns a typed unsupported diagnostic rather than silently using worst-case.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/engineering-annotation/src/dimension/order.test.ts packages/engineering-annotation/src/dimension/chain.test.ts
    pnpm --filter @vectorai/engineering-annotation check

Expected: all pass.

- [ ] **Step 7: Commit the graph engine**

Commit message: feat: add deterministic dimension-chain ordering

---

### Task 5: Projection into portable dimensions and DXF rendering

**Files:**
- Create: packages/engineering-annotation/src/dimension/project.ts
- Create: packages/engineering-annotation/src/dimension/project.test.ts
- Modify: packages/engineering-annotation/src/plan.ts
- Modify: packages/engineering-annotation/src/plan.test.ts
- Modify: packages/drawing-core/src/io/dxf.ts
- Modify: packages/drawing-core/src/io/dxf.test.ts

**Interfaces:**
- Consumes: validated EngineeringAnnotationDraft, ordered intent IDs, resolved ToleranceSpec values, and existing DimensionAnnotation.
- Produces: projectEngineeringAnnotations() and stable tolerance display labels used by DXF export.

- [ ] **Step 1: Write failing projection tests**

Verify that a confirmed intent plus resolved tolerance projects stable targets,
datum references, intent/chain IDs, generationOrder, evidence, and portable
tolerance fields. Verify candidate, conflict, stale, and missing-result inputs do
not become confirmed first-layer annotations.

- [ ] **Step 2: Run projection tests and verify failure**

Run: pnpm exec vitest run packages/engineering-annotation/src/dimension/project.test.ts

Expected: FAIL because the projection function does not exist.

- [ ] **Step 3: Implement pure projection**

Define:

~~~ts
export function projectEngineeringAnnotations(input: {
  draft: EngineeringAnnotationDraft;
  orderedIntentIds: string[];
  existingAnnotations: AnnotationNode[];
}): {
  annotations: DimensionAnnotation[];
  diagnostics: EngineeringDiagnostic[];
};
~~~

Projection must be deterministic and must not mutate the draft or existing
annotations.

- [ ] **Step 4: Adapt the existing planner**

Keep current geometry-derived radius and diameter behavior. Route generated
dimensions through the new intent/projection boundary without requiring a
tolerance formula, so existing plan tests remain valid.

- [ ] **Step 5: Write DXF label tests**

Test exact display strings for bilateral, unilateral, limits, fit, and legacy
upper/lower tolerances. Include escaping tests so tolerance text cannot corrupt DXF
group pairs.

- [ ] **Step 6: Implement DXF portable rendering**

DXF export reads toleranceProjection first and legacy tolerance second. It formats
confirmed/resolved values only, never invokes a provider, and preserves the
existing nominal dimension label when no tolerance exists.

- [ ] **Step 7: Run focused verification**

Run:

    pnpm exec vitest run packages/engineering-annotation/src/dimension/project.test.ts packages/engineering-annotation/src/plan.test.ts packages/drawing-core/src/io/dxf.test.ts
    pnpm --filter @vectorai/engineering-annotation check
    pnpm --filter @vectorai/drawing-core check

Expected: all pass.

- [ ] **Step 8: Commit projection and export**

Commit message: feat: project tolerance-aware dimensions

---

### Task 6: Durable annotation-plan revision store

**Files:**
- Create: packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts
- Create: packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts
- Modify: packages/plugin-dsh-annotation-host/src/service.ts
- Modify: packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts

**Interfaces:**
- Consumes: EngineeringAnnotationDraft, EngineeringAnnotationRevision, DrawingRef, and existing annotation session storage patterns.
- Produces: DimensionPlanStore with get(), begin(), setDraft(), confirm(), cancel(), undo(), redo(), and markNeedsRebase().

- [ ] **Step 1: Write failing lifecycle and persistence tests**

Cover begin/set draft, edit history, confirm, undo to editing, redo, cancel to the
independent latest-confirmed baseline, confirm parent revision linkage, stale
DrawingRef rejection, file round trip, corrupt-file fallback, and storage failure
before memory publication.

- [ ] **Step 2: Run focused tests and verify failure**

Run: pnpm exec vitest run packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts

Expected: FAIL because DimensionPlanStore is missing.

- [ ] **Step 3: Implement a schema-validated durable envelope**

Persist snapshot, undo, redo, and independent lastConfirmed. Parse every restored
entry through strict wire schemas. Save storage before changing the in-memory map.
Hash session IDs for file names and use temporary-file rename for atomic writes.

- [ ] **Step 4: Implement revision-safe lifecycle**

Confirmation runs full draft validation and graph ordering, creates an immutable
revision with parentRevisionId, and never confirms stale/conflicting plans. Cancel
restores lastConfirmed when present. Undo followed by edit must not erase the
confirmed baseline.

- [ ] **Step 5: Wire the store into the annotation host without adding formulas**

Construct the store in service.ts beside the partition store. Expose no model tool
yet; the first milestone only makes state available to later workflow tools.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts
    pnpm --filter @vectorai/plugin-dsh-annotation-host check

Expected: all pass.

- [ ] **Step 7: Commit durable state**

Commit message: feat: persist tolerance annotation plans

---

### Task 7: Minimal second-layer data inspection shell

**Files:**
- Create: packages/plugin-dsh-annotation-client/src/DimensionPlanInspector.tsx
- Create: packages/plugin-dsh-annotation-client/src/DimensionPlanInspector.test.tsx
- Modify: packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx
- Modify: packages/plugin-dsh-annotation-client/src/client.css
- Modify: packages/plugin-dsh-annotation-client/src/dependency-boundary.test.ts

**Interfaces:**
- Consumes: a read-only EngineeringAnnotationDraft projection and generationOrder from the second layer.
- Produces: a non-calculating inspector that displays order, role, datum links, tolerance source/status, and diagnostics.

- [ ] **Step 1: Write failing inspector tests**

Render a draft containing datum, overall, functional, component, and closure
intents. Assert displayed order follows generationOrder rather than source array
order. Assert unresolved/conflict/stale badges and rule ID/version are visible.

- [ ] **Step 2: Run focused test and verify failure**

Run: pnpm exec vitest run packages/plugin-dsh-annotation-client/src/DimensionPlanInspector.test.tsx

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Implement the read-only inspector**

Render stable rows with accessible labels. Do not calculate tolerances, run graph
sorting, infer datums, or mutate plan state in React.

- [ ] **Step 4: Mount behind explicit draft availability**

AnnotationWorkspace shows the inspector only when a dimension-plan draft exists.
The current partition interface remains unchanged when it does not.

- [ ] **Step 5: Enforce client dependency boundaries**

Extend tests to reject imports from tolerance evaluator and chain engine into the
client package.

- [ ] **Step 6: Run focused verification**

Run:

    pnpm exec vitest run packages/plugin-dsh-annotation-client/src/DimensionPlanInspector.test.tsx packages/plugin-dsh-annotation-client/src/dependency-boundary.test.ts
    pnpm --filter @vectorai/plugin-dsh-annotation-client check

Expected: all pass.

- [ ] **Step 7: Commit the inspection shell**

Commit message: feat: inspect ordered dimension plans

---

### Task 8: Documentation, bundle verification, and real regression

**Files:**
- Modify: docs/prd.md
- Modify: docs/tech-architecture.md
- Modify: docs/development.md
- Create: scripts/e2e-tolerance-data-foundation.ts
- Modify: package.json

**Interfaces:**
- Consumes: all contracts and services from Tasks 1 through 7.
- Produces: maintained architecture documentation and a deterministic local end-to-end verification command.

- [ ] **Step 1: Write the end-to-end script**

Build a small local Drawing with datum, overall, component, and closure intents.
Use the fixture provider to resolve one tolerance, order the graph, analyze the
worst-case chain, project confirmed annotations, round-trip durable state, and
export DXF.

The script must assert:

- no formula source appears in serialized Drawing data;
- ordered IDs are datum, overall, component, closure;
- projected ruleRef contains ID, version, and input digest;
- DXF includes the expected portable tolerance display;
- undo after confirm returns to editing;
- cancel after undo/edit restores the confirmed baseline.

- [ ] **Step 2: Add the package command and run it**

Add e2e:tolerance-data-foundation to package.json.

Run: pnpm e2e:tolerance-data-foundation

Expected: exit 0 with a compact JSON summary.

- [ ] **Step 3: Update maintained docs**

Document first-layer portable results, second-layer authoritative engineering
state, provider restrictions, graph ordering, compatibility, and the new local
verification command. State explicitly that production formulas are not yet
included.

- [ ] **Step 4: Run the full verification gate**

Run:

    git diff --check
    pnpm test
    pnpm check
    pnpm lint
    pnpm build:dsh-space
    pnpm build:dsh-annotation
    pnpm e2e:dxf-smart-partition
    pnpm e2e:tolerance-data-foundation

Expected: every command exits 0.

- [ ] **Step 5: Request final code review**

Review specifically for formula leakage into first-layer/DSH/UI packages,
non-deterministic ordering, stale-reference confirmation, legacy schema breakage,
and persistence publication before durable save. Fix every Critical or Important
finding and repeat the full verification gate.

- [ ] **Step 6: Commit documentation and end-to-end verification**

Commit message: docs: complete tolerance data foundation

- [ ] **Step 7: Push one feature branch and open one PR**

Push codex/tolerance-dimension-chain. Open one PR based on the branch containing
the DXF smart-partition foundation. The PR summary must state that formulas are an
extension point and production formulas are intentionally absent.
