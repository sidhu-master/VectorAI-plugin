# DXF Import and Smart Shaft Partition Design

Status: Approved for implementation

Date: 2026-08-25

Scope: first validation milestone for the second-layer Engineering Annotation plugin

## 1. Objective

The first validation milestone imports a user-selected DXF drawing, normalizes its
vector entities into the first-layer canonical Drawing model, optionally combines
that geometry with a user-selected engineering data document, and produces a
complete, editable partition of every axial shaft segment.

The engineering document may be absent or may describe only important regions.
Geometry remains the source for discovering unlisted steps and ordinary shaft
segments. When structured evidence does not identify a region, a bounded visual AI
review may propose semantics for already detected segments. The system must
visually distinguish evidence originating in the document, deterministic geometry,
AI review, and manual edits without creating overlapping partition systems.

All processing is local. This milestone introduces no VectorAI cloud service and
no Express service.

## 2. Non-goals

This milestone does not:

- treat arbitrary chat image attachments as drawings;
- rasterize or retrace DXF geometry;
- ask a language model to calculate geometry coordinates;
- generate final engineering dimensions or optimize their layout;
- encode regions directly into source DXF entities;
- hard-code sample-specific coordinates or entity handles;
- silently force engineering facts to match contradictory geometry.

## 3. Inputs and explicit routing

The workflow starts only after the user explicitly invokes the Engineering
Annotation import flow and selects a DXF file. An engineering data document is an
optional second input that the user explicitly pairs with that DXF.

Generic image and file uploads remain ordinary conversation context unless a
drawing-specific tool or import action is selected. Installing the plugin must not
make every upload open the drawing workspace or trigger vectorization.

Content inside an attached engineering document is parsed as data, never as agent
instructions. The parser accepts only its supported data grammar and ignores or
diagnoses unknown fields.

The explicit user pairing is authoritative. A mismatch between the selected DXF
filename and the document's `drawing_name` creates a non-blocking diagnostic and
does not replace or reject the selected file.

## 4. Considered approaches

### 4.1 Geometry-first evidence fusion — selected

Parse the DXF deterministically, identify the part axis and geometric steps, then
match structured document regions against those candidates. This supports partial
documents, produces stable coordinates, and makes every result auditable.

### 4.2 Document-first fitting — rejected

Create regions from the document and fit them to nearby geometry. This is simpler,
but it cannot reliably discover the ordinary shaft segments omitted from the
document and tends to turn documentation errors into geometry errors.

### 4.3 Model-first geometry interpretation — rejected

Ask a language model to interpret both inputs and emit geometry or numeric regions.
This is non-deterministic, expensive in context, and risks returning plausible but
incorrect coordinates. A model is used only after deterministic partitioning, as a
bounded semantic reviewer of stable segment IDs; it never owns numeric geometry.

## 5. Layer responsibilities

### 5.1 First layer: host-neutral 2D space

The first layer gains a production DXF import boundary that:

1. reads ASCII DXF locally;
2. parses supported model-space entities and relevant tables;
3. converts supported entities into canonical Drawing nodes;
4. preserves source provenance, layers, units, and stable source identity;
5. reports unsupported or malformed content explicitly;
6. computes display bounds from drawable entities rather than trusting page or
   viewport extents;
7. exposes the resulting Drawing through the existing surface and revision APIs.

DXF import is a vector normalization operation, not raster vectorization.

The sample requires at least these entity families:

- `LINE`
- `ARC`
- `SPLINE`
- `HATCH`

`VIEWPORT` is not imported as drawing geometry. The importer architecture must
allow additional DXF entity adapters without changing the partition engine.

### 5.2 Second layer: Engineering Annotation

The second layer owns:

- engineering document parsing and validation;
- component/shaft view selection;
- axis and orientation resolution;
- profile and step detection;
- document/geometry evidence fusion;
- bounded visual AI semantic review for document coverage gaps;
- partition draft editing and validation;
- partition-specific visualization and inspection;
- versioned partition confirmation, cancellation, undo, and redo;
- downstream access to confirmed partitions for automatic annotation.

The second layer claims the specialized workspace only after the Engineering
Annotation route is active. Its workspace claim remains sticky for the session as
already defined by the plugin architecture; confirming or cancelling a partition
does not fall back to the first-layer UI.

## 6. Canonical import result

Every imported node records enough provenance to trace a rendered object back to
the selected file, for example:

