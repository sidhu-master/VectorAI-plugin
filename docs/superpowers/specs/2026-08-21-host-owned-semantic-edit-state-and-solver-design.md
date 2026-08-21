# Host-Owned Semantic Edit State and Solver Design

**Date:** 2026-08-21  
**Status:** Proposed  
**Scope:** VectorAI first-layer DSH space plugin and shared drawing edit core

## 1. Decision

VectorAI will stop asking an LLM to carry internal workflow handles or invent Drawing coordinates for qualitative editing instructions.

The model owns semantic decisions:

- interpret the user's drawing intent;
- identify semantic parts and relevant visual evidence;
- choose generic spatial relationships and edit goals;
- inspect Preview evidence and decide whether to revise, finalize, or stop.

The Host owns execution state and exact geometry:

- bind the current root instruction, Drawing revision, Observation, context, Groundings, Preview, evaluation, and operation receipt;
- resolve visual or semantic references to exact Drawing nodes, source spans, endpoints, and world coordinates;
- solve translation, rotation, interfaces, constraints, collision, and minimum-deformation objectives;
- compile, validate, persist, undo, and replay exact Drawing transactions.

In the model-visible path, only a user instruction that explicitly contains a numeric distance, coordinate, or angle may create an exact numeric constraint. For qualitative instructions such as “raise the hand”, “cross both arms downward”, or “move this closer”, model-visible tools must reject raw translation, pivot, rotation, and absolute world-coordinate fields. Trusted interactive UI gestures, imported exact data, and deterministic engineering dimensions use separate provenance-bound paths described in §7.

## 2. Problem in the Current Implementation

The current DSH adapter exposes an internal chain resembling:

```text
drawing_observe -> taskId + observationId
drawing_build_context(taskId, observationId) -> contextId
drawing_ground(taskId, contextId, nodeIds) -> groundingId
drawing_preview_*(taskId, groundingId, translation, ...) -> previewHandle
drawing_evaluate_preview(taskId, previewHandle, candidateDigest)
drawing_finalize_preview(taskId, previewHandle, candidateDigest, ...)
```

This has four defects:

1. Random internal identifiers are repeatedly serialized through the model. Context compaction, stale history, or a single altered character produces `EDIT_TASK_STALE` or `EDIT_LINEAGE_MISMATCH`.
2. Old handles remain visible in conversation history even after a new direct-user turn invalidates them.
3. Large context results repeatedly expose whole-Drawing geometry facts and increase both token pressure and the chance of mixing old and current state.
4. The ordinary pose tools require `translation: [dx, dy]`. The Host derives connector rotation and endpoint transport, but the model still guesses the target displacement.

The repository already contains two pieces of the intended architecture that are not wired into the DSH semantic path:

- `@vectorai/drawing-spatial` has a revision-bound `SpatialPointRef` resolver for Observation-normalized points, node anchors, and explicit world references.
- `GroundingLedger` can retain task-scoped semantic hypotheses, supports, exclusions, interfaces, evidence, and revisions.

This migration will connect those capabilities instead of building gesture-specific rules.

## 3. Design Principles

### 3.1 Separate transport correlation from domain state

DSH may continue to correlate a model tool call with its tool result. That transport correlation is not the Drawing workflow state.

Drawing workflow state is stored by the Host and scoped by the trusted runtime session plus the current root-user turn. The model cannot supply or override session identity, root message identity, current revision, current candidate digest, or authority.

### 3.2 Keep opaque lineage internal

The Host continues minting task, Observation, context, Grounding, Preview, evaluation, commit, and operation identifiers for validation, persistence, audit, and UI projection. These identifiers are not fields in ordinary model-visible requests.

Tool results expose a compact workflow disposition and valid next capabilities, not internal UUIDs:

```ts
interface DrawingWorkflowResult<T> {
  state: 'observed' | 'selected' | 'preview_ready' | 'needs_revision' | 'committed' | 'blocked';
  result: T;
  nextTools: string[];
}
```

