# Agent Runtime and Progress Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auditable, cancellable Agent Runtime that automatically executes Spatial tasks, accepts instructions at safe points, and emits user-visible progress at least every 30 seconds.

**Architecture:** A pure Core state machine owns legal run transitions and bounded context projections. The Express service owns model/tool orchestration, shared deadlines, audit writes, and an in-memory run registry. Server-Sent Events streams structured progress while HTTP control endpoints pause, resume, stop, and enqueue user guidance.

**Tech Stack:** TypeScript 5.8, Vitest 3, Express 4, Zustand 5, native `AbortController`, Server-Sent Events.

## Global Constraints

- Continue development directly on `main`; the user explicitly does not want branch management before v0.1.
- Use the main agent only; do not dispatch sub-agents.
- Return an accepted `runId` within 1 second of a valid start request.
- Emit a user-visible progress event at least once every 30 seconds while a run is active.
- Every model/tool call has an AbortSignal and shares its stage deadline across retries.
- Retry a failed verification at most two times; the third failure pauses the run.
- Apply model changes only through validated SpatialPatch and SpatialCommit.
- Audit writes and context summarization must not block the model/tool critical path beyond bounded enqueue work.
- Prompt tools come only from the runtime `SpatialCapabilityRegistry`.
- Never expose or persist hidden model reasoning; publish structured decision summaries only.
- Preserve the existing `/api/ai/generate`, `/perceive`, `/agent/plan`, and `/agent/execute` compatibility routes during migration.

---

### Task 1: Capability Registry, Tool Receipts, and Bounded Context

**Files:**
- Create: `src/core/runtime/capabilities.ts`
- Create: `src/core/runtime/receipts.ts`
- Create: `src/core/runtime/context.ts`
- Create: `src/core/tests/runtime-context.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Produces `SpatialCapabilityRegistry`, `SpatialToolReceipt`, `RuntimeContextLedger`, `recordReceipt()`, and `buildRuntimeContext()`.

- [ ] Write failing tests proving an unavailable capability never appears in the catalog, only the latest 10 receipts enter hot context, durable facts persist, transient signals appear once, and completed-stage summaries cap at 5.
- [ ] Run `pnpm vitest run src/core/tests/runtime-context.test.ts`; expect missing-module failure.
- [ ] Implement immutable registry filtering and a three-layer ledger:

```typescript
interface RuntimeContextLedger {
  goal: string;
  stableRules: string[];
  recentReceipts: SpatialToolReceipt[];
  completedStageSummaries: string[];
  durableFacts: Record<string, unknown>;
  nextTransientSignals: Record<string, unknown>;
}
```

`buildRuntimeContext()` returns plain serializable data, consumes transient signals from the returned next ledger, and never includes raw screenshots, audit history, or hidden reasoning.
- [ ] Run focused tests, all Core tests, and `pnpm check`; expect PASS.
- [ ] Commit with `feat(core): add bounded agent runtime context`.

---

### Task 2: Pure Agent Run State Machine

**Files:**
- Create: `src/core/runtime/state-machine.ts`
- Create: `src/core/tests/runtime-state-machine.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes TaskPlan/TaskStep, SpatialHistory, and RuntimeContextLedger.
- Produces `AgentRunState`, `AgentRunEvent`, and `reduceAgentRun(state, event)`.

```typescript
type AgentRunStatus =
  | 'planning' | 'running' | 'pause_requested' | 'paused'
  | 'stopping' | 'stopped' | 'completed' | 'failed';
```

- [ ] Write failing transition tests for accepted→planning→running, pause requested during a model call, pause at safe point, resume, queued instruction consumption once, immediate stop, step completion, and terminal-state immutability.
- [ ] Run the focused test; expect missing-module failure.
- [ ] Implement an exhaustive reducer. Invalid transitions return the identical state and a structured transition error; no reducer branch performs IO.
- [ ] Run focused/Core tests and `pnpm check`; expect PASS.
- [ ] Commit with `feat(core): add agent run state machine`.

---

### Task 3: Runtime Progress Channel and 30-Second SLA

**Files:**
- Create: `api/services/agent-runtime/progress.ts`
- Create: `api/services/agent-runtime/progress.test.ts`

**Interfaces:**
- Produces `RunProgressChannel`, `AgentProgressEvent`, and subscription cleanup functions.

```typescript
interface AgentProgressEvent {
  id: string;
  runId: string;
  type: 'accepted' | 'planning' | 'tool_started' | 'tool_finished' | 'validation'
    | 'commit' | 'heartbeat' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'failed';
  title: string;
  detail?: string;
  timestamp: number;
  elapsedMs: number;
}
```

- [ ] Use fake timers to write failing tests: `accepted` publishes synchronously, heartbeat fires at 25 seconds of silence, any real event resets the timer, terminal events stop heartbeat, and unsubscribe releases listeners.
- [ ] Run focused test; expect missing-module failure.
- [ ] Implement with injected clock/timer dependencies so tests use no wall-clock sleeps. Use a 25-second internal heartbeat to remain below the 30-second SLA.
- [ ] Run focused tests and `pnpm check`; expect PASS.
- [ ] Commit with `feat(api): add agent progress heartbeat channel`.

