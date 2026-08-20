# Task-Driven 2D World Model Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy sampled-topology context with a revision-bound, task-driven 2D world model that supports local knowledge state, temporary semantic abstraction, counterfactual Preview queries, and a one-decision fast path.

**Architecture:** Canonical Drawing IR remains the only writable truth. New `drawing-world-model`, `drawing-grounding`, `drawing-spatial-actions`, and `drawing-preview-world` modules expose derived, revision-bound contracts; existing geometry sampling and transaction code are adapted behind these boundaries until the exact arrangement kernel replaces them. Runtime receives one compact `WorldModelSlice` and Evidence Delta without adding mandatory model stages.

**Tech Stack:** TypeScript 5.8, Vitest 3, existing Drawing IR/transaction engine, Express tool gateway, Sharp-backed shared renderer.

## Global Constraints

- Work directly on `main`; do not create a branch or worktree, per project owner decision.
- Do not use subagents; execute the plan inline in the current session.
- Use test-driven development: every production behavior starts with a failing test observed for the expected reason.
- Do not add object-, action-, orientation-, fixture-, or `test1`/`test2`-specific production rules.
- Drawing IR remains the only writable truth; all new world-model data is revision-bound and disposable.
- New capabilities are conditional projections, not fixed serial model stages.
- A clear local task targets one model decision before first Preview; extra decisions require `escalationReason` and non-empty Evidence Delta.
- Preserve all unrelated dirty-worktree changes and stage only files owned by the current task.

---

### Task 1: Revision-Bound World Model Core

**Files:**
- Create: `api/services/drawing-world-model/types.ts`
- Create: `api/services/drawing-world-model/compiler.ts`
- Create: `api/services/drawing-world-model/compiler.test.ts`
- Create: `api/services/drawing-world-model/index.ts`

**Interfaces:**
- Consumes: `DrawingDocument`, `RevisionId`, `Bounds2D`, and existing geometry bounds/sampling helpers.
- Produces: `WorldModelCompiler.compile(document, revision, request): WorldModelSlice`; `WorldModelSlice` contains `SourceSpan`, directed half-edges, authored/incidence connections, diagnostics, and `WorldModelKnowledgeState`.

- [x] **Step 1: Write failing tests for revision identity and knowledge semantics**

```ts
it('returns resolved only when the requested local scope is fully compiled', () => {
  const slice = compiler.compile(document, revision, { nodeIds: ['line_a'] });
  expect(slice.knowledge.state).toBe('resolved');
  expect(slice.sourceSpans[0]).toMatchObject({ sourceNodeId: 'line_a', parameterRange: [0, 1] });
});

it('marks truncated and unsupported scope as partial rather than empty', () => {
  const slice = compiler.compile(documentWithSpline, revision, { limit: 1 });
  expect(slice.knowledge.state).toBe('partial');
  expect(slice.knowledge.unresolvedBoundaryRefs.length).toBeGreaterThan(0);
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run api/services/drawing-world-model/compiler.test.ts`

Expected: FAIL because `drawing-world-model/compiler.ts` does not exist.

- [x] **Step 3: Implement immutable contracts and the minimum compiler**

Implement deterministic IDs from revision, node ID, and parameter range; keep `incidence` separate from authored `connected`; report sampled fallback and truncation explicitly. Do not claim faces or analytic intersections that were not compiled.

- [x] **Step 4: Run the test and verify GREEN**

Run: `pnpm vitest run api/services/drawing-world-model/compiler.test.ts`

Expected: PASS.

### Task 2: Task-Relevant Semantic View and Grounding History

**Files:**
- Create: `api/services/drawing-grounding/types.ts`
- Create: `api/services/drawing-grounding/ledger.ts`
- Create: `api/services/drawing-grounding/ledger.test.ts`
- Create: `api/services/drawing-grounding/task-relevant-view.ts`
- Create: `api/services/drawing-grounding/task-relevant-view.test.ts`
- Create: `api/services/drawing-grounding/index.ts`

**Interfaces:**
- Consumes: current `WorldModelSlice`, semantic hypotheses, and append-only evidence events.
- Produces: `GroundingLedger.append/fold/delta`, `createTaskRelevantView`, and temporary `part-of | contains | boundary-of | interface-with | context-for` relations.

- [x] **Step 1: Write failing tests for superseding and task-scoped grouping**

