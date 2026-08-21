# DSH Semantic Edit Architecture

## Outcome

VectorAI's DSH path is a local, revision-bound semantic editing system. The model describes a high-level spatial program; the Host resolves exact nodes, compiles and previews the actual transaction, evaluates the resulting effect, and is the only component allowed to finalize it. No VectorAI HTTP server, cloud gateway, or browser-owned authoritative Drawing is involved.

## Package direction

```text
@vectorai/drawing-core
          ↑
@vectorai/drawing-edit-protocol   @vectorai/drawing-spatial
          ↑                              ↑
@vectorai/drawing-edit-core ─────────────┘
          ↑
@vectorai/plugin-space-contracts
          ↑
@vectorai/plugin-dsh-space-host ← @vectorai/plugin-dsh-annotation
          ↕ staged strict Remote
@vectorai/plugin-dsh-space-client
```

`drawing-edit-protocol`, `drawing-edit-core`, and `engineering-annotation` are Host-neutral. They do not import DSH, React, Express, Node storage, or a model SDK. DSH lifecycle, attachments, questions, subagents, commands, Remote codecs, local file persistence, and the Python worker remain in adapters.

## Semantic state chain

```text
direct user instruction
  → TaskRef(base revision + policy snapshot)
  → ObservationRef
  → ContextRef
  → GroundingRef(exact nodes + connector interfaces + protected scope)
  → PreviewRef(candidate/effect digest + finalize operation binding)
  → EvaluationRecord(diagnostics + reviewer evidence)
  → Assessment(blocked | confirmation_required | auto_safe)
  → durable Commit receipt or Discard
```

Every stage checks the same session, task lineage, Drawing id, base revision, handle, and digest. Starting a new direct task invalidates the former task and its Preview. `drawing_revise_preview` replaces the current candidate only after the new program compiles successfully; a task is limited to three candidates.

## Auto-safe policy

The Host derives policy from the actual before/after effect. Model input has no `approved`, `force`, `autoSafe`, actor, or grant field.

- `blocked`: hard validator failure, stale/mismatched lineage, unresolved target, invalid references, broken inverse, out-of-scope effect, or a non-overridable deny. Confirmation cannot bypass it.
- `confirmation_required`: provisional/candidate source, known warning, unavailable or negative reviewer, review task policy, or a valid effect that exceeds the automatic qualification.
- `auto_safe`: exact grounded scope, confirmed source facts, clean mandatory diagnostics, satisfied reviewer, verified inverse, and the task's auto-safe policy.

Reviewer calls are single-flight per semantic risk key. A negative result remains sticky for the same objective/base/result/effect, so repeated evaluation cannot replace a known defect with a lucky response. Concurrent semantic and Undo questions are also single-flight and produce one terminal action.

## Formal writes

There are three public write modes:

1. `semantic`: a reviewed high-level program finalized as `auto-safe` or `confirmed`.
2. `interactive`: a browser gesture staged by the Host, then admitted through `/drawing-apply-intent` using opaque intent and operation tokens.
3. `undo`: an exact current commit staged by the Host or explicitly requested by a direct user command, applied as a new compensating revision.

The DSH Client Remote surface contains only `getSnapshot`, `query`, `getPreview`, `stageInteractiveEdit`, `stageUndo`, and `getOperation`. It does not publish `commit`, `createPreview`, `commitPreview`, or `discardPreview`.

## Durable envelope

Each session file under `~/.dsh/vectorai/drawings/` contains one versioned envelope:

```text
DrawingDurableState v2
├── current Drawing entry + revision
├── append-only CommitRecord[]
│   ├── parent/result revision
│   ├── forward/inverse transaction
│   ├── semantic and snapshot-integrity digest
│   └── assessment/reviewer evidence where applicable
└── terminal OperationReceipt[]
```

Before applying a write, the repository looks up `operationId` inside the durable ledger. The same id and binding returns the original receipt; the same id with a different binding is rejected. Snapshot, history, and receipt are persisted in one replacement envelope using file fsync, rename, and parent-directory fsync. Undo never edits history: it applies the target's inverse at the exact current revision and appends a new commit whose inverse can be audited.

## Second layer

`@vectorai/engineering-annotation` deterministically derives dimension annotations and association relations from confirmed geometry. `@vectorai/plugin-dsh-annotation` reads the first-layer snapshot and calls the first-layer `runExtensionProgram`; it never writes repository files, imports browser state, or owns a second commit path. Therefore removing the annotation plugin leaves the canvas, semantic editing, persisted annotations, and Undo intact.

## Verification

The migration is gated by:

- protocol strict-codec and dependency tests;
- pure edit compiler golden tests, including “把右手抬起来打招呼” and inverse restoration;
- repository idempotency, persistence, no-effect, and compensating Undo tests;
- semantic policy, provisional source, task invalidation, revise, reviewer concurrency, and sticky-defect tests;
- Client staged-write/Undo and forbidden Remote route tests;
- local clean-line vectorization integration test;
- second-layer external-consumer boundary and annotation planning tests;
- root `pnpm check`, `pnpm test`, and `pnpm build:dsh-space`.
