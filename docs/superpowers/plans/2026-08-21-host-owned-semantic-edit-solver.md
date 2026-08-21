# Host-Owned Semantic Edit Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace model-carried Drawing workflow handles and model-invented qualitative coordinates with Host-owned episode state, model-directed semantic selection, and deterministic spatial solving shared by DSH and Web.

**Architecture:** The DSH adapter binds the current trusted session/root-user turn to one internal semantic episode. Model-visible tools operate on that current episode and exchange only semantic references, short episode-local part/candidate keys, generic spatial goals, and compact dispositions; internal UUIDs, revisions, digests, authority, and idempotency remain in the Host. `@vectorai/drawing-edit-core` resolves semantic goals to exact transforms and compiles the existing forward/inverse Drawing transactions.

**Tech Stack:** TypeScript 5.8, Zod 4, Vitest 3, DSH rc.8 Cordis/tools/attachments, VectorAI Drawing IR, `@vectorai/drawing-spatial`, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-21-host-owned-semantic-edit-state-and-solver-design.md`

## Global Constraints

- Model-visible qualitative tools contain no `taskId`, `observationId`, `contextId`, `groundingId`, `previewHandle`, candidate digest, operation ID, raw Drawing command, translation, pivot, rotation, or absolute world-coordinate field.
- Only a deterministic numeric constraint extracted from the authoritative user instruction may be referenced by a model-visible `numericKey`.
- Model chooses semantic parts and generic relationships; Host resolves exact nodes/interfaces and computes coordinates.
- No production schema, prompt, solver weight, or branch may contain a fixture node ID, fixture coordinate, character name, body-part rule, or gesture-specific opcode.
- Multi-part edits solve and commit in one Preview/commit.
- Existing durable assessment, authority, idempotency, recovery, Undo, CAS, and auto-safe rules remain in force.
- Drawing activation remains conditional; ordinary chat and reference images do not open or initialize a Drawing workflow.
- New behavior is developed red-green with focused package tests before broader builds.

---

## File Map

### New files

- `packages/drawing-edit-protocol/src/spatial-intent.ts` — provider-neutral strict schemas/types for semantic references, qualitative goals, preservation goals, numeric-key references, requests, and compact dispositions.
- `packages/drawing-edit-core/src/spatial-intent-solver.ts` — deterministic candidate generation, scoring, constraint evaluation, and transaction compilation.
- `packages/drawing-edit-core/src/spatial-intent-solver.test.ts` — one-part, multi-part, numeric, topology, determinism, inverse, and failure tests.
- `packages/plugin-dsh-space-host/src/semantic-episode.ts` — Host-owned per-session episode state and current-state CAS transitions.
- `packages/plugin-dsh-space-host/src/semantic-episode.test.ts` — lifecycle, invalidation, retry, and compaction-independent state tests.
- `packages/plugin-dsh-space-host/src/numeric-instruction.ts` — deterministic bounded extraction of exact distances, angles, and coordinates from authoritative user text.
- `packages/plugin-dsh-space-host/src/numeric-instruction.test.ts` — normalization, unit, duplicate, and rejection tests.
- `scripts/e2e-host-owned-semantic-edit.ts` — local end-to-end harness test that never passes an internal handle or qualitative coordinate.

### Modified files

- `packages/drawing-edit-protocol/src/index.ts` and `src/protocol.test.ts` — export and verify the new protocol.
- `packages/drawing-edit-core/src/index.ts` — export the solver.
- `packages/plugin-dsh-space-host/src/semantic-edit-service.ts` — episode-backed observe/select/solve/evaluate/revise/finalize/discard APIs.
- `packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts` — stateful semantic API and transaction parity tests.
- `packages/plugin-dsh-space-host/src/semantic-tools.ts` — replace the model-visible catalog with current-episode tools.
- `packages/plugin-dsh-space-host/src/tools.test.ts` — schema boundary, tool sequence, retry, and compact-result tests.
- `packages/plugin-dsh-space-host/src/intake.ts` and `src/intake.test.ts` — bind trusted root identity/instruction without exposing selection IDs or fixed workflows.
- `packages/plugin-dsh-space-host/src/service.ts` — instantiate the episode-backed service and retain internal Remote/UI projections.
- `packages/plugin-space-contracts/src/index.ts` and `src/index.test.ts` — compact current AI selection/disposition projection for the Client.
- `packages/plugin-dsh-space-client/src/client.tsx` and `src/client-view.test.tsx` — render/clear transient AI selection from the current episode only.
- `package.json` — add the end-to-end command.
- `docs/dsh-plugin-migration.md`, `docs/prd.md`, and `docs/tech-architecture.md` — record the completed cutover and remove claims that contradict the production catalog.

---

### Task 1: Freeze the Semantic Intent Protocol

**Files:**
- Create: `packages/drawing-edit-protocol/src/spatial-intent.ts`
- Modify: `packages/drawing-edit-protocol/src/index.ts`
- Test: `packages/drawing-edit-protocol/src/protocol.test.ts`

**Interfaces:**
- Consumes: Zod 4 strict object schemas and the existing `DrawingRef` conventions.
- Produces: `drawingSelectPartsRequestSchema`, `spatialIntentRequestSchema`, `spatialIntentRevisionSchema`, `spatialReferenceSchema`, `spatialGoalSchema`, `preservationGoalSchema`, `explicitNumericConstraintSchema`, `DrawingWorkflowDisposition`, and their inferred TypeScript types.

- [ ] **Step 1: Write failing strict-codec tests**

Add tests that accept a generic qualitative request and reject every legacy/internal field:

```ts
const request = {
  summary: 'place two selected parts below the drawing center and make their paths cross',
  goals: [
    { kind: 'relative_position', subject: 'part-a', reference: { kind: 'drawing_anchor', anchor: 'center' }, relation: 'below', magnitude: 'moderate' },
    { kind: 'topology', subject: 'part-a', reference: { kind: 'part', partKey: 'part-b' }, relation: 'crosses' },
  ],
  preserve: [{ kind: 'connectivity', partKey: 'part-a' }, { kind: 'minimum_deformation' }],
};
expect(spatialIntentRequestSchema.parse(request)).toEqual(request);
for (const forbidden of ['taskId', 'contextId', 'groundingId', 'previewHandle', 'translation', 'pivot', 'rotationRadians']) {
  expect(() => spatialIntentRequestSchema.parse({ ...request, [forbidden]: forbidden === 'translation' ? [0, 80] : 'x' })).toThrow();
}
```

Also test normalized Observation coordinates reject values outside `[0, 1]`, unknown union variants fail, duplicate `partKey` selection requests fail, and `explicit_numeric` accepts only `numericKey` matching `n1`, `n2`, … without a value field.

- [ ] **Step 2: Run the protocol test to prove it fails**

Run: `pnpm --filter @vectorai/drawing-edit-protocol test -- --run src/protocol.test.ts`

Expected: FAIL because `spatialIntentRequestSchema` and related exports do not exist.

- [ ] **Step 3: Implement strict schemas and types**

Use `z.strictObject` for every object arm. Define:

```ts
export const spatialReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('part'), partKey: z.string().min(1).max(64) }),
  z.strictObject({ kind: z.literal('drawing_anchor'), anchor: z.enum(['center', 'top', 'bottom', 'left', 'right']) }),
  z.strictObject({ kind: z.literal('observation_point'), normalized: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]) }),
  z.strictObject({ kind: z.literal('semantic_anchor'), query: z.string().min(1).max(160) }),
]);

