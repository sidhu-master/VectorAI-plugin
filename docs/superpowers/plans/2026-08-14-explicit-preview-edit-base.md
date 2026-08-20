# Explicit Preview Edit Base Implementation Plan

> **Execution:** Work in the current main flow. Do not create a branch, worktree, commit, or object/action-specific fallback.

**Goal:** Let the main model explicitly choose between restarting from the canonical revision and revising the current Preview, while keeping every resulting candidate independently replayable and auditable.

**Architecture:** Public model context exposes two concrete edit-base options. `preview_transaction` creates a complete candidate from the canonical revision; `revise_preview` applies corrections to a specifically identified current candidate, then composes and revalidates a standalone canonical transaction. Runtime validates that the model-selected base is current and records candidate ancestry.

**Tech Stack:** TypeScript, Vitest, Drawing IR command/transaction engine, model-led runtime, Counterfactual World and SSE progress.

## Global constraints

- Preserve all unrelated dirty-worktree changes.
- Follow RED → GREEN → REFACTOR for every behavior change.
- The model chooses restart versus revise; Runtime only validates and executes the declared choice.
- Do not add hand, arm, greeting, direction, test1 or test2 logic.
- Review Evidence remains advisory and never becomes a Commit permission.
- Keep model context bounded; do not send the full candidate document or complete candidate history.

---

### Task 1: Make edit-base options a first-class model contract

**Files:**
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/contracts/drawing-agent.test.ts`
- Modify: `api/services/drawing-tools/catalog.ts`

- [ ] Add a failing adapter test asserting that a canonical-only turn exposes `startFromCanonical.baseRevision`.
- [ ] Add a failing adapter test asserting that a turn with a current Preview exposes both exact choices: canonical replacement and candidate revision, including handle and digest.
- [ ] Add `revise_preview` to the shared model tool-name contract and schema tests.
- [ ] Implement the minimal typed `ModelLoopEditBaseOptions` projection.
- [ ] Update the system prompt and tool guides so restart and revision are explicit model choices.
- [ ] Run: `pnpm vitest run api/services/drawing-agent/model-loop-adapter.test.ts src/contracts/drawing-agent.test.ts`

### Task 2: Implement candidate-relative revision as a deterministic tool

**Files:**
- Modify: `api/services/drawing-tools/drawing-tools.ts`
- Modify: `api/services/drawing-tools/drawing-tools.test.ts`
- Modify: `api/services/drawing-tools/catalog.ts`
- Modify: `api/services/drawing-tools/gateway.test.ts`

- [ ] Add a failing test that creates Preview A, revises only one field into Preview B, and proves B preserves every unrelated change from A.
- [ ] Add failing tests for wrong handle, wrong digest and stale revision.
- [ ] Add a failing four-plane test proving geometry, annotation, relation and feature changes from the parent remain in the revised standalone transaction.
- [ ] Store the exact candidate resulting document and explicit edit-base ancestry in `StoredCandidate`.
- [ ] Implement `revise_preview` by validating corrections against the parent candidate document, composing them with the parent canonical transaction, replaying the complete transaction from canonical, and comparing the final documents.
- [ ] Strip candidate-relative `expected` values only after they have been checked against the parent result; retain canonical parent preconditions.
- [ ] Return the same Preview delta, observation, diagnostics and Counterfactual summary shape as other semantic Preview tools.
- [ ] Run: `pnpm vitest run api/services/drawing-tools/drawing-tools.test.ts api/services/drawing-tools/gateway.test.ts`

### Task 3: Enforce the model's declared choice in the runtime

**Files:**
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/tool-catalog-policy.ts`
- Modify: `api/services/drawing-agent/tool-catalog-policy.test.ts`

- [ ] Add a failing loop test where the reviewer rejects Preview A and the model returns only a correction through `revise_preview`; assert Preview B retains A's earlier modification.
- [ ] Add a failing loop test where the model explicitly restarts with `preview_transaction`; assert A's changes are absent unless repeated.
- [ ] Add failing protocol tests for an implicit restart, a non-current revision base and a non-current candidate base.
- [ ] Project the exact `editBaseOptions` from the current candidate snapshot into every model turn.
- [ ] Make `revise_preview` available only while a current Preview exists.
- [ ] Require `preview_transaction.replacesPreviewHandle` when replacing a current Preview, and require it to be absent when no Preview exists.
- [ ] Treat `revise_preview` as a semantic Preview for independent review, canvas delta, observation selection and duplicate-candidate accounting.
- [ ] Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-agent/tool-catalog-policy.test.ts`

### Task 4: Preserve ancestry in audit and real UI progress

**Files:**
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/file-audit-store.test.ts`
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`

- [ ] Add failing assertions that candidate audit records distinguish `canonical`, `canonical-restart` and `preview-revision` bases.
- [ ] Add a failing presentation test for the real latest status “正在基于当前候选修订”.
- [ ] Audit the parent handle/digest or replaced handle whenever a new Preview becomes current.
- [ ] Publish `revising` progress for candidate-relative work and ordinary `previewing` for canonical restart.
- [ ] Keep the canvas atomic: the new Preview replaces the old displayed candidate without stacking deltas.
- [ ] Run: `pnpm vitest run api/services/drawing-agent/file-audit-store.test.ts src/components/agent/task-presentation.test.ts`

### Task 5: Align documentation and run the generic regression suite

**Files:**
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/agent-execution-flow.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-14-independent-preview-review-loop-design.md`

- [ ] Replace the old “every repair repeats the complete command set” contract with explicit restart/revise semantics.
- [ ] Document that Review Evidence identifies the reviewed candidate but the main model chooses the next edit base.
- [ ] Run focused tests from Tasks 1–4 together.
- [ ] Run: `pnpm exec tsc --noEmit`
- [ ] Run: `pnpm vitest run api/services/drawing-agent/model-loop-adapter.test.ts api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-agent/tool-catalog-policy.test.ts api/services/drawing-tools/drawing-tools.test.ts api/services/drawing-tools/gateway.test.ts src/contracts/drawing-agent.test.ts src/components/agent/task-presentation.test.ts`
- [ ] Run the prior manual-feedback regression with a scripted rejected candidate and verify the next correction can be relative to that candidate without losing earlier changes.

## Done definition

- Every model write names its canonical or Preview base.
- The model can freely choose restart or revise.
- Candidate-relative corrections preserve previous valid edits without making the model repeat them.
- Every revised candidate independently replays and commits from the canonical revision.
- Wrong, stale or ambiguous bases fail before changing the canvas or canonical Drawing IR.
- Review, ancestry, Preview replacement and Commit remain auditable and generic.
