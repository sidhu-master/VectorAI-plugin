# Drawing Perception to Canonical Drawing IR Design

**Status:** Approved for direct implementation

## Goal

Complete the image/PDF workflow so uploaded media becomes auditable Drawing IR and optional accompanying text can continue as a modification against the newly committed revision. Remove `SpatialIntent` from the perception path.

## Chosen approach

Three approaches were considered:

1. Keep compiling observations through legacy `SpatialIntent`. This is quick but preserves two competing document protocols and cannot provide Drawing-native assertions or source identity.
2. Convert observations deterministically into typed `DrawingCommand` batches. This is the selected approach because every write then uses the same Preview → Verify → Commit boundary as text edits.
3. Ask a model to translate observations into commands. This is flexible but makes stable IDs, replay and coordinate conversion nondeterministic, so it is not used for compilation.

## Input interpretation

One public Agent endpoint accepts drawing identity, revision, optional text, and at most one image/PDF attachment. There is no user-facing mode switch. A bounded interpreter classifies the input as:

- `analyze_only`: inspect the source and report findings without changing the DrawingDocument.
- `reconstruct`: reconstruct the source into Drawing IR.
- `reconstruct_then_modify`: reconstruct first, then plan the text modification against the resulting revision.

Image-only input defaults to `reconstruct`. Text-only input keeps the existing Drawing Agent path. Explicit analysis wording without modification wording produces `analyze_only`; ambiguous mixed input uses one structured Lite model classification, with deterministic fallback to `reconstruct_then_modify` when the text asks for a drawing change.

## Source artifacts and evidence

The route writes upload bytes once to a local content-addressed Source Artifact Store before starting the run. Runtime and audit receive only `sourceId`, hash, MIME type, byte length and page number. Base64, prompts containing media, credentials and crop bytes are forbidden in audit records.

PDF MVP processes page 1 and returns a warning when more pages exist. The architecture remains page-addressed.

Observation records retain source ID, page/view/region coordinates, measured values, confidence and evidence IDs. Stable Drawing node IDs are derived from the source hash plus observation ID, making retries idempotent.

## Resolver and commands

The perception pipeline remains:

`page analysis → views → datums/geometry/OCR → topology → dimension association`

Its terminal output changes from `SpatialIntent` batches to `DrawingCommandBatch`:

```ts
interface DrawingCommandBatch {
  componentId: string;
  commands: DrawingCommand[];
  postconditions: DrawingAssertion[];
  observationIds: string[];
  evidenceRefs: EvidenceId[];
  confidence: number;
  lowConfidenceCount: number;
}
```

The resolver performs deterministic coordinate transforms and validates every required primitive parameter. It never guesses missing values. Confirmed observations create confirmed nodes; confidence below `0.6` creates candidate nodes with confidence and evidence references, which the renderer already marks red. Invalid observations remain in the observation store and create no command.

Each topology component is independently batched with at most 25 created nodes. Geometry precedes annotations. Dimensions reference the stable IDs created from their associated geometry observations.

## Runtime flow

The Drawing Agent owns orchestration:

1. Accept immediately and emit a heartbeat within 25 seconds of silence.
2. Resolve the Source Artifact and interpret the combined input.
3. Run perception and mirror named stages to public progress.
4. For `analyze_only`, store observations, publish a bounded analysis summary and finish without a commit.
5. For reconstruction, preview each command batch using its postconditions, commit valid batches atomically, and retain successful components if a later component fails.
6. Refresh the canonical revision after each commit.
7. For `reconstruct_then_modify`, discard media from hot context and invoke the existing planner on the latest Drawing summary and revision.

Pause, stop and appended instructions are honored at existing safe points. Stop releases cached media. A stale revision triggers re-query/replan and never silently overwrites user work.

## Public projection and UI

Public run data may expose an `analysisSummary`, source metadata without bytes, warnings, workflow status and commit count. It never exposes model names, raw model replies, media bytes, complete documents or hidden reasoning.

The UI accepts PNG/JPEG/WebP/PDF, sends media together with text, shows perception stages, refreshes the canonical workspace after every commit and adds the terminal analysis/completion summary to chat. No business mode toggle is added.

## Error handling

- Unsupported MIME or oversized source: reject before starting.
- Malformed vision response: one bounded schema correction for that tool.
- Missing required geometry parameters: observation retained, command omitted, warning emitted.
- Low confidence but geometrically valid: candidate commit.
- Invalid transaction: reject the whole component; do not affect previous components.
- Pure analysis: zero commits by contract.

## Verification

- Unit tests for source storage, intent classification and Observation → DrawingCommand conversion.
- Integration tests for reconstruction, analysis-only and reconstruction-then-modify revision handoff.
- Audit tests proving no media bytes/model names and replayable commit references.
- Browser test for combined text/image input.
- Local `test1.jpg` baseline recording stage latency, observations, commits and candidate count under `.local/vectorai/baselines/`.

## Scope boundary

This phase supports raster images and first-page PDF fallback. Deterministic DXF import, PDF vector extraction, multi-page UI, layer/block/fill editing and 3D remain outside this implementation.