export const spatialIntentRequestSchema = z.strictObject({
  summary: z.string().min(1).max(500),
  goals: z.array(spatialGoalSchema).min(1).max(32),
  preserve: z.array(preservationGoalSchema).max(32),
}).superRefine(validatePartReferences);
```

Keep `explicitNumericConstraintSchema` separate from the model request; it contains the Host-extracted value/unit/evidence span. Export `SpatialIntentRequest`, `SpatialGoal`, `PreservationGoal`, `SpatialReference`, and `ExplicitNumericConstraint` with `z.infer`.

Define `drawingSelectPartsRequestSchema` from strict `current_selection`, `observation_point`, `observation_region`, `candidate`, and `semantic_query` reference arms. Enforce 1–16 unique `partKey` values, 1–8 bounded references per part, polygons with 3–64 normalized points, and bounded exclusion arrays.

- [ ] **Step 4: Run protocol tests and typecheck**

Run:

```bash
pnpm --filter @vectorai/drawing-edit-protocol test
pnpm --filter @vectorai/drawing-edit-protocol check
```

Expected: both commands exit 0; strict-codec tests confirm forbidden fields are rejected.

- [ ] **Step 5: Commit the protocol**

```bash
git add packages/drawing-edit-protocol/src/spatial-intent.ts packages/drawing-edit-protocol/src/index.ts packages/drawing-edit-protocol/src/protocol.test.ts
git commit -m "feat(protocol): add semantic spatial intent schema"
```

---

### Task 2: Add Trusted Numeric Extraction and Episode State

**Files:**
- Create: `packages/plugin-dsh-space-host/src/numeric-instruction.ts`
- Create: `packages/plugin-dsh-space-host/src/numeric-instruction.test.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-episode.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-episode.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/intake.ts`
- Test: `packages/plugin-dsh-space-host/src/intake.test.ts`

**Interfaces:**
- Consumes: `ExplicitNumericConstraint`, trusted DSH `sessionId`, exact root message ID/text/digest, `DrawingRef`, and Host `now/id/digest` ports.
- Produces: `extractNumericConstraints(text, drawingUnit)`, `SemanticEditEpisodeStore.bindInstruction`, `.start`, `.current`, `.transition`, `.invalidate`, and `.dispose`.

- [ ] **Step 1: Write failing numeric extraction tests**

Cover Chinese and ASCII forms without interpreting qualitative words as values:

```ts
expect(extractNumericConstraints('向上移动 80 mm，再旋转 30°', 'mm')).toMatchObject([
  { numericKey: 'n1', kind: 'distance', value: 80, unit: 'mm' },
  { numericKey: 'n2', kind: 'angle', value: 30, unit: 'deg' },
]);
expect(extractNumericConstraints('把手抬高一点', 'mm')).toEqual([]);
expect(extractNumericConstraints('移动 80', 'mm')).toMatchObject([
  { numericKey: 'n1', kind: 'distance', value: 80, unit: 'mm' },
]);
```

Reject non-finite/scientific-overflow values, cap extracted constraints at 16, retain the exact bounded evidence span, and normalize `毫米/mm`, `厘米/cm`, `度/°/deg` deterministically.

- [ ] **Step 2: Write failing episode lifecycle tests**

Verify one active episode per session, root identity binding, monotonic `stateEpoch`, current-state lookup without caller IDs, canonical semantic request idempotency, and invalidation by a new root turn/revision:

```ts
const first = store.start('session-1', instructionA, drawingRef);
expect(store.current('session-1')?.episodeId).toBe(first.episodeId);
const replay = store.transition('session-1', first.stateEpoch, { kind: 'observed', observation });
expect(store.transition('session-1', replay.stateEpoch, { kind: 'observed', observation })).toEqual(replay);
store.bindInstruction('session-1', instructionB);
expect(store.current('session-1')).toBeNull();
```

- [ ] **Step 3: Run focused tests to prove they fail**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/numeric-instruction.test.ts src/semantic-episode.test.ts src/intake.test.ts
```

