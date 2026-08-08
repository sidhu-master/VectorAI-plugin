# Progressive Numbered Drawing Perception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream system-numbered provisional CAD entities to the canvas as perception calls finish, allow idempotent correction, and promote only validated command batches into the canonical Drawing Document.

**Architecture:** Add a shared structured preview-delta contract and a pure frontend projection reducer. Drawing Perception emits deltas online through an async queue while bounded view/region work continues; DrawingAgentRuntime forwards and audits each delta immediately and commits final batches online. The frontend keeps provisional nodes outside `DrawingDocument` and Canvas renders them as a separate overlay.

**Tech Stack:** TypeScript 5.8, Express SSE, React 18, Zustand 5, SVG, Vitest 3, existing Drawing IR and transaction pipeline.

## Global Constraints

- Work on `main` with the main agent only; do not create a branch or worktree.
- Do not add model names, prompts, image bytes or hidden chain-of-thought to UI or delta payloads.
- `DrawingDocument` remains the only canonical authority; preview entities never use the Drawing API.
- Every delta is idempotent and scoped by `runId` plus monotonically increasing `sequence`.
- The system assigns stable public slot IDs; model-returned IDs are only inputs to deterministic derivation.
- Low-confidence preview entities remain candidates and render consistently, not with arbitrary per-stage colors.
- Existing pause, stop, audit, under-30-second heartbeat and canonical commit behavior must remain valid.

---

### Task 1: Shared Preview Delta Contract and Reducer

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Create: `src/drawing/preview/types.ts`
- Create: `src/drawing/preview/reducer.ts`
- Create: `src/drawing/tests/preview.test.ts`
- Modify: `src/drawing/index.ts`

**Interfaces:**
- Produces `PerceptionPreviewAction`, `PerceptionPreviewDelta`, `PerceptionPreviewState`, `emptyPerceptionPreview(runId)`, and `applyPerceptionPreviewDelta(state, delta)`.
- `PerceptionPreviewDelta` contains `runId`, `sequence`, `action`, `slotIds`, `upserts`, `removeIds`, and a page/view/region/stage source descriptor.

- [ ] **Step 1: Write failing reducer tests**

Cover ordered upsert, duplicate sequence rejection, out-of-order sequence rejection, replacement by stable node ID, explicit removal, and clearing through a reconciliation delta. Use candidate `CircleGeometry` and `LineGeometry` fixtures and assert that the reducer never mutates prior state.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/drawing/tests/preview.test.ts`

Expected: FAIL because `@/drawing/preview/reducer` and the delta types do not exist.

- [ ] **Step 3: Implement the minimal contract and pure reducer**

Define:

```ts
export type PerceptionPreviewAction =
  | 'observe' | 'refine' | 'retype' | 'merge' | 'split' | 'reject' | 'promote';

export interface PerceptionPreviewDelta {
  runId: string;
  sequence: number;
  action: PerceptionPreviewAction;
  slotIds: string[];
  upserts: Array<GeometryNode | AnnotationNode>;
  removeIds: string[];
  source: {
    page: number;
    viewId: string;
    regionId?: string;
    stage: 'outline' | 'detail' | 'annotation' | 'reconciliation';
  };
}

export interface PerceptionPreviewState {
  runId: string | null;
  lastSequence: number;
  nodes: Record<string, GeometryNode | AnnotationNode>;
}
```

Reject a delta when `runId` differs from a non-null state or `sequence <= lastSequence`; otherwise remove first and then upsert cloned nodes.

- [ ] **Step 4: Run reducer tests and type checking**

Run: `npm test -- src/drawing/tests/preview.test.ts && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit the contract slice**

```bash
git add src/contracts/drawing-agent.ts src/drawing/preview src/drawing/tests/preview.test.ts src/drawing/index.ts
git commit -m "feat(perception): define progressive preview deltas"
```

### Task 2: System Numbering and Online Pipeline Deltas

**Files:**
- Create: `api/services/drawing-perception/numbering.ts`
- Create: `api/services/drawing-perception/numbering.test.ts`
- Modify: `api/services/drawing-perception/build-patches.ts`
- Modify: `api/services/drawing-perception/pipeline.ts`
- Modify: `api/services/drawing-perception/pipeline.test.ts`

**Interfaces:**
- Consumes `PerceptionPreviewDelta` and existing observation-to-command conversion.
- Produces `numberGlobalContours(runId, page, viewId, contours)`, `previewDeltaFromObservations(...)`, and the new `DrawingPerceptionOutput` member `{ kind: 'observation_delta'; delta }`.

- [ ] **Step 1: Write failing numbering tests**

Provide contours with arbitrary model IDs and shuffled bounds. Assert deterministic top-to-bottom/left-to-right system IDs, identical retry output, and no public ID containing the model ID.

