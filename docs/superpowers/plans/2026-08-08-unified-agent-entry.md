# Unified Agent Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every AI input through one Agent Workflow and make combined text-and-drawing requests analyze intent, reconstruct the drawing, and then apply requested incremental modifications.

**Architecture:** The frontend exposes one `submitAgentInput()` action that either starts a run or appends text to the active run. For attachment runs, the runtime uses the existing multimodal planner as a lightweight intent/plan stage, always executes the specialized Drawing Perception Pipeline first, and only then runs modification steps against the reconstructed `SpatialModel`. The existing progress and audit channel records classification, perception, commits, fallback decisions, and modification execution under one `runId`.

**Tech Stack:** React 18, Zustand, TypeScript, Express, Vitest, existing Agent Runtime/SSE/FileAuditStore, Doubao-compatible chat completions.

## Global Constraints

- Do not create a branch or worktree; the user explicitly authorized development on `main`.
- Do not commit `test1.jpg`; it is a local real-flow fixture.
- All new behavior is developed with a failing test first.
- The start route continues returning HTTP 202 and `runId` without waiting for model work.
- Long-running work keeps the existing 25-second heartbeat so UI feedback remains within 30 seconds.
- Image/PDF geometry reconstruction continues using `doubao-seed-2.0-lite`; only qualifying low-confidence geometry repair can use `doubao-seed-2.1-turbo`.

---

### Task 1: Unified frontend submission

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Modify: `src/components/AIDialog.tsx`
- Create: `src/components/AIDialog.test.tsx`

**Interfaces:**
- Produces: `AppState.submitAgentInput(prompt?: string, image?: string, mimeType?: string): Promise<void>`.
- Consumes: existing `startAgent()` and `addAgentInstruction()` store actions.

- [ ] **Step 1: Write failing Store tests**

Add tests proving a combined text/image input calls `AgentClient.start()` with the same goal and attachment, an active run routes text to `addInstruction()`, and an active run rejects attachments without starting another run.

```ts
await store.getState().submitAgentInput('把左侧孔扩大', 'anBn', 'image/png');
expect(client.start).toHaveBeenCalledWith(expect.objectContaining({
  goal: '把左侧孔扩大', image: 'anBn', mimeType: 'image/png',
}));
```

- [ ] **Step 2: Run Store tests and verify RED**

Run: `pnpm vitest run src/hooks/useStore.test.ts`

Expected: FAIL because `submitAgentInput` does not exist.

- [ ] **Step 3: Implement minimal Store routing**

Add `submitAgentInput` to `AppState`. Treat `planning`, `running`, `pause_requested`, `paused`, and `stopping` with a non-null `agentRunId` as active. Active text calls `addAgentInstruction`; active attachment sets `agentError` and does not start a second run; all other valid input calls `startAgent`.

- [ ] **Step 4: Add a failing rendered UI test**

Render `AIDialog` with `react-dom/server` and assert the user-visible header has no mode switch text while still exposing the attachment input and send area.

```tsx
const html = renderToStaticMarkup(<AIDialog />);
expect(html).not.toContain('Agent 工作流模式');
expect(html).not.toContain('>普通<');
```

- [ ] **Step 5: Run UI test and verify RED**

Run: `pnpm vitest run src/components/AIDialog.test.tsx`

Expected: FAIL because the current mode toggle renders `普通`.

- [ ] **Step 6: Remove mode routing from `AIDialog`**

Delete `agentMode`, the toggle button, direct calls to `sendPrompt()` and `perceiveImage()`, and legacy perception loading/error UI. Call only `submitAgentInput()`. Keep text enabled during an active run, disable attachment upload while active, and display `agentError` in the conversation area.

- [ ] **Step 7: Run focused frontend tests and commit**

Run: `pnpm vitest run src/hooks/useStore.test.ts src/components/AIDialog.test.tsx`

Expected: PASS.

Commit: `feat(ui): use a single agent entry`

### Task 2: Structured input intent from the multimodal planner

**Files:**
- Modify: `src/core/agent.ts`
- Modify: `api/services/ai-gateway.ts`
- Create: `api/services/agent-runtime/input-intent.ts`
- Create: `api/services/agent-runtime/input-intent.test.ts`

**Interfaces:**
- Produces: `InputIntent`, `InputIntentKind`, `resolveInputIntent(plan, goal, hasAttachment)`, and `fallbackAttachmentPlan(goal)`.
- Consumes: existing `TaskPlan` returned by `AgentPlannerAdapter.plan()`.

- [ ] **Step 1: Write failing intent normalization tests**

Cover literal plans for `inspect_drawing`, `reconstruct_drawing`, and `modify_drawing`, plus a malformed/unknown plan corrected by modification verbs in the original goal.

```ts
expect(resolveInputIntent(
  { task: 'modify_drawing', summary: '扩大孔', steps: [modifyStep] },
  '把左侧孔扩大',
  true,
)).toMatchObject({ kind: 'modify_drawing', requiresDrawingPerception: true, requiresMutation: true });
```

- [ ] **Step 2: Run intent tests and verify RED**