The DSH adapter resolves the active internal record immediately before every operation and applies revision/state CAS checks. A stale or missing state returns a stable recovery disposition such as `reobserve_required`; the model is never asked to repair an identifier.

### 3.3 Semantic references, deterministic coordinates

The model may refer to Drawing content with:

- the current Host-verified canvas selection;
- a normalized point, stroke, or bounded region in the current Observation;
- a short candidate key from the current bounded candidate set;
- a semantic query and exclusions;
- a previously selected per-episode `partKey` such as `left-hand`.

The Host resolves those references into exact node IDs, source spans, half-edges, faces, and endpoint slots and records them in the Grounding Ledger. Raw Drawing node IDs can appear in evidence returned for audit, but the normal model path does not require copying them into later calls.

### 3.4 Generic relationships, not gesture opcodes

The protocol must not add operations named after “wave”, “cross arms”, a character, or a regression fixture. The model expresses generic constraints that compose across drawings:

- relative position: above, below, left of, right of, nearer, farther;
- alignment: aligned X/Y, centered, coincident, parallel, perpendicular;
- topology: touches, remains connected, crosses, does not cross, inside, outside;
- direction: up, down, left, right, toward/away from another reference;
- preservation: keep anchor, length, radius, topology, ordering, or protected scope;
- qualitative magnitude: minimal, slight, moderate, strong;
- explicit numeric distance or angle only when bound to a verified user-text span.

## 4. Host-Owned Episode State

Each direct user turn that intentionally activates Drawing editing creates one `SemanticEditEpisode` under the trusted DSH session:

```ts
interface SemanticEditEpisode {
  sessionId: string;
  rootUserMessageId: string;
  rootInstructionProjection: BoundedUserInstruction;
  drawingRef: DrawingRef;
  stateEpoch: number;
  state: 'active' | 'awaiting_review' | 'committed' | 'discarded' | 'invalidated';
  observation?: StoredObservation;
  context?: StoredWorldContext;
  groundingLedger: GroundingLedgerState;
  selectedParts: Record<string, ResolvedSemanticPart>;
  currentPreview?: StoredPreview;
  currentEvaluation?: StoredEvaluation;
  candidateCount: number;
}
```

The internal state machine is:

```text
canonical
  -> observed
  -> selecting / selected
  -> solving
  -> preview_ready
  -> evaluated
  -> revise | finalize | discard
```

Rules:

- a new direct-user edit turn atomically invalidates the prior active episode and its transient overlays;
- repeated tool calls in the same valid state are idempotent or return the current disposition;
- every state transition uses the session-state epoch and Drawing revision as CAS inputs;
- a concurrent interactive edit, import, undo, or commit invalidates the episode before it can write;
- context compaction can remove old presentation messages without removing Host state;
- session disposal may discard uncommitted state but never mutate the canonical Drawing.

## 5. Model-Visible Tool Surface

### 5.1 Observe

```ts
drawing_observe({ focus?: VisualFocusHint })
```

The adapter starts or resumes the current episode internally. The result contains one current Observation image, a compact Drawing summary, coordinate convention, current verified UI selection summary, and possible next tools. It does not return a model-replayable task or Observation handle.

The context builder remains an internal Host step. Large exact facts are queried or resolved on demand rather than copied into every model turn.

### 5.2 Select semantic parts

```ts
drawing_select_parts({
  parts: Array<{
    partKey: string;
    label: string;
    references: Array<
      | { kind: 'current_selection' }
      | { kind: 'observation_point'; normalized: [number, number] }
      | { kind: 'observation_region'; polygon: Array<[number, number]> }
      | { kind: 'candidate'; key: string }
      | { kind: 'semantic_query'; text: string }
    >;
    exclude?: Array<{ kind: 'candidate' | 'semantic_query'; value: string }>;
  }>;
})
```

The model makes the semantic choice. The Host performs exact coverage, topology, source-span, and interface resolution. Ambiguous results return a bounded candidate set with short episode-local keys and a canvas overlay. Confirmed selections update the existing AI-selection animation; no permanent colored labels or regression-specific decoration are added.