- [ ] **Step 2: Write a failing online emission test**

Use two views whose vision promises are manually released. Release the first view only and call the async iterator's next item repeatedly until an `observation_delta` arrives; assert that the second view promise is still pending. Assert the emitted entity uses a candidate quality and a stable `node_obs_*` Drawing ID.

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `npm test -- api/services/drawing-perception/numbering.test.ts api/services/drawing-perception/pipeline.test.ts`

Expected: FAIL because numbering and `observation_delta` do not exist.

- [ ] **Step 4: Expose observation-to-node projection without duplicating CAD conversion**

Refactor `build-patches.ts` to export a focused `buildObservationPreviewNodes` helper that reuses `geometryCommand`, `annotationCommand`, transforms and stable node IDs. It returns only valid `GeometryNode | AnnotationNode` values and warnings; it must not build or execute a transaction.

- [ ] **Step 5: Implement deterministic contour numbering**

Sort by normalized `y`, then `x`, then geometry family and normalized bounds. Assign IDs in the format `ctr_p<page>_<sanitized-view>_<four-digit-index>` and rewrite every projected contour reference through an old-to-new map before regional prompts receive it.

- [ ] **Step 6: Stream producer results through an async output queue**

Add a small private queue inside `pipeline.ts`. `run()` starts bounded perception producers, yields queued deltas as soon as datum/global/region calls finish, then awaits the final aggregate for topology, associations and command batches. Emit one delta per completed tool result, not per model token. Give deltas a single run-scoped monotonically increasing sequence.

- [ ] **Step 7: Emit final reconciliation operations**

After final deduplication, emit `reject` removals for provisional IDs absent from the resolved set. Final command batches retain stable node IDs so runtime promotion can remove matching preview entities.

- [ ] **Step 8: Run perception tests and type checking**

Run: `npm test -- api/services/drawing-perception/numbering.test.ts api/services/drawing-perception/pipeline.test.ts api/services/drawing-perception/build-patches.test.ts && npm run check`

Expected: PASS.

- [ ] **Step 9: Commit the pipeline slice**

```bash
git add api/services/drawing-perception
git commit -m "feat(perception): stream numbered observation deltas"
```

### Task 3: Runtime Online Consumption, Audit, and SSE

**Files:**
- Modify: `api/services/drawing-agent/progress.ts`
- Modify: `api/services/drawing-agent/progress.test.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`

**Interfaces:**
- Consumes `DrawingPerceptionOutput` online.
- Produces `AgentProgressEvent.type === 'perception_delta'` with optional `perceptionDelta`, and audits the same structured delta as a `perception` event.

- [ ] **Step 1: Write failing progress/client contract tests**

Publish and parse a `perception_delta` event. Assert structured node data survives SSE JSON parsing, replay deduplicates by event ID, and terminal behavior is unchanged.

- [ ] **Step 2: Write a failing runtime ordering test**

Provide a controlled async perception iterable that yields one delta, waits, then yields a command batch and completion. Assert the progress subscriber receives `perception_delta` before the iterable is released and the audit store records the sequence/action without a model name.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npm test -- api/services/drawing-agent/progress.test.ts api/services/drawing-agent/runtime.test.ts src/services/agent-client.test.ts`

Expected: FAIL because the event type and online handler do not exist.

- [ ] **Step 4: Extend the optional structured progress payload**

Add `perception_delta` to server/client unions and `perceptionDelta?: PerceptionPreviewDelta` to the event. Keep `publish(type, title, detail?, perceptionDelta?)` backward-compatible for all existing calls.

- [ ] **Step 5: Replace collection with online handling**

Remove `#collectPerception`. Add `#consumePerceptionPass` that handles each output immediately. Stage receipts update coverage and audit; deltas publish and audit; high-confidence command batches call `#applyPerceptionBatch` immediately in reconstruct mode. Primary low-confidence batches remain visible as deltas but are buffered instead of committed; when repair is configured, the repair pass replaces those proposals and only repaired batches are committed. If repair fails, commit the last geometrically valid buffered primary batches and retain their candidate quality.

- [ ] **Step 6: Promote committed preview IDs**

After a successful component commit, publish a `promote` delta whose `removeIds` are the stable node IDs created by that batch. On terminal failure/stop/completion, publish a final reconciliation delta clearing any remaining run preview IDs.

- [ ] **Step 7: Run runtime/client tests and type checking**

Run: `npm test -- api/services/drawing-agent/progress.test.ts api/services/drawing-agent/runtime.test.ts src/services/agent-client.test.ts && npm run check`

Expected: PASS.

- [ ] **Step 8: Commit runtime transport**

```bash
git add api/services/drawing-agent src/services/agent-client.ts src/services/agent-client.test.ts
git commit -m "feat(agent): forward perception deltas online"
```

