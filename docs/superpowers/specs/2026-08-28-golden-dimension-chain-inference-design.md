# Golden-Sample Dimension-Chain Inference Design

Status: Proposed for review

Date: 2026-08-28

Scope: nominal axial dimension-scheme inference for shaft drawings in the
Engineering Annotation plugin

## 1. Objective

Infer a reviewable axial dimension scheme from drawing topology, accepted shaft
partitions, engineering-document evidence, and an explicit policy profile. Use the
initial and fully annotated shaft drawings as a golden regression pair, without
copying sample coordinates or dimension values into production rules.

This milestone answers two separate questions:

1. Which nominal axial dimensions should appear on the drawing?
2. Which elementary span is intentionally left unmarked as the closure of each
   dimension chain?

Tolerance values remain optional. A correct nominal chain can exist before a
tolerance source is available. Tolerance calculation continues to use the existing
`DimensionIntent`, `ToleranceSpec`, and `DimensionChain` architecture.

## 2. Architectural boundary

The inference layer belongs to the second-layer Engineering Annotation plugin.
The first-layer 2D plugin provides geometry, stable references, axial topology,
rendering, selection, and portable confirmed annotations. It must not learn shaft
dimensioning policy.

    first-layer geometry and axial feature topology
                             +
       second-layer confirmed/current partition snapshot
                             |
                             v
       second-layer axial dimension inference
       - stations and elementary spans
       - semantic and document evidence
       - candidate dimension intervals
       - policy scoring and closure selection
                             |
                             v
        reviewable nominal dimension scheme
                             |
                  preview / edit / confirm
                             |
                             v
       existing DimensionIntent / DimensionChain
                             |
                  later tolerance resolution
                             |
                             v
       first-layer DimensionAnnotation projection

The golden target drawing is a test oracle only. Production code may never load
it, identify the sample by filename or digest, or contain its expected coordinates
and dimension values.

## 3. Scope and non-goals

The first milestone supports:

- one-dimensional axial chains for rotational shaft-like parts;
- nominal linear dimensions between axial stations;
- nested overall, composite, functional, local, and closure relationships;
- document-backed and geometry-backed evidence;
- explicit ambiguity, alternatives, diagnostics, and confidence;
- preview, edit, confirm, cancel, undo, redo, and layer visibility using the
  existing second-layer workflow conventions;
- deterministic operation on the local computer without a VectorAI service.

It does not infer numeric tolerances, GD&T values, radial/diameter chains, angular
chains, arbitrary planar networks, final collision-free label placement, or every
annotation in the golden target. Those capabilities may consume the resulting
scheme later but are not part of this feature.

## 4. Golden fixture contract

The current shaft assets become one canonical fixture under
`packages/engineering-annotation/test/fixtures/golden-shaft-001/`:

- the clean initial DXF;
- the fully annotated target DXF;
- the engineering data document;
- a checked-in semantic manifest derived and independently reviewed from the pair.

The target DXF remains unchanged and is parsed by test-only tooling. The semantic
manifest is reviewable JSON and records stable facts rather than renderer positions:

- axial station coordinates and their source geometry references;
- expected displayed axial intervals;
- expected closure intervals;
- parent-child chain relationships;
- functional/document evidence for each interval;
- expected confidence class and known conflicts.

For the first golden shaft, the accepted axial stations are:

    0, 17, 41.5, 45, 53, 92, 147, 150, 173

The target displays these axial intervals:

    0 -> 17       = 17
    17 -> 41.5    = 24.5
    17 -> 45      = 28
    45 -> 53      = 8
    45 -> 150     = 105
    92 -> 147     = 55
    147 -> 150    = 3
    0 -> 173      = 173

The inferred, unmarked closure intervals are:

    41.5 -> 45    = 3.5
    53 -> 92      = 39
    150 -> 173    = 23

These values are permitted in fixtures and assertions only. They are forbidden in
runtime inference source and runtime policy configuration.

The document states a width of 23 for the right bearing region while the golden
target does not display that width. The manifest must preserve this contradiction
as evidence. A matching result must not silently discard the document statement.

## 5. Domain model

The new inference types live in `engineering-annotation` and are independent from
DSH transport and React.

### 5.1 Axial topology

