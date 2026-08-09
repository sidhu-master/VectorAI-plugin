# One-slot Agent Drawing Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CV evidence private Agent context and make every visible drawing change come from one model-selected slot, rendered and verified before the next model decision.

**Architecture:** `cv_extract_evidence` creates bounded observation slots but never emits canvas geometry. A `transact` decision is bound to exactly one slot; its prepared transaction is projected into one provisional canvas delta, compared locally and globally, then promoted or rejected before the loop asks the model for its next decision. CV fitting deterministically samples oversized evidence and transaction gates prevent incompatible primitive coercion.

**Tech Stack:** TypeScript, Node.js, Vitest, existing DrawingFeedbackLoop/DrawingAgentRuntime, local OpenCV service, immutable DrawingDocument transactions.

## Global Constraints

- CV results are evidence/context only and must never be drawn directly.
- Each model `transact` decision references exactly one observation slot.
- Long fitted parameters may be referenced with `transact_fit`; the controller materializes exactly one explicit, validated DrawingCommand from the audited fit receipt.
- The UI receives a provisional drawing delta before validation and a promote/reject delta afterward.
- Only explicit 2D CAD primitives are supported; no layers, blocks, fills, or 3D.
- Local commits require meaningful local improvement and global non-regression.
- Oversized CV evidence is deterministically sampled within the requested budget.
- All decisions, proposals, validations, commits, and rejections remain auditable and replayable.
- Work directly in the current workspace; do not create a branch or sub-agent.

---

### Task 1: Stop Rendering CV Inventory

**Files:**
- Modify: `api/services/drawing-feedback/types.ts`
- Modify: `api/services/drawing-feedback/loop-controller.ts`
- Test: `api/services/drawing-feedback/loop-controller.test.ts`

**Interfaces:**
- Consumes: successful `cv_extract_evidence` executions.
- Produces: `{ kind: 'inventory'; regionId?: string; slotIds: string[]; candidateCount: number }`, containing metadata only.

- [x] **Step 1: Write the failing test**

Add a loop test that returns several CV candidates and asserts no geometry-bearing `observation` output is emitted, while the resulting slots remain available to the following model call.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- api/services/drawing-feedback/loop-controller.test.ts`
Expected: FAIL because the loop currently emits all projected CV candidates as `observation` nodes.

- [x] **Step 3: Write minimal implementation**

Replace the geometry-bearing extraction output with inventory metadata and remove `projectFeedbackCandidates` from the extraction path.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- api/services/drawing-feedback/loop-controller.test.ts`
Expected: PASS.

### Task 2: Enforce One-slot Transactions

**Files:**
- Modify: `api/services/drawing-feedback/model-adapter.ts`
- Modify: `api/services/drawing-feedback/loop-controller.ts`
- Test: `api/services/drawing-feedback/model-adapter.test.ts`
- Test: `api/services/drawing-feedback/loop-controller.test.ts`

**Interfaces:**
- Consumes: `FeedbackAgentDecision` with `type: 'transact'`.
- Produces: one-slot transactions only; incompatible slot/command geometry yields protocol feedback and no preview.

- [x] **Step 1: Write failing protocol and scope tests**

Assert that two `slotIds` are rejected, and that a circle command cannot be proposed for a slot whose only candidate type is `polyline`.

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/services/drawing-feedback/model-adapter.test.ts api/services/drawing-feedback/loop-controller.test.ts`
Expected: FAIL because multi-slot and incompatible primitive transactions are currently accepted.

- [x] **Step 3: Implement strict validation and prompt guidance**

Require `slotIds.length === 1`, describe the single-object loop in the model prompt, and validate create-command primitive types against the selected slot candidate types.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- api/services/drawing-feedback/model-adapter.test.ts api/services/drawing-feedback/loop-controller.test.ts`
Expected: PASS.

### Task 3: Stream the Model Proposal to the Canvas

**Files:**
- Modify: `api/services/drawing-feedback/preview-projector.ts`
- Modify: `api/services/drawing-feedback/types.ts`
- Modify: `api/services/drawing-feedback/loop-controller.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Test: `api/services/drawing-feedback/preview-projector.test.ts`
- Test: `api/services/drawing-feedback/loop-controller.test.ts`
- Test: `api/services/drawing-agent/runtime.test.ts`

**Interfaces:**
- Produces: `{ kind: 'proposal'; slotId: string; nodes: PerceptionPreviewNode[]; labelsByNodeId: Record<string,string> }`.
- Runtime maps `proposal` to one `perception_delta` action and tracks its stable `feedbackPreviewNodeId(slotId)` for later promote/reject.

- [x] **Step 1: Write failing projection and event-order tests**

Assert that a prepared one-slot transaction produces one stable preview node, and that runtime output order is proposal then promote/reject before the next model decision.

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/services/drawing-feedback/preview-projector.test.ts api/services/drawing-feedback/loop-controller.test.ts api/services/drawing-agent/runtime.test.ts`
Expected: FAIL because current preview output contains IDs only and cannot render geometry.

- [x] **Step 3: Implement transaction preview projection and runtime publishing**

Project affected geometry/annotation nodes from `preview.previewDocument`, assign stable slot preview IDs, yield `proposal`, and publish only those nodes to the preview layer.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- api/services/drawing-feedback/preview-projector.test.ts api/services/drawing-feedback/loop-controller.test.ts api/services/drawing-agent/runtime.test.ts`
Expected: PASS.

### Task 4: Bound Fitting and Strengthen Validation

**Files:**
- Modify: `api/services/drawing-cv/tool-registry.ts`
- Modify: `api/services/drawing-feedback/loop-controller.ts`
- Test: `api/services/drawing-cv/tool-registry.test.ts`
- Test: `api/services/drawing-feedback/loop-controller.test.ts`

**Interfaces:**
- CV fit reads at most `budget.maxSamplesPerResult` evenly distributed evidence samples.
- Commit acceptance requires local topology/association validity, a measurable local gain, and no global residual regression.

- [x] **Step 1: Write failing sampling and validation tests**

Assert a 550-sample handle succeeds with a 500-sample fit budget, an epsilon-only local change is rejected, and a locally improved proposal with increased global required residuals is rejected.

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/services/drawing-cv/tool-registry.test.ts api/services/drawing-feedback/loop-controller.test.ts`
Expected: FAIL with the existing budget rejection and permissive acceptance rule.

- [x] **Step 3: Implement deterministic sampling and two-level gate**

Read deterministic evenly spaced sample pages, define explicit local improvement tolerances, compare the preview document globally before commit, and record both reports in the audit event.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- api/services/drawing-cv/tool-registry.test.ts api/services/drawing-feedback/loop-controller.test.ts`
Expected: PASS.

### Task 5: Regression and Real-flow Verification

**Files:**
- Modify only files required by failures proven during verification.

**Interfaces:**
- Produces a verified one-slot reconstruction loop suitable for the local `test1.jpg` acceptance flow.

- [x] **Step 1: Run focused feedback/CV/runtime tests**

Run: `npm test -- api/services/drawing-feedback api/services/drawing-cv api/services/drawing-agent/runtime.test.ts`
Expected: PASS.

- [x] **Step 2: Run repository checks**

Run the repository test, type-check, and build commands from `package.json`.
Expected: all commands exit 0.

- [x] **Step 3: Run one local test1 workflow and inspect audit ordering**

Expected audit invariant: CV inventory creates no canvas delta; every visible proposal is preceded by one model transact decision and followed by exactly one validation plus promote/reject event before the next transact decision.

- [x] **Step 4: Commit only files belonging to this change**

Use a focused commit and preserve unrelated modified/untracked files already present in the workspace.
