# Spatial Patch, History, and Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace whole-entity AI mutations with validated local SpatialPatch operations, add reversible SpatialCommit history, and persist replayable audit events locally.

**Architecture:** Spatial Core owns pure patch validation, application, inversion, and history state without React or Node dependencies. The API layer owns an `AuditStore` abstraction and a filesystem implementation; the UI store consumes Core history as a projection. Existing SpatialIntent remains accepted temporarily and is compiled into SpatialPatch at the compatibility boundary.

**Tech Stack:** TypeScript 5.8, Vitest 3, Zustand 5, Express 4, Node.js ESM filesystem APIs.

## Global Constraints

- Spatial Core must not import React, Zustand, Express, Node filesystem APIs, or model-provider code.
- Every committed model mutation must be represented by a SpatialPatch and validated on a temporary model first.
- A successful SpatialCommit must contain both `patch` and `inversePatch`.
- Empty patches are valid for pure verification stages.
- Failed patch attempts must not mutate the source model or enter commit history.
- Local audit data lives under `.local/vectorai/runs/<runId>/` and `.local/` must be ignored by Git.
- Audit serialization must omit credentials, bearer tokens, base64 image/PDF bodies, and hidden model reasoning.
- Existing Core tests and the current text/image UI flows must remain functional during migration.
- Audit persistence must remain off the synchronous model/Patch critical path except for bounded enqueue work.
- Every audit event and commit records stage timing fields needed by the later 30-second progress SLA.

---

## File Map

Create these focused Core files:

- `src/core/patch/types.ts` — patch operation and error types.
- `src/core/patch/validate.ts` — structural and reference validation.
- `src/core/patch/apply.ts` — immutable application and inverse generation.
- `src/core/patch/intent-to-patch.ts` — temporary SpatialIntent compatibility compiler.
- `src/core/history/types.ts` — SpatialCommit and history state.
- `src/core/history/history.ts` — commit, undo, redo, and cursor behavior.
- `api/services/audit/types.ts` — audit event and storage interfaces.
- `api/services/audit/file-audit-store.ts` — local JSONL/file persistence.
- `api/services/audit/redact.ts` — deterministic sensitive-field redaction.

Modify these integration files:

- `src/core/index.ts` — export new public Core interfaces.
- `src/core/agent.ts` — verify and apply patches through the new Core API.
- `src/hooks/useStore.ts` — hold history state and route model changes through commits.
- `.gitignore` — ignore local run artifacts.

---

### Task 1: Define and Validate SpatialPatch

**Files:**
- Create: `src/core/patch/types.ts`
- Create: `src/core/patch/validate.ts`
- Create: `src/core/tests/patch-validate.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `GeometryEntity`, `SpatialRelation`, and `SpatialModel` from `src/core/types.ts`.
- Produces: `SpatialPatch`, `SpatialOperation`, `EntityPatch`, `RelationPatch`, `PatchValidationResult`, and `validatePatch(patch, model)`.

- [ ] **Step 1: Write failing validation tests**

```typescript
import { describe, expect, it } from 'vitest';
import { createEmptyModel } from '../model';
import { validatePatch } from '../patch/validate';
import type { SpatialPatch } from '../patch/types';