`AxialStation` describes one normalized axial coordinate:

- stable ID;
- scalar coordinate and unit;
- station kind, such as drawing end, shoulder, partition boundary, or datum;
- stable geometry references;
- evidence references and source confidence.

`AxialElementarySpan` connects adjacent stations only. Every consecutive station
pair has exactly one elementary span, even when it has no functional name.

Station IDs derive from stable geometry/partition references and a quantized
coordinate, not array indices. Translation, view scale, entity order, and axis
direction must not change the semantic result.

### 5.2 Candidate intervals

`AxialDimensionCandidate` spans any two valid stations and records:

- start and end station IDs;
- nominal distance computed by geometry;
- proposed role: overall, composite, functional, process, local, reference, or
  closure candidate;
- source and evidence references;
- hard requirements and soft scores;
- policy reasons and diagnostics.

An interval is not automatically a displayed dimension. Candidate generation,
selection, and final display are separate states.

### 5.3 Inferred scheme

`AxialDimensionScheme` contains:

- drawing and partition revision references;
- ordered stations and elementary spans;
- all considered candidates;
- displayed candidate IDs;
- closure candidate IDs;
- nested chain nodes;
- rejected alternatives with reason codes;
- global and per-decision confidence;
- diagnostics and an immutable inference policy descriptor.

`AxialChainNode` represents one parent interval, its selected child intervals, and
at most one closure interval. `DimensionDecisionTrace` records which evidence and
rules caused a candidate to be selected, rejected, or marked ambiguous.

Only after confirmation are displayed candidates projected into existing
`DimensionIntent` objects and chain nodes projected into existing
`DimensionChain` equations. Existing chain coefficients are calculated from
station orientation; a model never supplies them.

## 6. Inputs and authority

The inference engine accepts typed inputs:

1. geometry-derived axial stations and elementary spans;
2. the current partition snapshot, including functional region ranges;
3. parsed engineering-document facts;
4. optional manual constraints and names;
5. an immutable inference policy ID and version.

Authority is ordered as follows:

1. user-confirmed/manual facts;
2. exact document facts tied to drawing evidence;
3. deterministic geometry and topology;
4. confirmed partition semantics;
5. AI semantic proposals;
6. policy priors.

AI may identify a semantic role or relate a document phrase to an existing station
interval. It may not invent station coordinates, nominal lengths, chain arithmetic,
or tolerance values. All numbers are recomputed and validated locally.

## 7. Inference algorithm

### 7.1 Normalize stations

Collect drawing ends, accepted partition boundaries, section-profile transitions,
and document-backed boundaries. Merge coordinates within the drawing-unit
tolerance while retaining every evidence reference. Reject non-finite coordinates
and report unresolved boundaries instead of approximating them with screen pixels.

Sort stations in a canonical physical axis direction. A reversed DXF axis must
produce an equivalent semantic scheme with remapped station IDs.

### 7.2 Generate bounded candidates

Generate candidates from domain evidence rather than all possible station pairs:

- every adjacent elementary span;
- the exact span of every functional partition;
- explicit document lengths whose endpoints can be resolved;
- composite intervals formed by shared semantic boundaries;
- the overall minimum-to-maximum interval;
- user-required intervals.

This avoids an unbounded all-pairs search and makes every candidate explainable.
Duplicate intervals merge their evidence without losing source provenance.

### 7.3 Score evidence

The engine uses named, versioned scoring features. Initial features include:

- user-required interval;
- exact document endpoint/width match;
- functional region match;
- datum or assembly interface relevance;
- fit, surface, inspection, or process evidence;
- meaningful composite or overall span;
- ordinary anonymous residual span;
- terminal residual position;
- conflict between document, geometry, and partition semantics.

Document and functional evidence dominate policy priors. Terminal position is a
tiebreaker, never a universal rule. Scores, weights, and the resulting explanation
are persisted with the draft. No sample coordinate or expected value may appear in
a scoring feature.

### 7.4 Select a laminar interval family

Engineering axial dimension schemes are modeled as a weighted laminar interval
family: two selected intervals may be disjoint or one may contain the other, but
they may not cross. A deterministic interval dynamic program selects the highest
scoring valid family subject to hard constraints.

