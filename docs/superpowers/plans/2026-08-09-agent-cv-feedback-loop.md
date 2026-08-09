# Agent CV Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot image perception with an auditable Agent loop that calls bounded server CV tools, chooses overlapping regions, commits local Drawing IR changes, renders them back to source space, and corrects residual errors until the `test1.jpg` golden gate passes.

**Architecture:** Canonical Drawing IR and Command → Transaction → Commit remain the only edit path. A server OpenCV.js/WASM provider runs in worker threads and keeps large evidence outside model context. A source-feedback controller alternates between model decisions, CV evidence, Drawing previews, deterministic residual comparison, and local commits; once verified, it replaces the old perception-before-Agent pipeline.

**Tech Stack:** TypeScript 5.8, Node.js 22, Express 4, React 18, Zustand 5, Vitest 3, OpenCV.js/WASM, Sharp, SVG, SSE, local JSON/binary stores.

## Global Constraints

- Work directly on `main`; do not create a branch, worktree, or subagent.
- `test1.jpg` SHA-256 is `81d16ea531aa2887ae1a45240affd76648f38ba301627ccde8275ff075a9ed5c`; size is 1260×1748; it is the MVP release gate.
- Source Artifact is immutable source truth; Canonical Drawing IR is the only edit truth; CV output is evidence and never edits Drawing IR.
- CV is a server-side Agent tool. The browser only projects progress and overlays.
- AI-selected observation regions may overlap or nest and target complete entities rather than a non-overlapping page partition.
- Locally verified patches may commit before whole-sheet completion. Later corrections append another Commit.
- `doubao-seed-2.0-lite` is primary; `doubao-seed-2.1-turbo` is only for repeated non-improvement, topology-affecting type ambiguity, merge/split/retype ambiguity, or explicit low confidence.
- Active runs emit progress or heartbeat within 25 seconds; first visible overview or Drawing patch targets 30 seconds.
- Model context contains bounded summaries and handles, never raw pixels or unbounded samples.
- Never hard-code test1 entities in production or expose golden data to the model.
- Preserve unrelated working-tree changes and stage only current-task files.

---

## File Structure

- `fixtures/test1/`: source manifest, golden Drawing, topology, associations, ignore masks, seeded errors.
- `api/services/drawing-benchmark/`: golden validation and deterministic scoring.
- `api/services/drawing-cv/`: contracts, evidence store, worker protocol/provider, Agent tool registry.
- `api/services/drawing-feedback/`: regions, slots, source renderer, comparator, model adapter, loop controller.
- `api/services/drawing-agent/`: runtime, progress, audit, and model routing integration.
- `src/components/canvas/`: infinite grid and evidence/residual overlays.
- `src/drawing/preview/`: stable correction projection keyed by slot lineage.

---

### Task 1: test1 Golden Benchmark and Scorer

**Files:**
- Create: `fixtures/test1/source-manifest.json`
- Create: `fixtures/test1/expected-drawing.json`
- Create: `fixtures/test1/expected-topology.json`
- Create: `fixtures/test1/expected-associations.json`
- Create: `fixtures/test1/ignore-regions.json`
- Create: `fixtures/test1/seeded-errors/wrong-circle.json`
- Create: `api/services/drawing-benchmark/types.ts`
- Create: `api/services/drawing-benchmark/score.ts`
- Create: `api/services/drawing-benchmark/test1.test.ts`
- Modify: `scripts/test-drawing.ts`

**Interfaces:**
- Consumes: `DrawingDocument`, source-space transform, `test1.jpg`.
- Produces: `scoreDrawingBenchmark(actual, golden, options): DrawingBenchmarkReport` and the release golden.

- [ ] **Step 1: Write failing scorer tests**

