# Recognition Evaluation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one versioned recognition runtime that production and tests use to execute complete local-plus-model annotation pipelines, with all DSH request and subagent coupling isolated behind one adapter.

**Architecture:** A DSH-free runner owns pipeline registration, sanitized traces, fingerprints, and contract evaluation. One Host adapter owns the installed DSH `agent/request`, `llm/stream`, attachment, and subagent seams. The existing partition and GD&T reviewers become versioned pipelines registered once by `DrawingAnnotationHostService` and retain their current local policy and fallback behavior.

**Tech Stack:** TypeScript 5.8, Vitest 3, Cordis 4.0.2, DSH 0.1.2-alpha.5, pnpm 8 workspace scripts.

**Spec:** `docs/superpowers/specs/2026-09-04-recognition-evaluation-runtime-design.md`

## Global Constraints

- DSH compatibility baseline is exactly `0.1.2-alpha.5`.
- Only `dsh-recognition-model-adapter.ts` may call recognition-related DSH subagent and request-observation seams.
- Models remain bounded semantic reviewers; all geometry, arithmetic, tolerance values, datum precedence, GD&T controls, and grounding remain local.
- Production and evaluation must execute the same registered pipeline object.
- Evaluation artifacts never contain prompt text, system text, image bytes, document text, credentials, environment values, or provider headers.
- Existing Drawing, partition, dimension-plan, preview, confirmation, export, and stale-revision behavior remains unchanged.
- No user-visible status or evaluation UI is added.
- Every affected Host source change is followed by `pnpm build:dsh-annotation` before handoff.

---

### Task 1: DSH-free pipeline runner and evaluator

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/recognition-runtime.ts`
- Create: `packages/plugin-dsh-annotation-host/src/recognition-runtime.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/index.ts`

**Interfaces:**
- Produces `RecognitionModelPort`, `RecognitionPipeline`, `RecognitionPipelineRunner`, `RecognitionContractCase`, `RecognitionEvaluationReport`, and `createRecognitionFingerprint`.
- Later tasks supply one `RecognitionModelPort` and register typed pipelines with `RecognitionPipelineRunner.register()`.

- [ ] **Step 1: Write the failing runner and evaluator tests**

```ts
it('runs production and evaluation through the same registered pipeline', async () => {
  let executions = 0;
  const noModelPort: RecognitionModelPort = {
    review: async () => { throw new Error('model must not run'); },
  };
  const runner = new RecognitionPipelineRunner(noModelPort);
  runner.register({
    id: 'fixture', version: '1',
    async execute(input: number, context) {
      executions += 1;
      context.record({ id: 'local', kind: 'deterministic', status: 'completed', digest: 'sha256:local' });
      return input * 2;
    },
    normalize: (output) => ({ value: output }),
  });

  expect((await runner.run<number, number>('fixture', 3)).output).toBe(6);
  const report = await runner.evaluate({
    id: 'case-1', pipelineId: 'fixture', input: 4, attempts: 2,
    assert: (output) => output === 8 ? [] : ['wrong output'],
  });

  expect(report.passed).toBe(true);
  expect(executions).toBe(3);
});
```

Also assert duplicate pipeline IDs fail, unknown IDs fail, traces contain no supplied raw input, three-attempt failures are reported independently, and fingerprints change when DSH route, pipeline version, policy digest, or fixture digest changes.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/recognition-runtime.test.ts --reporter=verbose`

Expected: FAIL because `./recognition-runtime` does not exist.

- [ ] **Step 3: Implement the minimal DSH-free contracts**

```ts
export type RecognitionPromptPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly data: Uint8Array; readonly mediaType: 'image/png'; readonly name: string };

export interface RecognitionModelRequest<TStructured> {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly parentSessionId: string;
  readonly prompt: readonly RecognitionPromptPart[];
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly persona?: string;
  readonly maxDepth: number;
  readonly maxTokens?: number;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface RecognitionModelPort {
  review<TStructured>(request: RecognitionModelRequest<TStructured>): Promise<RecognitionModelResult<TStructured>>;
}

export interface RecognitionPipeline<I, O> {
  readonly id: string;
  readonly version: string;
  execute(input: I, context: RecognitionRunContext): Promise<O>;
  normalize(output: O): unknown;
}
```

