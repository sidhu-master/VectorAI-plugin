# DSH Semantic Edit Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the DSH semantic-edit migration with a host-neutral protocol package and a fail-closed model tool catalog that cannot commit a Preview before durable history, inverse transactions, idempotency, and Undo exist.

**Architecture:** `@vectorai/drawing-edit-protocol` becomes the owner of revision-bound semantic-edit wire identities and the first strict `SpatialEditProgram`/Finalize codecs. `@vectorai/plugin-space-contracts` re-exports that provider-neutral surface for first- and second-layer consumers. The DSH Host registers a safe default model catalog containing read tools plus `drawing_finalize_preview`; raw transaction Preview/Commit factories remain internal compatibility capabilities but are no longer registered for the model.

**Tech Stack:** TypeScript 5.8, Zod 4.4.3, Vitest 3.2.7, pnpm workspaces, DSH/Cordis `0.1.0-rc.8`

**Spec:** `docs/superpowers/specs/2026-08-21-dsh-semantic-edit-auto-safe-design.md`

## Global Constraints

- Work only on `codex/dsh-plugin-migration`.
- Do not add Express, cloud, model-SDK, React, DSH, Node filesystem, or Drawing Workspace dependencies to `drawing-edit-protocol` production files.
- Every wire schema is strict and rejects unknown fields.
- Finalize wire input never accepts `force`, `approved`, `humanDecision`, `autoSafe`, raw commands, session id, actor, authority, policy assessment, or grant.
- Until durable history, inverse transaction, Undo, and idempotency are implemented, valid Finalize calls return blocked `AUTO_SAFE_UNAVAILABLE` and never mutate the canonical Drawing.
- Keep the existing raw Preview/Commit implementation available only as an internal compatibility capability; do not register it in the default model tool catalog.
- Do not modify HyperFrames files.

---

### Task 1: Host-neutral semantic-edit protocol foundation

**Files:**
- Create: `packages/drawing-edit-protocol/package.json`
- Create: `packages/drawing-edit-protocol/tsconfig.json`
- Create: `packages/drawing-edit-protocol/src/refs.ts`
- Create: `packages/drawing-edit-protocol/src/spatial-edit-program.ts`
- Create: `packages/drawing-edit-protocol/src/finalize.ts`
- Create: `packages/drawing-edit-protocol/src/index.ts`
- Test: `packages/drawing-edit-protocol/src/protocol.test.ts`
- Test: `packages/drawing-edit-protocol/src/dependency-boundary.test.ts`

**Interfaces:**
- Consumes: Zod `z.object(...).strict()` and the spec's revision-bound handle shapes.
- Produces: `drawingRefSchema`, `editBasisSchema`, `observationArtifactRefSchema`, `spatialEditProgramSchema`, `finalizePreviewRequestSchema`, `finalizePreviewResultSchema`, and their inferred TypeScript types.

- [x] **Step 1: Write failing strict-codec tests**

Create tests that exercise real Zod parsing and prove:

```ts
expect(drawingRefSchema.parse({ drawingId: 'drawing-1', revision: 2 }))
  .toEqual({ drawingId: 'drawing-1', revision: 2 });
expect(() => drawingRefSchema.parse({ drawingId: 'drawing-1', revision: 2, sessionId: 'forged' }))
  .toThrow();

expect(observationArtifactRefSchema.parse({
  id: 'artifact-1',
  contentDigest: 'sha256:artifact',
  mimeType: 'image/png',
  basis: { kind: 'canonical', ref: { drawingId: 'drawing-1', revision: 2 } },
})).not.toHaveProperty('attachmentId');

expect(() => finalizePreviewRequestSchema.parse({
  previewHandle: 'preview-1',
  previewDigest: 'sha256:candidate',
  finalizeOperationId: 'operation-1',
  finalizeOperationBindingDigest: 'sha256:binding',
  evaluationId: 'evaluation-1',
  force: true,
})).toThrow();
```

The program fixture uses `rigid_transform` and literal expected values. It must reject a root `commands` array, an operation-specific unknown field, an empty evidence list, non-finite coordinates, and a preserve scope with no fields.

- [x] **Step 2: Run RED and confirm the package/API is absent**

Run:

```bash
pnpm vitest run packages/drawing-edit-protocol/src/protocol.test.ts packages/drawing-edit-protocol/src/dependency-boundary.test.ts
```