```ts
it('rejects an arc replaced by a circle', () => {
  const report = scoreDrawingBenchmark(wrongCircle, golden, TEST1_TOLERANCE);
  expect(report.passed).toBe(false);
  expect(report.entity.typeMismatches).toHaveLength(1);
});

it('requires exact entity and association sets', () => {
  const report = scoreDrawingBenchmark(withOneEntityRemoved(golden), golden, TEST1_TOLERANCE);
  expect(report.entity.recall).toBeLessThan(1);
  expect(report.passed).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- api/services/drawing-benchmark/test1.test.ts`

Expected: FAIL because the scorer and fixtures do not exist.

- [ ] **Step 3: Implement report contracts and matching**

```ts
export interface DrawingBenchmarkReport {
  passed: boolean;
  entity: { precision: number; recall: number; typeMismatches: string[]; parameterMismatches: string[] };
  topology: { passed: boolean; missing: string[]; extra: string[] };
  associations: { passed: boolean; missing: string[]; extra: string[] };
  residual: { edgeF1: number; unresolvedRegionCount: number };
}
```

Use stable IDs for recorded replay and minimum same-type source-space parameter distance for live results. Passing requires entity precision/recall `1`, no mismatches, edge F1 ≥ `0.995`, and no unresolved required region.

- [ ] **Step 4: Author and visually verify the golden package**

Encode every supported visible geometry, text, dimension, topology, and association with `test1_` IDs. Ignore only border, watermark, and compression noise. Render the golden over the original 1260×1748 image until all intended strokes are represented and no ignored stroke is represented.

- [ ] **Step 5: Capture current failure and commit**

Run: `npm test -- api/services/drawing-benchmark/test1.test.ts`

Run: `npm run test:drawing -- test1.jpg --benchmark fixtures/test1`

Expected: golden self-tests PASS; current one-shot live result exits non-zero and writes the baseline failure report.

```bash
git add fixtures/test1 api/services/drawing-benchmark scripts/test-drawing.ts test1.jpg
git commit -m "test add test1 drawing golden benchmark"
```

---

### Task 2: Infinite Grid During Pan