This is more precise than constructing an arbitrary graph and deleting a random
cycle edge. The topology graph remains useful for validation, but the primary
selection problem is nested interval selection.

Hard constraints include:

- valid station endpoints;
- no crossing selected intervals;
- required user/document intervals retained unless they conflict, in which case
  confirmation is blocked;
- one overall root per independent axial chain;
- no duplicate displayed interval;
- complete arithmetic coverage for every materialized parent chain.

### 7.5 Choose closure intervals

For each selected parent, selected child intervals partition part of its range.
Uncovered consecutive elementary spans are grouped into residual runs. A valid
parent chain may have at most one residual run designated as its closure.

Closure selection prefers the lowest control-importance residual, considering:

- absence of fit, datum, inspection, tolerance, or explicit display requirements;
- ordinary-shaft/process semantics rather than a functional interface;
- whether the residual is exactly derivable from selected dimensions;
- document conflicts;
- terminal position only as a final prior.

If two closure candidates are too close in score, the engine returns both as
alternatives and marks the chain `needs-review`. Stable ordering may make the UI
deterministic, but it may not silently turn an ambiguous result into a confirmed
decision.

### 7.6 Validate arithmetic and topology

For each chain, geometry must satisfy:

    parent nominal = sum(displayed child nominals) + closure nominal

within a scale-aware numeric tolerance. Validation also checks interval coverage,
orientation-derived coefficients, duplicate equations, crossing intervals, stale
references, and rank consistency. A matrix-rank/cycle check may be used as a
secondary proof that the displayed equations do not overconstrain the station
network.

The golden hierarchy should be explained as:

    28  = 24.5 + closure(3.5)
    105 = 8 + closure(39) + 55 + 3
    173 = 17 + 28 + 105 + closure(23)

The first two closures are expected to be high-confidence because their omitted
spans are ordinary transition/shaft residuals and their functional neighbors are
explicitly controlled. The final 23 conflicts with document evidence and therefore
must carry a visible conflict diagnostic. A production-default policy may require
review even when a separately versioned golden/reference policy ranks the target's
terminal closure first.

## 8. Policy profiles and avoiding overfitting

The engine ships a generic, versioned profile such as
`shaft-hierarchical-dimensioning-v1`. It describes evidence weights, hard
constraints, ambiguity margins, and allowed closure priors. It contains no drawing
name, digest, coordinate, or nominal value.

The golden test may run two assertions:

1. the generic policy produces the correct high-confidence inner chains and exposes
   the 23-width contradiction as a ranked ambiguity;
2. a reviewed enterprise/reference policy that prefers a fully derived terminal
   root closure reproduces the golden display while retaining the contradiction.

This distinction prevents a single customer's drafting convention from becoming a
false industry-wide rule. Policy profiles are data-only, immutable, locally stored,
and selected explicitly by the second-layer plugin.

## 9. Workflow and DSH integration

Inference starts only after the user asks for a dimension chain, an axial dimension
plan, or a dependent annotation workflow that explicitly requires one. Uploading a
DXF or document never starts dimension inference by itself.

The annotation host exposes an explicit operation such as
`drawing_dimension_chain_start`. It receives stable drawing/session references and
uses the current partition snapshot. It does not require silently confirming the
partition; instead it binds the scheme to that exact partition revision. Boundary
changes later mark the scheme stale and require a deterministic rebase or rerun.

The existing dimension-plan persistence owns the draft lifecycle. The client adds:

- a nested chain inspector showing displayed and closure intervals;
- per-edge decision evidence, conflict, confidence, and alternatives;
- canvas preview for displayed spans and a visually distinct muted/dashed closure;
- manual toggles to display, suppress, or choose an alternative interval;
- the shared cancel, before/after preview, confirm, undo, and redo workflow;
- a `尺寸链` visibility entry in the shared top-right layer controls.

Confirmation stores the nominal scheme and projects existing dimension intents and
chains. It does not invent tolerances and does not automatically generate unrelated
radius, diameter, or arc annotations. Final DXF dimension placement remains a later
consumer of the confirmed scheme.

## 10. Persistence and invalidation

The stored draft includes drawing revision, partition revision, policy ID/version,
canonical input digest, decision traces, alternatives, and diagnostics. Durable
save occurs before publication to memory or UI.