Expected: FAIL because the new modules and root-bound intake fields do not exist.

- [ ] **Step 4: Implement numeric extraction and episode store**

Make `SemanticEditEpisodeStore` a pure state component. Store internal IDs/digests but expose only cloned current disposition data to callers. Canonicalize request bindings with the Host digest port; rebinding the same root message ID/digest and replaying a matching semantic request are idempotent, while a different root message invalidates the old episode and a different semantic request advances the epoch.

Change `bindUserInstruction` input to include:

```ts
interface BoundUserInstruction {
  rootUserMessageId: string;
  rootUserMessageDigest: string;
  objective: string;
  numericConstraints: ExplicitNumericConstraint[];
}
```

In intake, use the exact runtime-root `directUser.id`; never infer root identity from child-agent messages. Do not inject extracted internal spans or values except the bounded public `{ numericKey, kind, value, unit }` list after Drawing activation.

- [ ] **Step 5: Run focused tests and package check**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/numeric-instruction.test.ts src/semantic-episode.test.ts src/intake.test.ts
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit Host episode foundations**

```bash
git add packages/plugin-dsh-space-host/src/numeric-instruction.ts packages/plugin-dsh-space-host/src/numeric-instruction.test.ts packages/plugin-dsh-space-host/src/semantic-episode.ts packages/plugin-dsh-space-host/src/semantic-episode.test.ts packages/plugin-dsh-space-host/src/intake.ts packages/plugin-dsh-space-host/src/intake.test.ts
git commit -m "feat(host): own semantic episode and numeric evidence"
```

