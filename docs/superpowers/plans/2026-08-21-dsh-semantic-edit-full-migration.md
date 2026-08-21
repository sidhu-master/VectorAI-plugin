# DSH Semantic Edit Full Migration Implementation Plan

> **Execution note:** This plan is the continuation of Phase 0. Execute it inline, in order, with a red-green-refactor cycle for every behavior change. Do not expose raw transaction commit capabilities to the model or the browser while migrating.

**Goal:** Complete the open-source, local-only migration from the legacy Web/Express drawing edit harness to a two-layer DSH plugin architecture: a reusable 2D semantic editing layer and an engineering-annotation layer built only on its public contracts.

**Architecture:** `drawing-edit-protocol` owns strict provider-neutral wire and durable record codecs. `drawing-edit-core` owns deterministic compile/evaluate/inverse logic and has no DSH, React, Node, Express, or filesystem dependency. The DSH Host owns task lineage, Preview isolation, policy, reviewer orchestration, durable exactly-once commits, and Undo. The Client owns presentation and human gestures but never commits arbitrary transactions. Engineering annotation is an external consumer package, not a deep import into the Host.

**Technology:** TypeScript 5.8, Zod, Vitest, DSH rc.8 (`agent`, `tools`, `subagent`, `user-questions`, `commands`, `typert`), React 18, Zustand, SVG canvas, local filesystem atomic persistence.

---

## Batch 1: Freeze provider-neutral edit and durability contracts

**Files:**

- Modify: `packages/drawing-edit-protocol/src/refs.ts`
- Modify: `packages/drawing-edit-protocol/src/spatial-edit-program.ts`
- Modify: `packages/drawing-edit-protocol/src/finalize.ts`
- Create: `packages/drawing-edit-protocol/src/transactions.ts`
- Create: `packages/drawing-edit-protocol/src/evaluation.ts`
- Create: `packages/drawing-edit-protocol/src/operations.ts`
- Modify: `packages/drawing-edit-protocol/src/index.ts`
- Test: `packages/drawing-edit-protocol/src/protocol.test.ts`
- Test: `packages/drawing-edit-protocol/src/boundary.test.ts`

**Red:** Add strict-codec tests that reject unknown fields and cover:

- ordered transaction commands versus set-normalized resource scopes;
- task, observation, context, grounding, Preview, evaluation, assessment, decision, grant, operation, commit, Undo, and selection-projection references;
- `blocked | confirmation_required | auto_safe` assessment arms;
- mode-discriminated `semantic | interactive | genesis | undo` operation bindings and terminal receipts;
- `committed | no_effect | outcome_unknown | recovering | absent | digest_mismatch` lookup results;
- bounded durable reviewer evidence and authoritative user-instruction projection;
- stable error codes for stale lineage, invalid scope, missing evaluator, auto-safe unavailable, idempotency reuse, Undo conflict, and outcome unknown.

**Green:** Implement the smallest strict Zod schemas and inferred TypeScript types. Move the canonical `DrawingTransactionCommand` vocabulary here. Define schema-declared ordered arrays; do not sort commands, polyline vertices, or spline points. Use opaque content digests instead of DSH attachment handles.

**Refactor:** Re-export these contracts from `plugin-space-contracts`, then remove duplicate workspace command definitions by adapting `drawing-workspace` to the protocol type.

**Verification:**

```bash
pnpm --filter @vectorai/drawing-edit-protocol test
pnpm --filter @vectorai/drawing-edit-protocol check
pnpm --filter @vectorai/plugin-space-contracts test
```

## Batch 2: Extract deterministic drawing-edit core

**Files:**

- Create: `packages/drawing-edit-core/package.json`
- Create: `packages/drawing-edit-core/tsconfig.json`
- Create: `packages/drawing-edit-core/src/index.ts`
- Create: `packages/drawing-edit-core/src/canonical.ts`
- Create: `packages/drawing-edit-core/src/document-transaction.ts`
- Create: `packages/drawing-edit-core/src/inverse.ts`
- Create: `packages/drawing-edit-core/src/point-resolver.ts`
- Create: `packages/drawing-edit-core/src/grounding.ts`
- Create: `packages/drawing-edit-core/src/world-model.ts`
- Create: `packages/drawing-edit-core/src/connected-transform.ts`
- Create: `packages/drawing-edit-core/src/compiler.ts`
- Create: `packages/drawing-edit-core/src/evaluate.ts`
- Tests: matching `*.test.ts` files under `packages/drawing-edit-core/src/`

**Red:** Port focused fixtures from the legacy services and add golden tests for:

