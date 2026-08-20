# Image-only Fast Vectorization and Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make image-only uploads complete through the deterministic vectorization pipeline with zero model calls and reveal each vector batch as progressively drawn SVG paths.

**Architecture:** An empty user goal plus an `image/*` source selects a bounded fast lane inside the existing model-led runtime. The runtime executes one deterministic tool action at a time, reusing the current Preview/Commit/audit machinery, while the frontend applies a bounded path reveal to existing outline preview deltas.

**Tech Stack:** TypeScript, React, Zustand, SVG/CSS animation, Vitest, Express SSE, Drawing IR transaction tools.

## Global Constraints

- Image plus any user text remains on the Agent path.
- PDF remains on the Agent path.
- The fast lane must produce no model call and must preserve pause, stop, audit, Preview, Commit, annotations and appended instructions.
- A vectorization batch contains at most 48 normal nodes and its visual reveal must finish within 520ms.
- Low-confidence geometry remains red and reduced-motion disables path animation.
- Do not create a branch or dispatch subagents.

---

### Task 1: Preserve empty goal for image-only submissions

**Files:**
- Modify: `src/hooks/useStore.test.ts`
- Modify: `src/hooks/useStore.ts`

**Interfaces:**
- Consumes: `submitAgentInput(prompt?, image?, mimeType?)`
- Produces: `AgentClient.start({ goal: '', attachment })` for image-only input.

- [ ] **Step 1: Write the failing store test**

Change the image-only expectation to:

```ts
expect(agent.start).toHaveBeenCalledWith(expect.objectContaining({
  drawingId,
  baseRevision: revision1,
  goal: '',
  attachment: { data: 'aW1hZ2U=', mimeType: 'image/png', page: 1 },
}));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/hooks/useStore.test.ts -t "image-only upload"`  
Expected: FAIL because the store still sends `解析并重建上传的二维图纸`.

- [ ] **Step 3: Implement the minimal client boundary**

Keep `requestedGoal` as the submitted `goal`; use the attachment itself to satisfy the start condition.
Keep the synthetic reconstruction phrase out of both the user message and server request.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run src/hooks/useStore.test.ts -t "image-only upload"`  
Expected: PASS.

### Task 2: Execute image-only reconstruction without a model call

**Files:**
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`

**Interfaces:**
- Consumes: `StartDrawingAgentRunInput` with empty `goal` and `source.mimeType` beginning with `image/`.
- Produces: ordered internal actions for `vectorize_image` and `preview_vectorization_batch`, followed by automatic annotations and completion.

- [ ] **Step 1: Write the failing runtime integration test**

Create a source-backed runtime with a deterministic vectorization fixture and a model whose `next()` throws if called. Start with:

```ts
goal: '',
source: {
  sourceId: 'source_image',
  sha256: 'a'.repeat(64),
  mimeType: 'image/png',
  byteLength: 4,
  page: 1,
}
```

Assert completed status, every vector batch committed, automatic annotations committed,
`model.calls === 0`, and progress contains `vectorizing` before `previewing`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts -t "imports an image-only source without calling the model"`  
Expected: FAIL because `#nextAction` currently calls the model first.

- [ ] **Step 3: Add the bounded deterministic fast lane**

Add a predicate equivalent to:

```ts
function isImageOnlyImport(record: RunRecord): boolean {
  return record.input.goal.trim() === ''
    && Boolean(record.input.source?.mimeType.startsWith('image/'));
}
```

Track candidate handle, committed batch index and annotation completion on `RunRecord`.
Advance one deterministic tool action per drive-loop iteration. Wrap each tool with an
`AbortController`, `ACTION_STARTED`, a deterministic audit event and the existing
`#executeTool`. Fail on a failed receipt; do not invoke the model as a fallback.

- [ ] **Step 4: Preserve appended instructions**

After import completion, finish immediately only when active and pending instructions are empty.
Otherwise continue into `#nextAction` so the same Run applies the user’s added instruction.

- [ ] **Step 5: Run runtime tests and verify GREEN**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts`  
Expected: all runtime tests pass.

### Task 3: Add bounded per-path reveal timing

**Files:**
- Create: `src/drawing/preview/reveal.ts`
- Create: `src/drawing/preview/reveal.test.ts`
- Modify: `src/drawing/index.ts`

**Interfaces:**
- Produces: `vectorRevealTiming(index: number, total: number): { delayMs: number; durationMs: number }`.

- [ ] **Step 1: Write timing tests**

Assert a one-node batch starts at 0, a 48-node batch has nondecreasing delays, and:

```ts
const last = vectorRevealTiming(47, 48);
expect(last.delayMs + last.durationMs).toBeLessThanOrEqual(520);
```

- [ ] **Step 2: Run timing tests and verify RED**

Run: `pnpm vitest run src/drawing/preview/reveal.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement timing**

Use a 220ms stagger window and 300ms path duration. Clamp index and total so invalid input cannot produce negative or unbounded CSS values.

- [ ] **Step 4: Run timing tests and verify GREEN**

Run: `pnpm vitest run src/drawing/preview/reveal.test.ts`  
Expected: PASS.

### Task 4: Render outline previews as progressively drawn paths

**Files:**
- Modify: `src/components/Canvas.test.tsx`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/canvas/SceneNodeRenderer.test.tsx`
- Modify: `src/components/canvas/SceneNodeRenderer.tsx`
- Modify: `src/components/canvas/EntityRenderer.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: stable entity index/count from `PerceptionPreviewLayer` and `vectorRevealTiming`.
- Produces: `data-vector-reveal`, `pathLength="1"` and bounded CSS variables on provisional outline paths.

- [ ] **Step 1: Write failing renderer tests**

Render two provisional outline entities and assert their paths have `data-vector-reveal`,
`pathLength="1"`, and different nonnegative reveal delays. Render an edit preview and assert it does not have the reveal marker.

- [ ] **Step 2: Run focused renderer tests and verify RED**

Run: `pnpm vitest run src/components/Canvas.test.tsx src/components/canvas/SceneNodeRenderer.test.tsx`  
Expected: FAIL because outline paths do not expose reveal attributes.

- [ ] **Step 3: Implement renderer props and CSS**

Pass `revealIndex` and `revealCount` only for `outline` preview entities. Apply:

```css
.vector-stroke-reveal {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: vector-stroke-reveal var(--vector-reveal-duration)
    ease-out var(--vector-reveal-delay) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .vector-stroke-reveal {
    animation: none;
    stroke-dashoffset: 0;
  }
}
```

Do not use blur filters or animation-driven React state.

- [ ] **Step 4: Run focused renderer tests and verify GREEN**

Run: `pnpm vitest run src/components/Canvas.test.tsx src/components/canvas/SceneNodeRenderer.test.tsx src/drawing/preview/reveal.test.ts`  
Expected: PASS.

### Task 5: Verify the complete behavior

**Files:**
- Modify documentation only if implementation names differ from this plan.

- [ ] **Step 1: Run static and full regression verification**

Run:

```bash
pnpm check
pnpm lint
pnpm build
pnpm test
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Run a real local image-only import**

Start an isolated Drawing, submit a local clean-line image with `goal: ''`, consume its SSE
events, and inspect the audit. Assert first meaningful work is `vectorizing`, final state is
completed, commits are present, and the Run audit contains no `model_call`.

- [ ] **Step 3: Inspect the local page**

Refresh `http://localhost:5173/`, confirm the canvas and task status render without console
application errors, and leave the page ready for the user’s own visual test.