**Files:**
- Create: `src/components/canvas/grid-pattern.ts`
- Create: `src/components/canvas/grid-pattern.test.ts`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/canvas/pan-interaction.test.ts`

**Interfaces:**
- Consumes: `{ scale, offsetX, offsetY }`.
- Produces: `gridPatternMetrics(transform)` and a viewport-size repeating SVG pattern.

- [ ] **Step 1: Write the failing invariant test**

```ts
it('changes pattern phase but not coverage while panning', () => {
  const a = gridPatternMetrics({ scale: 2, offsetX: 80, offsetY: 500 });
  const b = gridPatternMetrics({ scale: 2, offsetX: -2000, offsetY: 1600 });
  expect(b.minorSize).toBe(a.minorSize);
  expect([b.x, b.y]).not.toEqual([a.x, a.y]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/components/canvas/grid-pattern.test.ts`

- [ ] **Step 3: Implement nested patterns outside the world group**

```ts
export const gridPatternMetrics = (t: CanvasTransform) => ({
  minorSize: 10 * t.scale,
  majorSize: 50 * t.scale,
  x: modulo(t.offsetX, 50 * t.scale),
  y: modulo(t.offsetY, 50 * t.scale),
});
```

Update pattern phase and world transform in the same animation frame. Remove finite viewport line arrays.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/components/canvas/grid-pattern.test.ts src/components/canvas/pan-interaction.test.ts`

Manually drag beyond two viewport widths in every direction; no black strip may appear.

```bash
git add src/components/Canvas.tsx src/components/canvas/grid-pattern.ts src/components/canvas/grid-pattern.test.ts src/components/canvas/pan-interaction.test.ts
git commit -m "fix canvas use infinite panning grid"
```

---

### Task 3: CV Contracts and Content-Addressed Evidence Store

**Files:**
- Create: `api/services/drawing-cv/types.ts`
- Create: `api/services/drawing-cv/evidence-store.ts`
- Create: `api/services/drawing-cv/evidence-store.test.ts`

**Interfaces:**
- Produces: `SourcePixelRect`, `CvToolBudget`, `CvEvidenceSummary`, `DrawingCvProvider`, `CvEvidenceStore`.

- [ ] **Step 1: Write failing bounded-storage tests**

```ts
it('stores samples by handle and returns bounded pages', async () => {
  const summary = await store.putEvidence(evidenceWith1000Points);
  expect(summary.handle).toMatch(/^evidence_[a-f0-9]{24}$/);
  expect(JSON.stringify(summary)).not.toContain('samples');
  expect((await store.readSamples(summary.handle, { offset: 0, limit: 16 })).items).toHaveLength(16);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- api/services/drawing-cv/evidence-store.test.ts`

- [ ] **Step 3: Implement strict source-pixel types and storage**

```ts
export interface SourcePixelRect { x: number; y: number; width: number; height: number }
export interface CvToolBudget { maxPixels: number; maxResults: number; maxSamplesPerResult: number; timeoutMs: number }
export interface CvEvidenceSummary {
  handle: string; sourceId: string; regionId: string;
  kind: 'edge' | 'contour' | 'endpoint' | 'intersection' | 'primitive-candidate';
  bounds: SourcePixelRect; confidence: number; touchesRegionEdge: boolean; sampleCount: number;
}
```

Store JSON metadata plus compact binary samples under `.local/vectorai/evidence/<sourceId>/`. Validate finite coordinates, source bounds, safe IDs, ownership, pagination, and hashes on every read.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- api/services/drawing-cv/evidence-store.test.ts`

```bash
git add api/services/drawing-cv
git commit -m "feat add bounded cv evidence store"
```

---

### Task 4: Server OpenCV Worker Provider

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `api/services/drawing-cv/worker-protocol.ts`
- Create: `api/services/drawing-cv/opencv-worker.ts`
- Create: `api/services/drawing-cv/opencv-provider.ts`
- Create: `api/services/drawing-cv/opencv-provider.test.ts`

**Interfaces:**
- Produces: `OpenCvWorkerProvider implements DrawingCvProvider` with `inspectOverview`, `extractEvidence`, `fitPrimitive`, and `close`.

- [ ] **Step 1: Add dependencies**

Run: `pnpm add @techstark/opencv-js sharp`

Decode to raw RGBA with Sharp. Keep OpenCV types inside the provider. Follow the official OpenCV Node initialization model, adapted to ESM and Worker Threads.

- [ ] **Step 2: Write failing lifecycle, circle, and budget tests**

```ts
it('extracts a circle candidate in a worker', async () => {
  const evidence = await provider.extractEvidence(circlePng, fullRegion, budget, signal);
  expect(evidence.some((item) => item.kind === 'primitive-candidate')).toBe(true);
});

it('aborts over-budget work', async () => {
  await expect(provider.extractEvidence(hugePng, fullRegion, tinyBudget, signal))
    .rejects.toMatchObject({ code: 'CV_BUDGET_EXCEEDED' });
});
```

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- api/services/drawing-cv/opencv-provider.test.ts`

- [ ] **Step 4: Implement worker protocol and provider**

```ts
export type CvWorkerRequest =
  | { id: string; operation: 'overview'; rgba: ArrayBuffer; width: number; height: number; budget: CvToolBudget }
  | { id: string; operation: 'extract'; rgba: ArrayBuffer; width: number; height: number; region: SourcePixelRect; budget: CvToolBudget }
  | { id: string; operation: 'fit'; samples: Float64Array; primitiveType: GeometryObservationType; budget: CvToolBudget };
```

Initialize OpenCV once per worker; delete every `cv.Mat` in `finally`; enforce budgets before allocation; replace timed-out workers. Overview uses threshold/components/density. Evidence uses Canny/contours/polygon simplification/endpoints/intersections/Hough candidates. Fit uses deterministic line/circle/arc/ellipse/polyline/spline routines.

- [ ] **Step 5: Verify repeated use and commit**

Run: `npm test -- api/services/drawing-cv/opencv-provider.test.ts`

The test must execute 100 synthetic requests without a pending-request leak.

```bash
git add package.json pnpm-lock.yaml api/services/drawing-cv
git commit -m "feat add server opencv worker provider"
```

---

### Task 5: AI-Callable CV Tool Registry

**Files:**
- Create: `api/services/drawing-cv/tool-registry.ts`
- Create: `api/services/drawing-cv/tool-registry.test.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`

**Interfaces:**
- Produces: `DrawingCvToolRegistry.invoke(invocation): Promise<CvToolExecution>`.

- [ ] **Step 1: Write failing schema, overlap, and pagination tests**

```ts
it('allows overlapping regions without raw sample output', async () => {
  const a = await tools.invoke(observe(regionA));
  const b = await tools.invoke(observe(regionB));
  expect(overlaps(regionA.bounds, regionB.bounds)).toBe(true);
  expect(JSON.stringify([a.output, b.output])).not.toMatch(/samples|rgba|base64/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- api/services/drawing-cv/tool-registry.test.ts`

- [ ] **Step 3: Implement exact capabilities**

```ts
export type CvToolCapability =
  | 'inspect_source_overview' | 'create_observation_region'
  | 'cv_extract_evidence' | 'cv_read_evidence_page'
  | 'cv_fit_primitive' | 'compare_region';
```

Reject unknown fields and invalid bounds. Receipts include version, digest, source/region/slot IDs, evidence handles, duration, budget, status, error codes, and retry action. Reserve `compare_region` for Task 7.

- [ ] **Step 4: Verify audit safety and commit**

Run: `npm test -- api/services/drawing-cv/tool-registry.test.ts api/services/drawing-agent/file-audit-store.test.ts`

```bash
git add api/services/drawing-cv/tool-registry.ts api/services/drawing-cv/tool-registry.test.ts api/services/drawing-agent/audit-types.ts
git commit -m "feat expose bounded cv agent tools"
```

---

### Task 6: Overlapping Regions and Stable Slots

**Files:**
- Create: `api/services/drawing-feedback/types.ts`
- Create: `api/services/drawing-feedback/region-store.ts`
- Create: `api/services/drawing-feedback/region-store.test.ts`
- Create: `api/services/drawing-feedback/slot-store.ts`
- Create: `api/services/drawing-feedback/slot-store.test.ts`

**Interfaces:**
- Consumes: source bounds and `CvEvidenceSummary`.
- Produces: versioned `ObservationRegion`, `ObservationSlot`, and lineage operations.

- [ ] **Step 1: Write failing overlap and identity tests**

```ts
it('allows nested overlapping regions', () => {
  const root = regions.create(rootRegion);
  const child = regions.create({ ...childRegion, parentRegionId: root.id });
  expect(regions.list().map((item) => item.id)).toEqual([root.id, child.id]);
});

it('joins two crop observations into one full-circle slot', () => {
  const slot = slots.observe(leftPartial);
  const revised = slots.observe(rightPartial, { preferredSlotId: slot.id });
  expect(revised.id).toBe(slot.id);
  expect(revised.evidenceRefs).toHaveLength(2);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- api/services/drawing-feedback/region-store.test.ts api/services/drawing-feedback/slot-store.test.ts`

- [ ] **Step 3: Implement exact state**

Use `ObservationRegion` and `ObservationSlot` from the design. Stable slot IDs derive from source ID and first accepted evidence digest. `retype` keeps the slot and links deleted/created Drawing IDs; merge/split create explicit lineage records.

- [ ] **Step 4: Enforce crop-edge safety**

Add a test proving `touchesRegionEdge: true` cannot confirm a closed primitive until another region closes the contour or a whole-object fit validates it.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- api/services/drawing-feedback/region-store.test.ts api/services/drawing-feedback/slot-store.test.ts`

```bash
git add api/services/drawing-feedback
git commit -m "feat add overlapping observation slots"
```

---

### Task 7: Source Renderer and Residual Comparator

**Files:**
- Create: `api/services/drawing-feedback/source-renderer.ts`
- Create: `api/services/drawing-feedback/source-renderer.test.ts`
- Create: `api/services/drawing-feedback/residual-comparator.ts`
- Create: `api/services/drawing-feedback/residual-comparator.test.ts`
- Modify: `api/services/drawing-cv/tool-registry.ts`

**Interfaces:**
- Produces: `renderDrawingRegion(document, request): RenderedSemanticPlanes` and `compareDrawingRegion(input): RegionResidualReport`.

- [ ] **Step 1: Write failing renderer parity tests**

Build a fixture containing all MVP geometry, text, and dimension types. Assert each semantic plane draws into expected source bounds and CAD Y-up converts exactly once to source Y-down.

- [ ] **Step 2: Write the failing correction metric test**

```ts
it('improves after a wrong circle is corrected to an arc', () => {
  const before = compareDrawingRegion({ source, drawing: wrongCircle, region, masks });
  const after = compareDrawingRegion({ source, drawing: correctedArc, region, masks });
  expect(after.geometry.fitP95).toBeLessThan(before.geometry.fitP95);
  expect(after.geometry.edgeF1).toBeGreaterThan(before.geometry.edgeF1);
  expect(after.improved).toBe(true);
});
```

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- api/services/drawing-feedback/source-renderer.test.ts api/services/drawing-feedback/residual-comparator.test.ts`

- [ ] **Step 4: Implement semantic rendering and comparison**

Rasterize geometry, construction, annotations, and text separately. Share geometry sampling with SVG rendering. Compute tolerant edge precision/recall/F1, nearest-edge p50/p95/max, topology failures, association mismatch, and connected residual bounds. Improvement requires a target metric gain with no confirmed-topology regression.

- [ ] **Step 5: Wire `compare_region`, verify, and commit**

Run: `npm test -- api/services/drawing-feedback/source-renderer.test.ts api/services/drawing-feedback/residual-comparator.test.ts api/services/drawing-cv/tool-registry.test.ts`

```bash
git add api/services/drawing-feedback api/services/drawing-cv/tool-registry.ts
git commit -m "feat compare drawing against source evidence"
```

---

### Task 8: Feedback Decision Protocol and Bounded Context

**Files:**
- Create: `api/services/drawing-feedback/model-adapter.ts`
- Create: `api/services/drawing-feedback/model-adapter.test.ts`
- Modify: `api/services/drawing-feedback/types.ts`
- Modify: `api/services/drawing-agent/model-adapters.ts`

**Interfaces:**
- Consumes: goal, current revision summary, target regions/slots, recent receipts, residual summary, and at most one requested crop.
- Produces: strict `FeedbackAgentDecision`.

- [ ] **Step 1: Write failing parser and context tests**

```ts
export type FeedbackAgentDecision =
  | { type: 'call_tool'; toolCallId: string; capability: CvToolCapability; input: unknown }
  | { type: 'transact'; toolCallId: string; slotIds: string[]; commands: DrawingCommand[]; confidence: number }
  | { type: 'finish'; summary: string };
```

Reject unknown capabilities, raw samples, invalid regions, empty transactions, and finish while required residuals remain.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- api/services/drawing-feedback/model-adapter.test.ts`

- [ ] **Step 3: Implement prompt and context projection**

The prompt requires CV evidence, overlapping entity-centered regions, crop-edge safety, and real create/update/retype/merge/split/delete corrections. Keep at most 8 receipts, 32 region/slot summaries, 100 Drawing items, and one crop; record dropped-context summaries. Request a short action explanation, not hidden reasoning.

- [ ] **Step 4: Test model routing**

Prove Lite handles normal observation and JSON repair. Turbo is selected only for the five approved triggers. Public progress never includes model names.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- api/services/drawing-feedback/model-adapter.test.ts api/services/drawing-agent/model-adapters.test.ts`

```bash
git add api/services/drawing-feedback api/services/drawing-agent/model-adapters.ts
git commit -m "feat add bounded drawing feedback decisions"
```

---

### Task 9: Real Feedback Loop and Incremental Commits

**Files:**
- Create: `api/services/drawing-feedback/loop-controller.ts`
- Create: `api/services/drawing-feedback/loop-controller.test.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/server.ts`

**Interfaces:**
- Produces: `DrawingFeedbackLoop.run(input): AsyncIterable<DrawingFeedbackOutput>` and resumable checkpoints.

- [ ] **Step 1: Write the failing recorded correction test**

```ts
it('commits a wrong circle then retypes it to an arc and converges', async () => {
  const outputs = await collect(loop.run(recordedWrongCircleScenario));
  expect(outputs.filter(isCorrection).map((item) => item.action)).toContain('retype');
  expect(lastResidual(outputs).geometry.edgeF1).toBeGreaterThan(firstResidual(outputs).geometry.edgeF1);
  expect(outputs.at(-1)).toMatchObject({ kind: 'completed', unresolvedRequired: 0 });
});
```

- [ ] **Step 2: Write pause, recovery, and non-convergence tests**

Cover pause before tool, pause after preview, resume from checkpoint, appended instructions, CV timeout without rollback, stale revision requery, three non-improving corrections pausing one slot, and refusal to complete with required residuals.

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- api/services/drawing-feedback/loop-controller.test.ts`

- [ ] **Step 4: Implement the state machine**

```text
OBSERVE → SELECT_TARGET → ACQUIRE_EVIDENCE → PROPOSE_PATCH
→ PREVIEW_AND_RENDER → COMPARE → COMMIT_LOCAL_RESULT → SELECT_TARGET
```

Compare the preview `resultingDocument` before commit. Commit locally valid changes. If later evidence disproves one, append a correction transaction. Observation-only calls do not count as repair progress.

- [ ] **Step 5: Replace source-backed runtime entry and wire server dependencies**

Source-backed runs use `DrawingFeedbackLoop`; fast text runs remain unchanged. Construct one bounded worker pool and evidence store, close workers on shutdown, persist checkpoints in the run directory, and never silently fall back to the old pipeline.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- api/services/drawing-feedback/loop-controller.test.ts api/services/drawing-agent/runtime.test.ts api/routes/agent-runs.test.ts`

```bash
git add api/services/drawing-feedback api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts api/services/drawing-agent/types.ts api/server.ts
git commit -m "feat run source reconstruction as feedback loop"
```

---

### Task 10: Progressive UI and Auditable Corrections

**Files:**
- Modify: `api/services/drawing-agent/progress.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Modify: `src/drawing/preview/types.ts`
- Modify: `src/drawing/preview/reducer.ts`
- Modify: `src/drawing/tests/preview.test.ts`
- Create: `src/components/canvas/EvidenceOverlay.tsx`
- Create: `src/components/canvas/EvidenceOverlay.test.tsx`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/canvas/EntityRenderer.tsx`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`

**Interfaces:**
- Consumes: loop progress with region, slot, correction, preview delta, and residual summary.
- Produces: stable canvas projection and user-readable activity.

- [ ] **Step 1: Write failing reducer correction tests**

```ts
it('retypes a slot without leaving its old preview node', () => {
  const corrected = reducePreview(reducePreview(empty, observeCircle), retypeCircleToArc);
  expect(Object.values(corrected.nodes).map((node) => node.type)).toEqual(['arc']);
  expect(corrected.slotToNodeIds[slotId]).toEqual([arcId]);
});
```

- [ ] **Step 2: Write task-copy and overlay tests**

Require “正在观察轮廓 C17”, “将圆修正为圆弧”, “局部误差下降”, and “该区域尚未收敛”. Reject model names, raw samples, and hidden reasoning.

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- src/drawing/tests/preview.test.ts src/components/canvas/EvidenceOverlay.test.tsx src/components/agent/task-presentation.test.ts`

- [ ] **Step 4: Implement actions and overlays**

Support `observe | create | update | retype | merge | split | delete | reject | promote`. Render regions and residual bounds in one muted overlay, keep low confidence red, and atomically remove superseded nodes by slot lineage.

- [ ] **Step 5: Browser acceptance and commit**

Pause during CV, resume, add an instruction, refresh/reconnect, and pan beyond the original viewport while corrections arrive. No flicker, black grid gap, duplicate superseded node, or lost task state is allowed.

```bash
git add api/services/drawing-agent/progress.ts api/services/drawing-agent/audit-types.ts src/drawing/preview src/components/Canvas.tsx src/components/canvas src/components/agent
git commit -m "feat show live drawing correction loop"
```

---

### Task 11: Remove One-Shot Perception and Pass test1

**Files:**
- Delete: `api/services/drawing-perception/coverage.ts`
- Delete: `api/services/drawing-perception/coverage.test.ts`
- Delete: `api/services/drawing-perception/regions.ts`
- Delete: `api/services/drawing-perception/regions.test.ts`
- Delete: `api/services/drawing-perception/contour-assembler.ts`
- Delete: `api/services/drawing-perception/contour-assembler.test.ts`
- Delete or replace: `api/services/drawing-perception/pipeline.ts`
- Modify: `api/services/drawing-perception/pipeline.test.ts`
- Modify: `scripts/test-drawing.ts`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Produces: one source reconstruction path and a passing release report.

- [ ] **Step 1: Add a dependency-boundary failure test**

Assert runtime/routes/UI cannot import the removed scheduler, coverage self-assessment, or final batch reconciliation modules; assert no feature flag can select the old path.

- [ ] **Step 2: Remove old implementation**

Delete breadth-first partitions, model self-reported coverage, global-contour promotion, and one-time final batches. Retain reusable source artifacts, coordinate transforms, annotation parsing, and Drawing commands only when called by the new loop.

- [ ] **Step 3: Run deterministic verification**

Run: `npm run check`

Run: `npm test`

Run: `npm run build`

Expected: all exit 0.

- [ ] **Step 4: Run recorded replay**

Run: `npm run test:drawing -- test1.jpg --benchmark fixtures/test1 --replay`

Expected: identical Drawing revision and Commit-chain hashes across two replays; seeded errors show required correction operations.

- [ ] **Step 5: Run three live test1 regressions**

Each must report:

```text
entity precision = 1
entity recall = 1
type mismatches = 0
parameter mismatches = 0
topology missing/extra = 0
association conflicts/ambiguities = 0
edge F1 >= 0.995
unresolved required residuals = 0
maximum progress silence <= 25s
```

Do not weaken the scorer. Use audit evidence to fix provider, context, prompt, loop, fit, or a manually proven golden error until all three pass.

- [ ] **Step 6: Document measured status and commit**

```bash
git add api src scripts docs fixtures package.json pnpm-lock.yaml
git commit -m "feat complete agent cv drawing feedback loop"
```

---

## Final Verification

- [ ] `npm run check`, `npm test`, and `npm run build` exit 0.
- [ ] Grid remains visible throughout long pan.
- [ ] A real source run visibly performs observe, create/update, compare, and correction.
- [ ] Pause, resume, stop, instruction injection, refresh/reconnect, and audit replay work.
- [ ] Public events contain no model names, raw samples, credentials, media base64, or hidden reasoning.
- [ ] Three consecutive live test1 reports pass the unchanged golden gate.
- [ ] No unexpected file is staged.