---

### Task 3: Integrate Model-Directed Selection with Host Grounding

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Test: `packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Test: `packages/plugin-space-contracts/src/index.test.ts`

**Interfaces:**
- Consumes: current episode, stored Observation view, `resolveSpatialPoint`, `GroundingLedger`, `WorldModelCompiler`, current selection projection, and `DrawingSelectPartsRequest` from Task 1.
- Produces: `SemanticEditService.observeCurrent(sessionId)`, `selectCurrentParts(sessionId, request)`, `currentSelectedParts(sessionId)`, and compact `DrawingGroundingOverlay`/candidate dispositions.

- [ ] **Step 1: Write failing current-selection and Observation-reference tests**

Test these paths without passing task/context IDs:

```ts
await service.observeCurrent('session-1');
const selected = service.selectCurrentParts('session-1', {
  parts: [{ partKey: 'part-a', label: 'selected part', references: [{ kind: 'current_selection' }] }],
});
expect(selected.state).toBe('selected');
expect(service.currentSelectedParts('session-1')['part-a'].targetNodeIds).toEqual(['carrier-a']);
```

Add Observation-normalized point/region resolution tests, ambiguous candidate-key follow-up, exclusion, multiple independently moving parts, contacted endpoint discovery, revision mismatch, candidate-key expiry, and cross-session rejection. Assert the model-facing result omits exact internal UUIDs while the internal ledger retains them.

- [ ] **Step 2: Run focused tests to prove they fail**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/semantic-edit-service.test.ts`

Expected: FAIL because `observeCurrent`, `selectCurrentParts`, and current selected-part state do not exist.

- [ ] **Step 3: Implement current Observation and selection resolution**

Use the current episode as the only lineage source. Store the existing detailed Observation/context/grounding refs internally. Resolve:

- `current_selection` from the existing revision-bound projection;
- `observation_point` with `resolveSpatialPoint`, then return a bounded candidate set when multiple visible spans are within the scale-aware tolerance;
- `observation_region` through exact polygon/bounds coverage without turning overlap into automatic write scope;
- `candidate` from the current episode candidate map;
- `semantic_query` into bounded geometry/topology candidates, requiring a candidate/visual refinement when evidence is ambiguous.

Append proposal/selection/refinement events to one `GroundingLedger` per episode. Preserve existing interface inference and protected-scope digests internally. Emit only short `partKey`/candidate keys and safe summaries to the model.

- [ ] **Step 4: Update strict Client projection contracts**

Keep exact node IDs in the trusted Client Remote overlay projection, but bind them to `drawingRef + stateEpoch` and add a terminal disposition so the Client clears AI selection after commit/discard/failure. Reject unknown fields with Zod strict schemas.

- [ ] **Step 5: Run host and contract tests**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/semantic-edit-service.test.ts
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit semantic selection**

```bash
git add packages/plugin-dsh-space-host/src/semantic-edit-service.ts packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts packages/plugin-space-contracts/src/index.ts packages/plugin-space-contracts/src/index.test.ts
git commit -m "feat(host): ground model-directed semantic selections"
```

---

### Task 4: Implement the Deterministic Spatial Intent Solver

**Files:**
- Create: `packages/drawing-edit-core/src/spatial-intent-solver.ts`
- Create: `packages/drawing-edit-core/src/spatial-intent-solver.test.ts`
- Modify: `packages/drawing-edit-core/src/index.ts`

**Interfaces:**
- Consumes: `SpatialIntentRequest`, Host-resolved `partKey -> GroundedEditTarget`, Host numeric constraints, Drawing document/ref, existing connected-transform and multi-part compilers, canonical digest/time ports.
- Produces: `solveSpatialIntent(input): SpatialCompilation & { solver: SpatialSolverReceipt }` with deterministic translations/rotations, ranked candidate metrics, and stable failure codes.

- [ ] **Step 1: Write failing one-part solver tests**

