# Model-Led Drawing Agent Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the spatial-authorization/forced-strategy runtime with a model-led Drawing IR tool loop, candidate-scoped Human Decision Gate, diagnostic feedback, and a browser-verifiable end-to-end edit flow.

**Architecture:** Keep `src/drawing/` as the only mutable drawing truth and make every model operation a versioned tool call. Split protocol-hard failures from diagnostic feedback, bind human grants to one revision and transaction digest, then replace the legacy planner/workflow/spatial authorization path with a compact action loop that can query, redraw, vectorize, preview, inspect, revise, request a decision, and commit.

**Tech Stack:** TypeScript 5.8, Node.js/Express, React 18, Zustand, Vitest, Sharp, existing Drawing IR/SceneCompiler/OpenCV/Python vectorization services.

## Global Constraints

- Work directly on `main`; the user explicitly does not want branches before MVP release.
- Do not use subagents; the user explicitly requested one main development flow.
- Preserve unrelated working-tree changes and stage only files owned by each task.
- Use TDD for every production behavior: write one focused test, observe the expected failure, then implement the minimum passing code.
- Do not keep the old authorization runtime as a parallel production path or long-lived feature flag.
- Do not add object-, action-, direction-, sample-coordinate-, body-part-, architecture-part-, or `test2`-specific production rules.
- Drawing IR, Commands, Patch, inverse Patch, revision CAS, and deterministic transaction replay remain the only formal mutation path.
- Human Decision pauses only for permission, missing facts, value choices, or explicit risk acceptance; ordinary geometry defects remain model feedback.
- The UI must not display model names or hidden reasoning.

---

## File Structure

### Stable core and public protocol

- `src/drawing/transaction/types.ts`: transaction metadata, lineage, and decision grant references.
- `src/drawing/transaction/execute.ts`: hard validation input boundary and preview metadata projection.
- `src/drawing/repository/types.ts`, `src/drawing/repository/state.ts`, `src/drawing/repository/memory.ts`: commit metadata persistence and deterministic replay.
- `src/contracts/drawing-agent.ts`: model action, tool, diagnostic, Human Decision, run-state, and public run-view contracts.
- `src/contracts/drawing-agent.test.ts`, `src/drawing/tests/transaction.test.ts`, `src/drawing/tests/repository-state.test.ts`: public behavior tests.

### Human interaction and diagnostics

- `api/services/human-interaction/types.ts`: server-side request/response/grant records.
- `api/services/human-interaction/policy.ts`: identify candidate actions requiring a decision and verify candidate-scoped grants.
- `api/services/human-interaction/file-store.ts`: append/read decision state below the existing run directory.
- `api/services/human-interaction/*.test.ts`: grant matching, expiry, denial, and persistence tests.
- `api/services/drawing-diagnostics/evaluate-preview.ts`: warning/decision-required facts derived from before/after documents.
- `api/services/drawing-diagnostics/evaluate-preview.test.ts`: constraint, annotation, endpoint, and unrelated-change behavior tests.

### Model tool gateway

- `api/services/drawing-tools/types.ts`: generic tool invocation/result/receipt types.
- `api/services/drawing-tools/registry.ts`: versioned dispatch and revision binding.
- `api/services/drawing-tools/drawing-tools.ts`: IR query/inspect/render/measure/preview/evaluate/commit tools.
- `api/services/drawing-tools/topology-tools.ts`: build topology, trace paths, find interfaces, inspect fragment, materialize split.
- `api/services/drawing-tools/generation-tools.ts`: redraw, vectorize, fit, and annotation recomputation adapters.
- `api/services/drawing-tools/*.test.ts`: real registry and tool behavior tests.

### Agent loop and API

- `api/services/drawing-agent/model-loop-adapter.ts`: one-action multimodal model adapter and strict schema parser.
- `api/services/drawing-agent/model-loop-adapter.test.ts`: tool, decision, commit, finish, and repair protocol tests.
- `api/services/drawing-agent/model-loop-runtime.ts`: compact Episode/tool loop, safe points, duplicate-candidate handling, escalation, Human Decision wait/resume, preview/commit.
- `api/services/drawing-agent/model-loop-runtime.test.ts`: end-to-end runtime tests with real Drawing Core/tools and only external model/image services faked.
- `api/services/drawing-agent/state.ts`, `api/services/drawing-agent/state.test.ts`: remove workflow-DAG requirements and add `waiting_for_user`.
- `api/routes/agent-runs.ts`, `api/routes/agent-runs.test.ts`: decision response endpoint and waiting-state behavior.
- `api/app.ts`: wire the new runtime, tools, diagnostics, generation adapters, and human store.

