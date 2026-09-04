# Recognition Pipeline Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every automatic engineering recognition path through one Host-owned pipeline registry and make production plus contract evaluation execute the same domain implementations.

**Architecture:** Add deterministic annotation-planning and axial-dimension pipelines beside the existing partition and shaft-GD&T pipelines. `DrawingAnnotationHostService` constructs one runner and injects thin runner closures into tools and persistence services; pipeline modules own recognition and calculation, while services retain mutation, history, and persistence. Contract cases and a live DSH probe exercise those same registered objects without copying production algorithms.

**Tech Stack:** TypeScript 5.8, Vitest 3, Cordis 4.0.2, DSH 0.1.2-alpha.5, pnpm 8 workspace scripts.

**Spec:** `docs/superpowers/specs/2026-09-04-recognition-pipeline-completion-design.md`

## Global Constraints

- `createAnnotationRecognitionRunner()` is the only production pipeline composition root.
- Production services and tools may not import or call low-level recognition algorithms directly.
- Partition and shaft functional-feature review are the only pipelines allowed to call `RecognitionModelPort`.
- Models cannot choose coordinates, dimensions, datum precedence, GD&T characteristics, tolerance values, roughness values, or annotation anchors.
- Pipelines do not write Drawing, partition, dimension-plan, or annotation-session state.
- Existing UI, persistence schemas, editing, undo/redo, confirmation, stale-revision, and export behavior remain unchanged.
- Production and evaluation call the same registered `RecognitionPipeline` object.
- The DSH compatibility baseline remains exactly `0.1.2-alpha.5`.
- Every affected Host source change is followed by `pnpm build:dsh-annotation` before handoff.

---

### Task 1: Deterministic Engineering Annotation Pipeline

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/deterministic-annotation-pipeline.ts`
- Create: `packages/plugin-dsh-annotation-host/src/deterministic-annotation-pipeline.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/deterministic-annotation-recognition-contract.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/index.ts`

**Interfaces:**
- Consumes: `planEngineeringAnnotations`, `RecognitionPipeline`, and `RecognitionPipelineRunner`.
- Produces:

```ts
export const DETERMINISTIC_ANNOTATION_PIPELINE_ID = 'deterministic-engineering-annotation-plan';
export const DETERMINISTIC_ANNOTATION_PIPELINE_VERSION = '1';

export interface DeterministicAnnotationPipelineInput {
  document: DrawingDocument;
  ref: DrawingRef;
  objective: string;
  annotationKinds: readonly DeterministicAnnotationKind[];
}

export type EngineeringAnnotationPlanner = (
  input: DeterministicAnnotationPipelineInput,
  signal?: AbortSignal,
) => Promise<EngineeringAnnotationPlan>;

export function createDeterministicAnnotationPipeline():
  RecognitionPipeline<DeterministicAnnotationPipelineInput, EngineeringAnnotationPlan>;

export function createEngineeringAnnotationPlanner(
  runner: RecognitionPipelineRunner,
): EngineeringAnnotationPlanner;
```

- [ ] **Step 1: Write the failing pipeline test**

Import a confirmed geometry fixture and assert that running the desired pipeline returns the exact result of the existing authoritative planner while never calling the model:

```ts
const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN'); });
const runner = new RecognitionPipelineRunner({ review } as RecognitionModelPort);
runner.register(createDeterministicAnnotationPipeline());

const run = await runner.run(DETERMINISTIC_ANNOTATION_PIPELINE_ID, {
  document,
  ref,
  objective: '工程图纸自动标注集',
  annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
});

