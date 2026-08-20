# Independent Preview Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the diagnostic-acknowledgement and positive-verification gates with one independent, advisory before/after Preview review whose result becomes main-model context.

**Architecture:** The main model creates a revision-bound Preview. The runtime renders aligned before and after views, sends one two-panel comparison image to a separately configured reviewer, stores the result as `PreviewReviewEvidence`, and supplies that evidence to the next main-model turn. Only Drawing IR validity, current revision/Preview identity, and user grants can block commit.

**Tech Stack:** TypeScript, Vitest, Express runtime, Sharp image composition, shared Drawing IR and SceneCompiler.

## Global Constraints

- Do not create a branch, worktree, or sub-agent; execute in the current main flow.
- Do not commit unless the user explicitly requests it; the workspace contains ongoing MVP changes.
- Do not add object-, gesture-, direction-, test1-, or test2-specific logic.
- The reviewer never selects geometry, plans an edit, mutates Drawing IR, grants permission, or vetoes commit.
- Deterministic image vectorization and automatic annotation keep their no-review fast path.
- Every production behavior change follows RED → GREEN → REFACTOR.

---

### Task 1: Make Preview review a first-class model context

**Files:**
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.test.ts`

**Interfaces:**
- Produces: `PreviewReviewEvidence` with `status: 'satisfied' | 'needs_revision' | 'unavailable'`.
- Consumes: `ModelLoopActionInput.currentPreviewReview?: PreviewReviewEvidence`.

- [ ] **Step 1: Write the failing context-projection test**

Add a test that invokes the real `ModelLoopActionAdapter`, captures its serialized user prompt, and asserts this literal review object is present:

```ts
currentPreviewReview: {
  revision: 'revision_1',
  previewHandle: 'preview_1',
  transactionDigest: 'sha256:reviewed',
  status: 'needs_revision',
  reason: '右侧候选没有满足用户要求',
  defects: [],
  reviewedAt: 100,
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-adapter.test.ts`

Expected: FAIL because `ModelLoopActionInput` and the public context do not expose `currentPreviewReview`.

- [ ] **Step 3: Add the minimal typed contract and projection**

Define:

```ts
export interface PreviewReviewEvidence {
  revision: RevisionId;
  previewHandle: string;
  transactionDigest: string;
  status: 'satisfied' | 'needs_revision' | 'unavailable';
  reason: string;
  defects: DrawingPreviewDefect[];
  reviewedAt: number;
}
```

Add the optional field to `ModelLoopActionInput` and serialize it through `publicContext` without provider or model names.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-adapter.test.ts`

Expected: PASS.

### Task 2: Send one aligned before/after comparison image to an independent reviewer

**Files:**
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/preview-verifier.ts`
- Modify: `api/services/drawing-agent/preview-verifier.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/app.ts`
- Modify: `api/services/drawing-agent/file-audit-store.ts`
- Modify: `api/services/drawing-agent/file-audit-store.test.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `scripts/e2e-visual-edit.ts`

**Interfaces:**
- Consumes: effective objective, aligned before/after observations, deterministic diagnostics, and `modelProfile.reviewer`.
- Produces: existing typed `DrawingPreviewVerificationResult`, later converted to `PreviewReviewEvidence` by Runtime.

- [ ] **Step 1: Write failing reviewer boundary tests**

Add assertions that the real adapter sends exactly one image of width `before.width * 2`, its layout is `before | after`, and the reviewer receives the original goal plus appended instructions. Add a runtime assertion that the configured `reviewer` model is used without diagnostic-based escalation.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm vitest run api/services/drawing-agent/preview-verifier.test.ts api/services/drawing-agent/model-loop-runtime.test.ts
```

Expected: FAIL because the current sheet has three panels and model selection uses diagnostic/rejection state.

- [ ] **Step 3: Implement the two-panel reviewer packet**

Change the comparison builder to copy only before and after rows into a `width * 2` image. Simplify the reviewer prompt to:

```text
你是独立的二维图纸修改复核者。左侧是修改前，右侧是修改后。
你只判断修改后是否满足用户当前有效指令；不规划、不改图、不决定权限。
```

Add `reviewer: string` to `DrawingAgentModelProfile`, update audit parsing and existing typed fixtures, configure it in `api/app.ts`, and always use that role for Preview review.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

### Task 3: Keep rejected Preview visible and feed Review Evidence to the main model

**Files:**
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/state.ts`

**Interfaces:**
- Consumes: `DrawingPreviewVerificationResult`.
- Produces: `RunRecord.currentPreviewReview` and `ModelLoopActionInput.currentPreviewReview`.

- [ ] **Step 1: Write the failing real-loop test**

Use the real in-memory Drawing Application and Gateway. Script a semantic Preview whose reviewer returns `satisfied: false`, then assert on the next main-model input:

```ts
expect(input.currentPreviewHandle).toBe(rejectedHandle);
expect(input.currentPreviewReview).toMatchObject({
  previewHandle: rejectedHandle,
  status: 'needs_revision',
  reason: '目标尚未满足',
});
```

Also assert the Preview remains visible and the main model can replace it with a new Preview.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run api/services/drawing-agent/model-loop-runtime.test.ts`

Expected: FAIL because rejection currently clears `currentPreviewHandle` and stores no first-class Review Evidence.

- [ ] **Step 3: Implement the minimal lifecycle**

Replace `#independentlyVerifyPreview(): Promise<boolean>` with a review operation that always records one of:

```ts
{ status: 'satisfied', reason, defects }
{ status: 'needs_revision', reason, defects }
{ status: 'unavailable', reason, defects: [] }
```

Do not dispatch `PREVIEW_CLEARED` on `needs_revision` or repeated reviewer protocol failure. Clear the review only when a new Preview replaces it, revision changes, the run ends, or the current Preview is committed.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same focused test. Expected: PASS.

### Task 4: Remove diagnostic acknowledgements and positive-review commit authorization

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/contracts/drawing-agent.test.ts`
- Modify: `src/drawing/transaction/types.ts`
- Modify: `src/drawing/tests/transaction.test.ts`
- Modify: `src/drawing/tests/repository-state.test.ts`
- Modify: `api/services/drawing-diagnostics/types.ts`
- Modify: `api/services/drawing-diagnostics/evaluate-preview.ts`
- Modify: `api/services/drawing-diagnostics/evaluate-preview.test.ts`
- Modify: `api/services/drawing-spatial-actions/connected-transform.ts`
- Modify: `api/services/drawing-spatial-actions/connected-transform.test.ts`
- Modify: `api/services/drawing-tools/catalog.ts`
- Modify: `api/services/drawing-tools/drawing-tools.ts`
- Modify: `api/services/drawing-tools/drawing-tools.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`
- Modify: `api/services/drawing-agent/state.ts`
- Modify: `api/services/drawing-application/file-drawing-repository.ts`

**Interfaces:**
- Removes: `requiresModelAcknowledgement` and `diagnosticAcknowledgements` across diagnostics, tool schemas, transactions, actions, repository parsing, and prompts.
- Preserves: diagnostic codes, messages, node IDs, scale-independent facts, and exact current-Preview identity checks.

- [ ] **Step 1: Write failing authority-boundary tests**

Add one runtime test where a Preview with `confidence: 0.4` receives `needs_revision` and the main model commits that same current Preview. Assert commit succeeds and the result is a candidate. Add a second test where the model tries to commit a different non-current handle and receives `PREVIEW_NOT_CURRENT`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/contracts/drawing-agent.test.ts api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-tools/drawing-tools.test.ts
```

Expected: the first test fails on the positive-verification gate and the old acknowledgement protocol is still accepted.

- [ ] **Step 3: Remove the obsolete protocol and gates**

Delete acknowledgement fields and parsing. Keep connected-transform and length-change metrics as ordinary `warning` facts. Replace commit review authorization with only:

```ts
if (record.state.currentPreviewHandle !== action.previewHandle) {
  return PREVIEW_NOT_CURRENT;
}
```

The reviewer result remains attached to commit audit evidence but cannot allow or deny the write.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same command. Expected: PASS.

### Task 5: Align authoritative documentation and verify the generic loop

**Files:**
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/agent-execution-flow.md`
- Delete: `docs/superpowers/specs/2026-08-14-model-authoritative-diagnostic-loop-design.md`
- Delete: `docs/superpowers/plans/2026-08-14-model-authoritative-diagnostic-loop.md`
- Delete: `docs/superpowers/specs/2026-08-14-mandatory-semantic-preview-verification-design.md`
- Delete: `docs/superpowers/plans/2026-08-14-mandatory-semantic-preview-verification.md`

**Interfaces:**
- Documents: reviewer is independent and advisory; Review occurrence is part of the semantic loop, positive approval is not a commit permission.

- [ ] **Step 1: Update the documents after behavior is green**

Replace all acknowledgement/positive-receipt language with the approved terms “主模型 / 独立检查模型 / Review Evidence”. Remove the obsolete positive-gate design and plan so they cannot be mistaken for current architecture.

- [ ] **Step 2: Run focused generic regression**

Run:

```bash
pnpm vitest run api/services/drawing-agent/model-loop-adapter.test.ts api/services/drawing-agent/preview-verifier.test.ts api/services/drawing-agent/model-loop-runtime.test.ts api/services/drawing-diagnostics/evaluate-preview.test.ts api/services/drawing-spatial-actions/connected-transform.test.ts api/services/drawing-tools/drawing-tools.test.ts src/contracts/drawing-agent.test.ts
```

Expected: PASS with no object/action-specific fixtures in the new tests.

- [ ] **Step 3: Run project verification**

Run:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

Expected: all commands pass. If an existing unrelated regression remains, report its exact test and do not disguise it as success.

- [ ] **Step 4: Inspect the final diff for obsolete gates**

Run:

```bash
rg -n "requiresModelAcknowledgement|diagnosticAcknowledgements|PREVIEW_RECREATE_REQUIRED|PREVIEW_DIAGNOSTIC_ACKNOWLEDGEMENT_REQUIRED" api src
```

Expected: no production-code matches. The approved design document may name removed fields while documenting their deletion.