Cover direction, relative position, alignment, exact extracted numeric constraint, and absence of model coordinates:

```ts
const solved = solveSpatialIntent({
  document, baseRef, parts: { hand: groundedHand },
  intent: { summary: 'move upward', goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }], preserve: [{ kind: 'connectivity', partKey: 'hand' }] },
  numericConstraints: [], ports,
});
expect(centerOf(solved.candidate, 'hand')[1]).toBeGreaterThan(centerOf(document, 'hand')[1]);
expect(solved.solver.inputsContainModelCoordinates).toBe(false);
expect(solved.inverse).not.toHaveLength(0);
```

Verify connected endpoints move to their exact solved carrier contact and untouched-node canonical digests stay equal.

- [ ] **Step 2: Write failing multi-part and topology tests**

Cover atomic two-part direction/alignment, `crosses`, `does_not_cross`, `touches`, `inside`, collision rejection, protected scopes, unsatisfiable goals, deterministic ranking, and candidate cap. Assert both parts appear in one forward/inverse batch and a failure produces no partial candidate.

- [ ] **Step 3: Run solver tests to prove they fail**

Run: `pnpm --filter @vectorai/drawing-edit-core test -- --run src/spatial-intent-solver.test.ts`

Expected: FAIL because `solveSpatialIntent` does not exist.

- [ ] **Step 4: Implement deterministic candidate generation**

Derive Drawing scale from the finite Drawing diagonal. Map qualitative magnitude to versioned scale ratios:

```ts
const MAGNITUDE_RATIO = { minimum: 0.02, slight: 0.05, moderate: 0.12, strong: 0.22 } as const;
```

These are generic solver constants, not fixture coordinates. Generate seeds from direction, relative-part/reference bounds, alignment, semantic/Observation anchors, and current positions. Add a bounded deterministic neighborhood around each seed; sort all tuples canonically and cap combined candidates at 256.

- [ ] **Step 5: Implement residuals, hard constraints, and compilation**

Score each candidate with a lexicographically stable receipt containing:

```ts
interface SpatialSolverReceipt {
  version: 'spatial-intent-solver-0.1.0';
  candidateCount: number;
  selectedRank: number;
  goalResidual: number;
  movementCost: number;
  deformationCost: number;
  collisionPenalty: number;
  topologyPenalty: number;
  solvedTransforms: Array<{ partKey: string; translation: Vec2; rotationRadians?: number }>;
  inputsContainModelCoordinates: false;
}
```

Use exact segment/bounds/topology predicates for topology goals. Treat protected-scope mutation, non-finite math, missing numeric key, structural invalidity, and impossible hard topology as rejection. Use the existing minimum-deformation connected transform for carrier orientation and endpoint transport. Compile one part through `compileSpatialEditProgram` and 2–16 parts through `compileMultiPartTransform`, then verify inverse replay before returning.

- [ ] **Step 6: Run core tests and property regressions**

Run:

```bash
pnpm --filter @vectorai/drawing-edit-core test
pnpm --filter @vectorai/drawing-edit-core check
```

Expected: all commands exit 0, including existing connected-transform and multi-part parity tests.

- [ ] **Step 7: Commit the solver**

```bash
git add packages/drawing-edit-core/src/spatial-intent-solver.ts packages/drawing-edit-core/src/spatial-intent-solver.test.ts packages/drawing-edit-core/src/index.ts
git commit -m "feat(core): solve qualitative spatial intents"
```

---

### Task 5: Connect Episode Selection to Preview, Evaluation, and Commit

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Test: `packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/durable-envelope.ts`
- Test: `packages/plugin-dsh-space-host/src/repository-persistence.test.ts`

**Interfaces:**
- Consumes: current episode/parts, `solveSpatialIntent`, current Preview/evaluation/durable commit core, current session policy and user authority.
- Produces: `previewCurrentIntent`, `reviseCurrentIntent`, `evaluateCurrentPreview`, `finalizeCurrentPreview`, `discardCurrentPreview`, and current-disposition operation replay.

- [ ] **Step 1: Write failing current-episode preview tests**

Exercise the entire service without an externally supplied handle:

```ts
await service.observeCurrent('session-1');
service.selectCurrentParts('session-1', selection);
const first = service.previewCurrentIntent('session-1', intent);
const replay = service.previewCurrentIntent('session-1', intent);
expect(replay.candidateDigest).toBe(first.candidateDigest);
expect(replay.previewHandle).toBe(first.previewHandle);
```

Add tests for a different semantic revision replacing the current Preview, candidate budget, revision invalidation, concurrent interactive commit, no-effect, failed solver, and multi-part one-commit/one-Undo round trip.

- [ ] **Step 2: Write failing evaluation/finalization tests**

Verify evaluate/finalize/discard resolve the internal current Preview and operation binding; response-loss replay returns the same durable receipt; hard-invalid results remain blocked; confirmation and auto-safe remain distinct; terminal states clear transient selection.

- [ ] **Step 3: Run focused tests to prove they fail**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/semantic-edit-service.test.ts src/repository-persistence.test.ts`

Expected: FAIL because current-episode preview/finalize methods do not exist.

- [ ] **Step 4: Implement current-episode write APIs**

Resolve all internal handles from `SemanticEditEpisodeStore` immediately before each action. Bind operation identity to `{ episodeId, stateEpoch, operationKind, canonicalSemanticRequestDigest, drawingRef, candidateDigest? }`. Reuse existing Preview storage, evaluation/reviewer, assessment, confirmation, commit envelope, receipt, inverse, and Undo implementations.

Do not delete the internal low-level methods until parity tests pass; make them private/test-only and remove them from the production tool catalog in Task 6.

- [ ] **Step 5: Persist solver provenance**

Add solver version, canonical intent digest, selected-part scope digests, numeric evidence digests, and `SpatialSolverReceipt` to durable review/commit evidence. Do not store transient DSH attachment IDs as the only evidence. Replay must reproduce the candidate semantic digest from the durable intent, resolved scopes, Drawing base, and solver version.

- [ ] **Step 6: Run host persistence and semantic tests**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/semantic-edit-service.test.ts src/repository-persistence.test.ts
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit episode-backed writes**

```bash
git add packages/plugin-dsh-space-host/src/semantic-edit-service.ts packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts packages/plugin-dsh-space-host/src/durable-envelope.ts packages/plugin-dsh-space-host/src/repository-persistence.test.ts
git commit -m "feat(host): commit solved intents from current episode"
```

---

### Task 6: Cut Over the DSH Model Tool Catalog

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Test: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/intake.ts`
- Test: `packages/plugin-dsh-space-host/src/intake.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Test: `packages/plugin-dsh-space-host/src/typert.test.ts`

**Interfaces:**
- Consumes: Task 3/5 current-episode service APIs and Task 1 strict schemas.
- Produces: production catalog containing `drawing_observe`, `drawing_select_parts`, `drawing_preview_spatial_intent`, `drawing_revise_spatial_intent`, `drawing_evaluate_preview`, `drawing_finalize_preview`, `drawing_discard_preview`, parameterless current-operation recovery through `drawing_get_operation`, and `drawing_undo_commit`.

- [ ] **Step 1: Write failing catalog boundary tests**

Assert the production tool names exactly match the expected high-level set and inspect every parameter schema recursively:

```ts
expect(catalog.map(({ name }) => name)).not.toEqual(expect.arrayContaining([
  'drawing_build_context',
  'drawing_ground',
  'drawing_preview_grounded_transform',
  'drawing_preview_multi_part_transform',
  'drawing_preview_program',
]));
expect(JSON.stringify(catalog.map(({ parameters }) => parameters))).not.toMatch(
  /taskId|contextId|groundingId|previewHandle|candidateDigest|translation|pivot|rotationRadians/,
);
```

Add invocation tests that perform observe → select → preview → evaluate → finalize without reading/copying any internal identifier, plus compact-result size assertions and wrong-state recovery dispositions.

- [ ] **Step 2: Run tool tests to prove they fail**

Run: `pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/tools.test.ts src/intake.test.ts src/typert.test.ts`

Expected: FAIL because the production catalog still exposes legacy lineage and numeric tools.

- [ ] **Step 3: Replace model-visible tool definitions**

Parse `drawing_select_parts`, `drawing_preview_spatial_intent`, and revision arguments through Task 1 Zod schemas before calling the service. Keep tool outputs below 16 KB of text excluding the single image attachment. Return semantic summaries, solver/evaluation diagnostics, current state, and next tools; omit whole-Drawing geometry arrays and all internal IDs/digests.

Make evaluate/finalize/discard parameter objects empty. Keep `drawing_get_operation` only as an empty-parameter current-episode recovery lookup; the Host resolves the internal operation ID/binding digest and the model never receives or constructs either value.

- [ ] **Step 4: Remove fixed workflow and selection IDs from intake**

The conditional hint may say that a verified selection exists and how many nodes it covers, but it must not print selection handles or node IDs. It may name high-level capabilities, not prescribe a fixed full sequence. Unrelated user turns still receive no Drawing mutation instruction.

- [ ] **Step 5: Verify strict Typert registration**

Ensure every model-visible request/result is backed by a Zod v4 strict schema accepted by the rc.8 typert loader. Keep DSH-specific attachment presentation in the adapter rather than provider-neutral protocol packages.

- [ ] **Step 6: Run complete Host tests and check**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: all commands exit 0 and no catalog test finds a forbidden lineage/coordinate field.

- [ ] **Step 7: Commit the catalog cutover**

```bash
git add packages/plugin-dsh-space-host/src/semantic-tools.ts packages/plugin-dsh-space-host/src/tools.test.ts packages/plugin-dsh-space-host/src/intake.ts packages/plugin-dsh-space-host/src/intake.test.ts packages/plugin-dsh-space-host/src/service.ts packages/plugin-dsh-space-host/src/typert.test.ts
git commit -m "feat(dsh): expose host-owned semantic edit tools"
```

---

### Task 7: Keep AI Selection and Client State Episode-Bound

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Test: `packages/plugin-dsh-space-client/src/client-view.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Test: `packages/plugin-dsh-space-client/src/remote.test.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Test: `packages/plugin-space-contracts/src/index.test.ts`

**Interfaces:**
- Consumes: trusted current Grounding overlay projection with Drawing ref/state epoch/terminal disposition.
- Produces: transient blinking AI selection distinct from user selection, with deterministic clearing on every episode terminal/invalidation state.

- [ ] **Step 1: Write failing Client lifecycle tests**

Verify selected nodes blink with the AI-selection class while the episode is active, user selection styling remains separate, replacement swaps the set atomically, and commit/discard/blocked/reobserve/session change clears all AI selection and dashed Preview decoration.

- [ ] **Step 2: Run Client tests to prove they fail**

Run: `pnpm --filter @vectorai/plugin-dsh-space-client test -- --run src/client-view.test.tsx src/remote.test.ts`

Expected: FAIL until the new episode disposition/epoch is consumed.

- [ ] **Step 3: Implement strict projection and clearing**

Poll/project only the current trusted Remote state. Ignore an overlay whose drawing ref or epoch no longer matches the current workspace. Do not add part labels, orange/purple colors, or permanent annotations. Clear Preview dashed state when the Host reports a terminal disposition even if the conversation response is delayed.

- [ ] **Step 4: Run Client and contract tests**

Run:

```bash
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/plugin-dsh-space-client check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Client episode projection**