### UI

- `src/services/agent-client.ts`, `src/services/agent-client.test.ts`: decision-response API.
- `src/hooks/useStore.ts`, `src/hooks/useStore.test.ts`: pending decision state and resume flow.
- `src/components/HumanDecisionCard.tsx`, `src/components/HumanDecisionCard.test.tsx`: compact candidate decision UI.
- `src/components/AIDialog.tsx`, `src/components/AIDialog.test.tsx`: place the card above the composer and preserve append-instruction behavior.
- `src/components/ComposerTaskStatus.tsx`, `src/components/agent/task-presentation.ts`: real waiting/tool status presentation.
- `src/drawing/preview/types.ts`, `src/components/Canvas.tsx`: generic tool overlay semantics rather than hard authorization coloring.

### Removal and regression

- Delete or stop importing production-only legacy spatial authorization/router/compiler adapters after the new loop is active.
- `scripts/e2e-model-led-test2.ts`: real local server/browser-friendly regression driver using current Drawing IR and configured models.
- Update `README.md` only after the implemented commands and workflow are verified.

---

### Task 1: Free Transaction Metadata and Deterministic Persistence

**Files:**
- Modify: `src/drawing/transaction/types.ts`
- Modify: `src/drawing/transaction/execute.ts`
- Modify: `src/drawing/repository/types.ts`
- Modify: `src/drawing/repository/state.ts`
- Modify: `src/drawing/repository/memory.ts`
- Modify: `api/services/drawing-application/file-drawing-repository.ts`
- Test: `src/drawing/tests/transaction.test.ts`
- Test: `src/drawing/tests/repository-state.test.ts`
- Test: `api/services/drawing-application/file-drawing-repository.test.ts`

**Interfaces:**
- Produces `DrawingTransactionMetadata`, `DrawingLineageRecord`, and metadata-preserving `TransactionPreview`/`DrawingCommit`.
- Consumed by Tasks 2, 4, 5, and 6.

- [ ] **Step 1: Add a failing transaction test for a single atomic transaction that deletes geometry, annotation, relation, and feature nodes, creates replacements of different IDs/types, and exposes the supplied `replace/redraw` lineage and grant refs on the ready preview.**

- [ ] **Step 2: Run `npm test -- src/drawing/tests/transaction.test.ts --reporter=dot` and confirm failure because transaction metadata is not represented or projected.**

- [ ] **Step 3: Add minimal optional metadata types and clone them into `TransactionPreview`; keep all existing callers source-compatible.**

- [ ] **Step 4: Add a failing repository-state test proving commit metadata and lineage survive commit, revert, and replay. Run it and confirm the persisted commit lacks metadata.**

- [ ] **Step 5: Persist cloned metadata on `DrawingCommit` in memory/state/file repositories, validate snapshot shape, and preserve it through deterministic replay.**

- [ ] **Step 6: Run the three focused test files, then `npm run check`.**

- [ ] **Step 7: Commit only Task 1 files with `feat: preserve model-led drawing transaction metadata`.**

### Task 2: Human Decision Contracts, Policy, and Store

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Test: `src/contracts/drawing-agent.test.ts`
- Create: `api/services/human-interaction/types.ts`
- Create: `api/services/human-interaction/policy.ts`
- Create: `api/services/human-interaction/policy.test.ts`
- Create: `api/services/human-interaction/file-store.ts`
- Create: `api/services/human-interaction/file-store.test.ts`

**Interfaces:**
- Produces `HumanDecisionRequest`, `HumanDecisionResponse`, `PermissionGrant`, `HumanInteractionPolicy.evaluate(...)`, and `HumanInteractionStore`.
- Consumed by Tasks 4, 5, and 6.

- [ ] **Step 1: Add failing public-protocol tests for all five decision kinds, exact allowed fields, non-empty options, candidate-scoped grants, and `waiting_for_user` run projection.**

- [ ] **Step 2: Run `npm test -- src/contracts/drawing-agent.test.ts --reporter=dot` and confirm the parser/status types are missing.**