expect(run.output).toEqual(planEngineeringAnnotations({
  document, ref, objective: '工程图纸自动标注集',
  annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
}));
expect(run.trace).toContainEqual(expect.objectContaining({
  id: 'deterministic-annotation-plan', kind: 'deterministic', status: 'completed',
}));
expect(review).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run src/deterministic-annotation-pipeline.test.ts
```

Expected: FAIL because `deterministic-annotation-pipeline.ts` and its exports do not exist.

- [ ] **Step 3: Implement the pipeline and stable normalizer**

Call `planEngineeringAnnotations(input)` exactly once. Record one deterministic stage whose digest includes the pipeline input reference, requested kinds, and stable output facts. Normalize only domain output:

```ts
normalize: (output) => ({
  annotations: output.annotations.map(normalizeAnnotation),
  associations: output.associations.map(normalizeAssociation),
  pending: structuredClone(output.pending),
  suppressed: structuredClone(output.suppressed),
  hasProgram: output.program !== null,
})
```

`normalizeAnnotation` retains IDs, node/dimension kinds, numeric values, targets, definition points, and text positions. It must not retain document bytes or arbitrary session data.

- [ ] **Step 4: Register the pipeline once and add the production-shaped contract case**

Register the new factory in `createAnnotationRecognitionRunner()`. The contract test imports `golden-shaft-001/initial.dxf`, evaluates three attempts with all four kinds, asserts stable annotation IDs, values, target geometry, and definition points, and asserts `review` was never called. Update the composition test to expect:

```ts
[
  'partition-semantic-review',
  'deterministic-engineering-annotation-plan',
  'shaft-gdt-semantic-review',
]
```

- [ ] **Step 5: Run focused and existing deterministic regressions**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/deterministic-annotation-pipeline.test.ts \
  src/deterministic-annotation-recognition-contract.test.ts \
  src/annotation-recognition-runtime.test.ts
pnpm --filter @vectorai/engineering-annotation exec vitest run \
  src/opening-angle/sample.integration.test.ts \
  src/diameter/measure.test.ts \
  src/plan.test.ts
```

Expected: all selected tests pass and no model call occurs.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-annotation-host/src/deterministic-annotation-pipeline.ts \
  packages/plugin-dsh-annotation-host/src/deterministic-annotation-pipeline.test.ts \
  packages/plugin-dsh-annotation-host/src/deterministic-annotation-recognition-contract.test.ts \
  packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.ts \
  packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.test.ts \
  packages/plugin-dsh-annotation-host/src/index.ts
git commit -m "feat(annotation): register deterministic annotation recognition"
```

### Task 2: Route Every Basic Annotation Tool Through the Registry

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts`

**Interfaces:**
- Consumes: `EngineeringAnnotationPlanner` and `createEngineeringAnnotationPlanner(runner)` from Task 1.
- Produces: all automatic/basic annotation tool calls await the injected production planner; `tools.ts` no longer imports `planEngineeringAnnotations`.

- [ ] **Step 1: Write failing tool and boundary tests**

Add a tool test with an injected planner spy that returns a real `EngineeringAnnotationPlan`. Execute the tool and assert the planner received the exact current snapshot, drawing ref, objective, and kind list. Add a boundary assertion:

```ts
const tools = readFileSync(join(directory, 'tools.ts'), 'utf8');
expect(tools).not.toContain('planEngineeringAnnotations');
expect(tools).toContain('EngineeringAnnotationPlanner');
```

Update `automatic-annotation-flow.integration.test.ts` so the runner lists the deterministic pipeline and the automatic tool receives `createEngineeringAnnotationPlanner(recognition)`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/tools.test.ts src/dependency-boundary.test.ts \
  src/automatic-annotation-flow.integration.test.ts
```

Expected: FAIL because the tool still imports and calls `planEngineeringAnnotations` directly.

- [ ] **Step 3: Require the injected planner in tool factories**

Change `createEngineeringAnnotationTool` to receive `planner: EngineeringAnnotationPlanner`, then replace the direct call with:

```ts
const plan = await planner({
  document: snapshot.document,
  ref: snapshot.ref,
  objective: options.objective,
  annotationKinds: options.annotationKinds,
}, exec.signal);
```

Pass the same planner through `createOpeningAngleAnnotationTool` and `createDiameterAnnotationTool`. Do not provide a direct-algorithm fallback.

- [ ] **Step 4: Wire the one production planner**

In `DrawingAnnotationHostService`, create one closure from `this.recognition` and inject it into automatic, opening-angle, and diameter tool construction. Update tests to create their planners from registered runners or to inject an explicit test planner; test code must not reproduce recognition logic.

- [ ] **Step 5: Run Host tool and full-flow regressions**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/tools.test.ts src/dependency-boundary.test.ts \
  src/automatic-annotation-flow.integration.test.ts
```

Expected: all selected tests pass, automatic output is unchanged, and the model spy remains unused for deterministic planning.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-annotation-host/src/tools.ts \
  packages/plugin-dsh-annotation-host/src/tools.test.ts \
  packages/plugin-dsh-annotation-host/src/service.ts \
  packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts \
  packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts
