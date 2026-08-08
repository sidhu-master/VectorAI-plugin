# Drawing Agent Runtime Migration Implementation Plan

> **Status:** ready for execution after Phase 2 canonical workspace cutover  
> **Scope:** text-driven Agent planning/query/mutation over Drawing Core. Image/PDF perception remains guarded until Phase 4.  
> **Hard boundary:** no SpatialModel, SpatialIntent, compatibility translator, dual write, feature flag, branch, worktree, sub-agent, or `test1.jpg` mutation.

## Goal

Replace the legacy Agent path that owns `SpatialHistory` and commits `SpatialIntent` with a Drawing-native runtime:

`goal → GoalSpec / Workflow → typed query tools → DrawingCommand proposal → Preview Event → Application Commit → verification → audit`

The Drawing Repository remains the only authority. The Agent stores identifiers, revision, workflow state, receipts, and presentation state; it never stores a writable DrawingDocument copy.

## Non-goals

- No image/PDF reconstruction or Drawing Perception integration in this phase.
- No DXF/PDF import/export adapter.
- No hidden chain-of-thought exposure. UI receives structured plans, tool events, previews, validation and commits only.
- No server restart recovery for an in-flight Agent run; persisted audit and drawing commits must remain recoverable.
- No branches or concurrent merge. A stale revision triggers re-query/re-plan.

## Target boundaries

```text
Agent HTTP Route
  -> DrawingAgentRuntime
       -> AgentPlannerAdapter / AgentDecisionAdapter
       -> DrawingToolRegistry
            -> DrawingApplication.open / preview / execute
       -> DrawingAgentAuditStore

Browser AgentClient
  -> drawingId + baseRevision + goal
  <- presentation-only AgentRunView + SSE progress
```

The model never receives the entire repository history. Hot context contains the GoalSpec, workflow node, current revision, bounded query results, recent receipts, stable rules and optional selected IDs.

---

### Task 1: Shared Drawing Agent Protocol

**Files:**
- Create: `src/contracts/drawing-agent.ts`
- Create: `src/contracts/drawing-agent.test.ts`
- Modify: `src/services/agent-types.ts`

Define:

```ts
interface GoalSpec {
  id: string;
  objective: string;
  scope: DrawingSelector;
  acceptanceCriteria: DrawingAssertion[];
  riskPolicy: { candidateAllowed: boolean; maxCommits: number };
}

interface WorkflowNode {
  id: string;
  capability: string;
  dependsOn: string[];
  completionCriteria: DrawingAssertion[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
}

type AgentDecision =
  | { type: 'query'; toolCallId: string; selector: DrawingSelector }
  | { type: 'inspect'; toolCallId: string; nodeId: string }
  | { type: 'transact'; toolCallId: string; commands: DrawingCommand[]; confidence?: number }
  | { type: 'finish'; summary: string };
```

Add strict runtime parsers for untrusted planner/decision JSON. Reject unknown keys, immutable update fields, `history.revert`, empty workflows, invalid confidence, and transactions without commands. Shared presentation types contain no DrawingDocument or history.

**Tests:** valid round-trip; every union arm; unknown key rejection; malformed selector/command; prototype-like objects; no legacy protocol names.

---

### Task 2: Drawing Application Preview and Query Boundary

**Files:**
- Modify: `api/services/drawing-application/application.ts`
- Modify: `api/services/drawing-application/application.test.ts`
- Modify: `src/contracts/drawing-application.ts`

Add:

```ts
query(input: { drawingId: DrawingId; selector: DrawingSelector }): Promise<{
  revision: RevisionId;
  result: DrawingQueryResult;
}>;

preview(input: {
  drawingId: DrawingId;
  transaction: DrawingTransaction;
}): Promise<TransactionResult>;
```

`preview` opens the latest snapshot and calls the public Core preview function without persistence. `execute` remains the only commit operation and re-checks revision. Query results are cloned/bounded contracts, not repository references.

