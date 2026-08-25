# Tolerance and Dimension-Chain Data Architecture

Status: Proposed for review

Date: 2026-08-25

Scope: data-layer foundation for tolerance-aware automatic engineering annotation

## 1. Objective

Extend the two-layer architecture so the Engineering Annotation plugin can later
apply user-supplied tolerance formulas, reason about dimension chains, and generate
dimensions in dependency order. This milestone establishes contracts, validation,
persistence, projection, and ordering. It does not ship production formulas or
automatic placement of every dimension.

## 2. Architectural decision

The first layer stores portable confirmed annotation results. The second layer
stores engineering intent, rule inputs, dimension-chain structure, calculation
provenance, and draft workflow state.

    first-layer geometry and topology
                  |
                  v
    second-layer intents and dependency graph
                  |
                  v
       pluggable tolerance rule provider
                  |
                  v
         ordered annotation plan
                  |
           preview and confirm
                  |
                  v
    first-layer DimensionAnnotation projection

Keeping everything in the second layer would hide confirmed tolerances from generic
viewers and exporters. Keeping formulas and chains in the first layer would couple
the general 2D platform to one engineering domain.

## 3. First-layer portable contracts

drawing-core continues to own DimensionAnnotation. Its existing upper/lower
tolerance remains readable for backward compatibility. New documents may carry a
structured ToleranceProjection with:

- display mode: none, bilateral, unilateral, limits, or fit;
- upper/lower deviations or upper/lower limits;
- optional fit designation;
- unit and candidate/resolved/confirmed/conflict status;
- source: document, standard, enterprise rule, manual, or AI candidate;
- optional immutable rule ID, rule version, and input digest;
- evidence references.

DimensionAnnotation also gains optional datum references, engineering intent ID,
engineering chain IDs, and deterministic generation order.

These fields describe a resolved display result and provenance. They never contain
executable formulas, chain equations, AI prompts, or mutable workflow state.

Portable validation requires finite numbers, ordered limits, evidence for confirmed
results, bounded fit designations, immutable rule references, and stable geometry
anchors for datum references.

## 4. Second-layer engineering domain

engineering-annotation owns the authoritative planning model.

### 4.1 DimensionIntent

A DimensionIntent records:

- stable ID and DrawingRef;
- dimension kind, targets, datum IDs, nominal value, and unit;
- functional role: datum, overall, functional, assembly, process, inspection,
  auxiliary, or closure;
- source: document, geometry, manual, or AI candidate;
- candidate/resolved/confirmed/conflict status and evidence.

AI may propose intent and functional role, but only deterministic validation or a
user action can promote an AI candidate to confirmed state.

### 4.2 ToleranceSpec

A ToleranceSpec records:

- stable ID and referenced DimensionIntent ID;
- bilateral, unilateral, limits, fit, or formula mode;
- source and candidate/resolved/confirmed/conflict status;
- optional immutable rule ID and rule version;
- typed rule inputs;
- resolved deviations, limits, or fit designation;
- canonical input digest and evaluation time;
- evidence and diagnostics.

The system stores rule identity, version, inputs, input digest, and resolved result.
It never stores executable source code in the Drawing or workflow document.

### 4.3 EngineeringDatum

An EngineeringDatum records a stable name, geometry anchor, primary/secondary/
tertiary/origin role, source, status, and evidence. Datums are explicit entities,
not implied array positions. Changing referenced geometry invalidates the datum and
every dependent intent.

### 4.4 DimensionChain

A DimensionChain records:

- stable ID, DrawingRef, optional name, and datum IDs;
- member intent IDs;
- coefficient 1 or -1 for each member;
- functional, component, or closure member role;
- closure intent ID and optional target;
- worst-case, statistical, or reference-only analysis mode;
- status, evidence, and diagnostics.

Chain equations reference stable intent IDs and never duplicate nominal values or
tolerances.

## 5. Tolerance rule provider

Formulas are supplied later through a host-neutral ToleranceRuleProvider owned by
engineering-annotation. A rule descriptor exposes an ID, immutable version, input
schema, and supported output modes. Evaluation receives rule identity, nominal
value, unit, and typed inputs, and returns a structured tolerance result.

The first provider is synchronous and deterministic. The same rule version and
canonical input digest must always produce the same result. A provider cannot read
ambient DSH state, call a model, mutate a Drawing, or access the network.

No production formula is included in this milestone. Tests use an explicitly
non-production fixture provider.

