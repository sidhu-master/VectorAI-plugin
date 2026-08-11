# Topology-Safe Repair Loop and Live Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Region-First edits preserve existing connections, reuse grounded context across repair candidates, escalate Lite/Lite/Turbo, expose only the latest real task status, and allow failed runs to be retried safely.

**Architecture:** Keep Drawing IR and its transaction validator authoritative. Add deterministic endpoint cleanup and anchor-preserving deformation before preview, cache revision-bound spatial grounding for design repairs, and project the rich event stream into one current UI status. A retry always starts a fresh audited run from the latest canonical revision while reusing the original user input.

**Tech Stack:** TypeScript, Node.js, React 19, Zustand, Vitest, SVG/Drawing IR, Server-Sent Events.

## Global Constraints

- Drawing IR remains the only canonical drawing state.
- Region-external and protected geometry must remain unchanged by default.
- Existing boundary connectivity must be preserved and no new dangling endpoints may be introduced.
- Logical candidate attempts use Lite, Lite, then Turbo; protocol/schema correction does not consume a candidate attempt.
- Model names stay in audit data and never appear in the task UI.
- The main task card shows only the latest meaningful domain status; full events remain replayable.
- Retry starts a new run from the latest canonical revision and never revives a failed run.
- Work directly on `main`; do not create a branch, worktree, or sub-agent.

---

### Task 1: Deterministic topology-safe spatial compilation

**Files:**
- Create: `api/services/drawing-spatial/anchored-deformation.ts`
- Create: `api/services/drawing-spatial/anchored-deformation.test.ts`
- Modify: `api/services/drawing-spatial/spatial-edit-compiler.ts`
- Modify: `api/services/drawing-spatial/spatial-edit-compiler.test.ts`
- Modify: `api/services/drawing-spatial/region-resolver.ts`
- Modify: `api/services/drawing-spatial/region-resolver.test.ts`
- Modify: `api/services/drawing-spatial/strategy-router.ts`
- Modify: `api/services/drawing-spatial/strategy-router.test.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.test.ts`

**Interfaces:**
- Consumes: `SpatialEditDesign`, `SpatialSelection.boundaryAnchors`, `SpatialTransform`, `GeometryNode`.
- Produces: `applyAnchoredDeformation(node, transform, context): GeometryNode`, protected fragments with unchanged quality, snapped split plans, and differential dangling-endpoint validation.

- [ ] **Step 1: Write failing compiler and deformation tests**

Add tests proving that protected fragment quality is byte-for-byte unchanged and that a rotated target polyline keeps fixed anchor coordinates:

```ts
expect(protectedAfter?.quality).toEqual(protectedBefore?.quality);
expect(deformedPolyline.vertices[0].point).toEqual(anchorPoint);
expect(deformedPolyline.vertices.at(-1)?.point).not.toEqual(originalTip);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- api/services/drawing-spatial/anchored-deformation.test.ts api/services/drawing-spatial/spatial-edit-compiler.test.ts
```

Expected: FAIL because `applyAnchoredDeformation` does not exist and protected split creates still receive design quality.

- [ ] **Step 3: Implement anchor-preserving deterministic deformation**

Create a focused point-mapping module with this public shape:

```ts
export interface AnchoredDeformationContext {
  anchors: Vec2[];
  targetGeometry: GeometryNode[];
  tolerance: number;
}

export function applyAnchoredDeformation(
  node: GeometryNode,
  transform: SpatialTransform,
  context: AnchoredDeformationContext,
): GeometryNode;
```

Map freeform vertices/control points using a smooth distance weight. Weight is exactly zero at every fixed anchor and reaches one at the farthest target point. Preserve analytic node types; translate/rotate/scale analytic centers and axes by the local weight. In `compileSpatialEdit`, use rigid transformation only when it leaves all boundary anchors inside tolerance; otherwise use anchored deformation for freeform targets and add `ANCHORED_DEFORMATION_APPLIED` to fidelity warnings. Apply `withDesignQuality` only to target fragments and whole targets.

