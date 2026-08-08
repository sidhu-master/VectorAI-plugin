# Progressive Numbered Drawing Perception Design

**Status:** Approved by the user for direct implementation

## Goal

Turn drawing reconstruction from a batch conversion into a visible, correctable Agent process. The left canvas must grow while the right task panel reports perception work. Intermediate mistakes are provisional observations, not completed drawing mistakes; the Agent may refine, retype, merge, split or reject them before validated geometry enters the canonical Drawing Document.

## Why the previous loop was insufficient

The adaptive perception loop already divides complex drawings into whole-view contour reads and regional detail reads, but the pipeline collects every region, builds final topology and command batches, and only then lets the runtime apply them. It is iterative internally but batch-oriented at the user boundary. This design changes that boundary: every useful observation becomes a stream event as soon as its model/tool call finishes.

## Approaches considered

1. Commit every partial result directly to the Drawing Document. This is visually incremental, but transient mistakes pollute revision history and make merge/split correction expensive.
2. Keep the canonical document unchanged and show only textual progress. This is safe, but fails the core requirement that users see the drawing appear.
3. Maintain a separate provisional projection and promote only validated results. This is selected. The projection is disposable and freely correctable; the existing Preview → Commit transaction remains the only canonical write boundary.

## Identity and numbering

The system, not the model, owns public observation identity.

- A whole-view contour pass returns untrusted model-local IDs. The pipeline sorts valid contours spatially, then assigns stable slots such as `CTR-P1-V01-0001`.
- Regional standalone geometry and annotations receive stable observation slots derived from source, page, view, region and normalized spatial/type fingerprints, rendered to users as `GEO-0001`, `TXT-0001` or `DIM-0001`.
- Model-local IDs remain audit evidence only. All later regional prompts reference system-assigned contour slots.
- Repeated reads of the same slot update its revision instead of appending a second visible object.

Numbering is deterministic within a run and stable across retries with the same source and region schedule. Cross-run identity reconciliation remains outside this phase.

## Perception delta protocol

The perception pipeline adds structured `observation_delta` outputs alongside stage receipts and final command batches.

```ts
type PerceptionDeltaAction =
  | 'observe'
  | 'refine'
  | 'retype'
  | 'merge'
  | 'split'
  | 'reject'
  | 'promote';

interface PerceptionPreviewDelta {
  sequence: number;
  action: PerceptionDeltaAction;
  slotIds: string[];
  upserts: Array<GeometryNode | AnnotationNode>;
  removeIds: string[];
  source: {
    page: number;
    viewId: string;
    regionId?: string;
    stage: 'outline' | 'detail' | 'annotation' | 'reconciliation';
  };
}
```

Every delta is idempotent. `upserts` replace nodes with the same ID; `removeIds` delete provisional nodes. Sequence numbers make reconnect/replay deterministic. Deltas contain CAD projection data and evidence references, never image bytes, prompts, model names or hidden reasoning.

## Data flow

1. Prepare the page and establish a provisional page coordinate frame before emitting geometry.
2. Analyze the complete view and create the numbered contour registry.
3. Immediately project coarse contours with sufficient parameters into candidate geometry and emit `observe` deltas.
4. Read detail regions in bounded waves. As each region finishes, emit standalone geometry and annotations immediately.
5. Accumulate contour evidence and emit `refine`, `retype`, `merge`, `split` or `reject` deltas when the assembler changes a slot's best projection.
6. Rebuild topology and dimension associations from the converged observation set.
7. Preview and commit deterministic Drawing commands component by component.
8. Emit `promote` reconciliation deltas to remove provisional projections as their canonical counterparts become visible.
9. Clear all remaining provisional nodes on terminal completion, stop or failure; canonical commits already made remain intact.

The first implementation may emit one delta per completed model/tool response rather than one delta per token. This still provides real progressive drawing and preserves the under-30-second receipt target without depending on provider token streaming.

## Runtime and transport

`DrawingAgentRuntime` must consume the perception async iterable online. It may no longer collect all command batches before applying them. Each output is handled immediately:

- stage receipt → human-readable task event and audit event;
- observation delta → structured SSE event and audit event;
- command batch → Preview → Commit immediately, unless the run is analysis-only;
- pause/stop → stop new model calls at the next safe point while retaining the current preview projection in paused state; terminal stop clears it.

The SSE progress event adds an optional structured perception delta. Existing textual clients remain compatible because the field is optional.

## Frontend projection

Zustand stores `perceptionPreview`, keyed by stable node ID and scoped to `runId`. It is not part of `DrawingDocument`, is never sent to the Drawing API, and cannot be edited as canonical geometry.

Canvas renders two sources:

1. canonical document nodes with normal confirmed/candidate styling;
2. provisional nodes above them with a consistent dashed/low-opacity treatment and visible short slot labels.

When a commit arrives, the canonical workspace refreshes first and the corresponding provisional IDs are removed. Starting another run or receiving a terminal event clears stale preview state.

## Coordinate policy

Progressive output is only meaningful if the first object is visible. Every delta therefore carries nodes already transformed into one explicit provisional frame. The frontend fits preview and canonical bounds together and must not assume normalized page values are millimetres. Actual unit calibration can later update the frame through a recorded transaction; it must not silently rescale individual nodes.

This phase establishes the protocol boundary and fit behavior. Reliable scale extraction from dimensions remains a separate calibration task.

## Error handling

- Invalid observation parameters: audit and omit the projection; do not guess.
- Duplicate or overlap read: deterministic ID/fingerprint upserts the existing slot.
- Later contradiction: emit `retype`, `merge`, `split` or `reject`; no canonical revert is needed before promotion.
- SSE reconnect: replay retained ordered deltas; client ignores sequences it has already applied.
- Region failure: keep projections from successful regions and show incomplete coverage.
- Run failure/stop: clear provisional projection while preserving canonical commits.
- Commit failure: retain the affected provisional nodes as candidates and surface the validation failure.

## Audit and regression

Each delta is appended to the Agent audit log with run ID, sequence, action, slot IDs, source region, entity types, confidence and evidence references. The local observation store saves the delta ledger without media. Regression replay reduces the ledger into the same final provisional projection and compares it with golden expectations under geometry tolerances.

Required tests:

- contour IDs are system-assigned and deterministic;
- a regional result is emitted before later regions finish;
- runtime forwards a delta before pipeline completion;
- the client idempotently applies upsert/remove/retype/reject operations;
- Canvas renders provisional and canonical nodes together;
- commit promotion removes the matching provisional node;
- stop/failure clears provisional state;
- replaying a delta ledger produces the same projection;
- existing canonical transaction and audit tests continue to pass.

## Scope boundary

This phase implements real progressive preview for raster image and first-page PDF perception. It does not add layers, blocks, fills, 3D, cross-run object identity, collaborative preview sharing or user approval of provisional edits. Canonical user confirmation can be added later without changing the delta protocol.