### 5.3 Preview a qualitative spatial intent

```ts
drawing_preview_spatial_intent({
  summary: string;
  goals: SpatialGoal[];
  preserve: PreservationGoal[];
})
```

`SpatialGoal` is a strict discriminated union of the generic relationships in §3.4. Subjects refer to selected `partKey` values. References use other `partKey` values, current Drawing anchors, semantic anchors, or Observation-normalized references.

```ts
type SpatialReference =
  | { kind: 'part'; partKey: string }
  | { kind: 'drawing_anchor'; anchor: 'center' | 'top' | 'bottom' | 'left' | 'right' }
  | { kind: 'observation_point'; normalized: [number, number] }
  | { kind: 'semantic_anchor'; query: string };

type QualitativeMagnitude = 'minimum' | 'slight' | 'moderate' | 'strong';

type SpatialGoal =
  | {
      kind: 'direction'; subject: string;
      direction: 'up' | 'down' | 'left' | 'right'; magnitude: QualitativeMagnitude;
    }
  | {
      kind: 'relative_position'; subject: string; reference: SpatialReference;
      relation: 'above' | 'below' | 'left_of' | 'right_of' | 'near' | 'far' | 'centered';
      magnitude: QualitativeMagnitude;
    }
  | {
      kind: 'alignment'; subject: string; reference: SpatialReference;
      axis: 'x' | 'y' | 'both';
    }
  | {
      kind: 'topology'; subject: string; reference: SpatialReference;
      relation: 'touches' | 'crosses' | 'does_not_cross' | 'inside' | 'outside';
    }
  | {
      kind: 'explicit_numeric'; subject: string;
      quantity: 'delta_x' | 'delta_y' | 'distance' | 'angle' | 'target_x' | 'target_y';
      numericKey: string;
    };

type PreservationGoal =
  | { kind: 'part_shape'; partKey: string }
  | { kind: 'connectivity'; partKey: string }
  | { kind: 'anchor'; reference: SpatialReference }
  | { kind: 'topology'; partKey?: string }
  | { kind: 'protected_scope' }
  | { kind: 'minimum_deformation' };
```

There is no raw `translation`, `pivot`, `rotationRadians`, or world-space `point` field in the qualitative tool schema.

The Host deterministically extracts explicit values and units from the authoritative instruction before the model can request a Preview. `drawing_observe` exposes a bounded list such as `{ numericKey: 'n1', quantity: 'distance', value: 80, unit: 'mm' }`. The model may reference `n1`, but cannot supply or modify its value.

The internal evidence record is:

```ts
type NumericConstraint = {
  numericKey: string;
  kind: 'distance' | 'angle' | 'coordinate';
  value: number | [number, number];
  unit: string;
  userEvidenceSpan: InternalUserInstructionSpanRef;
};
```

The Host verifies that the bounded authoritative user instruction contains the same normalized value and unit. An unknown numeric key is rejected with `EDIT_NUMERIC_EVIDENCE_MISSING`.

### 5.4 Evaluate, revise, finalize, discard

These tools operate on the current episode Preview:

```text
drawing_evaluate_preview()
drawing_revise_spatial_intent({ goalDelta, preserveDelta? })
drawing_finalize_preview()
drawing_discard_preview()
```

The Host binds the internal Preview handle, candidate digest, assessment, operation ID, and grant. The model only supplies semantic revision content when revising.

The visual reviewer receives the authoritative instruction plus deterministic before/after render evidence. It never receives write tools and never returns coordinates or authority.

## 6. Spatial Solver

The first-layer plugin adds a provider-neutral `SpatialIntentSolver` to `@vectorai/drawing-edit-core`, beneath both Web and DSH adapters.

Inputs:

- canonical Drawing and revision;
- resolved semantic parts and exact interfaces;
- Observation/world-model evidence;
- qualitative and verified numeric goals;
- preserve/protected scopes;
- deterministic solver version and options.

Pipeline:

1. Build local frames, anchors, topology, carrier/connector contacts, and available degrees of freedom.
2. Convert semantic goals to numeric residual functions and hard constraints.
3. Generate bounded initial candidates from current geometry, semantic anchors, symmetry, and Observation references.
4. Optimize transforms while minimizing goal residual, movement, connector deformation, collisions, topology changes, and preserve-scope violations.
5. Reject candidates that fail structural, reference, numeric, or protected-scope checks.
6. Rank remaining candidates deterministically and compile the selected candidate to forward/inverse Drawing commands.
7. Return diagnostics, solver metrics, and render evidence to Preview/evaluation.

The existing connected-carrier solver remains useful for exact endpoint transport and minimum-deformation orientation, but its target center becomes solver output rather than `model translation + current center`.

Multi-part edits are solved as one atomic problem. The solver cannot commit one hand and then solve the other against a partially committed Drawing.

## 7. Advanced and Interactive Editing

- Canvas drag, property editing, and explicit UI transforms may continue to provide exact coordinates through the trusted interactive intent path; they do not use the model-visible qualitative schema.
- Imported CAD data and engineering dimensions may provide exact world coordinates because their provenance is deterministic.
- Freeform path creation uses Observation-normalized references or source geometry evidence by default. Raw world points are available only through a separately authorized exact-data path.
- The current model-visible `drawing_preview_program` and numeric transform tools are removed from the default DSH catalog after the new path reaches parity. They must not remain as a bypass that allows qualitative turns to invent coordinates.

## 8. Error and Recovery Semantics

| Condition | Host result | Recovery |
|---|---|---|
| No active Drawing | `drawing_not_active` | Continue normal chat; do not open the Drawing panel |
| No Drawing intent | no Drawing tool activation | Other plugins and normal image chat are unaffected |
| Tool called in wrong state | `invalid_state` + current disposition/next tools | Model chooses a currently valid tool |
| Drawing revision changed | `reobserve_required` | Host discards transient episode state; model calls `drawing_observe()` |
| Selection ambiguous | `selection_ambiguous` + bounded candidates | Model selects/refines candidate evidence |
| No solver solution | `no_solution` + residual/constraint diagnostics | Model revises semantic goals or asks the user when meaning is ambiguous |
| Qualitative request contains model numeric value | `EDIT_NUMERIC_EVIDENCE_MISSING` | Remove numeric field and use semantic goals |
| Preview invalid or unsafe | `blocked` | Revise or discard; confirmation cannot override hard invalidity |
| Context messages compacted | no workflow failure | Host state continues independently of chat presentation |

Retries never ask the model to reconstruct a UUID. Exact operation idempotency, commit receipts, undo, and audit continue using internal durable identifiers.

The Host derives an operation binding from the episode, operation kind, canonical semantic request, current revision, and current candidate digest. A transport retry joins or returns that operation. A later model call with the same canonical semantic request returns the current disposition instead of creating a duplicate Preview or commit; a different request creates a new operation. No idempotency key is accepted from model arguments.

## 9. Context and Plugin Isolation

The DSH pre-step contribution remains capability-oriented and conditional:

- no Drawing and no Drawing intent: inject nothing and do not mount the Drawing workspace;
- active Drawing but unrelated question: expose at most a compact capability hint;
- explicit Drawing edit intent or verified current selection: expose the high-level semantic edit tools;
- never inject a fixed global workflow ordering into every user turn.

Tool results contain bounded summaries and one relevant image. Whole-Drawing geometry arrays, internal handles, and prior Preview payloads stay in Host memory/storage and are queried only as needed. This prevents VectorAI from crowding out other DSH plugins.

## 10. Migration Sequence

The cutover is atomic at the model-visible catalog boundary:

1. Add `SemanticEditEpisodeStore` and internal current-state resolution while keeping existing canonical transaction and safety cores.
2. Wire `SpatialPointRef`, `GroundingLedger`, World Model slices, and selection projections into Host-owned episodes.
3. Add the generic spatial-goal protocol and deterministic solver with Web/DSH-neutral contracts.
4. Add new stateful semantic tools and compact results.
5. Migrate evaluation, revision, finalization, overlays, and multi-part atomic solving to the current-episode APIs.
6. Run old and new protocols in test-only parity fixtures; do not expose both write paths to the model in production.
7. Replace the old catalog in one release and remove model-visible task/context/Grounding/Preview handles and qualitative numeric transforms.
8. Update Web to consume the same shared intent/solver core through its own adapter.