- [ ] **Step 4: Run compiler and deformation tests and verify GREEN**

Run the same focused command. Expected: PASS.

- [ ] **Step 5: Write failing resolver, router, and validator tests**

Add these observable cases:

```ts
expect(selection.splitPlan[0].ranges).not.toContainEqual({
  range: [0.9975, 1], role: 'target',
});

expect(routeSpatialEditStrategy({
  goal: '把右手抬起来打招呼', document, region, selection,
}).primaryReason).not.toContain('工程几何');

expect(report.unexpectedDanglingEndpoints).toEqual([]);
```

The router fixture must include an unrelated auto-generated dimension; the validator fixture must include a pre-existing open endpoint in both before and after documents.

- [ ] **Step 6: Run resolver/router/validator tests and verify RED**

Run:

```bash
npm test -- api/services/drawing-spatial/region-resolver.test.ts api/services/drawing-spatial/strategy-router.test.ts api/services/drawing-spatial/spatial-validator.test.ts
```

Expected: FAIL because endpoint slivers survive, global annotations force geometric routing, and dangling endpoints are currently checked absolutely.

- [ ] **Step 7: Implement endpoint snapping, local routing, and differential validation**

In `RegionResolver`, snap region cuts to atomic-segment endpoints when their sampled path length is below:

```ts
const snapDistance = Math.max(tolerance * 10, sampledLength * 0.005);
```

Build anchors only after snapped ranges are merged. In the router, treat dimensions and constraints as hard geometry only when they reference `wholeNodes` or `crossingNodes`. In the validator, calculate baseline dangling endpoints from the original selected/crossing nodes, exclude valid boundary anchors, and reject only newly introduced unmatched endpoints.

- [ ] **Step 8: Run all drawing-spatial tests and commit**

Run:

```bash
npm test -- api/services/drawing-spatial
```

Expected: PASS.

Commit:

```bash
git add api/services/drawing-spatial
git commit -m "fix: preserve topology in spatial edit compilation"
```

---

### Task 2: Revision-bound repair context and Lite/Lite/Turbo candidate state machine

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.test.ts`
- Modify: `src/contracts/drawing-agent.ts`

**Interfaces:**
- Consumes: validated spatial grounding, `DrawingPreviewDefect[]`, `modelProfile.decision`, `modelProfile.repair`.
- Produces: revision-bound `SpatialRepairContext`, `candidateAttempt` progress metadata, failure classification, and a maximum of three candidate transactions.

- [ ] **Step 1: Write failing runtime tests for repair reuse and escalation**

Add a semantic-edit runtime test where the preview verifier rejects the first two candidates and accepts the third. Record region and design calls:

```ts
expect(regionProposer.propose).toHaveBeenCalledTimes(1);
expect(designModels).toEqual(['decision-model', 'decision-model', 'repair-model']);
expect(designInputs[1].repairFeedback).toContainEqual(
  expect.objectContaining({ code: 'connectivity' }),
);
expect(candidateEvents.map((event) => event.candidateAttempt)).toEqual([1, 2, 3]);
```

Add a separate test where `region-selection-empty` causes re-grounding and the third logical candidate uses the repair model. Add a protocol-error test proving schema correction stays on the same candidate attempt and model tier.

- [ ] **Step 2: Run the runtime tests and verify RED**

Run:

```bash
npm test -- api/services/drawing-agent/runtime.test.ts
```

Expected: FAIL because every defect re-grounds and any repair immediately selects the repair model.

- [ ] **Step 3: Add explicit repair context and failure classification**

Add a private revision-bound cache to `RunRecord`:

```ts
interface SpatialRepairContext {
  revision: RevisionId;
  observation: VisualObservation;
  workspace: Awaited<ReturnType<NonNullable<RuntimeApplication['open']>>>;
  episodeId: string;
  region: SemanticRegion;
  selection: SpatialSelection;
  split: MaterializedSplit;
  strategy: SpatialEditStrategy;
  targetGeometry: GeometryNode[];
  regionVersion: number;
  selectionVersion: number;
  selectionVersionId: string;
}
```

Classify failures as `protocol`, `design`, `selection`, `stale`, or `provider`. Reuse the cache for design/topology and compiler defects; clear it only for selection defects, stale revisions, new user instructions, commit completion, or a new run.

- [ ] **Step 4: Implement logical candidate model selection and progress metadata**

Use:

```ts
const candidateAttempt = record.state.recovery.validationRepairs + 1;
const modelName = candidateAttempt >= 3
  ? record.modelProfile.repair
  : record.modelProfile.decision;
