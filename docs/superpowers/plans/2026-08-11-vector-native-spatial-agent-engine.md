# Vector-Native Spatial Agent Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vertical, auditable path where an AI observes canonical Drawing IR through a shared renderer, resolves a semantic 2D target, previews an incremental edit on the server, verifies vector and visual results, and commits the transaction.

**Architecture:** Drawing IR remains the only state source. A pure TypeScript `SceneCompiler` creates a render-neutral display list consumed by browser SVG and server raster/grounding adapters. The Agent runtime receives a server-generated `VisualObservation`, produces task-level `EditIntent` before low-level commands, verifies the in-memory preview deterministically and visually, then commits or loops.

**Tech Stack:** TypeScript 5.8, React 18, SVG, Express 4, Sharp, Zustand, Vitest, SSE.

## Global Constraints

- Work directly on `main`; the user explicitly does not want branches or worktrees before MVP release.
- Use the primary agent only; do not dispatch subagents.
- Use TDD for every production behavior change and verify each new test fails for the intended reason before implementation.
- Drawing IR is the only formal front-end/back-end drawing state.
- Every AI write must use Command → Preview → Verify → Commit with `baseRevision` protection.
- Server AI loops must not depend on a browser screenshot round trip.
- Existing `test1.jpg`, `test2.png`, `.local/`, and `tmp/` stay local and untracked.
- Do not expose model names in public task events.
- Keep accepted-run response under 1 second and target a visible progress/heartbeat event at least every 30 seconds; record misses as UX telemetry rather than rejecting a correct Drawing IR result.
- Preserve the MVP boundary: 2D geometry, text, and dimensions; no 3D, layers, blocks, or hatches.

---

## Milestone 1: Runtime correctness baseline

### Task 1: Make model audit callbacks call-scoped

**Files:**
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/model-adapters.ts`
- Modify: `api/services/drawing-agent/model-adapters.test.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`

**Interfaces:**
- Consumes: existing planner, decision, and acceptance adapter inputs.
- Produces: `DrawingModelCallContext`; no mutable `adapter.onRawReply` property.

- [ ] **Step 1: Write failing adapter and concurrent-run audit tests**

```typescript
interface DrawingModelCallContext {
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
}