Expected: FAIL because the new package source and exported schemas do not exist; configuration or syntax errors do not count as the intended RED state.

- [x] **Step 3: Add the package and minimal strict production schemas**

Implement the spec shapes with these public discriminants:

```ts
type EditBasis =
  | { kind: 'canonical'; ref: DrawingRef }
  | { kind: 'preview'; baseRef: DrawingRef; previewHandle: string; previewDigest: string }
  | { kind: 'carried-candidate'; handoffId: string; taskId: string; originTaskId: string; baseRef: DrawingRef; candidateDigest: string };

type SpatialOperation =
  | { kind: 'rigid_transform'; translation: readonly [number, number]; rotationRadians: number; pivot: readonly [number, number] }
  | { kind: 'connected_transform'; translation: readonly [number, number]; rotationRadians: number; pivot: readonly [number, number]; interfaceIds: string[] }
  | { kind: 'set_endpoint'; nodeId: string; endpoint: 'start' | 'end'; point: readonly [number, number] }
  | { kind: 'create_path'; nodeId: string; points: Array<readonly [number, number]>; closed: boolean }
  | { kind: 'delete_nodes'; nodeIds: string[] };
```

`SpatialEditProgram` contains exactly `baseRef`, `targetHandle`, `summary`, `objective`, `operations`, `preserveScopes`, `postconditions`, and `evidenceRefs`. Bound arrays and strings, require finite numeric values, and use strict nested schemas. The first postcondition union contains `preserve_connectivity`, `within_bounds`, and `target_position`.

Finalize result is a strict union containing at least the currently executable blocked result:

```ts
{
  status: 'rejected';
  disposition: 'blocked';
  code: 'AUTO_SAFE_UNAVAILABLE';
  message: string;
}
```

It also freezes the future response discriminants `committed`, `already-satisfied`, `root-required`, `needs-revision`, `discarded`, and `outcome-unknown` without adding any authority or grant to requests.

- [x] **Step 4: Add dependency-boundary behavior test**

Recursively inspect non-test `.ts` imports under the package and fail on:

```ts
const forbidden = [
  /^node:/,
  /^(?:react|react-dom|express|openai)(?:\/|$)/,
  /^@deepseek-ai\//,
  /^@vectorai\/drawing-workspace(?:\/|$)/,
  /^@vectorai\/plugin-/,
  /(?:^|\/)api(?:\/|$)/,
  /(?:^|\/)src\/(?:components|hooks|services)(?:\/|$)/,
];
```

Assert that `refs.ts`, `spatial-edit-program.ts`, and `finalize.ts` are package-owned production files.

- [x] **Step 5: Run GREEN and type-check the package**

Run:

```bash
pnpm vitest run packages/drawing-edit-protocol/src
pnpm --filter @vectorai/drawing-edit-protocol check
```

Expected: all protocol and boundary tests pass; TypeScript exits 0.

---

### Task 2: Adopt the protocol through public first-layer contracts

**Files:**
- Modify: `packages/plugin-space-contracts/package.json`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1 protocol schemas and types.
- Produces: backward-compatible `drawingRefSchema`/`DrawingRef` plus public semantic-edit schemas re-exported by `@vectorai/plugin-space-contracts`.

- [x] **Step 1: Write the failing external-consumer test**

Import protocol exports only from `./index` in `plugin-space-contracts` and assert that a valid Finalize request parses while `{ ...request, approved: true }` is rejected. Verify the existing Drawing query and workspace snapshot fixtures still parse with the re-exported `drawingRefSchema`.