```ts
it('folds support deltas without replaying superseded supports', () => {
  ledger.append(proposed);
  ledger.append(refinedRemovingBodyEdge);
  expect(ledger.current('entity_arm')?.supportRefs).toEqual(['span_upper', 'span_lower']);
});

it('groups the same spans differently for different goals without mutating Drawing IR', () => {
  expect(createTaskRelevantView({ goalDigest: 'goal_a', hypotheses }).relations)
    .not.toEqual(createTaskRelevantView({ goalDigest: 'goal_b', hypotheses }).relations);
  expect(document.features).toHaveLength(0);
});
```

- [x] **Step 2: Run both tests and verify RED**

Run: `pnpm vitest run api/services/drawing-grounding/ledger.test.ts api/services/drawing-grounding/task-relevant-view.test.ts`

Expected: FAIL because the modules do not exist.

- [x] **Step 3: Implement append-only folding and task projection**

Store only event deltas; expose full history to audit and only `current + deltaSince(cursor)` to model context. Reject cross-revision events and dangling semantic relations.

- [x] **Step 4: Run both tests and verify GREEN**

Run: `pnpm vitest run api/services/drawing-grounding/ledger.test.ts api/services/drawing-grounding/task-relevant-view.test.ts`

Expected: PASS.

### Task 3: Counterfactual Preview World

**Files:**
- Create: `api/services/drawing-preview-world/types.ts`
- Create: `api/services/drawing-preview-world/service.ts`
- Create: `api/services/drawing-preview-world/service.test.ts`
- Create: `api/services/drawing-preview-world/index.ts`
- Modify: `api/services/drawing-tools/drawing-tools.ts`
- Modify: `api/services/drawing-tools/drawing-tools.test.ts`

**Interfaces:**
- Consumes: transaction Preview result, base document/revision, resulting temporary document, and `WorldModelCompiler`.
- Produces: `CounterfactualWorldBranch` with affected bounds/nodes, world-model delta, knowledge state, and stable query handle.

- [x] **Step 1: Write failing service tests**

```ts
it('derives only the affected local world from a ready preview', () => {
  const branch = service.create({ baseDocument, previewResult, transactionDigest: 'a'.repeat(64) });
  expect(branch.affectedScope.nodeIds).toEqual(['line_a']);
  expect(branch.delta.unchangedNodeCount).toBe(baseDocument.geometry.length - 1);
});

it('rejects a branch when base revision or digest changes', () => {
  expect(() => service.get(branch.id, otherRevision)).toThrow(/COUNTERFACTUAL_STALE/);
});
```

- [x] **Step 2: Run and verify RED**

Run: `pnpm vitest run api/services/drawing-preview-world/service.test.ts`

Expected: FAIL because the service does not exist.

- [x] **Step 3: Implement branch creation and local delta**

Reuse the temporary `resultingDocument`; calculate affected bounds from Patch nodes and compile only an expanded local scope. Store handles in memory with revision/digest guards; never create a canonical revision.

- [x] **Step 4: Expose the branch from `preview_transaction` and `evaluate_preview`**

Return `counterfactualBranchId`, affected scope, topology/support summary, and knowledge state. Keep full documents private.

- [x] **Step 5: Run service and drawing-tool tests**

Run: `pnpm vitest run api/services/drawing-preview-world/service.test.ts api/services/drawing-tools/drawing-tools.test.ts`

Expected: PASS.

### Task 4: World Model, Grounding, and Action Tool Surface

**Files:**
- Create: `api/services/drawing-world-model/tools.ts`
- Create: `api/services/drawing-world-model/tools.test.ts`
- Create: `api/services/drawing-spatial-actions/types.ts`
- Create: `api/services/drawing-spatial-actions/proposals.ts`
- Create: `api/services/drawing-spatial-actions/proposals.test.ts`
- Create: `api/services/drawing-spatial-actions/index.ts`
- Modify: `api/services/drawing-tools/index.ts`
- Modify: `api/services/drawing-tools/catalog.ts`
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/contracts/drawing-agent.test.ts`

**Interfaces:**
- Consumes: Drawing Application current checkpoint, world compiler, Grounding Ledger, and existing topology/transaction tools.
- Produces model tools: `build_world_slice`, `inspect_world_slice`, `ground_semantic_entities`, `refine_semantic_entity`, `propose_spatial_actions`, and `inspect_counterfactual_world`.

- [x] **Step 1: Write failing contract and tool tests**

Assert that all tools return drawing/revision/compiler/input digest, Knowledge State, bounded result counts, and continuation rather than silent truncation.

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run api/services/drawing-world-model/tools.test.ts api/services/drawing-spatial-actions/proposals.test.ts src/contracts/drawing-agent.test.ts`