```

Schema correction stays inside `#callSemanticModel` and therefore does not increment `validationRepairs`. Publish `candidateAttempt` and `maxCandidateAttempts: 3` on `designing`, `generating`, `previewing`, `verifying`, and `revising` events. Record the model tier only in audit data.

- [ ] **Step 5: Make default topology invariants explicit in model context**

Update the spatial design system prompt and user payload so the model always receives:

```ts
defaultInvariants: [
  'outside-region-unchanged',
  'protected-region-unchanged',
  'maintain-existing-connectivity',
  'no-new-dangling-endpoints',
  'preserve-style-unless-requested',
]
```

Tell the model to output a high-level transform for freeform anchored deformation and a replacement only when the topology cannot be expressed by that transform.

- [ ] **Step 6: Clear rejected previews on terminal failure**

Call `#clearEditPreview(record, 'reject')` before terminal failure publication and ensure `regionOverlay` becomes `null`. Keep rejected candidate snapshots only in audit/Episode files.

- [ ] **Step 7: Run agent tests and commit**

Run:

```bash
npm test -- api/services/drawing-agent
```

Expected: PASS.

Commit:

```bash
git add api/services/drawing-agent src/contracts/drawing-agent.ts
git commit -m "feat: reuse spatial context across bounded repair attempts"
```

---

### Task 3: Safe frontend retry from the latest Drawing IR revision

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`

**Interfaces:**
- Consumes: the last submitted prompt/attachment, current `document`, current `revision`, and terminal `agentStatus`.
- Produces: `retryAgent(): Promise<void>`, a fresh run subscription, and no duplicate user chat message.

- [ ] **Step 1: Write failing retry behavior tests**

Test a failed run followed by a canonical revision update and retry:

```ts
await store.getState().submitAgentInput('把右手抬起来');
agent.emit(failedEvent('grounding timeout'));
store.setState({ revision: revision2 });
await store.getState().retryAgent();

expect(agent.start).toHaveBeenLastCalledWith(expect.objectContaining({
  goal: '把右手抬起来', baseRevision: revision2,
}));
expect(store.getState().aiMessages.filter((message) => message.role === 'user'))
  .toHaveLength(1);
expect(store.getState().perceptionPreview.nodes).toEqual({});
```

Add a second test proving the original image attachment is reused.

- [ ] **Step 2: Run the store tests and verify RED**

Run:

```bash
npm test -- src/hooks/useStore.test.ts
```

Expected: FAIL because `retryAgent` and retained input do not exist and failed previews remain visible.

- [ ] **Step 3: Extract a shared run launcher and implement retry**

Store a private serializable submission:

```ts
interface AgentSubmission {
  goal: string;
  image?: string;
  mimeType?: string;
}
```

Refactor the current `startAgent` body into one closure that accepts `{ appendUserMessage: boolean }`. `startAgent` stores the submission and appends the user message; `retryAgent` requires terminal error state, reuses the submission, reads the current canonical revision, clears failed preview state, and launches with `appendUserMessage: false`.

- [ ] **Step 4: Run store tests and commit**

Run:

```bash
npm test -- src/hooks/useStore.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/hooks/useStore.ts src/hooks/useStore.test.ts
git commit -m "feat: retry failed agent runs from canonical state"
```

---

### Task 4: Latest real task status card and retry UI

**Files:**
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`
- Modify: `src/components/ConstructionTimeline.tsx`
- Modify: `src/components/ConstructionTimeline.test.tsx`