- rigid translation/rotation of line, circle, ellipse, polyline, spline, arc, and annotation points;
- the Doraemon-style “raise right hand” connected transform: target carrier plus contacted open line connectors move, unrelated geometry remains semantically identical;
- exact endpoint edits, create path, and delete nodes;
- preconditions, referential integrity, topology/preserve checks, forward/inverse round trip, and no-op detection;
- deterministic candidate/effect digests under injected hash/id/time ports;
- same effect with different display summaries produces the same semantic risk key.

**Green:** Adapt the pure logic from `api/services/drawing-spatial-program`, `drawing-spatial-actions`, `drawing-world-model`, `drawing-grounding`, and `drawing-diagnostics`. Accept all environment effects as ports. Return protocol commands, actual effect scopes, diagnostics, postconditions, forward commands, inverse commands, and canonical semantic projections.

**Refactor:** Make legacy Web services delegate to `drawing-edit-core` where their behavior overlaps. Add dependency-boundary tests proving the core does not import DSH, React, Node built-ins, Express, API routes, or Host packages.

**Verification:**

```bash
pnpm --filter @vectorai/drawing-edit-core test
pnpm --filter @vectorai/drawing-edit-core check
```

## Batch 3: Replace snapshot-only DSH persistence with a durable operation envelope

**Files:**

- Modify: `packages/plugin-dsh-space-host/src/repository-storage.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.ts`
- Create: `packages/plugin-dsh-space-host/src/durable-envelope.ts`
- Create: `packages/plugin-dsh-space-host/src/operation-ledger.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-preview-store.ts`
- Test: `packages/plugin-dsh-space-host/src/repository-storage.test.ts`
- Test: `packages/plugin-dsh-space-host/src/operation-ledger.test.ts`
- Test: `packages/plugin-dsh-space-host/src/repository.semantic.test.ts`

**Red:** Add fault-injection and concurrency tests for:

- atomic envelope writes containing current snapshot, monotonically increasing workspace ref, commit record, forward/inverse transaction, embedded assessment/evidence/authority, and operation receipt;
- startup recovery yielding either complete N or complete N+1;
- rename/manifest commit point and directory sync failure quarantining the drawing as `recovering` until ledger reconciliation;
- ledger-first same-operation/same-binding replay and same-operation/different-binding rejection for genesis, semantic, interactive, and Undo writes;
- stale/foreign/replaced Preview handles, failed Preview replacement preserving the former Preview, and no-op not increasing revision;
- caller mutation of returned objects not mutating repository state.

**Green:** Introduce a versioned durable envelope and storage port. Implement local Node storage with temp write, file sync, atomic rename, parent directory sync, recovery marker/inspection, and per-session serialization. Keep Preview/session state isolated from the formal snapshot; persist only formal commits and their audit evidence.

**Refactor:** Preserve a migration reader for existing version-1 drawing snapshots. Upgrade on the first formal write without losing the imported drawing.

**Verification:**

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- repository
pnpm --filter @vectorai/plugin-dsh-space-host check
```

## Batch 4: Implement Host task lineage, grounding, Preview, evaluation, and policy

**Files:**

- Create: `packages/plugin-dsh-space-host/src/task-store.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Create: `packages/plugin-dsh-space-host/src/reviewer.ts`
- Create: `packages/plugin-dsh-space-host/src/policy.ts`
- Create: `packages/plugin-dsh-space-host/src/pending-decisions.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Tests: matching `*.test.ts` files

**Red:** Cover the complete state machine:

- direct user instruction creates a task with bounded authoritative objective and a session policy snapshot;
- observe/context/ground/compile/evaluate/finalize requests require exact same-task lineage;
- a new direct task invalidates the prior Preview and carries only a non-finalizable handoff basis;
- maximum three candidates per task; the third candidate cannot create a fourth through “revise”;
- reviewer runs are single-flight, negative defects are sticky by semantic risk key, and later candidates clear a defect only with scoped resolution evidence;
- mandatory source-quality and postcondition evaluator manifests fail closed;
- actual before/after effect, not model-declared command type, drives policy;
- auto-safe is limited to exact geometry field/range scopes with no create/delete/topology/constraint change, confirmed source, clean diagnostics, satisfied reviewer, verified inverse, and explicit auto intent;
- exact approval relieves authority only and produces a `confirmed` commit, never an `auto_safe` classification;
- hard deny, unknown command/evaluator, unresolved evidence, out-of-scope effects, and safety postcondition failures are blocked and cannot be confirmed.

**Green:** Implement a session-scoped `SemanticEditService` with immutable handles and Host-computed digests. Use a provider port for the one-shot reviewer; production DSH wiring calls `ctx.subagents.start` with a strict output schema, no semantic write tools, depth limit zero, and guaranteed `run.dispose()`. Implement pending human decisions as candidate-bound single-flight records with terminal CAS.

**Refactor:** Serialize all task transitions using one session-state epoch and a fixed lock order: session state → drawing → storage. Finalize re-reads Preview, policy epoch, evaluation ledger, candidate digest, authority, and base ref immediately before the commit point.

**Verification:**

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- task-store semantic-edit reviewer policy pending-decisions
pnpm --filter @vectorai/plugin-dsh-space-host check
```