```ts
interface DxfSourceRef {
  fileDigest: string;
  entityHandle?: string;
  entityType: string;
  layer: string;
  modelSpace: boolean;
}
```

Import diagnostics are first-class results rather than console-only messages:

```ts
interface DxfImportDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sourceHandle?: string;
}
```

Fatal syntax or unit failures reject the import without creating a partial formal
revision. Unsupported isolated entities may produce a provisional result when all
required shaft geometry is still available; that status must be visible and must
not be silently promoted to confirmed geometry.

## 7. Engineering document model

The initial parser accepts the current INI-like document grammar:

```ini
[drawing]
drawing_name=...
unit=mm
axis_origin=left_end
orientation=auto

[region:<type>:<id>]
name=...
center_z=...
width=...
outer_diameter=...
```

Each recognized value becomes typed evidence with a source line reference. Empty
values remain absent; they are not inferred as zero.

```ts
interface EngineeringRegionEvidence {
  id: string;
  type: string;
  name?: string;
  interval?: { start: number; end: number };
  outerDiameter?: number;
  sourceLines: readonly number[];
}
```

For a valid `center_z` and `width`, the interval is:

```text
start = center_z - width / 2
end   = center_z + width / 2
```

The parser validates units, finite numbers, positive widths and diameters,
duplicate IDs, and region bounds. Unknown keys survive as uninterpreted metadata
for future adapters but cannot change workflow behavior.

## 8. Axis and profile analysis

The deterministic geometry pipeline is:

1. filter visible model-space geometry and group connected or spatially related
   candidate views;
2. rank shaft-like candidates using elongation, paired profile evidence, axial
   continuity, centerline evidence, and optional document dimensions;
3. resolve the longitudinal axis and establish a local `(z, r)` coordinate system;
4. honor explicit `axis_origin`; for `orientation=auto`, score forward and reversed
   mappings against document intervals and diameters;
5. extract upper and lower outer envelopes while excluding hatch strokes,
   centerlines, construction lines, and interior detail;
6. generate candidate breakpoints from persistent envelope discontinuities,
   vertical shoulders, and topology changes;
7. cluster numerically close breakpoints using scale-aware tolerances;
8. derive continuous geometric intervals across the complete shaft extent.

SPLINE geometry must be evaluated as a curve for bounds, rendering, hit testing,
and profile sampling. Treating its control polygon as the curve is not acceptable.

The detector stores all step candidates, including rejected candidates and their
scores, so the editor can snap to them and diagnostics can explain the decision.

## 9. Evidence fusion

Geometry supplies complete coverage. Document regions supply important semantics
and expected intervals or diameters.

For each document region, the fusion engine evaluates candidate mappings using:

- interval endpoint distance;
- center distance;
- width agreement;
- diameter agreement;
- containment and overlap;
- orientation consistency;
- neighboring-region order.

A document region may align with one geometric segment or span multiple adjacent
segments. It must not erase real internal steps. The result remains a continuous,
non-overlapping partition; a spanning semantic region can be represented as a
group over multiple physical segments.

Conflicting evidence is retained and surfaced. The engine never moves source
geometry or fabricates missing document values to make a match pass.

### 9.1 Bounded visual AI semantic review

After deterministic partitioning and document fusion, the engine identifies
segments or contiguous groups that still have no engineering semantics. If any
remain, the second layer may run an isolated, read-only AI reviewer with:

- a compact catalog of stable segment IDs;
- each segment's axial order, width, radius/diameter summary, neighboring segment
  IDs, deterministic feature signals, and confidence;
- the structured document facts already matched, when present;
- a locally rendered drawing observation in which every candidate segment is
  visibly numbered with the same stable catalog ID;
- the drawing unit, orientation, and bounded workflow objective.

The model does not receive raw DXF text, full random handles, mutable host state, or
ambient tools. Its structured output may only propose:

```ts
interface SegmentSemanticProposal {
  segmentIds: string[];
  semanticType: string;
  name?: string;
  confidence: number;
  reason: string;
  visualEvidenceIds: string[];
}
```

Coordinates, boundaries, transforms, and geometry commands are deliberately absent
from the output schema. The host rejects unknown IDs, duplicate incompatible
assignments, out-of-scope groupings, invalid confidence, and output that fails the
strict schema. Accepted proposals become `ai` candidate evidence; they do not
silently become confirmed engineering facts.