- [ ] **Step 3: Implement strict parsers/types. A grant must bind `requestId`, `episodeId`, `revision`, `transactionDigest`, actions, resource IDs, effect, and scope `candidate`.**

- [ ] **Step 4: Add failing policy tests: deleting an existing constraint and changing a locked node require a decision; normal geometry replacement, annotation recomputation, and diagnostic warnings do not; grants fail when revision/digest/resource/action changes.**

- [ ] **Step 5: Implement policy evaluation and exact grant matching without any object/action/sample-specific rule.**

- [ ] **Step 6: Add failing file-store tests for atomic persistence, pending request lookup, response resolution, and restart recovery; implement the smallest append-safe store under `.local/vectorai/runs/<runId>/human-interactions.json`.**

- [ ] **Step 7: Run focused tests and `npm run check`, then commit Task 2 files with `feat: add candidate-scoped human decision gate`.**

### Task 3: Hard Validation and Diagnostic Feedback Separation

**Files:**
- Create: `api/services/drawing-diagnostics/types.ts`
- Create: `api/services/drawing-diagnostics/evaluate-preview.ts`
- Create: `api/services/drawing-diagnostics/evaluate-preview.test.ts`
- Modify: `src/drawing/transaction/execute.ts`
- Modify: `src/drawing/tests/transaction.test.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.test.ts`

**Interfaces:**
- Produces `DrawingDiagnosticReport` and `evaluateDrawingPreview({ before, after, transaction, tolerance })`.
- Hard validation remains `previewTransaction(...)`; diagnostics never mutate or reject a candidate.
- Consumed by Tasks 4 and 5.

- [ ] **Step 1: Add failing tests proving a schema-invalid reference remains rejected while a valid geometry edit with a new dangling endpoint, changed annotation value, or violated constraint remains previewable and yields warnings/decision-required facts.**

- [ ] **Step 2: Run focused transaction/diagnostic tests and confirm current spatial validation rejects or cannot represent the split behavior.**

- [ ] **Step 3: Implement diagnostic types and pure evaluators for endpoint/topology deltas, constraint impact, annotation impact, changed-node scope, and candidate confidence.**

- [ ] **Step 4: Reduce legacy `validateSpatialEditPreview` to a diagnostic compatibility adapter for still-unmigrated callers; do not let it rewrite model commands or strategy.**

- [ ] **Step 5: Run focused tests, `npm run check`, and the full test suite; commit Task 3 files with `refactor: separate drawing diagnostics from hard validation`.**

### Task 4: Versioned Model Tool Gateway

**Files:**
- Create: `api/services/drawing-tools/types.ts`
- Create: `api/services/drawing-tools/registry.ts`
- Create: `api/services/drawing-tools/registry.test.ts`
- Create: `api/services/drawing-tools/drawing-tools.ts`
- Create: `api/services/drawing-tools/drawing-tools.test.ts`
- Create: `api/services/drawing-tools/topology-tools.ts`
- Create: `api/services/drawing-tools/topology-tools.test.ts`
- Create: `api/services/drawing-tools/generation-tools.ts`
- Create: `api/services/drawing-tools/generation-tools.test.ts`
- Modify: `api/services/drawing-application/application.ts`

**Interfaces:**
- Produces `ModelDrawingToolRegistry.invoke({ runId, episodeId, drawingId, revision, toolCallId, tool, input })` returning a versioned `ModelToolResult` and audit-safe receipt.
- Provides tool names listed in the design; generation tools return handles/candidates and never commit automatically.
- Consumed by Task 5.

- [ ] **Step 1: Add failing registry tests for unique tool call IDs, strict input parsing, revision binding, timeout/error receipts, and no second document state.**

- [ ] **Step 2: Implement registry and common receipt types with read concurrency and serialized preview/commit operations.**

- [ ] **Step 3: Add failing real behavior tests for `query_nodes`, `inspect_nodes`, `render_drawing`, `measure_geometry`, `preview_transaction`, `evaluate_preview`, and `commit_preview`; assert resulting Drawing documents and receipts rather than mocks.**

- [ ] **Step 4: Implement core drawing tools through `DrawingApplication`, `previewTransaction`, diagnostics, and repository CAS.**

- [ ] **Step 5: Add failing topology tests showing `trace_paths` returns alternate candidates and uncertainty without `authorizationId`, and `materialize_split` only changes a candidate transaction.**