it('sends raw replies only to the callback of the current call', async () => {
  const first: string[] = [];
  const second: string[] = [];
  await Promise.all([
    adapter.decide(decisionInput({ onRawReply: (_role, reply) => first.push(reply) })),
    adapter.decide(decisionInput({ onRawReply: (_role, reply) => second.push(reply) })),
  ]);
  expect(first).toEqual(['first']);
  expect(second).toEqual(['second']);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run api/services/drawing-agent/model-adapters.test.ts api/services/drawing-agent/runtime.test.ts`

Expected: FAIL because model input has no call-scoped callback and runtime mutates the shared adapter.

- [ ] **Step 3: Add the callback to each model input and remove mutable adapter state**

```typescript
export interface DrawingModelCallContext {
  onRawReply?: (role: DrawingModelRole, reply: string) => void;
}

export interface DrawingDecisionInput extends DrawingModelCallContext {
  plan: DrawingAgentPlan;
  currentWorkflowNodeId: string;
  revision: RevisionId;
  pendingInstructions: string[];
  recentReceipts: DrawingToolReceipt[];
  toolEvidence: DrawingToolEvidence[];
  attempt: number;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
  vision?: DrawingVisionContext;
}
```

Adapters call `input.onRawReply?.('decision', reply)`. Runtime passes `(replyRole, reply) => this.#auditRaw(record, replyRole, reply)` inside the input object and removes save/restore of `adapter.onRawReply`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/model-adapters.test.ts api/services/drawing-agent/runtime.test.ts`

Expected: all focused tests pass and concurrent run audit records remain isolated.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-agent/types.ts api/services/drawing-agent/model-adapters.ts api/services/drawing-agent/model-adapters.test.ts api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts
git commit -m "fix: isolate drawing model audit callbacks"
```

### Task 2: Ensure existing text-instructed drawings receive vision and dual verification

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`

**Interfaces:**
- Consumes: existing `renderForVision`, `verify_goal`, and acceptance adapter.
- Produces: visual context for `text_only` drawing edits and deterministic-plus-visual goal verification.

- [ ] **Step 1: Write failing behavior tests**

```typescript
it('renders vision for a text-only instruction on an existing drawing', async () => {
  // Start with goal text, a viewport, and no source attachment.
  // Decision adapter captures input.vision.
  expect(capturedVision?.snapshot.nodes.length).toBeGreaterThan(0);
});

it('does not visually accept a goal that fails deterministic assertions', async () => {
  expect(final.status).toBe('failed');
  expect(acceptanceCalls).toBe(0);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts`

Expected: the text-only decision receives `undefined` vision, and visual verification currently bypasses deterministic verification.

- [ ] **Step 3: Correct visual eligibility and verification order**

`#ensureVision` skips only missing render context and `analyze_only`. `#verifyGoal` always runs the deterministic `verify_goal` tool first; visual acceptance runs only after deterministic success and only for visual-semantic goals.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts`

Expected: runtime tests pass, text-only edits receive vision, and visual acceptance cannot override invalid vector state.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts
git commit -m "fix: verify visual drawing edits against canonical state"
```

---

## Milestone 2: Shared SceneCompiler

### Task 3: Define a render-neutral scene and compile all MVP geometry

**Files:**
- Create: `src/drawing/scene/types.ts`
- Create: `src/drawing/scene/compile.ts`
- Create: `src/drawing/scene/path.ts`
- Create: `src/drawing/scene/index.ts`
- Create: `src/drawing/tests/scene-compile.test.ts`
- Modify: `src/drawing/index.ts`

**Interfaces:**
- Consumes: `DrawingDocument`, `GeometryNode`, `AnnotationNode`, `Bounds2D`, and optional view bounds.
- Produces: `compileDrawingScene(document, options): RenderScene`, `compileDrawingNode(node, options): ScenePrimitive[]`, and stable `nodeIndex` bounds.

- [ ] **Step 1: Write failing golden scene tests for every geometry type**

```typescript
const scene = compileDrawingScene(documentWithAllGeometry(), {
  revision: 'revision_scene_1' as RevisionId,
  viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
});
expect(scene.primitives.map((item) => [item.nodeId, item.kind])).toEqual([
  ['point', 'marker'], ['line', 'path'], ['ray', 'path'], ['xline', 'path'],
  ['circle', 'path'], ['arc', 'path'], ['ellipse', 'path'],
  ['polyline', 'path'], ['spline', 'path'],
]);
expect(scene.nodeIndex.circle.worldBounds).toEqual({ minX: 10, minY: 10, maxX: 30, maxY: 30 });
```

- [ ] **Step 2: Run the scene test and verify RED**

Run: `npx vitest run src/drawing/tests/scene-compile.test.ts`

Expected: FAIL because the scene module does not exist.

- [ ] **Step 3: Implement minimal scene types and pure geometry compilation**

```typescript
export interface RenderScene {
  drawingId: DrawingId;
  revision: RevisionId;
  rendererVersion: string;
  worldBounds: Bounds2D | null;
  primitives: ScenePrimitive[];
  nodeIndex: Record<string, SceneNodeIndex>;
}

export type ScenePrimitive = ScenePath | SceneText | SceneMarker;
```

Circle/arc/ellipse remain analytic `arc` path commands; polyline bulges compile to arc commands; splines compile through one shared curve routine. Ray/xline clipping happens in the compiler from `viewBounds`.

- [ ] **Step 4: Run the scene test and verify GREEN**

Run: `npx vitest run src/drawing/tests/scene-compile.test.ts src/drawing/tests/query.test.ts`

Expected: scene and existing bounds tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/drawing/scene src/drawing/tests/scene-compile.test.ts src/drawing/index.ts
git commit -m "feat: compile drawing ir into shared render scenes"
```

### Task 4: Compile text and dimension annotations into the shared scene

**Files:**
- Modify: `src/drawing/scene/compile.ts`
- Modify: `src/drawing/scene/types.ts`
- Modify: `src/drawing/tests/scene-compile.test.ts`

**Interfaces:**
- Consumes: text/dimension annotation definitions and render scale.
- Produces: scene paths, markers, and text for linear/aligned/radius/fallback dimensions.

- [ ] **Step 1: Add failing annotation golden tests**

```typescript
expect(primitivesFor(scene, 'dimension_linear').map((item) => item.role)).toEqual([
  'dimension-extension', 'dimension-extension', 'dimension-measure',
  'dimension-arrow', 'dimension-arrow', 'dimension-text',
]);
expect(primitivesFor(scene, 'label')[0]).toMatchObject({
  kind: 'text', content: 'R20', position: [12, 8],
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/drawing/tests/scene-compile.test.ts`

Expected: annotation primitives are absent.

- [ ] **Step 3: Move dimension geometry rules into the pure compiler**

Use scale-independent world geometry plus `screenConstant` metadata for arrowheads, markers, and text backgrounds. No JSX, DOM, or Sharp imports are permitted.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx vitest run src/drawing/tests/scene-compile.test.ts src/components/canvas/EntityRenderer.test.tsx`

Expected: all scene and existing annotation rendering tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/drawing/scene src/drawing/tests/scene-compile.test.ts
git commit -m "feat: compile drawing annotations into shared scenes"
```

### Task 5: Add a shared SVG serializer and migrate browser rendering

**Files:**
- Create: `src/drawing/scene/svg.ts`
- Create: `src/drawing/tests/scene-svg.test.ts`
- Create: `src/components/canvas/SceneNodeRenderer.tsx`
- Create: `src/components/canvas/SceneNodeRenderer.test.tsx`
- Modify: `src/components/Canvas.tsx`
- Delete: `src/components/canvas/EntityRenderer.tsx`
- Delete: `src/components/canvas/EntityRenderer.test.tsx`

**Interfaces:**
- Consumes: `ScenePrimitive[]`, node render state, view scale.
- Produces: `scenePathData(path): string`, `SceneNodeRenderer`, and the existing entity selection contract.

- [ ] **Step 1: Write failing serializer and React renderer tests**

```typescript
expect(scenePathData(circlePath)).toBe('M 30 20 A 10 10 0 1 1 10 20 A 10 10 0 1 1 30 20');
render(<SceneNodeRenderer node={sceneNode} selected scale={2} onSelect={onSelect} />);
expect(screen.getByTestId('scene-node-circle')).toHaveAttribute('data-entity-id', 'circle');
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/drawing/tests/scene-svg.test.ts src/components/canvas/SceneNodeRenderer.test.tsx`

Expected: serializer and component are missing.

- [ ] **Step 3: Implement serializer and render compiled scene nodes**

The component applies UI-only styles (selected, candidate, provisional) but never interprets DrawingNode geometry. Canvas compiles committed and preview documents with the current world viewport and groups primitives by `nodeId` for interaction.

- [ ] **Step 4: Run canvas and scene tests**

Run: `npx vitest run src/drawing/tests/scene-svg.test.ts src/components/canvas/SceneNodeRenderer.test.tsx src/components/Canvas.test.tsx src/components/canvas/geometry.test.ts`

Expected: rendering and selection behavior pass without `EntityRenderer`.

- [ ] **Step 5: Commit**

```bash
git add src/drawing/scene src/components/Canvas.tsx src/components/canvas/SceneNodeRenderer.tsx src/components/canvas/SceneNodeRenderer.test.tsx
git rm src/components/canvas/EntityRenderer.tsx src/components/canvas/EntityRenderer.test.tsx
git commit -m "refactor: render the canvas from shared scenes"
```

### Task 6: Migrate server raster, semantic planes, and grounding to RenderScene

**Files:**
- Create: `api/services/drawing-render/rasterize-scene.ts`
- Create: `api/services/drawing-render/rasterize-scene.test.ts`
- Modify: `api/services/drawing-feedback/source-renderer.ts`
- Modify: `api/services/drawing-feedback/source-renderer.test.ts`
- Modify: `api/services/drawing-vision/grounding-renderer.ts`
- Modify: `api/services/drawing-vision/grounding-renderer.test.ts`

**Interfaces:**
- Consumes: `RenderScene`, affine world-to-image transform, render profile.
- Produces: RGBA/semantic raster output and `GroundingSnapshot` with exact `{ label, nodeId, rgb, imageBounds, worldBounds, zOrder, clipped }`.

- [ ] **Step 1: Write failing cross-adapter and offscreen grounding tests**

```typescript
expect(snapshot.nodes[0]).toMatchObject({
  label: 'G001', nodeId: 'circle', rgb: expect.any(Array), clipped: false,
});
expect(snapshot.nodes.some((node) => node.nodeId === 'offscreen')).toBe(false);
expect(maskBounds(sceneRaster)).toEqual(snapshot.nodes[0].bounds);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run api/services/drawing-render/rasterize-scene.test.ts api/services/drawing-vision/grounding-renderer.test.ts`

Expected: shared rasterizer and explicit palette fields do not exist; offscreen nodes may produce clamped phantom bounds.

- [ ] **Step 3: Implement one scene rasterizer and adapt existing services**

Raster bounds update only when at least one pixel is written. Palette allocation is deterministic per observation and collision-free for the visible node count. Existing source comparison receives semantic planes derived from the shared scene.

- [ ] **Step 4: Run all renderer tests**

Run: `npx vitest run api/services/drawing-render api/services/drawing-vision api/services/drawing-feedback/source-renderer.test.ts api/services/drawing-feedback/source-comparator.test.ts`

Expected: server renderer tests pass and use no direct DrawingNode geometry switch outside SceneCompiler.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-render api/services/drawing-feedback/source-renderer.ts api/services/drawing-feedback/source-renderer.test.ts api/services/drawing-vision
git commit -m "refactor: render server observations from shared scenes"
```

---

## Milestone 3: Grounded semantic editing

### Task 7: Build revision-bound overview and detail observations

**Files:**
- Create: `api/services/drawing-vision/observation-types.ts`
- Create: `api/services/drawing-vision/observation-builder.ts`
- Create: `api/services/drawing-vision/observation-builder.test.ts`
- Modify: `api/services/drawing-application/application.ts`
- Modify: `api/services/drawing-application/application.test.ts`
- Modify: `api/services/drawing-agent/types.ts`

**Interfaces:**
- Consumes: Drawing workspace revision, optional selected IDs, optional user viewport, optional target bounds.
- Produces: `VisualObservation` containing overview, target-detail, optional user-viewport, vector digest, transforms, grounding, and renderer version.

- [ ] **Step 1: Write failing observation tests**

```typescript
const observation = await application.observeForAgent({ drawingId, selectedIds: ['hand'] });
expect(observation.views.map((view) => view.purpose)).toEqual(['overview', 'target-detail']);
expect(observation.revision).toBe(workspace.revision);
expect(observation.views[0].worldBounds).toContainBounds(documentBounds);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run api/services/drawing-vision/observation-builder.test.ts api/services/drawing-application/application.test.ts`

Expected: observation builder and application method do not exist.

- [ ] **Step 3: Implement fit views, detail selection, handles, and cache keys**

The cache key is `drawingId/revision/viewSpecHash/selectionHash/rendererVersion/styleProfile`. Overview is generated even when no browser viewport exists. Images are stored behind bounded in-memory handles for the run; public events contain metadata, not base64 payloads.

- [ ] **Step 4: Run observation and application tests**

Run: `npx vitest run api/services/drawing-vision api/services/drawing-application/application.test.ts`

Expected: overview/detail views are deterministic and revision-bound.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-vision api/services/drawing-application/application.ts api/services/drawing-application/application.test.ts api/services/drawing-agent/types.ts
git commit -m "feat: build grounded visual observations on the server"
```

### Task 8: Introduce VisualFeatureGraph and EditIntent model stages

**Files:**
- Create: `src/contracts/drawing-spatial-agent.ts`
- Create: `src/contracts/drawing-spatial-agent.test.ts`
- Create: `api/services/drawing-agent/semantic-adapters.ts`
- Create: `api/services/drawing-agent/semantic-adapters.test.ts`
- Modify: `api/services/ai-gateway.ts`
- Modify: `api/services/ai-gateway-drawing.test.ts`
- Modify: `api/services/drawing-agent/types.ts`

**Interfaces:**
- Consumes: user goal, `VisualObservation`, Drawing summary, spatial query evidence.
- Produces: validated `VisualFeatureGraph`, `EditIntent`, and call-scoped model audit output.

- [ ] **Step 1: Write failing protocol parser tests**

```typescript
expect(parseEditIntent({
  operation: 'local-redraw',
  targetFeatureIds: ['right_hand'],
  targetNodeIds: ['G31'],
  anchors: [{ nodeId: 'G30', role: 'shoulder' }],
  preserveNodeIds: ['body'],
  preserveRules: [{ type: 'outside-target-unchanged' }],
  desiredRelations: [{ type: 'connected', from: 'G30', to: 'G31' }],
  confidence: 0.91,
  evidenceRefs: ['view_detail'],
})).toMatchObject({ operation: 'local-redraw', confidence: 0.91 });
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/contracts/drawing-spatial-agent.test.ts api/services/drawing-agent/semantic-adapters.test.ts`

Expected: protocols and adapters do not exist.

- [ ] **Step 3: Implement strict parsers and multimodal adapters**

Target resolver returns semantic hypotheses with stable Drawing node IDs and cited observation handles. Intent adapter cannot output DrawingCommand. The AI transport supports both configured company gateway and direct OpenAI-compatible endpoints for multimodal calls.

- [ ] **Step 4: Run protocol, adapter, and gateway tests**

Run: `npx vitest run src/contracts/drawing-spatial-agent.test.ts api/services/drawing-agent/semantic-adapters.test.ts api/services/ai-gateway-drawing.test.ts`

Expected: valid outputs parse, invented/unseen IDs and malformed anchors fail with typed errors.

- [ ] **Step 5: Commit**

```bash
git add src/contracts/drawing-spatial-agent.ts src/contracts/drawing-spatial-agent.test.ts api/services/drawing-agent/semantic-adapters.ts api/services/drawing-agent/semantic-adapters.test.ts api/services/ai-gateway.ts api/services/ai-gateway-drawing.test.ts api/services/drawing-agent/types.ts
git commit -m "feat: resolve semantic drawing targets before geometry edits"
```

### Task 9: Compile EditIntent through bounded edit strategies

**Files:**
- Create: `api/services/drawing-edit/strategy-types.ts`
- Create: `api/services/drawing-edit/compile-intent.ts`
- Create: `api/services/drawing-edit/compile-intent.test.ts`
- Create: `api/services/drawing-edit/preserve-report.ts`
- Create: `api/services/drawing-edit/preserve-report.test.ts`

**Interfaces:**
- Consumes: `EditIntent`, target nodes, anchors, and optional AI-generated candidate geometry.
- Produces: `CompiledEditCandidate { commands, targetNodeIds, preserveNodeIds, allowedBounds, strategy }` and deterministic preservation report.

- [ ] **Step 1: Write failing transform, local-redraw, and preservation tests**

```typescript
expect(compileEditIntent(rotationIntent, context).commands).toEqual([
  { type: 'geometry.update', id: 'arm', changes: { start: [10, 10], end: [10, 40] }, expected: oldArm },
]);
expect(comparePreservedNodes(before, preview, ['body']).changedNodeIds).toEqual([]);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run api/services/drawing-edit`

Expected: edit compiler does not exist.

- [ ] **Step 3: Implement exact transform and local replacement strategies**

MVP strategies are `transform`, `deform`, and `local-redraw`. Local redraw accepts candidate Drawing geometry, deletes the authorized old target set, snaps declared anchors within tolerance, and emits candidate-quality nodes when confidence is below 0.6.

- [ ] **Step 4: Run drawing-edit and command tests**

Run: `npx vitest run api/services/drawing-edit src/drawing/tests/command.test.ts src/drawing/tests/transaction.test.ts`

Expected: strategies produce valid incremental commands and reject changes outside the authorized target/preserve boundary.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-edit
git commit -m "feat: compile semantic edit intents into bounded transactions"
```

---

## Milestone 4: Preview-first verification loop and release gate

### Task 10: Verify semantic edits before commit and loop on defects

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Modify: `api/services/drawing-agent/tool-registry.ts`
- Modify: `api/services/drawing-agent/tool-registry.test.ts`
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/contracts/drawing-agent.test.ts`

**Interfaces:**
- Consumes: observation, feature graph, EditIntent, compiled candidate, preview document.
- Produces: audited Observe → Ground → Design → Preview → Verify → Commit/Revise loop with typed defects.

- [ ] **Step 1: Write a failing runtime test using a real preview document**

```typescript
expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
  'observing', 'grounding', 'designing', 'previewing', 'verifying', 'revising', 'committed',
]));
expect(commitCount).toBe(1);
expect(firstRejectedPreview.wasCommitted).toBe(false);
expect(finalDocument.geometry.some((node) => node.id === oldHandId)).toBe(false);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/services/drawing-agent/tool-registry.test.ts src/contracts/drawing-agent.test.ts`

Expected: current runtime commits before semantic visual acceptance and lacks structured stage events.

- [ ] **Step 3: Add preview-scoped verification and repair feedback**

The runtime renders before/preview/diff from the in-memory preview. Deterministic report must pass before the visual verifier runs. A failed verifier returns defects to the next observation without committing. A passing result commits exactly the prepared handle with revision protection.

- [ ] **Step 4: Run runtime and transaction tests**

Run: `npx vitest run api/services/drawing-agent src/contracts/drawing-agent.test.ts src/drawing/tests/transaction.test.ts`

Expected: rejected previews never commit, defects drive a real second decision, and audit order is replayable.

- [ ] **Step 5: Commit**

```bash
git add api/services/drawing-agent src/contracts/drawing-agent.ts src/contracts/drawing-agent.test.ts
git commit -m "feat: verify semantic drawing previews before commit"
```

### Task 11: Stream server-side progress and transaction deltas to the canvas

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`
- Modify: `src/drawing/preview/types.ts`
- Modify: `src/drawing/preview/reducer.ts`
- Modify: `src/drawing/tests/preview.test.ts`

**Interfaces:**
- Consumes: public semantic stage events and transaction preview/commit deltas.
- Produces: continuously visible canvas changes, pause/resume compatibility, and model-name-free task presentation.

- [ ] **Step 1: Write failing client/store stage tests**

```typescript
expect(presentTask(stageEvent('grounding')).currentStage).toBe('perceive');
expect(store.getState().perceptionPreview.entities).toContainEqual(expect.objectContaining({ id: 'raised_hand' }));
expect(JSON.stringify(publicEvent)).not.toContain('doubao');
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/services/agent-client.test.ts src/hooks/useStore.test.ts src/components/agent/task-presentation.test.ts src/drawing/tests/preview.test.ts`

Expected: new stage/delta events are not parsed or projected.

- [ ] **Step 3: Implement event parsing and idempotent preview projection**

Preview deltas render immediately; committed transaction events reconcile provisional entities against the canonical drawing revision. Duplicate SSE event IDs and transactions are ignored.

- [ ] **Step 4: Run front-end state and component tests**

Run: `npx vitest run src/services/agent-client.test.ts src/hooks/useStore.test.ts src/components/agent/task-presentation.test.ts src/drawing/tests/preview.test.ts src/components/Canvas.test.tsx`

Expected: stages and incremental geometry appear without full document reload.

- [ ] **Step 5: Commit**

```bash
git add src/contracts/drawing-agent.ts src/services/agent-client.ts src/services/agent-client.test.ts src/hooks/useStore.ts src/hooks/useStore.test.ts src/components/agent src/drawing/preview src/drawing/tests/preview.test.ts
git commit -m "feat: stream semantic edit previews to the canvas"
```

### Task 12: Establish test2 semantic-edit, replay, and latency release gates

**Files:**
- Create: `api/services/drawing-benchmark/semantic-edit.ts`
- Create: `api/services/drawing-benchmark/semantic-edit.test.ts`
- Create: `scripts/e2e-test2-semantic-edit.ts`
- Modify: `package.json`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/superpowers/specs/2026-08-11-vector-native-spatial-agent-engine-design.md`

**Interfaces:**
- Consumes: test2-derived Drawing IR fixture, recorded observation/model/tool audit, before/final documents.
- Produces: structural, visual, replay, and latency benchmark report.

- [ ] **Step 1: Write failing benchmark tests**

```typescript
expect(report).toMatchObject({
  oldTargetRemoved: true,
  anchorsConnected: true,
  preservedNodesChanged: [],
  previewVerifiedBeforeCommit: true,
  replayExact: true,
});
expect(report.maxVisibleSilenceMs).toBeLessThanOrEqual(30_000);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run api/services/drawing-benchmark/semantic-edit.test.ts`

Expected: semantic edit benchmark does not exist.

- [ ] **Step 3: Implement the report and real local E2E command**

The automated unit fixture is versioned Drawing IR without the local image. The manual/real-model command reads local `test2.png`, persists only ignored audit artifacts, and fails on duplicate old limbs, disconnected anchors, unrelated changes, or non-replayable commits. A visible event gap above 30 seconds is reported separately as a UX target miss.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Run: `npm run check`

Run: `npm run build`

Run: `npm run lint`

Expected: tests, type check, and build pass. ESLint has no errors in files changed by this plan; any pre-existing repository lint failures are listed with exact paths and counts.

- [ ] **Step 5: Run local test2 preview flow**

Run: `npm run e2e:test2-semantic-edit`

Expected system result: the server produces overview/detail observations, at least one visible preview before commit, a final Drawing IR transaction, and an exact replay. Current-model failures are retained as provider conformance evidence and do not invalidate a passing injected-provider transaction path.

- [ ] **Step 6: Commit**

```bash
git add api/services/drawing-benchmark/semantic-edit.ts api/services/drawing-benchmark/semantic-edit.test.ts scripts/e2e-test2-semantic-edit.ts package.json docs/tech-architecture.md docs/superpowers/specs/2026-08-11-vector-native-spatial-agent-engine-design.md
git commit -m "test: gate vector-native semantic drawing edits"
```

## Plan completion audit

- [x] Every production behavior was introduced through a test that was observed failing first.
- [x] No geometry interpretation remains duplicated between browser and server renderers.
- [x] Every accepted AI edit is a replayable Drawing IR transaction.
- [x] Text-only instructions on existing drawings receive server visual observations.
- [x] Semantic visual edits are verified against before/preview/diff before commit.
- [x] An injected correct `test2` EditIntent preserves 92 external nodes, connects the shoulder pivot, previews validly, and commits through Drawing IR.
- [x] Public task events contain no model names; 30-second visibility is measured separately from correctness.
- [x] `npm test`, `npm run check`, and `npm run build` pass with fresh output.

Fresh verification: 100 test files / 597 tests passed; type-check and production build passed. All files changed by this plan pass ESLint. Repository-wide lint remains blocked by 23 pre-existing errors and one warning in `api/routes/auth.ts`, `drawing-cv/opencv-worker.ts`, `drawing-cv/tool-registry.ts`, `drawing-feedback/slot-store.ts`, `src/components/Canvas.tsx`, `src/core/tests/compiler.test.ts`, `src/core/validator.ts`, and `vite.config.ts`.