No compatibility shim may silently translate an invented model displacement into a qualitative goal.

This document supersedes only the model-visible lineage and coordinate fields in the existing DSH semantic-edit design. Its durable assessment, authority, commit receipt, recovery, Undo, and auto-safe rules remain normative and operate on the internal Host identifiers defined here.

## 11. Verification Gates

### Protocol and state

- Model-visible qualitative tool schemas contain no internal lineage ID, raw Drawing command, translation, pivot, rotation, or absolute world-point field.
- Context compaction between every workflow step does not change the active Host episode or tool outcome.
- New direct-user turns, imports, interactive commits, undo, and concurrent finalization invalidate stale episodes deterministically.
- Same operation retry returns the same terminal receipt and never duplicates a commit.

### Selection and grounding

- Current user selection, Observation-normalized references, candidate keys, semantic queries, exclusions, source spans, and multi-part selection are covered.
- The model's active selected parts appear only as the transient AI-selection animation and clear on replace, discard, commit, failure, or session disposal.
- Grounding Ledger evidence is revision-bound; unknown, partial, ambiguous, stale, and cross-session references fail closed.

### Solver

- Qualitative directions and relationships resolve without a model-provided coordinate.
- Explicit numeric constraints succeed only when their exact normalized value/unit is present in the authoritative user instruction.
- Property tests verify untouched-node semantic digests, connectivity, protected scopes, inverse replay, finite values, deterministic ranking, and no partial multi-part commit.
- Solver fixtures cover lines, circles, arcs, polylines, splines, connected carriers, zero/one/multiple interfaces, collisions, and unsatisfiable goals.
- Evaluation uses solver diagnostics and before/after renders; it cannot mutate state or grant authority.

### End to end

- Long-session DSH tests run after forced context pruning and complete without copying any internal identifier.
- Generic tasks cover one-part and multi-part relative positioning, alignment, crossing, preservation, exact user dimensions, ambiguous selection, and unsatisfiable constraints.
- Regression drawings may be test inputs but production code, schemas, prompts, and solver weights contain no character, body-part, gesture phrase, fixture node ID, or fixture coordinate special case.
- Web and DSH produce the same semantic candidate digest for the same Drawing, intent, selection evidence, and solver version.

## 12. Completion Criteria

This migration is complete only when:

1. DSH qualitative Drawing edits contain no model-authored coordinates and no model-replayed internal lineage handles.
2. Semantic selection is model-directed, Host-grounded, visible as transient AI selection, and revision-bound.
3. Exact transforms are computed and validated by the shared deterministic solver.
4. Multi-part edits solve and commit atomically.
5. Preview, visual feedback, auto-safe assessment, durable commit, and Undo use the same Host-owned episode lineage.
6. Forced context compaction and stale-history tests no longer produce handle transcription or stale-task retry loops.
7. The Drawing capability remains lazily activated and composable with unrelated DSH plugins.

## 13. Reference Patterns

- [MCP architecture](https://modelcontextprotocol.io/specification/2025-06-18/architecture): the Host coordinates context, permissions, lifecycle, and model integration while servers expose focused capabilities.
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence): thread-scoped checkpoints retain workflow state across graph steps and interruption/replay.
- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create): conversation/response linkage and tool-call correlation are transport/runtime concerns rather than application-domain arguments.
- [A Solver-Aided Hierarchical Language for LLM-Driven CAD Design](https://arxiv.org/abs/2502.09819): a semantic hierarchical language offloads spatial reasoning to a geometric constraint solver.
- [Autodesk Fusion sketch constraints](https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-FULLY-DEFINE-CONSTRAIN-SKETCH.htm): deterministic dimensions and constraints define exact geometry and predictable edits.