git commit -m "refactor(annotation): route basic annotations through recognition runtime"
```

### Task 3: Axial Dimension Inference Pipeline and Production Migration

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/axial-dimension-pipeline.ts`
- Create: `packages/plugin-dsh-annotation-host/src/axial-dimension-pipeline.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/axial-dimension-recognition-contract.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-inference-service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-inference-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/index.ts`

**Interfaces:**
- Consumes: current drawing snapshot, current `PartitionDraft | PartitionRevision`, staged engineering text, policy ID, and the existing engineering-annotation functions.
- Produces:

```ts
export const AXIAL_DIMENSION_PIPELINE_ID = 'axial-dimension-inference';
export const AXIAL_DIMENSION_PIPELINE_VERSION = '1';

export interface AxialDimensionPipelineInput {
  drawing: DrawingWorkspaceSnapshot;
  partition: PartitionDraft | PartitionRevision;
  engineeringText: string;
  policyId: AxialInferencePolicy['id'];
}

export type AxialDimensionInference = (
  input: AxialDimensionPipelineInput,
  signal?: AbortSignal,
) => Promise<EngineeringAnnotationDraft>;

export function createAxialDimensionPipeline():
  RecognitionPipeline<AxialDimensionPipelineInput, EngineeringAnnotationDraft>;

export function createAxialDimensionInference(
  runner: RecognitionPipelineRunner,
): AxialDimensionInference;
```

- [ ] **Step 1: Write the failing pure-pipeline test**

Move no code yet. Build the same drawing, partition, and engineering text used by `dimension-inference-service.test.ts`; assert that the desired pipeline returns a projection with the current policy, candidates, displayed dimensions, and document evidence. Assert the model is not called and the trace contains these ordered deterministic stages:

```ts
[
  'dimension-partition-validation',
  'dimension-document-normalization',
  'dimension-topology',
  'dimension-candidates',
  'dimension-inference',
  'dimension-projection',
]
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run src/axial-dimension-pipeline.test.ts
```

Expected: FAIL because the axial pipeline does not exist.

- [ ] **Step 3: Move the exact calculation sequence into the pipeline**

Move `assertPartitionGeometryCurrent` and `normalizeDocumentCoordinates` from `dimension-inference-service.ts` into the new pipeline module. Keep the existing call order and arguments:

```ts
const parsed = normalizeDocumentCoordinates(
  parseEngineeringDocument(input.engineeringText),
  input.drawing.document.unitSystem.length,
);
const topology = buildAxialTopology({
  partition: input.partition,
  document: input.drawing.document,
  unit: input.drawing.document.unitSystem.length,
});
const candidateSet = generateAxialDimensionCandidates({
  topology, partition: input.partition, document: parsed,
});
const scheme = inferAxialDimensionScheme({
  topology, candidateSet, policy: policyById(input.policyId),
  ...('id' in input.partition ? { partitionRevisionId: input.partition.id } : {}),
});
return projectAxialDimensionScheme({ scheme });
```

Record a digest for every stage. The normalizer returns the complete normalized scheme and projection facts, never raw engineering text.

- [ ] **Step 4: Register and contract-test the production pipeline**

Register it between deterministic annotation planning and GD&T. Update the composition assertion to exactly:

```ts
[
  'partition-semantic-review',
  'deterministic-engineering-annotation-plan',
  'axial-dimension-inference',
  'shaft-gdt-semantic-review',
]
```

The contract test imports `golden-shaft-001/initial.dxf` and `engineering-data.ini`, uses its real confirmed partition, evaluates the registered pipeline for three attempts, and asserts the expected stable intervals, chain equations, evidence-backed candidates, absence of micro-spans, and zero model calls.

- [ ] **Step 5: Make `DimensionInferenceService` a persistence adapter**

Inject `AxialDimensionInference` into the service. `start()` remains responsible for resolving the current session, drawing, partition, base draft, and store, but awaits the pipeline for the projection:

```ts
const projection = await this.infer({
  drawing,
  partition: domainPartition,
  engineeringText: this.documents.getStagedEngineeringText(agent) ?? '',
  policyId,
});
this.plans.begin(sessionId, drawing.ref);
return this.plans.setDraft(sessionId, mergeAxialDimensionProjection(base, projection));
```