---

### Task 4: Agent Runtime Orchestrator and Run Registry

**Files:**
- Create: `api/services/agent-runtime/types.ts`
- Create: `api/services/agent-runtime/runtime.ts`
- Create: `api/services/agent-runtime/registry.ts`
- Create: `api/services/agent-runtime/runtime.test.ts`
- Modify: `api/services/ai-gateway.ts`

**Interfaces:**
- Consumes planner/executor adapters, SpatialPatch/History, AuditStore, progress channel, and pure state machine.
- Produces `AgentRuntime.start()`, `pause()`, `resume()`, `stop()`, `addInstruction()`, and `AgentRunRegistry`.

- [ ] Write failing tests with deterministic local adapters: start returns before planner resolves; steps auto-run; commits publish; pause waits for safe point; new guidance replans remaining work once; stop aborts the current request and commits no partial Patch; two verification retries share one stage deadline; third failure pauses.
- [ ] Run focused test; expect missing-module failure.
- [ ] Implement dependency-injected orchestration. Each stage calculates one deadline and passes remaining milliseconds plus one AbortSignal to every attempt. Audit calls are enqueued and errors publish diagnostics without corrupting run state.
- [ ] Adapt existing `planTask()` and `executeAgentStep()` behind model adapter interfaces without removing compatibility exports.
- [ ] Run runtime tests, full tests, `pnpm check`, and targeted ESLint; expect PASS.
- [ ] Commit with `feat(api): orchestrate auditable agent runs`.

---

### Task 5: SSE and HTTP Control Routes

**Files:**
- Create: `api/routes/agent-runs.ts`
- Create: `api/routes/agent-runs.test.ts`
- Modify: `api/app.ts`

**Interfaces:**
- Produces:
  - `POST /api/agent/runs` → HTTP 202 `{ success: true, runId }`
  - `GET /api/agent/runs/:runId/events` → SSE
  - `POST /api/agent/runs/:runId/pause`
  - `POST /api/agent/runs/:runId/resume`
  - `POST /api/agent/runs/:runId/stop`
  - `POST /api/agent/runs/:runId/instructions`
  - `GET /api/agent/runs/:runId`

- [ ] Write failing route tests using a local ephemeral HTTP server. Assert start responds under 1 second without awaiting planner, SSE sends `accepted`, control errors use 404/409 correctly, and instruction bodies reject empty text.
- [ ] Run focused test; expect route missing/404.
- [ ] Implement SSE headers, initial replay of latest progress, disconnect cleanup, request validation, and error mapping. Do not buffer image/PDF bodies into audit events.
- [ ] Run route/full tests, `pnpm check`, and targeted ESLint; expect PASS.
- [ ] Commit with `feat(api): expose streaming agent run controls`.

---

### Task 6: Frontend Agent Client and Store Migration

**Files:**
- Create: `src/services/agent-client.ts`
- Create: `src/services/agent-client.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/components/ConstructionTimeline.tsx`
- Modify: `src/components/AIDialog.tsx`

**Interfaces:**
- Consumes Task 5 routes.
- Produces an `AgentClient` with `start`, `subscribe`, `pause`, `resume`, `stop`, and `addInstruction`; Store exposes current run progress and controls.

- [ ] Write failing client/store tests for immediate accepted state, ordered event projection, pause/resume/stop commands, instruction queuing, reconnect without duplicate events, and terminal cleanup.
- [ ] Run focused tests; expect missing client API.
- [ ] Implement EventSource-based streaming with injected transport for tests. Migrate Agent mode from manual `executeNextStep` clicks to automatic runtime execution while retaining compatibility functions until UI cleanup.
- [ ] Update Construction Timeline to show decision summaries, tool/validation/commit events, heartbeat wait time, and pause/resume/stop/instruction controls.
- [ ] Run focused/full tests, `pnpm check`, targeted ESLint, and `pnpm build`; expect PASS except documented unrelated legacy lint debt.
- [ ] Commit with `feat(ui): stream and control agent runs`.

---

### Task 7: Runtime Integration and Performance Regression

**Files:**
- Create: `api/services/agent-runtime/runtime-integration.test.ts`
- Modify: `README.md`
- Modify: `docs/tech-architecture.md`

- [ ] Add a recorded-response integration case that plans two steps, emits progress, commits two patches, accepts guidance at a safe point, finishes, writes audit events, and replays the final model exactly.
- [ ] Add a fake 70-second model call test and assert visible events occur at 0, 25, and 50 seconds without real waiting.
- [ ] Document runtime routes, event schema, 30-second SLA, context limits, and local audit inspection commands.
- [ ] Run `pnpm test && pnpm check && pnpm build`; run full `pnpm lint` and report any pre-existing debt separately.
- [ ] Commit with `docs: document streaming agent runtime`.