- [ ] **Step 6: Adapt existing atomic graph/resolver/split services behind topology tools, removing accepted/write-authority semantics from the returned public result.**

- [ ] **Step 7: Add failing generation tests proving redraw/vectorize/fit return candidates, generation errors are returned to the caller, and no automatic geometric fallback occurs. Implement adapters around existing services.**

- [ ] **Step 8: Run all Task 4 tests plus `npm run check`; commit with `feat: expose model-led drawing tool gateway`.**

### Task 5: Model Action Adapter and Runtime Loop

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/contracts/drawing-agent.test.ts`
- Create: `api/services/drawing-agent/model-loop-adapter.ts`
- Create: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Create: `api/services/drawing-agent/model-loop-runtime.ts`
- Create: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/state.ts`
- Modify: `api/services/drawing-agent/state.test.ts`
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Modify: `api/services/drawing-episode/types.ts`
- Modify: `api/services/drawing-episode/context-builder.ts`

**Interfaces:**
- Produces `DrawingAgentActionModel.next(input): Promise<DrawingAgentAction>` and `ModelLedDrawingAgentRuntime` with `start/getState/getProgress/pause/resume/stop/addInstruction/respondToDecision`.
- Consumed by Task 6 and `api/app.ts` in Task 7.

- [ ] **Step 1: Add failing parser/adapter tests for `tool`, `request-human-decision`, `commit`, and `finish` actions, exact schema repair, current tool catalog, Drawing summary, visual observations, recent diagnostics, decisions, and appended instructions.**

- [ ] **Step 2: Implement one multimodal action adapter with no planner DAG, no spatial authorization, and no forced strategy fields.**

- [ ] **Step 3: Replace state-machine tests with failing behavior for `running → waiting_for_user → running`, pause/stop from waiting, append instructions, tool receipt budgets, current Preview handle, duplicate digest tracking, and completion without workflow nodes.**

- [ ] **Step 4: Implement the minimum new state transitions while preserving public document/model secrecy.**

- [ ] **Step 5: Add a failing runtime integration test in which the model queries topology, sees an incomplete path, renders a focused view, previews a free replacement across all four planes, reads diagnostics, revises it, and commits. Use the real Drawing Core and tool registry.**

- [ ] **Step 6: Implement the bounded action loop, true progress events/overlays, Preview reuse/expiry, model escalation configuration, duplicate candidate feedback, and atomic commit.**

- [ ] **Step 7: Add failing runtime tests for constraint deletion decision: the runtime enters waiting, persists the request, grants and commits after approval, replans after denial, and invalidates the grant after revision/digest changes.**

- [ ] **Step 8: Implement Human Decision pause/resume and audit context; ordinary diagnostics must never enter waiting automatically.**

- [ ] **Step 9: Run Task 5 tests, `npm run check`, and full tests; commit with `feat: run model-led drawing tool loop`.**

### Task 6: HTTP and Client Human Interaction Flow

**Files:**
- Modify: `api/routes/agent-runs.ts`
- Modify: `api/routes/agent-runs.test.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Create: `src/components/HumanDecisionCard.tsx`
- Create: `src/components/HumanDecisionCard.test.tsx`
- Modify: `src/components/AIDialog.tsx`
- Modify: `src/components/AIDialog.test.tsx`
- Modify: `src/components/ComposerTaskStatus.tsx`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`

**Interfaces:**
- Adds `POST /api/agent/runs/:runId/decisions/:requestId/respond`.
- Projects `pendingDecision` in `DrawingAgentRunView` and exposes `respondToAgentDecision(...)` in the Zustand store.

- [ ] **Step 1: Add failing route/client tests for valid response, stale request, duplicate response, unknown option, waiting-state pause/stop, and current-run projection.**

- [ ] **Step 2: Implement strict route parsing and client API calls; do not overload general instruction submission.**

- [ ] **Step 3: Add failing store tests proving a pending request appears, survives event polling, resolves into the same run, and clears on revision expiry/terminal state. Implement store projection.**

- [ ] **Step 4: Add failing component tests for a compact card above the composer with question, reason, affected resource summary, recommended option, preview affordance, and optional additional instruction.**

- [ ] **Step 5: Implement the card and waiting status without exposing model names or hidden reasoning; ordinary task status remains a single latest state.**

- [ ] **Step 6: Run focused UI/API tests, `npm run check`, and `npm run build`; commit with `feat: add human decision interaction flow`.**