Change `start()` to `Promise<DimensionPlanSessionSnapshot>`. Update `createDimensionChainStartTool` to accept a promise and await it, and update automatic annotation to await dimension inference before starting GD&T. Existing editing, confirm, cancel, undo, redo, and stale methods remain synchronous and unchanged.

- [ ] **Step 6: Update service tests for asynchronous production execution**

Construct a real registered runner in the test fixture and inject `createAxialDimensionInference(runner)`. Convert only `start()` tests to `async`/`await`. Retain assertions for missing/stale partition errors, unit normalization, existing datum/GD&T preservation, tolerance handoff, and document evidence.

- [ ] **Step 7: Run dimension and automatic-flow regressions**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/axial-dimension-pipeline.test.ts \
  src/axial-dimension-recognition-contract.test.ts \
  src/dimension-inference-service.test.ts \
  src/tools.test.ts \
  src/automatic-annotation-flow.integration.test.ts \
  src/annotation-recognition-runtime.test.ts
pnpm --filter @vectorai/engineering-annotation exec vitest run \
  src/dimension-inference/golden.integration.test.ts \
  src/dimension-inference/external-golden.integration.test.ts
```

Expected: all selected tests pass and model review is never called by the dimension pipeline.

- [ ] **Step 8: Commit**

```bash
git add packages/plugin-dsh-annotation-host/src/axial-dimension-pipeline.ts \
  packages/plugin-dsh-annotation-host/src/axial-dimension-pipeline.test.ts \
  packages/plugin-dsh-annotation-host/src/axial-dimension-recognition-contract.test.ts \
  packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.ts \
  packages/plugin-dsh-annotation-host/src/annotation-recognition-runtime.test.ts \
  packages/plugin-dsh-annotation-host/src/dimension-inference-service.ts \
  packages/plugin-dsh-annotation-host/src/dimension-inference-service.test.ts \
  packages/plugin-dsh-annotation-host/src/tools.ts \
  packages/plugin-dsh-annotation-host/src/service.ts \
  packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts \
  packages/plugin-dsh-annotation-host/src/index.ts
git commit -m "refactor(annotation): run dimension inference through recognition runtime"
```

### Task 4: Complete Domain Contracts and Enforce the Single Source

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/gdt-recognition-contract.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: all four registered pipelines and the existing golden/educational fixtures.
- Produces: contract coverage for datum, GD&T, and roughness plus source-level guards against recognition bypasses.

- [ ] **Step 1: Write the failing GD&T contract and source-boundary assertions**

Create the runner through `createAnnotationRecognitionRunner()`, then evaluate `GDT_SEMANTIC_PIPELINE_ID` on the maintained golden partition for three attempts. Assert final production `GdtRecommendation` facts:

```ts
expect(output.datums.map(({ name, geometryId }) => ({ name, geometryId }))).toEqual(expectedDatums);
expect(output.controls).toEqual(expect.arrayContaining([
  expect.objectContaining({ characteristic: 'total-runout', datumNames: ['A', 'B'] }),
]));
expect(output.surfaceTextures).toEqual(expect.arrayContaining([
  expect.objectContaining({ parameter: 'Ra', value: 0.8 }),
]));
```

Assert each roughness geometry ID belongs to the same cylindrical functional surface selected by the production grounder. Do not reproduce selection logic in the test; derive expected IDs from the maintained fixture manifest or explicit approved contract data.

Extend the boundary test to scan non-test Host source files. Permit low-level imports only in:

```ts
[
  'deterministic-annotation-pipeline.ts',
  'axial-dimension-pipeline.ts',
  'semantic-reviewer.ts',
  'gdt-reviewer.ts',
]
```

Fail if any other source calls the guarded low-level functions or DSH recognition seams.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/gdt-recognition-contract.test.ts \
  src/dependency-boundary.test.ts \
  src/automatic-annotation-flow.integration.test.ts
```

Expected: FAIL until the new contract and complete four-pipeline boundary are present.

- [ ] **Step 3: Complete the automatic-flow assertion**

Use one runner for deterministic planning, axial dimensions, and GD&T in the full automatic integration test. Assert `runner.list()` contains exactly four pipelines and the final draft contains the expected dimension-chain, datum, GD&T, and roughness results. Assert the fake model port remains unused for the documented golden fixture.