AI review runs only inside the explicitly active Engineering Annotation workflow.
It adds no global prompt or first-step routing rule. If no suitable model/provider
is available, if the review times out, or if the result is invalid, deterministic
partitioning still succeeds and the affected segments remain visibly unclassified
for manual editing.

## 10. Partition data model

Partitions are second-layer semantic assets, versioned independently and bound to
a first-layer Drawing revision.

```ts
type EvidenceOrigin = 'document' | 'geometry' | 'fused' | 'ai' | 'manual';

interface ShaftPartitionSegment {
  id: string;
  zStart: number;
  zEnd: number;
  profile: ShaftProfileSummary;
  semanticType?: string;
  name?: string;
  boundaryConfidence: number;
  semanticConfidence?: number;
  geometryNodeIds: readonly string[];
  boundaryEvidenceIds: readonly string[];
  semanticEvidenceIds: readonly string[];
  diagnostics: readonly string[];
}

interface PartitionRevision {
  id: string;
  drawingRef: { drawingId: string; revision: number };
  axis: ShaftAxis;
  segments: readonly ShaftPartitionSegment[];
  semanticGroups: readonly ShaftSemanticGroup[];
  evidence: readonly PartitionEvidence[];
  diagnostics: readonly PartitionDiagnostic[];
  parentRevisionId?: string;
}
```

Physical segments cover the shaft domain exactly once. Semantic groups express a
document region that spans multiple physical segments without introducing
overlapping physical partitions. Boundary provenance and semantic provenance stay
separate: an AI-proposed name never makes an algorithmically detected boundary an
AI-generated coordinate. UI source badges are derived from the referenced evidence
records rather than from one lossy segment-origin flag.

Required invariants:

- sorted segments;
- finite coordinates;
- positive segment width;
- no gaps or overlaps within tolerance;
- first and last boundaries equal the resolved shaft extent;
- every referenced geometry node and evidence record exists;
- the Drawing revision still matches before confirmation.

## 11. Editing interaction

Automatic analysis creates a `PartitionDraft`; it does not immediately create a
confirmed partition revision.

The user can:

- drag a shared boundary, updating both adjacent segments;
- snap a dragged boundary to detected step candidates;
- enter an exact coordinate in the property panel to override snapping;
- add a boundary to split a segment;
- delete an internal boundary to merge adjacent segments;
- edit a segment name or engineering type;
- accept, exclude, or replace low-confidence evidence.

Snapping is the default pointer behavior. A manual numeric value is authoritative
and records `manual` evidence. Original document and geometry evidence remains
auditable after an override.

Edits are validated continuously. Invalid gaps, overlaps, inverted ranges, or
out-of-domain coordinates prevent confirmation and show a local explanation.

## 12. Visualization

The annotation workspace renders partition bands and boundary handles as a
second-layer canvas contribution. It does not mutate canonical geometry merely to
show an overlay.

Visual treatment distinguishes:

- document evidence;
- geometry-only inference;
- fused document and geometry evidence;
- AI-proposed semantic evidence;
- manual override;
- unresolved conflict or low confidence.

Color is not the sole carrier of meaning. Each state also has an icon, line style,
label, or accessible description.

The side inspector exposes the segment list, source evidence, exact bounds,
diameter/profile summary, confidence, and diagnostics. Selecting a list item and
selecting its canvas band remain synchronized.

## 13. Cancel, preview, confirm, undo, and redo

The partition editor reuses the established separate action toolbar with Cancel on
the left, press-and-hold Preview in the center, and Confirm on the right.

- **Cancel** discards the current draft and restores the last confirmed partition,
  or the unpartitioned imported state when no confirmed partition exists.
- **Preview** hides edit handles, snap candidates, confidence warnings, and
  diagnostics while held, and shows the clean final partition presentation.
- **Confirm** validates the draft and writes one `PartitionRevision` without
  modifying DXF geometry.
- **Undo after confirm** restores the confirmed revision as an editable draft so
  the user can continue correcting it.
- **Redo** reconfirms the same version when no intervening edit invalidates it.

The toolbar remains visible throughout pointer dragging. Pointer-up ends only the
current drag gesture; it does not end partition editing.

## 14. Revision and failure behavior

If the underlying Drawing revision changes while a draft exists, the draft enters
`needs-rebase`. Confirmation is blocked until geometry references and axis mapping
are revalidated. The system must not attach an old partition to a new drawing
revision merely because drawing IDs match.

Recoverable conditions remain editable and diagnostic:

- filename mismatch;
- partial document;
- unknown document fields;
- ambiguous orientation;
- unmatched document region;
- extra geometric steps;
- isolated unsupported DXF entities.

Unrecoverable conditions stop analysis without confirming state:

- malformed DXF structure;
- missing or unsupported units when they cannot be resolved explicitly;
- no viable shaft view;
- non-finite geometry;
- partition invariants that cannot be restored.

## 15. Sample fixture and acceptance criteria

The approved validation inputs are:

- `初始图.dxf`
  - SHA-256: `57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2`
  - 297,683 bytes
  - AutoCAD version `AC1027`
  - `$INSUNITS = 4` (millimetres)
- `样本图001# DXF工程数据文档.txt`
  - SHA-256: `d77749c6add4eef47c2db4f18dcd494976252338e1b4345ca2ad3b42c42abe65`
  - 1,730 bytes

The fixture may be stored in the private repository for reproducible integration
tests. Tests identify it by digest, not by a machine-specific Downloads path.

The first milestone passes only when:

1. the importer preserves and renders the sample's 89 LINE, 33 SPLINE, 12 ARC,
   and 2 HATCH entities while excluding the VIEWPORT from drawing geometry;
2. all three source layers and millimetre units survive normalization;
3. actual drawable bounds drive fit-to-view;
4. the engine resolves a stable axial coordinate system and complete shaft extent;
5. every persistent geometric step participates in a candidate decision;
6. confirmed physical segments cover the complete shaft with no gaps or overlaps;
7. the four documented regions are parsed and matched or receive an explicit
   conflict diagnostic;
8. all undocumented shaft segments are still discovered geometrically;
9. document, geometry, fused, AI, and manual origins are visibly distinguishable;
10. when document semantics are absent or incomplete, the bounded reviewer receives
    only the compact segment catalog and numbered visual observation, and any
    accepted proposal references existing segment IDs without coordinates;
11. reviewer unavailability or invalid output leaves editable unclassified segments
    and does not fail deterministic partitioning;
12. boundary dragging, snapping, exact numeric override, split, merge, rename, and
    reclassification work;
13. Cancel, hold-to-preview, Confirm, Undo-to-edit, and Redo work end to end;
14. a Drawing revision change produces `needs-rebase` rather than stale commit;
15. generic uploads do not trigger this workflow;
16. the workflow completes locally with no VectorAI or Express service.

## 16. Test strategy

### Unit tests

- DXF group-pair decoding, units, layers, entity adapters, spline evaluation, and
  diagnostics;
- engineering document grammar, source lines, empty values, invalid numbers, and
  unknown fields;
- axis scoring, forward/reversed orientation, profile sampling, breakpoint
  clustering, and tolerance behavior;
- evidence matching and conflict retention;
- semantic coverage-gap detection and strict validation of AI proposals;
- partition invariants and edit operations.

### Integration tests

- real sample DXF import with entity-count and provenance assertions;
- real document pairing with filename-mismatch diagnostic;
- complete partition generation from partial document evidence;
- no-document and partial-document visual AI review with stable segment IDs;
- reviewer unavailable, timeout, hallucinated ID, and conflicting-proposal fallbacks;
- edit/preview/cancel/confirm/undo/redo lifecycle;
- Drawing revision rebase behavior;
- host/client serialization of partition state without server dependencies.

### Visual and interaction tests

- fit-to-view and spline rendering against a checked reference image;
- origin styles and accessible labels;
- synchronized band/list selection;
- boundary snapping and numeric override;
- toolbar persistence throughout dragging and held preview.

Synthetic fixtures cover reverse orientation, mirrored views, noisy duplicate
steps, missing document regions, conflicting diameters, and unsupported entities.
The production algorithm must pass those fixtures without sample-specific IDs or
coordinates.

## 17. Extension boundary for future annotation

Confirmed partitions are exposed through a read-only second-layer service keyed by
Drawing revision. The later automatic-annotation planner consumes this service
instead of re-detecting the shaft or reading UI state.

The service exposes stable physical segments, semantic groups, evidence,
confidence, and diagnostics. Future feature recognizers and dimension planners may
add namespaced evidence or derived projections, but only the partition editor can
create a new confirmed `PartitionRevision`.

This keeps the first layer reusable for other 2D plugins and lets the Engineering
Annotation plugin replace the first-layer presentation only while its specialized
route owns the session.