## Batch 5: Publish the semantic DSH tool chain and slash commands

**Files:**

- Modify: `packages/plugin-dsh-space-host/src/tools.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Create: `packages/plugin-dsh-space-host/src/commands.ts`
- Modify: `packages/plugin-dsh-space-host/src/index.ts`
- Modify: `packages/plugin-dsh-space/src/index.ts`
- Test: `packages/plugin-dsh-space-host/src/semantic-tools.test.ts`
- Test: `packages/plugin-dsh-space-host/src/commands.test.ts`
- Test: `packages/plugin-dsh-space-host/src/tool-catalog.test.ts`

**Red:** Assert model-visible tools are exactly the high-level family:

- `drawing_import`, `drawing_summarize`, `drawing_query`;
- `drawing_observe`, `drawing_build_context`, `drawing_ground`, `drawing_preview_program`, `drawing_evaluate_preview`, `drawing_revise_preview`, `drawing_finalize_preview`, `drawing_discard_preview`, `drawing_get_operation`, `drawing_undo_commit`.

Assert raw `commit`, `preview_transaction`, `commit_preview`, arbitrary update/delete, interactive intent staging, and command dispatch are not model-visible. Add strict unknown-field, stale lineage, forged auto-safe flag, forged actor, question-answer normalization, confirmation single-flight, cancel, response-loss, and operation reconciliation tests.

**Green:** Implement strict tool adapters over `SemanticEditService`. Use the exact live runtime-root agent as the only model-facing human-question caller. Register `/drawing-policy review|auto-safe`, `/drawing-apply-intent`, and `/drawing-undo` as direct human commands. Treat DSH command abort/transport error after admission as outcome unknown; retain Host-minted operation/binding tokens and reconcile through the operation ledger.

**Refactor:** Remove the raw transaction tools from all catalogs and public exports. Keep internal factory access only for repository tests until the browser Remote cutover in Batch 6.

**Verification:**

```bash
pnpm --filter @vectorai/plugin-dsh-space-host test -- tools commands
pnpm --filter @vectorai/plugin-dsh-space test
pnpm build:dsh-space
```

## Batch 6: Cut the browser Remote over to safe interactive intents and add Undo UI

**Files:**

- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-host/src/typert.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.ts`
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-workspace/src/store.ts`
- Modify: `packages/drawing-viewer-react/src/DrawingWorkspace.tsx`
- Modify: `packages/drawing-viewer-react/src/canvas/Canvas.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Tests: adjacent Remote, store, Canvas, service, and interaction tests

**Red:** Prove the browser cannot invoke arbitrary commits or semantic finalize through the Remote. Cover:

- `projectSelection(expectedRef, bounded nodeIds)` minting an expiring selection projection;
- `stageInteractiveEdit(expectedRef, whitelist operation)` returning an opaque intent and binding digest;
- the UI invoking `/drawing-apply-intent <intentId> <intentDigest> <operationId> <bindingDigest>` rather than Remote commit;
- selection clearing on blank-canvas click, drag/zoom parity, preview/formal overlay alignment, Undo availability, and operation outcome status;
- an interactive commit invalidating stale semantic Preview/evaluation/grant state;
- active Preview preventing Undo until explicit discard.

**Green:** Replace public `commit/createPreview/commitPreview/discardPreview` Remote descriptors with read-only snapshot/Preview/source/query plus selection projection and interactive staging. Route annotation text dragging and supported direct-manipulation edits through staged intents. Add commit mode, reason, and Undo receipt to workspace state and toolbar/status UI.

**Refactor:** Add a capability probe and fail read-only if the Host lacks the safe interactive protocol. Do not retain a compatibility fallback to direct commit.

**Verification:**

```bash
pnpm --filter @vectorai/drawing-workspace test
pnpm --filter @vectorai/drawing-viewer-react test
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/plugin-dsh-space-client check
```