**Tests:** query revision; preview no mutation; preview candidate; stale preview; preview-ready followed by stale commit; wrong-drawing revision.

---

### Task 3: Typed Drawing Tool Registry

**Files:**
- Create: `api/services/drawing-agent/tool-registry.ts`
- Create: `api/services/drawing-agent/tool-registry.test.ts`
- Create: `api/services/drawing-agent/types.ts`

Implement versioned tool definitions for `query_entities`, `inspect_entity`, `preview_transaction`, `commit_transaction`, and `verify_goal`. Each definition declares read/write behavior, input parser, timeout and receipt builder.

Receipts contain tool call ID, capability/version, input digest, revision before/after, affected IDs, structured validation/outcome, duration, status and retry guidance. They never contain media base64, API keys, hidden reasoning, or a full DrawingDocument.

Mutation execution is always two-stage:

1. Build transaction against the current revision.
2. Publish Preview Event and enter a safe point.
3. If not paused/stopped, call Application execute atomically.

**Tests:** registry uniqueness; schema failures never call Application; read tools never mutate; preview never persists; commit receipt matches returned commit; stale response remains structured.

---

### Task 4: Drawing-native Planner and Decision Adapters

**Files:**
- Create: `api/services/drawing-agent/model-adapters.ts`
- Create: `api/services/drawing-agent/model-adapters.test.ts`
- Modify: `api/services/ai-gateway.ts`

Separate two structured model roles:

- Planner: goal + bounded document summary → GoalSpec + workflow.
- Decision: current workflow node + bounded query results + recent receipts → one AgentDecision.

The adapter parses with Task 1 runtime parsers. It does not accept SpatialModel or return SpatialIntent. Prompt templates explicitly require stable IDs from tool results and prohibit invented IDs. Model name stays in internal audit events, not presentation events.

**Tests:** request shape excludes full document/history; parser error propagation; abort/deadline propagation; no model name in public progress detail.

---

### Task 5: New Drawing Agent State Machine and Runtime

**Files:**
- Create: `api/services/drawing-agent/state.ts`
- Create: `api/services/drawing-agent/state.test.ts`
- Create: `api/services/drawing-agent/runtime.ts`
- Create: `api/services/drawing-agent/runtime.test.ts`
- Reuse or move: `api/services/agent-runtime/progress.ts`

Build a fresh state machine around drawing ID/revision, GoalSpec, workflow, recent receipts, pending instructions and run controls. Do not adapt `src/core/runtime/state-machine.ts`.

Required safe points: before model call, before read tool, after Preview, after Commit. `stop` from running, pause-requested or paused must deterministically reach `stopped`. Additional instructions merge at a safe point and re-plan from the latest revision.

Recovery policy:

1. Invalid model schema: same model correction once.
2. `STALE_REVISION` / missing node: refresh revision/query and re-plan unfinished work.
3. Transaction validation failure: return structured errors to Decision Adapter, maximum two repairs.
4. Explicit decision confidence below 0.6: one Turbo decision attempt; retain valid Lite proposal if Turbo fails or remains low.
5. Exhausted recovery: pause/failed with prior verified commits preserved.

Enforce maximum decisions, commits, consecutive read tools and wall-clock deadline. Emit accepted immediately and heartbeat within 25 seconds.

**Tests:** fast create/update/delete; already-satisfied; Preview-before-Commit ordering; pause at preview; stop from paused; instruction re-plan; stale recovery; low-confidence escalation exactly once; schema repair; bounded-loop failure; first event latency.

---

### Task 6: Drawing-native Audit

**Files:**
- Create: `api/services/drawing-agent/audit-types.ts`
- Create: `api/services/drawing-agent/file-audit-store.ts`
- Create: `api/services/drawing-agent/file-audit-store.test.ts`
- Delete after import audit: legacy `api/services/audit/*`

Persist a manifest with drawing ID, base revision, GoalSpec, command/schema versions, prompt hashes and internal model profile. Append JSONL events for instructions, plans, decisions, tool calls, previews, validations, commits, re-plans and state changes. Store DrawingCommit by reference plus a cloned commit record.