Implement a registry-backed runner, sanitized trace collection, exact attempt accounting, and SHA-256 fingerprinting over canonical JSON metadata only.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/recognition-runtime.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 5: Export the stable Host-owned contracts and commit**

```bash
git add packages/plugin-dsh-annotation-host/src/recognition-runtime.ts \
  packages/plugin-dsh-annotation-host/src/recognition-runtime.test.ts \
  packages/plugin-dsh-annotation-host/src/index.ts
git commit -m "feat(annotation): add shared recognition pipeline runtime"
```

### Task 2: Single DSH model adapter

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.ts`
- Create: `packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts`

**Interfaces:**
- Consumes `RecognitionModelPort` and `RecognitionModelRequest` from Task 1.
- Produces `DshRecognitionModelAdapter`, `DshRecognitionRuntimeReport`, and `createDshRecognitionModelAdapter(ctx)`.

- [ ] **Step 1: Write failing adapter tests with a complete fake DSH bridge**

```ts
it('correlates every child request and returns only sanitized observations', async () => {
  const bridge = createFakeBridge({
    versions: { agent: '0.1.2-alpha.5', llm: '0.1.2-alpha.5', subagent: '0.1.2-alpha.5' },
    childRequests: [
      { provider: 'deepseek-official', model: 'fixture-model', reasoningEffort: 'high', maxTokens: 256 },
      { provider: 'deepseek-official', model: 'fixture-model', reasoningEffort: 'high', maxTokens: 256 },
    ],
    structured: { proposals: [] },
  });
  const result = await new DshRecognitionModelAdapter(bridge).review({
    pipelineId: 'partition', pipelineVersion: '1', parentSessionId: 'parent',
    prompt: [{ type: 'text', text: 'secret prompt' }],
    outputSchema: { type: 'object', properties: {} }, maxDepth: 1,
    timeoutMs: 1_000,
  });

  expect(result.observations).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain('secret prompt');
  expect(result.structured).toEqual({ proposals: [] });
});
```

Also assert exact package-version mismatch, missing capability, missing parent, no correlated `llm/stream`, route mismatch between `agent/request` and `llm/stream`, timeout, and aborted signals fail with stable codes; assert every published run is disposed.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts --reporter=verbose`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement the adapter and DSH bridge**

The adapter must:

```ts
export const SUPPORTED_DSH_RECOGNITION_VERSION = '0.1.2-alpha.5';

export class DshRecognitionModelAdapter implements RecognitionModelPort {
  constructor(private readonly bridge: DshRecognitionBridge) {}
  runtimeReport(): DshRecognitionRuntimeReport;
  review<TStructured>(request: RecognitionModelRequest<TStructured>): Promise<RecognitionModelResult<TStructured>>;
}
```

Resolve package versions through `createRequire(import.meta.url)`, validate all five subagent capabilities, subscribe before `start()`, correlate observations by the child session ID published by `subagent/start`, hash request content in memory, retain only safe metadata, pass every waterfall continuation through unchanged, and dispose listeners and the run in `finally`.

- [ ] **Step 4: Run adapter and boundary tests**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts --reporter=verbose`

Expected: PASS and the boundary test proves no other recognition module directly invokes `ctx.subagents.start()`.

- [ ] **Step 5: Commit the adapter**

```bash
git add packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.ts \
  packages/plugin-dsh-annotation-host/src/dsh-recognition-model-adapter.test.ts \
  packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts
git commit -m "feat(annotation): isolate DSH recognition requests"
```

### Task 3: Partition semantic pipeline migration and contract evaluation

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts`

**Interfaces:**
- Consumes `RecognitionPipelineRunner` and `RecognitionModelPort` from Task 1.
- Produces `PARTITION_SEMANTIC_PIPELINE_ID`, `createPartitionSemanticPipeline(space)`, and the existing `PartitionSemanticReviewer` adapter used by `PartitionWorkflowService`.