### Task 7: Switch Production Wiring and Remove Legacy Decision Authority

**Files:**
- Modify: `api/app.ts`
- Modify: `api/routes/agent-runs.ts`
- Modify: `README.md`
- Delete or remove production imports from: `api/services/drawing-spatial/topology-authorization.ts`
- Delete or remove production imports from: `api/services/drawing-spatial/strategy-router.ts`
- Delete or archive tests tied only to removed production authority semantics.
- Modify: `api/services/drawing-agent/generic-spatial-architecture.test.ts`
- Modify: `src/contracts/drawing-spatial-region.ts` only to remove obsolete authorization contracts after all consumers are migrated.

**Interfaces:**
- Production `api/app.ts` creates only `ModelLedDrawingAgentRuntime` for agent editing.
- No production route reaches accepted SpatialSelection, SpatialEditAuthorization, or forced Strategy Router.

- [ ] **Step 1: Add/replace an architecture dependency test that fails while production runtime/app imports authorization, forced strategy routing, or legacy planner DAG adapters.**

- [ ] **Step 2: Wire the new model loop, tool registry, diagnostics, human store, CV/vectorization/redraw adapters, audit and Episode stores in `api/app.ts`.**

- [ ] **Step 3: Delete legacy production runtime imports and obsolete authority contracts/files once `rg` shows no production consumer. Do not delete reusable topology, split, fit, render, generation, perception, or replay code.**

- [ ] **Step 4: Update README commands and architecture only to describe verified behavior.**

- [ ] **Step 5: Run architecture tests, `rg` removal checks, `npm run check`, full tests, lint, and build; commit with `refactor: switch to model-led drawing agent`.**

### Task 8: Real Model and Browser Regression

**Files:**
- Create: `scripts/e2e-model-led-test2.ts`
- Modify: `package.json`
- Add focused regression fixtures only if they contain no user-local audit or media data.

**Interfaces:**
- Produces `npm run e2e:model-led-test2` and an audit report containing real tool actions, Preview versions, diagnostics, optional Human Decisions, Commit, and final revision.

- [ ] **Step 1: Write an E2E driver that imports/opens the current `test2` Drawing IR, starts the configured model-led agent with the generic instruction, consumes progress, and asserts a committed or explicitly decision-waiting result without relying on object-specific coordinates or IDs.**

- [ ] **Step 2: Run the driver against the local server and observe the expected initial failure before the full flow is wired or correct.**

- [ ] **Step 3: Fix only general runtime/tool/diagnostic issues exposed by the run, each behind a focused failing automated test. Do not add sample-specific prompts or thresholds.**

- [ ] **Step 4: Use the in-app browser to reproduce the user flow: clear canvas, load the clean line drawing/Drawing IR, submit the edit, observe dynamic tool overlays and Preview revisions, answer a decision only if requested, and inspect the final Drawing IR and visual output.**

- [ ] **Step 5: Verify the result against generic invariants: intended semantic change, connected/closed limb boundary where applicable, unchanged unrelated structure, correct orientation from actual coordinates, valid Drawing IR, replayable Commit, and no model name in UI.**

- [ ] **Step 6: Run `npm test -- --reporter=dot`, `npm run check`, `npm run lint`, `npm run build`, Python vectorization tests, deterministic replay, and the real E2E script. Record exact pass/fail counts and any external-model variance.**

- [ ] **Step 7: Commit the regression driver and general fixes with `test: verify model-led drawing agent end to end`.**

## Plan Self-Review

- **Spec coverage:** Tasks cover all four IR planes, free replacement/redraw, tools, diagnostics, Human Decision, waiting UI, transaction/replay, legacy deletion, model replacement, and real browser regression.
- **No dual authority:** Task 7 removes production authorization/router imports after the tool loop is active.
- **Type consistency:** `DrawingAgentAction`, `HumanDecisionRequest/Response`, `PermissionGrant`, `DrawingTransactionMetadata`, `DrawingLineageRecord`, `ModelDrawingToolRegistry`, and `pendingDecision` are introduced before consumers.
- **Safety boundary:** Only protocol/revision/grant failures are hard; diagnostic facts do not mutate or reject candidates.
- **No sample rules:** `test2` appears only in Task 8 regression and never in a production API or prompt requirement.
- **Dirty worktree:** Every task stages explicit files only and preserves pre-existing unrelated changes.