The scheme becomes stale when:

- a referenced geometry entity is deleted or replaced;
- an axial station moves outside normalization tolerance;
- partition boundaries or semantics change;
- document facts used as evidence change;
- the selected policy version changes.

Rebase is allowed only when old station references map uniquely to new stations.
Otherwise the affected decisions remain visible but unresolved. Confirmation is
blocked until all required references and conflicts are resolved.

## 11. Diagnostics

Required diagnostics include:

- `DIMENSION_STATION_UNRESOLVED`
- `DIMENSION_STATION_CONFLICT`
- `DIMENSION_CANDIDATE_CROSSES_SELECTED`
- `DIMENSION_REQUIRED_INTERVAL_CONFLICT`
- `DIMENSION_CLOSURE_MISSING`
- `DIMENSION_CLOSURE_AMBIGUOUS`
- `DIMENSION_CHAIN_ARITHMETIC_MISMATCH`
- `DIMENSION_DOCUMENT_DISPLAY_CONFLICT`
- `DIMENSION_SCHEME_PARTITION_STALE`
- `DIMENSION_POLICY_VERSION_MISMATCH`

Diagnostics carry stable entity IDs, evidence references, severity, and a concise
user-facing explanation. They never expose model chain-of-thought.

## 12. Verification strategy

Implementation is test-driven in layers.

### 12.1 Golden integrity tests

- parse the clean and target DXFs and prove the clean geometry is preserved;
- extract target axial dimensions into the reviewed semantic manifest;
- verify the target fixture and manifest digests deliberately when either changes;
- ensure production packages never import the target DXF or expected manifest.

### 12.2 Domain tests

- recover the golden station set from geometry and confirmed partitions;
- generate only evidence-bounded candidates;
- select the expected laminar displayed intervals;
- infer closures 3.5 and 39 with high confidence;
- rank 23 as the golden root closure while retaining the document conflict;
- calculate chain equations and coefficients locally;
- return alternatives for genuinely ambiguous residuals;
- reject crossing, incomplete, stale, and arithmetically invalid schemes;
- preserve semantic results under entity reordering, drawing translation, view
  scaling, and reversed axis direction;
- prove missing tolerances do not block nominal inference;
- scan runtime inference and policy sources for golden-only coordinates, values,
  filenames, and digests.

### 12.3 Adapter and workflow tests

- explicit user intent gates the DSH tool;
- document upload alone does not start inference;
- AI proposals cannot supply numeric coordinates or coefficients;
- persistence is atomic and revision-bound;
- partition edits invalidate or rebase the scheme correctly;
- preview, manual alternative selection, cancel, confirm, undo, and redo preserve
  the expected draft state;
- confirmation projects deterministic `DimensionIntent` and `DimensionChain`
  records without creating unrelated annotations;
- layer visibility hides only the dimension-chain overlay.

### 12.4 End-to-end acceptance

Run the actual local host and client against the golden initial DXF and engineering
document. The preview must match the target's nominal axial interval set under the
reviewed reference policy, explain all three omitted spans, and show the 23-width
document conflict. A visual snapshot supplements but does not replace semantic
assertions.

## 13. Delivery sequence

1. consolidate and validate the golden fixture and manifest;
2. implement axial topology and evidence contracts;
3. implement bounded candidate generation;
4. implement laminar selection, closure ranking, and arithmetic validation;
5. project confirmed schemes into existing intent/chain contracts;
6. add host persistence and the explicit DSH operation;
7. add inspector, canvas preview, editing, and shared controls;
8. run golden semantic comparison, package regression, and local DSH verification;
9. open one feature PR and merge it after all checks pass, following the repository
   workflow agreed with the user.

## 14. Acceptance criteria

The feature is complete when:

- the golden target is reproduced semantically without runtime sample constants;
- every displayed and omitted interval has a deterministic explanation;
- the 23-width document/target disagreement remains visible;
- generic policy behavior is separated from reference drafting convention;
- no tolerance value is fabricated;
- no document upload triggers the workflow automatically;
- confirmed output uses the existing engineering data contracts;
- all unit, integration, golden, regression, and local DSH checks pass.