```bash
git add packages/plugin-dsh-space-client/src/client.tsx packages/plugin-dsh-space-client/src/client-view.test.tsx packages/plugin-dsh-space-client/src/remote.ts packages/plugin-dsh-space-client/src/remote.test.ts packages/plugin-space-contracts/src/index.ts packages/plugin-space-contracts/src/index.test.ts
git commit -m "fix(client): bind AI selection to semantic episode"
```

---

### Task 8: Add End-to-End Regression and Forced-Compaction Coverage

**Files:**
- Create: `scripts/e2e-host-owned-semantic-edit.ts`
- Modify: `package.json`
- Modify: `packages/plugin-dsh-space-host/src/semantic-parity.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`

**Interfaces:**
- Consumes: final model-visible catalog and shared solver.
- Produces: repeatable local regression command and parity proof for DSH/Web-neutral semantics.

- [ ] **Step 1: Write the failing end-to-end script**

The script must:

1. load a generic Drawing fixture through the repository;
2. bind a qualitative root instruction;
3. call only the final model-visible tool signatures;
4. select two parts through current selection/Observation references;
5. request a generic multi-part relation/direction intent without numeric coordinates;
6. evaluate and finalize one atomic Preview;
7. verify the durable commit and Undo round trip;
8. scan captured model request arguments for forbidden lineage/coordinate keys;
9. discard presentation messages between each step to simulate context compaction while retaining Host state;
10. repeat the same semantic input and verify deterministic candidate/commit digests.