Run: `pnpm vitest run api/services/agent-runtime/input-intent.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic normalization and fallback**

Map known planner task names directly. When the planner returns an unknown task, use explicit Chinese/English mutation verbs to choose `modify_drawing`; attachment-only/default reconstruction goals choose `reconstruct_drawing`; analysis verbs choose `inspect_drawing`. Always require perception for attachments. Build a one-step `modify_drawing` fallback plan when mutation is clear but the planner fails.

- [ ] **Step 4: Update planner contract and demo fallback**

Extend `PLANNER_PROMPT` so attachment tasks return one of `inspect_drawing`, `reconstruct_drawing`, or `modify_drawing`. For modification tasks, planner steps describe only changes to apply after the runtime reconstructs the baseline. Update `defaultPlan()` to use the same task names and produce a modification step when the prompt contains mutation verbs.

- [ ] **Step 5: Run intent and gateway tests and commit**

Run: `pnpm vitest run api/services/agent-runtime/input-intent.test.ts api/services/agent-runtime/model-adapters.test.ts`

Expected: PASS.

Commit: `feat(agent): classify combined drawing requests`

### Task 3: Perceive first, modify second

**Files:**
- Modify: `api/services/agent-runtime/registry.ts`
- Modify: `api/services/agent-runtime/runtime.ts`
- Modify: `api/services/agent-runtime/runtime-drawing.test.ts`
- Modify: `api/services/agent-runtime/runtime.test.ts`

**Interfaces:**
- Consumes: `resolveInputIntent()` and `fallbackAttachmentPlan()` from Task 2.
- Stores: normalized input intent and optional post-drawing plan in `AgentRunRecord`.
- Produces: one ordered audited run: intent analysis → drawing perception/baseline commits → optional modification plan execution.

- [ ] **Step 1: Write failing ordered-flow tests**

Add one test where planner returns `modify_drawing`, drawing yields a baseline point, and executor updates that point. Assert call order and two commits under one run. Add tests that a reconstruct-only request never calls executor and a planner failure falls back to reconstruction with a validation event.

```ts
expect(order).toEqual(['plan', 'perceive', 'modify']);
expect(state.history.commits.map((commit) => commit.runId)).toEqual([
  'run_modify_drawing', 'run_modify_drawing',
]);
```

- [ ] **Step 2: Run drawing runtime tests and verify RED**

Run: `pnpm vitest run api/services/agent-runtime/runtime-drawing.test.ts`

Expected: FAIL because attachment runs currently skip the planner and complete immediately after baseline batches.

- [ ] **Step 3: Implement attachment intent stage**

Before `DrawingPerceptionPipeline.run()`, call the planner with the goal and attachment using the selected vision model. Normalize and store the intent/plan. Publish `planning` and `validation` events containing the intent kind, confidence, and chosen path. If planning fails, publish the failure detail and install the deterministic fallback intent/plan without terminating the run.

- [ ] **Step 4: Continue into modification after baseline commits**

At the final drawing batch, do not finish when a stored intent requires mutation. Replace the drawing plan with the stored modification plan, reset `currentStepIndex`, keep status `running`, and call `runSteps()`. If an instruction arrived during perception, finish all baseline batches and then call `replan()` with that instruction. If a mutation request produces no valid baseline batch, fail with a stage-specific error instead of running modification against an empty model.

- [ ] **Step 5: Preserve pause/resume and instruction semantics**

Keep drawing batches across pause. Do not discard remaining baseline batches when a text instruction arrives; apply it only after all baseline batches reach a safe point. Ensure terminal cleanup clears stored intent and post-drawing plan.

- [ ] **Step 6: Run runtime suite and commit**

Run: `pnpm vitest run api/services/agent-runtime/runtime-drawing.test.ts api/services/agent-runtime/runtime.test.ts api/services/agent-runtime/runtime-integration.test.ts`

Expected: PASS.

Commit: `feat(agent): modify drawings after reconstruction`

### Task 4: Route and real-flow regression

**Files:**
- Modify: `api/routes/agent-runs.test.ts`
- Modify: `README.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: unified frontend and ordered runtime behavior from Tasks 1–3.
- Produces: route-level evidence that combined input returns immediately and a documented real acceptance procedure.

- [ ] **Step 1: Add a route regression test**

Post a combined `goal + image + mimeType` request to `/api/agent/runs`; assert HTTP 202 arrives before planning resolves and the planner later receives both the text and image.

- [ ] **Step 2: Run route test and verify behavior**

Run: `pnpm vitest run api/routes/agent-runs.test.ts`

Expected: PASS after Tasks 1–3; if it fails, correct the route/runtime boundary without reintroducing synchronous model work.

- [ ] **Step 3: Update current implementation docs**

Document the single UI entry, joint intent stage, ordered baseline-before-modification rule, fallback behavior, and the fact that legacy `/api/ai/*` routes are no longer frontend call sites.

- [ ] **Step 4: Run all automated verification**

Run: `pnpm test && pnpm check && pnpm build`

Expected: all tests pass, TypeScript exits 0, and Vite build exits 0.

- [ ] **Step 5: Run the local real-flow acceptance**

Use `test1.jpg` twice through the Agent start API/UI: once with no text and once with a bounded modification instruction. Verify accepted/heartbeat timing, event order, baseline commits, optional modification commit, final model, and local audit files. Record run IDs and elapsed timings without committing the image or generated `.local` data.

- [ ] **Step 6: Commit documentation and regression changes**

Commit: `docs(agent): document unified real flow`
