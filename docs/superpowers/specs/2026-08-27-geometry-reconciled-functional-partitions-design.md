# Geometry-Reconciled Functional Partitions Design

## Problem

The migrated partition engine treats a document interval as the visible functional
range even when that interval conflicts with strong DXF geometry. In the shaft
fixture, `G01 center_z=91 width=55` becomes `63.5–118.5`, while the actual 55 mm
gear profile is bounded by accepted shoulders at `92–147`. The document group is
therefore attached to unrelated physical segments and the visual reviewer is then
allowed to misclassify the real gear as another spline.

The current regression test encodes the raw document interval as the expected
answer, so it validates the defect rather than the engineering reference.

## Accepted Sample Result

The real DXF, engineering document, and supplied engineering reference image form
one acceptance oracle. Functional view must show:

- 左轴承位: `0–17`, document-backed;
- 外花键: `17–41.5`, document-backed;
- 常规区域: `41.5–92`, inferred after visual review abstains and recorded as
  fused geometry/document evidence;
- 一级齿轮: `92–147`, document semantics reconciled to geometry;
- 右轴承位: `150–173`, document-backed.

The transition at `147–150` remains unclassified. Physical axial segments remain
continuous and independently editable.

## Reconciliation Model

Document values are constraints, not unconditional display coordinates. For each
document region, the deterministic matcher scores every contiguous sequence of
accepted geometric segments using:

1. exact or near-exact width agreement;
2. endpoint alignment to accepted shoulders;
3. outer-diameter agreement;
4. center agreement as a weaker tie-breaker.

When geometry supplies a high-confidence candidate whose width and diameter agree
with the document but whose center conflicts with the raw interval, the semantic
group uses the matched geometric boundaries and records a
`DOCUMENT_REGION_RECONCILED` warning. When no strong geometric candidate exists,
the source interval is preserved and the existing unmatched/ambiguous diagnostics
remain available for manual review.

This restores the old Web architecture: the model or document identifies semantic
intent, while local geometry owns coordinates. The model never writes coordinates.

## Inferred Regular Region

`常规区域` is a supported deterministic display region, not a generic AI escape
label. The visual reviewer first receives every unclassified segment. If it
abstains, a run bounded by trusted document regions and accepted geometric steps
may be emitted as `regular-shaft` when it spans at least 5% of the shaft axis. It
is named `常规区域`, cites fused geometry/document evidence, and remains
distinguishable from document and AI regions. The final short transition before
the right bearing remains empty.

The visual AI reviewer continues to reject generic region proposals; it cannot
invent `常规区域` or overwrite reconciled document groups.

## Verification

- A real-fixture integration test asserts the five exact names and ranges above.
- A reconciliation regression asserts the gear maps to `92–147` and emits the
  conflict diagnostic rather than occupying `63.5–118.5`.
- Semantic-review tests assert reconciled regions appear only as read-only visual
  context, while every still-unclassified segment remains eligible for review.
- The real local end-to-end script imports the actual DXF and document, applies a
  captured bounded visual review, and compares the final functional bands to the
  same five-region oracle.
- The full repository test suite and production build must pass before handoff.