Expected: FAIL because new tools are not registered.

- [x] **Step 3: Implement bounded read tools and non-authorizing proposals**

Action proposals may rank `transform | deform | solve | replace | redraw | hybrid | raw`, but only describe feasibility, cost, affected refs, and diagnostics. They never create write authorization.

- [x] **Step 4: Register compact catalog contracts**

Keep full input schema lazy-loaded through the existing capability catalog. Do not add all tool contracts to every model request.

- [x] **Step 5: Run tool and contract tests**

Run: `pnpm vitest run api/services/drawing-world-model/tools.test.ts api/services/drawing-spatial-actions/proposals.test.ts src/contracts/drawing-agent.test.ts api/services/drawing-tools/registry.test.ts`

Expected: PASS.

### Task 5: Runtime Fast Path and Evidence-Driven Escalation

**Files:**
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Modify: `src/contracts/drawing-agent.ts`

**Interfaces:**
- Consumes: current `WorldModelSlice`, `TaskRelevantView`, Grounding Evidence Delta, tool results, and Preview branch summaries.
- Produces: one compact model context plus audited `escalationReason`, without mandatory extra planner/grounder/verifier calls.

- [x] **Step 1: Write failing fast-path tests**

```ts
it('provides world slice and action facts in the first model decision', async () => {
  await runtime.start(clearLocalGoal);
  expect(model.inputs[0].spatialContext?.worldModelSlice).toBeDefined();
  expect(model.inputs).toHaveLength(1);
});

it('requires reason and evidence before an extra decision', async () => {
  expect(() => recordEscalation({ reason: '', evidenceRefs: [] })).toThrow();
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-agent/model-loop-adapter.test.ts`

Expected: FAIL on missing world-model context/escalation contract.

- [x] **Step 3: Integrate the fast path**

Build deterministic evidence concurrently where possible, send one Observation and one bounded Slice, then let the existing model select a target and action in one decision. Reuse caches across later turns; emit no synthetic stages.

- [x] **Step 4: Add evidence-driven escalation accounting**

Extra model turns must point to ambiguity, relevant incomplete knowledge, infeasible action, Preview defect, user instruction, or protocol repair and include new evidence/diagnostic digest.

- [x] **Step 5: Run runtime/adapter tests**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-agent/model-loop-adapter.test.ts api/services/drawing-agent/context-budget.test.ts`

Expected: PASS.

### Task 6: Regression, Benchmarks, and Migration Cleanup

**Files:**
- Create: `api/services/drawing-world-model/evidence-efficiency.test.ts`
- Modify: `api/services/drawing-agent/generic-spatial-architecture.test.ts`
- Modify: `scripts/benchmark-agent-context.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: production tool registry, runtime audit, and local largest Drawing snapshot.
- Produces: regression evidence for knowledge correctness, one-decision first Preview, bounded context, branch locality, and no fixture-specific logic.

- [ ] **Step 1: Add failing architecture and efficiency gates**

Assert production uses the new module boundaries, no region-intersection authorization remains, clear local tasks have one pre-Preview model decision, extra turns carry Evidence Delta, and counterfactual compilation touches only affected scope.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run api/services/drawing-world-model/evidence-efficiency.test.ts api/services/drawing-agent/generic-spatial-architecture.test.ts`

- [ ] **Step 3: Finish migration wiring and remove replaced production entry points**

Delete only code proven unused by production and tests; preserve reusable geometry kernels as adapters. Do not maintain old/new production main chains behind a feature flag.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm benchmark:agent-context
```

Expected: all commands exit 0; benchmark reports one image, bounded text context, and world-model/branch timings separately.

- [ ] **Step 5: Run the real local browser workflow**

Start the local server, import/open the clean line drawing, issue a generic semantic edit, and verify visible Grounding evidence, current Preview, counterfactual diagnostics, retry continuity, and Commit/Undo in the browser. Record actual failures rather than substituting mocks.