## Batch 7: Migrate engineering annotation as the independent second layer

**Files:**

- Create: `packages/engineering-annotation/package.json`
- Create: `packages/engineering-annotation/tsconfig.json`
- Create: `packages/engineering-annotation/src/index.ts`
- Create: `packages/engineering-annotation/src/measure.ts`
- Create: `packages/engineering-annotation/src/plan.ts`
- Create: `packages/engineering-annotation/src/layout.ts`
- Create: `packages/engineering-annotation/src/coverage.ts`
- Create: `packages/engineering-annotation/src/program.ts`
- Create: `packages/plugin-dsh-annotation/package.json`
- Create: `packages/plugin-dsh-annotation/src/index.ts`
- Create: `packages/plugin-dsh-annotation/src/tools.ts`
- Tests: matching unit, contract, boundary, and pack-install tests

**Red:** Port the existing annotation fixtures and assert:

- confirmed measurements become protocol annotation-create programs plus resolved target associations;
- pending/ambiguous/conflict evidence never materializes automatically;
- deterministic layout avoids duplicate, collision, and out-of-frame labels;
- all confirmed facts are consumed or explicitly suppressed;
- the package imports only public `drawing-core`, `drawing-spatial`, `drawing-edit-protocol`, and `drawing-edit-core` entry points;
- the DSH annotation adapter consumes the first-layer Host API and cannot deep-import its internals.

**Green:** Move/adapt the pure planner, measurement, layout, and coverage logic from `api/services/drawing-annotation`. Emit ordinary Spatial Edit Programs that pass through the same Preview, evaluation, policy, durable commit, and Undo path. Publish the second layer as a separate workspace package and DSH plugin package.

**Refactor:** Keep legacy Web annotation endpoints as adapters over the new package during the transition. No annotation logic lives in the first-layer Host.

**Verification:**

```bash
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/plugin-dsh-annotation test
pnpm --filter @vectorai/plugin-dsh-annotation pack --pack-destination /tmp/vectorai-pack-check
```

## Batch 8: Golden workflows, local-only gate, documentation, and release verification

**Files:**

- Create: `packages/plugin-dsh-space-host/src/golden-workflows.test.ts`
- Create: `packages/plugin-dsh-annotation/src/golden-annotation.test.ts`
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `docs/superpowers/specs/2026-08-21-dsh-semantic-edit-auto-safe-design.md`
- Create: `docs/dsh-plugin-architecture.md`
- Create: `docs/dsh-local-development.md`
- Modify: root/package manifests and `scripts/build-dsh-space.mjs` as required

**Red/Golden:** Run the complete local workflows:

1. Import/vectorize a line drawing; verify white raster background is not part of formal geometry and source underlay is off by default.
2. Ask “把右手抬起来打招呼”; observe → context → ground → connected-transform Preview → deterministic evaluation → reviewer → auto-safe single commit; verify exact formal diff and no confirmation.
3. Undo that commit using explicit user authority; verify a new revision semantically equals the pre-edit drawing.
4. Repeat with an ambiguous target/source-quality warning; verify one bounded question and zero commit on cancel.
5. Run engineering auto-annotation; verify only confirmed annotations/associations commit and one Undo reverts the batch.
6. Simulate lost commit responses for all write modes; verify ledger lookup returns the original receipt and no duplicate revision.
7. Scan runtime packages and built artifacts to ensure DSH plugin operation does not import Express, call VectorAI cloud endpoints, or require a server process.

**Documentation:** Mark every migration checklist item as complete only when backed by a named test. Document the two repositories/packages boundary, public adapter seams for DSH and the standalone website, local compute/vectorizer requirements, policy modes, Preview/confirmation/Undo behavior, recovery, and extension guide for second-layer plugins.

**Fresh final verification:**

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm build:dsh-space
pnpm --filter @vectorai/plugin-dsh-space test
pnpm --filter @vectorai/plugin-dsh-space-host check
pnpm --filter @vectorai/plugin-dsh-space-client check
pnpm --filter @vectorai/engineering-annotation check
pnpm --filter @vectorai/plugin-dsh-annotation check
git diff --check
git status --short
```

## Completion gate

Migration is complete only when all eight batches are implemented, no model/browser raw commit path remains, the “raise right hand” and engineering-annotation goldens pass, every formal write is durable/idempotent/Undo-capable, both DSH and Web adapters use the same provider-neutral core, built DSH operation requires no Express/cloud service, and the fresh final verification above passes without relying on prior output.