- [ ] **Step 1: Rewrite the existing reviewer test against the desired model-port boundary**

```ts
const model = {
  review: vi.fn(async () => ({
    stopReason: 'completed',
    structured: { proposals: [{
      segmentIds: ['segment:1'], semanticType: 'shaft-seat',
      dimensionRole: 'ordinary', confidence: 0.9, reason: '稳定圆柱面',
      visualEvidenceIds: ['observation:segment:1'],
    }] },
    observations: [{
      provider: 'fixture', model: 'fixture', messageCount: 2,
      systemDigest: 'sha256:system', toolNames: ['structured_output'],
      requestDigest: 'sha256:request',
    }],
  })),
};
const runner = new RecognitionPipelineRunner(model);
runner.register(createPartitionSemanticPipeline({ renderObservation } as never));
const result = await runner.run(PARTITION_SEMANTIC_PIPELINE_ID, { agent, draft, segmentIds: ['segment:1'] });

expect(model.review).toHaveBeenCalledWith(expect.objectContaining({
  parentSessionId: 's', maxDepth: 1,
  prompt: expect.arrayContaining([expect.objectContaining({ type: 'image', data: new Uint8Array([1]) })]),
}));
expect(result.output.draft.segments[0]).toMatchObject({ semanticType: 'shaft-seat' });
```

Keep the existing tests for context overlays, invalid proposals, timeout coverage, batching, consolidation, and incomplete coverage.

- [ ] **Step 2: Run the semantic reviewer tests and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts --reporter=verbose`

Expected: FAIL because the pipeline factory and model-port boundary do not exist.

- [ ] **Step 3: Move the exact existing workflow into a versioned pipeline**

Keep observation rendering, 128-overlay batching, overlap consolidation, prompt wording, schema, validation, confidence threshold, evidence checking, and `applySemanticProposals` unchanged. Replace attachment saving and direct `ctx.subagents.start()` with `context.model.review()` and record deterministic/model/grounding stage digests.

- [ ] **Step 4: Add a production-shaped end-to-end contract case**

The contract test must run `RecognitionPipelineRunner.evaluate()` against the same registered partition pipeline, return a fixed bounded semantic candidate from a fake model port, and assert the final `semanticGroups` and unclassified transition segments after real local `applySemanticProposals` processing. It must also assert the sanitized evaluation report omits prompt text and image bytes.

- [ ] **Step 5: Run partition runtime tests and commit**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/recognition-runtime.test.ts packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts packages/plugin-dsh-annotation-host/src/partition-service.test.ts --reporter=verbose`

Expected: PASS.

```bash
git add packages/plugin-dsh-annotation-host/src/semantic-reviewer.ts \
  packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts \
  packages/plugin-dsh-annotation-host/src/partition-recognition-contract.test.ts
git commit -m "refactor(annotation): run partition recognition through shared pipeline"
```

### Task 4: GD&T semantic pipeline migration

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/gdt-reviewer.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts`

**Interfaces:**
- Consumes the same `RecognitionPipelineRunner` and `RecognitionModelPort` as partition recognition.
- Produces `GDT_SEMANTIC_PIPELINE_ID` and `createGdtSemanticPipeline(space)` while preserving `AutomaticGdtReviewer` output.

- [ ] **Step 1: Add failing tests for model-assisted and local-only paths**

```ts
expect(model.review).not.toHaveBeenCalled(); // deterministic requirements resolve locally

expect(model.review).toHaveBeenCalledWith(expect.objectContaining({
  pipelineId: GDT_SEMANTIC_PIPELINE_ID,
  parentSessionId: 'session-gdt',
  maxDepth: 1,
}));
expect(result.controls[0]?.geometryIds).toEqual(['locating-face-upper']);
```

Also retain the current guarantee that provider failure falls back to the grounded local result unless the caller signal is aborted.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts --reporter=verbose`

Expected: FAIL because the GD&T pipeline factory is missing and the reviewer still calls DSH directly.