- [ ] **Step 4: Document the final production boundary**

Update `docs/tech-architecture.md` with the four pipeline IDs, the distinction between the global registry and domain implementations, and the rule that services own persistence but cannot own recognition algorithms.

- [ ] **Step 5: Run all recognition and golden contracts**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host exec vitest run \
  src/recognition-runtime.test.ts \
  src/partition-recognition-contract.test.ts \
  src/deterministic-annotation-recognition-contract.test.ts \
  src/axial-dimension-recognition-contract.test.ts \
  src/gdt-recognition-contract.test.ts \
  src/automatic-annotation-flow.integration.test.ts \
  src/dependency-boundary.test.ts
```

Expected: all four production pipelines are evaluated, deterministic cases make zero model calls, and no source boundary is bypassed.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-annotation-host/src/gdt-recognition-contract.test.ts \
  packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts \
  packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts \
  docs/tech-architecture.md
git commit -m "test(annotation): enforce recognition pipeline contracts"
```

### Task 5: Repository-Owned Live DSH Probe and Final Verification

**Files:**
- Create: `scripts/probe-dsh-recognition-runtime.mjs`
- Create: `scripts/probe-dsh-recognition-runtime.test.mjs`
- Modify: `package.json`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: the freshly built `packages/plugin-dsh-annotation/lib/index.js` and installed Headless DSH profile.
- Produces: `pnpm probe:dsh-recognition`, a real provider-backed compatibility check whose local result contains only sanitized facts.

- [ ] **Step 1: Write the failing probe-serialization test**

Export pure helpers from the script for creating the temporary plugin source, validating the two JSONL records, and formatting the safe summary. The test supplies a fake runtime/result record containing exact versions, one observation, and SHA-256 digests, then asserts validation succeeds. It also supplies records containing prompt/persona markers and asserts validation rejects them.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test scripts/probe-dsh-recognition-runtime.test.mjs
```

Expected: FAIL because the repository-owned probe module does not exist.

- [ ] **Step 3: Implement the opt-in probe command**

The script must:

1. require a freshly built annotation bundle;
2. create an isolated run directory below `.local/dsh-recognition-probe`;
3. generate a temporary DSH patch and probe plugin that import `createDshRecognitionModelAdapter` from the built bundle;
4. invoke the configured Headless DSH CLI through `spawn`, never a shell string;
5. make one bounded structured child request with a 60-second timeout;
6. validate exact DSH versions, compatibility, stop reason, structured marker, at least one observation, and SHA-256 request digests;
7. reject output containing probe prompt or persona text;
8. print only provider, model, reasoning effort, versions, and pass/fail status.

Add the root script:

```json
"probe:dsh-recognition": "node scripts/probe-dsh-recognition-runtime.mjs"
```

The script may accept `VECTORAI_DSH_CLI` as an explicit development override. Otherwise it resolves the configured profile CLI from the current user's DSH directory. It must not inspect or print credentials, provider headers, or environment values.

- [ ] **Step 4: Run unit and real probe verification**

Run:

```bash
node --test scripts/probe-dsh-recognition-runtime.test.mjs
pnpm build:dsh-annotation
pnpm probe:dsh-recognition
```

Expected: unit test passes, the bundle builds, and the live command reports `compatible=true`, exact `0.1.2-alpha.5` versions, a completed structured result, one or more sanitized observations, and no prompt/persona text.

- [ ] **Step 5: Run the full affected verification matrix**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-host check
pnpm --filter @vectorai/engineering-annotation test
pnpm build:dsh-annotation
pnpm check:dsh-build-freshness
git diff --check
rg -n "subagents\.start|agent/request|llm/stream" packages/plugin-dsh-annotation/lib/index.js
```

Expected: zero failed tests, type-check and builds exit 0, bundle freshness passes, and the built annotation bundle contains one centralized group of DSH recognition seams in the adapter.

- [ ] **Step 6: Commit**

```bash
git add scripts/probe-dsh-recognition-runtime.mjs \
  scripts/probe-dsh-recognition-runtime.test.mjs \
  package.json docs/tech-architecture.md
git commit -m "test(annotation): add live recognition runtime probe"
```
