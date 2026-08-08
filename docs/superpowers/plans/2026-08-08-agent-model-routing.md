# Agent Model Routing and Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every image-bearing Agent call through `doubao-seed-2.0-lite`, keep text roles independently configurable, and audit role/model/timing without persisting prompts or media.

**Architecture:** A pure model-profile resolver selects a model by role and media presence. Agent Runtime owns the resolved profile for a run and passes an explicit model to gateway adapters. Structured model lifecycle events reuse the progress/audit channel.

**Tech Stack:** TypeScript 5.8, Express 4, Vitest 3, native AbortController/SSE.

## Global Constraints

- Work directly on `main`; do not create a branch or worktree.
- Use the main agent only; do not dispatch sub-agents.
- Any call carrying an original image or crop uses `doubao-seed-2.0-lite` by default.
- Request-provided model overrides are passed through unchanged after non-empty-string validation.
- Never persist prompt text, image base64, tokens, credentials, or hidden reasoning.
- Preserve the accepted-under-1-second and 25-second heartbeat behavior.

---

### Task 1: Pure Agent Model Profile Resolver

**Files:**
- Create: `api/services/agent-runtime/model-profile.ts`
- Create: `api/services/agent-runtime/model-profile.test.ts`
- Modify: `api/services/agent-runtime/types.ts`

**Interfaces:**
- Produces `AgentModelProfile`, `AgentModelRole`, `resolveAgentModelProfile()`, and `selectAgentModel()`.

```ts
export interface AgentModelProfile {
  planner?: string;
  vision: string;
  executor?: string;
  repair?: string;
}

export function selectAgentModel(
  profile: AgentModelProfile,
  input: { role: AgentModelRole; hasImage: boolean; isRepair?: boolean },
): string;
```

- [ ] Write tests proving image-bearing planner/executor/repair calls select `vision`, text roles select their configured role, missing optional roles fall back without returning an empty model, and request overrides win.
- [ ] Run `pnpm vitest run api/services/agent-runtime/model-profile.test.ts`; expect missing-module failure.
- [ ] Implement the immutable resolver with default vision model `doubao-seed-2.0-lite` and environment values supplied as function inputs rather than read inside the pure function.
- [ ] Run focused tests and `pnpm check`; expect PASS.
- [ ] Commit with `feat(agent): add role based model profiles`.

### Task 2: Carry Model Profiles Through Runtime and Gateway Adapters

**Files:**
- Modify: `api/services/agent-runtime/types.ts`
- Modify: `api/services/agent-runtime/registry.ts`
- Modify: `api/services/agent-runtime/runtime.ts`
- Modify: `api/services/agent-runtime/model-adapters.ts`
- Modify: `api/services/agent-runtime/runtime.test.ts`
- Modify: `api/services/agent-runtime/model-adapters.test.ts`

**Interfaces:**
- `StartAgentRunInput.modelProfile` is required after route resolution.
- `PlanStageInput.modelName` and `ExecuteStageInput.modelName` are explicit strings.

```ts
interface PlanStageInput {
  modelName: string;
  // existing fields unchanged
}

interface ExecuteStageInput {
  modelName: string;
  // existing fields unchanged
}
```

- [ ] Add failing tests proving an image run sends `doubao-seed-2.0-lite` to initial planning, execution retries, and image-bearing replanning; prove a text-only run uses planner/executor/repair roles.
- [ ] Run runtime and adapter tests; expect missing model fields or incorrect fallback failures.
- [ ] Store only the small profile in `AgentRunRecord`; select a model immediately before each model call and forward it as `PlanParams.model` or `ExecuteStepParams.llmModel`.
- [ ] Emit no model name inside prompts and retain the same AbortSignal/deadline behavior.
- [ ] Run focused/full tests and `pnpm check`; expect PASS.
- [ ] Commit with `feat(agent): route models by runtime role`.

### Task 3: Validate HTTP Model Overrides and Frontend Transport

**Files:**
- Modify: `api/routes/agent-runs.ts`
- Modify: `api/routes/agent-runs.test.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`
- Modify: `api/app.ts`

**Interfaces:**
- `POST /api/agent/runs` accepts optional `models: Partial<AgentModelProfile>`.

```json
{
  "models": {
    "vision": "doubao-seed-2.0-lite",
    "planner": "optional-text-model"
  }
}
```

- [ ] Write route/client tests for valid overrides, empty-string rejection, default profile resolution, and exact request serialization.
- [ ] Run focused tests; expect the override to be ignored or invalid values to be accepted.
- [ ] Resolve environment defaults once in `api/app.ts`, merge request overrides in the route, and pass the complete profile to Runtime.
- [ ] Add optional `models` to `StartAgentInput` without exposing environment values to the browser.
- [ ] Run focused/full tests, `pnpm check`, and targeted ESLint; expect PASS.
- [ ] Commit with `feat(api): accept agent model overrides`.

### Task 4: Model Call Lifecycle Audit Events

**Files:**
- Modify: `api/services/agent-runtime/progress.ts`
- Modify: `api/services/agent-runtime/progress.test.ts`
- Modify: `api/services/agent-runtime/runtime.ts`
- Modify: `api/services/agent-runtime/runtime.test.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/components/ConstructionTimeline.tsx`

**Interfaces:**
- Adds progress types `model_started` and `model_finished`.
- Event detail is structured metadata only: `role`, `model`, `attempt`, `durationMs`, `status`.

```ts
interface AgentModelEventDetail {
  role: AgentModelRole;
  model: string;
  attempt: number;
  durationMs?: number;
  status?: 'success' | 'aborted' | 'failed';
}
```

- [ ] Write fake-clock tests proving every planner/executor call has paired lifecycle events and aborted calls record `aborted`; assert serialized events do not contain the goal, prompt, image, token, or API key.
- [ ] Run focused tests; expect missing event types.
- [ ] Publish lifecycle events around the existing model calls without adding awaited audit work to the critical path.
- [ ] Show concise role/model/duration entries in Construction Timeline.
- [ ] Run `pnpm test && pnpm check && pnpm build`; run targeted ESLint.
- [ ] Commit with `feat(agent): audit model call lifecycle`.