describe('validatePatch', () => {
  it('accepts an empty patch for a verification-only step', () => {
    expect(validatePatch({ operations: [] }, createEmptyModel()).valid).toBe(true);
  });

  it('rejects an update to a missing entity', () => {
    const patch: SpatialPatch = {
      operations: [{ type: 'entity.update', entityId: 'missing', changes: { visible: false } }],
    };
    expect(validatePatch(patch, createEmptyModel()).errors[0].code).toBe('ENTITY_NOT_FOUND');
  });

  it('rejects changing an entity id or type through a partial update', () => {
    const model = createEmptyModel();
    model.entities.push({ id: 'c1', type: 'circle', visible: true, center: [0, 0], radius: 5 });
    const patch = {
      operations: [{ type: 'entity.update', entityId: 'c1', changes: { type: 'line' } }],
    } as unknown as SpatialPatch;
    expect(validatePatch(patch, model).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm vitest run src/core/tests/patch-validate.test.ts`  
Expected: FAIL because the patch modules do not exist.

- [ ] **Step 3: Add exact patch types**

```typescript
export type EntityPatch =
  | { visible?: boolean; x?: number; y?: number }
  | { visible?: boolean; start?: [number, number]; end?: [number, number] }
  | { visible?: boolean; center?: [number, number]; radius?: number };

export type RelationPatch = Partial<Pick<SpatialRelation, 'status' | 'value' | 'axis' | 'property'>>;

export type SpatialOperation =
  | { type: 'entity.add'; entity: GeometryEntity }
  | { type: 'entity.update'; entityId: string; changes: EntityPatch }
  | { type: 'entity.delete'; entityId: string }
  | { type: 'relation.add'; relation: SpatialRelation }
  | { type: 'relation.update'; relationId: string; changes: RelationPatch }
  | { type: 'relation.delete'; relationId: string };

export interface SpatialPatch { operations: SpatialOperation[] }
export interface PatchError { operationIndex: number; code: string; message: string }
export interface PatchValidationResult { valid: boolean; errors: PatchError[] }
```

Import `GeometryEntity` and `SpatialRelation` with type-only imports. Implement `validatePatch()` to reject duplicate additions, missing update/delete targets, immutable `id`/`type` changes, relation references missing after earlier operations, and non-finite numeric changes. Evaluate operations in order against evolving ID sets so “add entity then add relation” is valid.

- [ ] **Step 4: Run focused and existing Core tests**

Run: `pnpm vitest run src/core/tests/patch-validate.test.ts src/core/tests/validator.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/core/patch src/core/tests/patch-validate.test.ts src/core/index.ts
git commit -m "feat(core): define and validate spatial patches"
```

---

### Task 2: Apply and Invert Patches Atomically

**Files:**
- Create: `src/core/patch/apply.ts`
- Create: `src/core/tests/patch-apply.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `SpatialPatch` and `validatePatch()` from Task 1.
- Produces: `applyPatch(model, patch): PatchApplyResult` where `PatchApplyResult` is `{ success: true; model: SpatialModel; inversePatch: SpatialPatch } | { success: false; model: SpatialModel; errors: PatchError[] }`.

- [ ] **Step 1: Write failing atomicity and inverse tests**

```typescript
it('applies ordered operations without mutating the source model', () => {
  const source = createEmptyModel();
  const patch: SpatialPatch = { operations: [
    { type: 'entity.add', entity: { id: 'c1', type: 'circle', visible: true, center: [10, 20], radius: 5 } },
    { type: 'entity.update', entityId: 'c1', changes: { radius: 8 } },
  ] };
  const result = applyPatch(source, patch);
  expect(result.success).toBe(true);
  if (!result.success) return;
  expect(source.entities).toHaveLength(0);
  expect(result.model.entities[0]).toMatchObject({ id: 'c1', radius: 8 });
});

it('restores the original model by applying the inverse patch', () => {
  const source = modelWithCircleAndRadiusRelation();
  const result = applyPatch(source, patchThatUpdatesThenDeletesCircle());
  expect(result.success).toBe(true);
  if (!result.success) return;
  const restored = applyPatch(result.model, result.inversePatch);
  expect(restored.success && restored.model).toEqual(source);
});

it('returns the unchanged source model when any operation is invalid', () => {
  const source = modelWithCircle();
  const result = applyPatch(source, { operations: [{ type: 'entity.delete', entityId: 'missing' }] });
  expect(result).toMatchObject({ success: false, model: source });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run src/core/tests/patch-apply.test.ts`  
Expected: FAIL because `applyPatch` is missing.

- [ ] **Step 3: Implement immutable application and reverse-order inversion**

Clone the model once, apply operations to working entity/relation arrays, and collect one inverse per operation. Reverse collected inverses before returning. Deleting an entity must also delete its attached relations and create inverse operations that restore the entity before its relations. After structural validation, run `validateModel(workingModel)`; convert geometry failures into `PatchError` with code `MODEL_INVALID` and return the unchanged source model.

- [ ] **Step 4: Run patch and complete Core tests**

Run: `pnpm vitest run src/core/tests/patch-apply.test.ts src/core/tests`  
Expected: PASS for all Core tests.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/core/patch/apply.ts src/core/tests/patch-apply.test.ts src/core/index.ts
git commit -m "feat(core): apply and invert spatial patches"
```

---

### Task 3: Compile Existing SpatialIntent into SpatialPatch

**Files:**
- Create: `src/core/patch/intent-to-patch.ts`
- Create: `src/core/tests/intent-to-patch.test.ts`
- Modify: `src/core/index.ts`
- Modify: `src/core/agent.ts`

**Interfaces:**
- Consumes: current `SpatialIntent`, `compileIntent()`, current model, and Task 1 patch types.
- Produces: `compileIntentToPatch(intent, currentModel): { patch: SpatialPatch; errors: string[] }`.

- [ ] **Step 1: Write failing compatibility tests**

Cover these exact cases:

```typescript
it('compiles create intent to entity.add operations');
it('compiles modify intent to entity.update with only changed geometry fields');
it('compiles replace intent to deletes followed by adds');
it('allows a verify_model intent with an empty objects array to produce an empty patch');
it('preserves relations from image perception as relation.add operations');
```

For modify, use a current circle `{ center: [0, 0], radius: 5 }` and an intent object with `{ id: 'c1', params: { radius: 8 } }`; assert the generated change is exactly `{ radius: 8 }` and does not require `center`.

- [ ] **Step 2: Run the compatibility tests and confirm failure**

Run: `pnpm vitest run src/core/tests/intent-to-patch.test.ts`  
Expected: FAIL because `compileIntentToPatch` is missing and current validation rejects partial/empty intents.

- [ ] **Step 3: Implement the compatibility compiler**

Keep the current `SpatialIntent.operation` field only at this boundary. For `create`, reuse entity/reference normalization and emit adds. For `modify`, resolve `id`, validate type matches the current entity, normalize only supplied fields, and emit `entity.update`. For `replace`, emit relation deletes, entity deletes, entity adds, then relation adds. If `objects` is empty and no relations are supplied, return an empty patch without calling the legacy non-empty validator.

Update `verifyIntent()` and `applyStepToModel()` in `src/core/agent.ts` to compile and apply patches. Do not delete legacy `compileIntent()` yet because existing tests and non-Agent call sites still consume it.

- [ ] **Step 4: Run Agent compatibility and complete tests**

Run: `pnpm vitest run src/core/tests/intent-to-patch.test.ts src/core/tests && pnpm check`  
Expected: all tests and TypeScript checks PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/core/patch/intent-to-patch.ts src/core/tests/intent-to-patch.test.ts src/core/agent.ts src/core/index.ts
git commit -m "feat(core): compile spatial intents into incremental patches"
```

---

### Task 4: Add SpatialCommit History with Undo/Redo

**Files:**
- Create: `src/core/history/types.ts`
- Create: `src/core/history/history.ts`
- Create: `src/core/tests/history.test.ts`
- Modify: `src/core/index.ts`
- Modify: `src/hooks/useStore.ts`

**Interfaces:**
- Consumes: `SpatialPatch`, `applyPatch()`, and `SpatialModel`.
- Produces: `createHistory(model)`, `commitPatch(history, input)`, `undo(history)`, and `redo(history)` operating on `SpatialHistory`.

```typescript
export interface SpatialCommit {
  id: string;
  runId: string;
  parentCommitId?: string;
  stepId: string;
  source: 'AI' | 'user' | 'system';
  patch: SpatialPatch;
  inversePatch: SpatialPatch;
  validation: { valid: true; errors: [] };
  confidence?: number;
  timestamp: number;
}

export interface SpatialHistory {
  model: SpatialModel;
  commits: SpatialCommit[];
  cursor: number;
}
```

- [ ] **Step 1: Write failing history tests**

```typescript
it('creates a commit and advances the cursor');
it('undo applies inversePatch and moves the cursor backward');
it('redo reapplies patch and moves the cursor forward');
it('a new commit after undo truncates the redo branch');
it('a failed patch creates no commit and leaves history unchanged');
```

Inject `id`, `timestamp`, and `runId` in test inputs so results are deterministic; production callers generate them outside the pure history functions.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run src/core/tests/history.test.ts`  
Expected: FAIL because history modules do not exist.

- [ ] **Step 3: Implement pure history transitions and Store integration**

`commitPatch()` calls `applyPatch()`, stores the returned inverse, and returns a discriminated result without mutating input history. `undo()` and `redo()` return unchanged history at their respective boundaries.

In Zustand, add `history: SpatialHistory`, `undo()`, `redo()`, `canUndo`, and `canRedo`. Route `applyIntent`, direct parameter edits, deletion, perception confirmation, and successful Agent steps through `commitPatch()`. Use `source: 'user'` for direct UI changes and `source: 'AI'` for model/Agent changes. Keep `model` temporarily synchronized from `history.model` to minimize component churn.

- [ ] **Step 4: Add Store regression tests**

Create `src/hooks/useStore.test.ts` and reset store state before each test. Assert a parameter edit creates one commit, deletion removes attached relations and undo restores both, and a failed AI intent does not change model/history.

Run: `pnpm vitest run src/core/tests/history.test.ts src/hooks/useStore.test.ts && pnpm check`  
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/core/history src/core/tests/history.test.ts src/hooks/useStore.ts src/hooks/useStore.test.ts src/core/index.ts
git commit -m "feat(core): add reversible spatial commit history"
```

---

### Task 5: Persist Redacted Local Audit Events and Replay Them

**Files:**
- Create: `api/services/audit/types.ts`
- Create: `api/services/audit/redact.ts`
- Create: `api/services/audit/file-audit-store.ts`
- Create: `api/services/audit/replay.ts`
- Create: `api/services/audit/audit.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `SpatialCommit`, `SpatialModel`, and Node ESM filesystem APIs.
- Produces: `AuditStore`, `FileAuditStore`, `redactAuditPayload()`, and `replayCommits(initialModel, commits)`.

```typescript
export interface AuditEvent {
  id: string;
  runId: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  timing?: { queuedMs?: number; modelMs?: number; toolMs?: number; validationMs?: number; persistMs?: number };
}

export interface AuditStore {
  startRun(manifest: AuditRunManifest): Promise<void>;
  appendEvent(event: AuditEvent): Promise<void>;
  saveCommit(commit: SpatialCommit): Promise<void>;
  finishRun(runId: string, model: SpatialModel): Promise<void>;
  readEvents(runId: string): Promise<AuditEvent[]>;
}
```

- [ ] **Step 1: Write failing audit tests with a temporary directory**

Use `mkdtemp(join(tmpdir(), 'vectorai-audit-'))` in `beforeEach` and remove that exact temporary directory in `afterEach`. Tests must assert:

```typescript
it('writes manifest, JSONL events, commit files, and final model');
it('preserves event order when appendEvent calls are concurrent');
it('redacts apiKey, authorization, token, and base64 media fields recursively');
it('replays stored commits to the same final SpatialModel');
it('round-trips stage timing fields without adding media payloads');
```

- [ ] **Step 2: Run audit tests and confirm failure**

Run: `pnpm vitest run api/services/audit/audit.test.ts`  
Expected: FAIL because audit modules do not exist.

- [ ] **Step 3: Implement redaction and FileAuditStore**

Use an explicit constructor root directory; never derive a write target from an unresolved environment variable. Resolve each run directory as `join(rootDir, safeRunId)` where `safeRunId` must match `/^[A-Za-z0-9_-]+$/`. Serialize writes per run with a Promise chain to preserve JSONL order. Write JSON with UTF-8 and a trailing newline for events. Recursively replace values whose normalized keys contain `apikey`, `authorization`, `token`, `base64`, `image`, or `pdfbody` with `'[REDACTED]'` while retaining source hashes and controlled references.

`replayCommits()` applies commits in order using `applyPatch()` and throws with commit ID if a replayed patch fails.

- [ ] **Step 4: Ignore runtime artifacts and run verification**

Append this exact rule to `.gitignore`:

```gitignore
# VectorAI local runtime artifacts
.local/
```

Run: `pnpm vitest run api/services/audit/audit.test.ts src/core/tests && pnpm check && pnpm build`  
Expected: all commands PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add .gitignore api/services/audit
git commit -m "feat(api): persist replayable local audit events"
```

---

### Task 6: Foundation Integration Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: all public APIs from Tasks 1–5.
- Produces: documented local audit paths, patch lifecycle, test commands, and migration notes for the later Agent Runtime plan.

- [ ] **Step 1: Add one end-to-end foundation regression test**

Create `src/core/tests/patch-history-replay.test.ts`. Start with a model containing a line and circle, commit an entity update plus relation addition, undo, redo, serialize commits, replay from the initial model, and assert the replayed model equals the history model.

- [ ] **Step 2: Run the test and confirm it passes through only public exports**

Run: `pnpm vitest run src/core/tests/patch-history-replay.test.ts`  
Expected: PASS without importing private module internals.

- [ ] **Step 3: Update documentation**

Replace the default Vite README with project setup commands, architecture entry points, environment variable names without values, audit directory behavior, and these verification commands:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

Update the technical architecture “current implementation” section to distinguish the completed Patch/History/Audit foundation from the still-pending Agent Runtime and PDF plans.

- [ ] **Step 4: Run the complete quality gate**

Run: `pnpm test && pnpm check && pnpm lint && pnpm build`  
Expected: all commands exit 0. Fix existing lint debt touched by this plan; if unrelated pre-existing lint errors remain, capture their exact list in the handoff and do not claim the lint gate passed.

- [ ] **Step 5: Commit Task 6**

```bash
git add README.md docs/tech-architecture.md src/core/tests/patch-history-replay.test.ts
git commit -m "docs: document spatial patch foundation"
```

---

## Follow-on Plans

After this foundation passes review, create and execute separate plans in this order:

1. Agent Runtime state machine, `SpatialCapabilityRegistry`, bounded context manager, structured tool receipts, SSE progress/heartbeat, cancellation, safe-point instruction insertion, replanning, shared deadlines, screenshot reuse, and bounded verification retries.
2. Construction Timeline execution trace, commit diff visualization, controls, and low-confidence red highlighting.
3. PDF ingestion, page rasterization, source metadata, page selection, and perception merge；将 `test1` 移入 `src/core/tests/fixtures/perception/` 并建立首个图片黄金样例（当前文件若已被 `dist/` 清理，需要从原始来源重新放回）。
4. Golden-fixture evaluation harness and optional online-model metrics.