**Interfaces:**
- Consumes: ordered `AgentProgressEvent[]`, `agentError`, logical candidate metadata, `retryAgent`.
- Produces: one latest meaningful status, live elapsed time, exact error copy, and a retry button in terminal error state.

- [ ] **Step 1: Write failing presentation tests**

Replace fixed-stage assertions with behavior assertions:

```ts
expect(presentation.heading).toBe('正在验证手臂连接');
expect(presentation.attemptLabel).toBe('第 2/3 次尝试');
expect(presentation).not.toHaveProperty('stages');
expect(presentation).not.toHaveProperty('details');
```

Build the event sequence so a meaningful `verifying` event is followed by `model_started` and `heartbeat`; the heading must remain the verifying title. Pass `nowMs` and assert active elapsed time advances locally.

- [ ] **Step 2: Run presentation tests and verify RED**

Run:

```bash
npm test -- src/components/agent/task-presentation.test.ts src/components/ConstructionTimeline.test.tsx
```

Expected: FAIL because the current presenter returns fixed stages and details.

- [ ] **Step 3: Implement meaningful-event projection**

Define domain event priority explicitly. Ignore `model_started`, `model_finished`, and `heartbeat` when a later meaningful domain action exists. For active runs derive start time as `event.timestamp - event.elapsedMs` and compute elapsed from `nowMs`. Return:

```ts
interface PresentedAgentTask {
  heading: string;
  detail: string | null;
  elapsed: string;
  attemptLabel: string | null;
  tone: 'active' | 'paused' | 'success' | 'danger' | 'neutral';
}
```

- [ ] **Step 4: Replace the fixed timeline with one live status card**

Use a one-second React timer only while active. Render the latest heading, optional detail, elapsed time, and candidate attempt. On error, render the exact safe `agentError` and a primary “重试” button wired to `retryAgent`; retain reset, pause/resume, and stop controls. Do not render model names or an event list.

- [ ] **Step 5: Run component tests and commit**

Run:

```bash
npm test -- src/components/agent/task-presentation.test.ts src/components/ConstructionTimeline.test.tsx src/components/AIDialog.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/components/agent src/components/ConstructionTimeline.tsx src/components/ConstructionTimeline.test.tsx
git commit -m "feat: show live agent status with retry action"
```

---

### Task 5: Regression verification and real test2 acceptance

**Files:**
- Verify: `scripts/test2-self-semantic-edit.ts`
- Verify: `scripts/e2e-test2-semantic-edit.ts`

**Interfaces:**
- Consumes: the completed runtime, Drawing IR repository, and existing test2 fixture/scripts.
- Produces: evidence that automated checks and the real preview path work together.

- [ ] **Step 1: Run focused topology and Agent suites**

```bash
npm test -- api/services/drawing-spatial api/services/drawing-agent src/hooks/useStore.test.ts src/components/agent/task-presentation.test.ts src/components/ConstructionTimeline.test.tsx
```

Expected: PASS with no unhandled rejection or timer leak.

- [ ] **Step 2: Run complete static and automated verification**

```bash
npm run check
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run deterministic test2 spatial regression**

```bash
npm run test:test2-self-edit
```

Expected: the modified right-arm candidate preserves protected geometry, keeps boundary anchors connected, and passes spatial validation.

- [ ] **Step 4: Run the real semantic edit flow when model credentials are available**

```bash
npm run e2e:test2-semantic-edit -- "把图形的右手抬起来打招呼"
```

Expected: a valid incremental transaction or an exact provider failure; no invalid preview remains on the canvas. Audit must show candidate model tiers Lite/Lite/Turbo only if all three candidates were needed.

- [ ] **Step 5: Restart the local server and inspect the browser**

Restart the existing dev process, open `http://localhost:5173/`, verify the task card shows one live status, and force or replay a timeout to verify the retry button starts a new run.

- [ ] **Step 6: Record verification evidence**

Capture the exact passing command results, the final run ID, candidate-attempt audit sequence, and whether the real model flow completed or stopped on a provider error. Do not change the regression scripts merely to make a failing result appear successful.