## 6. Dependency graph and generation order

Annotation order is a directed acyclic graph, not array position. An edge records
beforeIntentId, afterIntentId, evidence, and one reason:

- datum-before-dependent;
- overall-before-functional;
- functional-before-component;
- component-before-closure;
- explicit-document-order.

The deterministic default rank is:

1. datum establishment;
2. overall dimensions;
3. functional and assembly dimensions;
4. process and inspection dimensions;
5. component dimensions;
6. closure dimensions;
7. auxiliary dimensions such as chamfers and fillets.

Within a rank, stable geometry order and intent ID break ties. A topological sort
produces generationOrder. Cycles are never silently broken; they create a
DIMENSION_DEPENDENCY_CYCLE diagnostic and block confirmation.

## 7. Draft, projection, and confirmation

The second layer builds an EngineeringAnnotationDraft containing datums, intents,
tolerance specs, chains, dependency edges, diagnostics, and an ordered preview.

Confirmation:

1. validates Drawing revision, targets, and datums;
2. verifies the dependency graph is acyclic;
3. verifies required tolerance rules resolved successfully;
4. validates every dimension chain;
5. projects ordered results into first-layer DimensionAnnotation nodes;
6. commits the annotation batch atomically;
7. persists the confirmed second-layer revision and provenance.

Preview is non-destructive. Cancel restores the latest confirmed plan. Undo after
confirmation returns to an editable draft, matching the partition workflow.

## 8. Persistence and invalidation

Second-layer state is a revision-bound sidecar keyed by Drawing ID and revision. It
uses the same durable-envelope rules as shaft partition sessions:

- durable save before memory publication;
- independent latest-confirmed baseline;
- parent revision IDs;
- explicit rebase after Drawing revision changes;
- retained rule ID, version, and input digest.

Geometry deletion or replacement marks affected datums, intents, tolerance specs,
and chains stale. Invalid references remain visible and must be repaired or removed
before confirmation.

## 9. Package boundaries

- drawing-core: portable ToleranceProjection and datum references.
- plugin-space-contracts: wire schemas for portable and second-layer projections.
- engineering-annotation: intents, datums, chains, rule interface, ordering,
  validation, projection, and lifecycle-independent domain services.
- plugin-dsh-annotation-host: DSH tools, sessions, persistence adapters, and AI
  reviewer orchestration only.
- plugin-dsh-annotation-client: ordered list, datum/chain inspection, tolerance
  status, conflicts, preview, cancel, and confirm.

The UI formats tolerances but never calculates them or determines order. DSH
adapters never contain formulas or dimension-chain logic.

## 10. Compatibility and export

Legacy upper/lower tolerance data remains valid and normalizes to a manual portable
projection without invented rule provenance.

DXF export consumes only the first-layer projection and never reruns formulas.
Unsupported rich semantics degrade to stable display text while canonical data
retains provenance. Other plugins can render or export confirmed annotations
without installing the Engineering Annotation plugin.

## 11. Errors

Required diagnostics include:

- TOLERANCE_RULE_UNKNOWN
- TOLERANCE_RULE_VERSION_MISMATCH
- TOLERANCE_INPUT_INVALID
- TOLERANCE_RESULT_INVALID
- DIMENSION_DATUM_STALE
- DIMENSION_TARGET_STALE
- DIMENSION_CHAIN_INCOMPLETE
- DIMENSION_CHAIN_CONFLICT
- DIMENSION_DEPENDENCY_CYCLE
- ANNOTATION_PLAN_DRAWING_STALE

Formula errors never fall back to AI-generated numeric tolerances. An unresolved
required tolerance blocks confirmation but remains editable.

## 12. Verification

The implementation must test:

- schema round trips and legacy upper/lower compatibility;
- finite-number and limit-order validation;
- deterministic rule versions and input digests;
- unknown-rule and invalid-result rejection;
- chain equation and coefficient validation;
- stable topological ordering and explicit cycle rejection;
- stale datum/geometry propagation;
- confirmed projection into portable annotations;
- atomic persistence failures;
- confirm, cancel, undo, redo, and rebase;
- DXF bilateral, unilateral, limits, and fit rendering;
- dependency boundaries keeping formulas outside DSH and UI packages.

## 13. Non-goals

This milestone does not ship production tolerance formulas, infer formal tolerance
numbers from a language model, implement statistical process capability, solve
arbitrary nonlinear tolerance networks, optimize final label placement, or add any
VectorAI cloud or Express service.