- [ ] **Step 2: Run the script to prove it fails**

Run: `pnpm tsx scripts/e2e-host-owned-semantic-edit.ts`

Expected: FAIL until Tasks 1–7 provide the final catalog and current-episode flow.

- [ ] **Step 3: Add parity and anti-special-case tests**

Assert the shared solver produces the same candidate digest when called through the direct core adapter and DSH Host adapter. Scan production TypeScript in protocol/core/Host packages for fixture node IDs, fixture coordinates, character names, and gesture-specific operation names used by test inputs; fail with the matched path and line.

- [ ] **Step 4: Register and run end-to-end command**

Add:

```json
"e2e:host-owned-semantic-edit": "tsx scripts/e2e-host-owned-semantic-edit.ts"
```

Run:

```bash
pnpm e2e:host-owned-semantic-edit
pnpm --filter @vectorai/plugin-dsh-space-host test -- --run src/semantic-parity.test.ts src/tools.test.ts
```

Expected: commands exit 0; the E2E reports one commit, one successful Undo, zero forbidden keys, and deterministic replay.

- [ ] **Step 5: Commit E2E coverage**

```bash
git add scripts/e2e-host-owned-semantic-edit.ts package.json packages/plugin-dsh-space-host/src/semantic-parity.test.ts packages/plugin-dsh-space-host/src/tools.test.ts
git commit -m "test: cover host-owned semantic edit flow"
```

---

### Task 9: Update Architecture Docs, Build, Pack, and Smoke Test DSH

**Files:**
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: all completed implementation tasks.
- Produces: accurate migration status, a built plugin bundle, and a local DSH runtime smoke result.

- [ ] **Step 1: Update documentation to the production truth**

Record the final model-visible tool names, Host-owned episode rule, numeric evidence rule, solver responsibility, multi-part atomic behavior, and legacy catalog removal. Remove statements implying ordinary pose tools accept model displacement or that the model must replay task/context/Preview handles.

- [ ] **Step 2: Run focused package gates**

Run:

```bash
pnpm --filter @vectorai/drawing-edit-protocol test && pnpm --filter @vectorai/drawing-edit-protocol check
pnpm --filter @vectorai/drawing-edit-core test && pnpm --filter @vectorai/drawing-edit-core check
pnpm --filter @vectorai/plugin-space-contracts test && pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-space-host test && pnpm --filter @vectorai/plugin-dsh-space-host check
pnpm --filter @vectorai/plugin-dsh-space-client test && pnpm --filter @vectorai/plugin-dsh-space-client check
```

Expected: every command exits 0.

- [ ] **Step 3: Run repository gates and build plugin artifacts**

Run:

```bash
pnpm test
pnpm check
pnpm build:dsh-space
pnpm e2e:host-owned-semantic-edit
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Verify dependency and package boundaries**

Pack the first-layer Host, Client, and annotation example packages into a temporary directory, install them into a clean temporary consumer, and import their public entry points. Verify the annotation package consumes only public first-layer contracts and no package deep-imports Host internals.

- [ ] **Step 5: Restart local DSH and run a runtime smoke test**

Restart `/Users/sidhu/Applications/DSH.app`, open a fresh Drawing edit session, and run one qualitative single-part and one qualitative multi-part request. Inspect the session log and assert:

- request context uses the configured model window;
- no tool call contains a legacy lineage/coordinate field;
- no `EDIT_TASK_STALE` or `EDIT_LINEAGE_MISMATCH` occurs;
- model-selected parts appear as transient blinking AI selection;
- one Preview is evaluated and terminal UI state clears;
- committed result can be undone.

- [ ] **Step 6: Commit docs and verified cutover**

```bash
git add docs/dsh-plugin-migration.md docs/prd.md docs/tech-architecture.md
git commit -m "docs: complete host-owned semantic edit migration"
```

- [ ] **Step 7: Record final verification evidence**

Run:

```bash
git status --short
git log --oneline -12
```

Expected: clean working tree and the task commits listed in order.