Use temp-file + fsync + atomic rename for manifest/commit records; serialize event appends per run. Redact configured secret fields and reject media bodies.

**Tests:** restart read; concurrent append order; malformed audit file error; redaction; no SpatialCommit/SpatialModel fields; commit IDs match repository history.

---

### Task 7: Replace Agent HTTP Contract

**Files:**
- Create or rewrite: `api/routes/agent-runs.ts`
- Modify: `api/routes/agent-runs.test.ts`
- Modify: `api/app.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`

New start body:

```ts
{
  drawingId: DrawingId;
  baseRevision: RevisionId;
  goal: string;
  selectedIds?: string[];
  stableRules?: string[];
}
```

Reject image/PDF fields in Phase 3 with `DRAWING_PERCEPTION_NOT_MIGRATED`. Validate that baseRevision belongs to drawing before returning 202. Preserve SSE replay, pause/resume/stop/instruction endpoints. Public run responses use shared presentation types only.

**Tests:** no SpatialModel input/default; drawing/revision mismatch; accepted under one second with deferred runtime; SSE replay/terminal close; controls; attachment rejection.

---

### Task 8: Re-enable Text Agent in Canonical Workspace

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Modify: `src/components/AIDialog.tsx`
- Modify: `src/components/ConstructionTimeline.tsx`

`startAgent` requires current drawing ID/revision and sends no document. Commit progress triggers `DrawingClient.open(drawingId)` to refresh the canonical projection and commits. The store never accepts a document from Agent run state. Text-only requests run automatically; image/PDF remains locally guarded with the Phase 4 message. Additional text routes to the active run.

**Tests:** start request shape; progress refresh; Agent response cannot replace document; active instruction; image guard; stale refresh; model names absent from UI.

---

### Task 9: Remove Replaced Legacy Agent Paths

**Files:**
- Delete after `rg` proves unreferenced: `api/services/agent-runtime/runtime.ts`, legacy adapters/types/registry, old audit, `src/core/runtime/*`, `src/core/history/*`
- Remove obsolete `/api/ai/generate`, `/api/ai/perceive`, and `/api/ai/agent/execute` mutation routes if no Phase 4 code calls them.
- Keep only legacy compiler/types still owned by the isolated Phase 4 perception implementation, and record them explicitly.
- Create: `src/drawing/tests/legacy-agent-boundary.test.ts`
- Modify architecture implementation status.

Boundary test scans production Agent, route and UI code for SpatialModel, SpatialIntent, SpatialHistory, `commitPatch`, legacy mutation endpoints, document arrays in runtime state, and model names in public events.

---

### Task 10: Full Verification and Commit Gate

Run:

```bash
npm test
npm run check
npm run build
npx eslint src/drawing src/contracts src/hooks src/components src/pages \
  api/services/drawing-application api/services/drawing-agent api/routes/agent-runs.ts
git diff --check
git status --short --untracked-files=all
```

Manual browser acceptance:

1. Start a text task and observe accepted/planning within one second.
2. Observe structured query and Preview before the first Commit.
3. Pause at a safe point, add an instruction, resume and verify re-plan.
4. Reload after Commit and confirm exact DrawingDocument/revision/commits restoration.
5. Submit an image and confirm explicit Phase 4 guard with no legacy request.
6. Confirm no model name, hidden reasoning, console error or blank page.

## Completion gate

- Agent mutations only occur through DrawingApplication transactions.
- Runtime owns no SpatialModel, SpatialHistory or writable DrawingDocument.
- Every commit is preceded by a Preview event and followed by deterministic goal verification.
- Pause/stop/instruction behavior is deterministic at safe points.
- Low-confidence escalation is limited to one explicit decision retry.
- Audit can relate run → tool receipt → DrawingCommit → resulting revision.
- Text Agent is enabled; image/PDF remains safely disabled until Phase 4.
- `test1.jpg` remains untouched and untracked.