### Task 4: Frontend Preview Projection Lifecycle

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`

**Interfaces:**
- Consumes structured `perception_delta` events.
- Produces `perceptionPreview` in `AppState` and clears it on a new run, stopped, completed, failed, reset or run mismatch.

- [ ] **Step 1: Write failing store tests**

Start an image run, emit observe/refine/reject deltas, and assert each change appears immediately in `perceptionPreview` without changing `document`, `revision` or `commits`. Verify duplicate/out-of-order deltas are ignored and terminal events clear the preview.

- [ ] **Step 2: Run the store test and verify failure**

Run: `npm test -- src/hooks/useStore.test.ts`

Expected: FAIL because `perceptionPreview` is missing.

- [ ] **Step 3: Apply deltas in the SSE subscription**

Initialize `perceptionPreview` with `emptyPerceptionPreview(null)`. On `perception_delta`, reduce structured data synchronously in the same Zustand update as the visible task event. On commit, refresh canonical workspace as before; promotion/removal arrives through its own delta.

- [ ] **Step 4: Implement lifecycle clearing**

Clear stale projection when starting/resetting a run and on stopped/completed/failed. Pausing retains it so the visible partial drawing remains inspectable.

- [ ] **Step 5: Run store tests and type checking**

Run: `npm test -- src/hooks/useStore.test.ts && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit frontend state integration**

```bash
git add src/hooks/useStore.ts src/hooks/useStore.test.ts
git commit -m "feat(ui): project live perception state"
```

### Task 5: Canvas Overlay, Labels, Fit, and End-to-End Verification

**Files:**
- Modify: `src/components/Canvas.tsx`
- Create: `src/components/Canvas.test.tsx`
- Modify: `src/components/canvas/EntityRenderer.tsx`
- Modify: `src/components/canvas/EntityRenderer.test.tsx`
- Modify: `src/components/canvas/geometry.test.ts`
- Modify: `src/index.css`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes canonical nodes plus `perceptionPreview.nodes`.
- Produces a non-interactive provisional overlay with stable short labels and combined-bounds fit.

- [ ] **Step 1: Write failing renderer/fit tests**

Assert a provisional entity has a single subdued dashed treatment, its label is rendered, it is not selectable as canonical geometry, and model bounds include preview nodes. Include a normalized unit-width drawing fixture and assert fit scale is derived from viewport bounds rather than capped at five.

- [ ] **Step 2: Run focused UI tests and verify failure**

Run: `npm test -- src/components/canvas/EntityRenderer.test.tsx src/components/canvas/geometry.test.ts src/components/Canvas.test.tsx`

Expected: FAIL because Canvas has no preview overlay and fit is capped.

- [ ] **Step 3: Add explicit provisional rendering props**

Extend `EntityRenderer` with `provisional?: boolean` and `label?: string`. Provisional paths use one theme token, dashed stroke and reduced opacity; they have no transparent hit target and do not invoke selection handlers.

- [ ] **Step 4: Render canonical and preview sources separately**

Canvas keeps canonical selection behavior, draws preview nodes in a separate SVG group, and derives labels from slot IDs. Avoid merging preview nodes into `DrawingDocument` or object-list state.

- [ ] **Step 5: Fit combined bounds without assuming CAD-scale magnitudes**

Remove the fixed `5` fit cap. Compute the initial fit from finite combined bounds, clamp only against a safe renderer maximum high enough for normalized frames, and re-fit while the first progressive run is growing until the user manually pans or zooms. Do not silently rewrite node coordinates.

- [ ] **Step 6: Document the progressive projection boundary**

Update `docs/tech-architecture.md` with the numbered contour registry, online delta sequence, provisional frontend projection, promotion and audit flow.

- [ ] **Step 7: Run focused and full verification**

Run: `npm test -- src/components/canvas/EntityRenderer.test.tsx src/components/canvas/geometry.test.ts src/hooks/useStore.test.ts api/services/drawing-perception/pipeline.test.ts api/services/drawing-agent/runtime.test.ts`

Then run: `npm test && npm run check && npm run build && npm run lint`

Expected: all tests, type checking and build pass. If lint exposes pre-existing unrelated debt, record exact failures without modifying unrelated files.

- [ ] **Step 8: Run the real local drawing baseline**

Run: `npm run test:drawing -- test1.jpg`

Expected: accepted/progress output occurs within 30 seconds, at least one observation delta precedes terminal completion, final geometry remains auditable, and no media/model name is printed. Do not add or modify `test1.jpg`.

- [ ] **Step 9: Commit the completed feature**

```bash
git add src/components/Canvas.tsx src/components/canvas/EntityRenderer.tsx src/components/canvas/EntityRenderer.test.tsx src/components/canvas/geometry.test.ts src/index.css docs/tech-architecture.md
git commit -m "feat(ui): render progressive drawing reconstruction"
```