- [x] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/plugin-space-contracts/src/index.test.ts
```

Expected: FAIL because the semantic-edit exports are not yet exposed from `plugin-space-contracts`.

- [x] **Step 3: Replace the duplicate DrawingRef owner and re-export protocol**

Add `@vectorai/drawing-edit-protocol: workspace:*`. Import and re-export the protocol `drawingRefSchema` rather than declaring a second schema/interface. Re-export the remaining semantic-edit schemas and types from the package root. Preserve every existing workspace/query export.

- [x] **Step 4: Run GREEN and package checks**

Run:

```bash
pnpm vitest run packages/drawing-edit-protocol/src packages/plugin-space-contracts/src/index.test.ts
pnpm --filter @vectorai/drawing-edit-protocol check
pnpm --filter @vectorai/plugin-space-contracts check
```

Expected: all focused tests and both TypeScript checks pass.

---

### Task 3: Fail-closed DSH Finalize gate and safe model catalog

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `docs/dsh-plugin-migration.md`

**Interfaces:**
- Consumes: `finalizePreviewRequestSchema` and `finalizePreviewResultSchema` through `@vectorai/plugin-space-contracts`.
- Produces: `createDrawingFinalizePreviewTool()` and `createDrawingAgentToolCatalog()`; the default model catalog omits `drawing_preview_transaction` and `drawing_commit_preview`.

- [x] **Step 1: Write failing safety-gate tests**

Add tests that name the production breaks they catch:

1. A default tool catalog must equal the literal ordered names `drawing_import`, `drawing_summarize`, `drawing_query`, `drawing_finalize_preview`, `drawing_discard_preview`; adding either raw transaction tool fails the test.
2. A valid Finalize call returns exactly blocked `AUTO_SAFE_UNAVAILABLE` and leaves the repository snapshot revision and current Preview unchanged.
3. A Finalize call containing `force`, `approved`, `humanDecision`, `commands`, or `autoSafe` rejects through the real strict schema before any repository action.
4. A call without an owning Agent fails with `DRAWING_SESSION_REQUIRED`.

- [x] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/tools.test.ts
```

Expected: FAIL because the safe catalog and fail-closed Finalize tool do not exist.

- [x] **Step 3: Implement the minimal fail-closed tool and catalog**

`drawing_finalize_preview` parses the strict request and returns:

```ts
{
  status: 'rejected',
  disposition: 'blocked',
  code: 'AUTO_SAFE_UNAVAILABLE',
  message: 'Durable history, inverse transactions, idempotency, and Undo are required before semantic finalize.',
}
```

It performs no repository mutation. `DrawingSpaceHostService` registers only `createDrawingAgentToolCatalog(...)`; retain raw factory functions for internal compatibility tests but do not include them in that catalog.

- [x] **Step 4: Run GREEN and focused checks**

Run:

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/tools.test.ts packages/plugin-space-contracts/src/index.test.ts packages/drawing-edit-protocol/src
pnpm --filter @vectorai/plugin-dsh-space-host check
```

Expected: focused tests and Host type-check pass.

- [x] **Step 5: Record truthful migration status**

Update `docs/dsh-plugin-migration.md` to state that Phase 0 protocol extraction has started, default model raw Commit is gated off, and semantic Finalize remains Preview-only/blocked until Phase 2 durable prerequisites are implemented.

---

### Task 4: Simple migration self-test and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-21-dsh-semantic-edit-phase-0-foundation.md` only to mark steps actually completed.
- Regenerate: `packages/plugin-dsh-space-host/lib/index.js`
- Regenerate: `packages/plugin-dsh-space-host/lib/typert.js`
- Regenerate: `packages/plugin-dsh-space-client/lib/client.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a verified Phase 0 foundation commit on the migration branch.

- [x] **Step 1: Run focused self-test**

Run:

```bash
pnpm vitest run packages/drawing-edit-protocol/src packages/plugin-space-contracts/src/index.test.ts packages/plugin-dsh-space-host/src/tools.test.ts
pnpm --filter @vectorai/drawing-edit-protocol check
pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-space-host check
```

- [x] **Step 2: Run repository regression and build checks**

Run:

```bash
pnpm test
pnpm check
pnpm build:dsh-space
git diff --check
```

Expected: all tests/checks/builds exit 0. If an existing unrelated baseline warning remains, report it with exact output and do not call the run clean.

- [x] **Step 3: Inspect scope and commit**

Confirm `git status --short` contains no HyperFrames path and the diff only includes the plan, protocol package, public-contract adoption, Host safety gate, lockfile, and migration status. Commit with:

```bash
git add docs/superpowers/plans/2026-08-21-dsh-semantic-edit-phase-0-foundation.md \
  docs/dsh-plugin-migration.md packages/drawing-edit-protocol \
  packages/plugin-space-contracts packages/plugin-dsh-space-host/src/tools.ts \
  packages/plugin-dsh-space-host/src/tools.test.ts packages/plugin-dsh-space-host/src/service.ts \
  packages/plugin-dsh-space-host/lib packages/plugin-dsh-space-client/lib/client.js \
  pnpm-lock.yaml
git commit -m "feat: start DSH semantic edit protocol migration"
```