- [ ] **Step 3: Migrate only the model boundary**

Keep `resolveShaftGdtRules`, feature-review validation, local datum ordering, characteristic selection, surface-role resolution, geometry grounding, coverage calculation, and optional-enrichment fallback unchanged. Route only the bounded feature-role request through `context.model.review()`.

- [ ] **Step 4: Run GD&T and grounding regressions**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts packages/plugin-dsh-annotation-host/src/gdt-grounding.test.ts packages/plugin-dsh-annotation-host/src/gdt-service.test.ts packages/plugin-dsh-annotation-host/src/shaft-gdt-rules.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 5: Commit the migration**

```bash
git add packages/plugin-dsh-annotation-host/src/gdt-reviewer.ts \
  packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts
git commit -m "refactor(annotation): share DSH adapter across semantic reviewers"
```

### Task 5: Register one runtime in the Host and verify the actual bundle

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes both registered pipeline factories and `createDshRecognitionModelAdapter(ctx)`.
- Produces one `DrawingAnnotationHostService.recognition` runner shared by partition and GD&T production workflows.

- [ ] **Step 1: Write the failing Host composition assertion**

```ts
const fakeModelPort: RecognitionModelPort = {
  review: async () => ({ stopReason: 'completed', structured: {}, observations: [] }),
};
const fakeDrawingSpace = {} as DrawingSpaceExtensionHost<Agent>;
const runner = createAnnotationRecognitionRunner(fakeModelPort, fakeDrawingSpace);
expect(runner.list()).toEqual([
  'shaft-partition-semantic-review',
  'shaft-gdt-semantic-review',
]);
```

Extend the full automatic-annotation integration test so partition and GD&T execute through one injected fake model port while the final dimensions, datums, controls, and roughness remain locally grounded.

- [ ] **Step 2: Run the Host tests and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts --reporter=verbose`

Expected: FAIL because the Host does not yet own one registered runtime.

- [ ] **Step 3: Compose the runtime once**

Export `createAnnotationRecognitionRunner(model, space)`, construct one adapter and one runner in `DrawingAnnotationHostService`, register both pipelines, and pass thin runner closures to `PartitionWorkflowService` and `GdtService`. Add `llm` to the loader-visible injection list so request observation cannot race service initialization.

- [ ] **Step 4: Update current architecture documentation**

Document the new single DSH boundary, production/evaluation pipeline sharing, sanitized multi-request observations, exact DSH version gate, and the rule that deterministic pipelines register without acquiring a model stage.

- [ ] **Step 5: Run focused and package verification**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-host check
pnpm --filter @vectorai/engineering-annotation test
pnpm build:dsh-annotation
```

Expected: 0 failed tests, type-check exit 0, and local DSH annotation bundle build exit 0.

- [ ] **Step 6: Run the real installed-runtime probe and inspect the built boundary**

Run the opt-in Headless probe against DSH `0.1.2-alpha.5` with a fresh output file. Assert `agent/request`, `llm/stream`, all five subagent capabilities, exact structured output, child route propagation, deep-frozen request messages, and paired start/end events. Then run:

```bash
rg -n "subagents\.start|agent/request|llm/stream" \
  packages/plugin-dsh-annotation-host/src \
  packages/plugin-dsh-annotation-host/lib/index.js
```

Expected: production recognition calls and observers are centralized in `dsh-recognition-model-adapter.ts`; test doubles may mention the strings.

- [ ] **Step 7: Commit the completed vertical slice**

```bash
git add packages/plugin-dsh-annotation-host/src/service.ts \
  packages/plugin-dsh-annotation-host/src/dependency-boundary.test.ts \
  packages/plugin-dsh-annotation-host/src/automatic-annotation-flow.integration.test.ts \
  docs/tech-architecture.md \
  docs/superpowers/specs/2026-09-04-recognition-evaluation-runtime-design.md \
  docs/superpowers/plans/2026-09-04-recognition-evaluation-runtime.md
git commit -m "feat(annotation): integrate recognition evaluation runtime"
```
