# Datum and Geometric Tolerance Foundation

**Date:** 2026-08-29  
**Status:** Approved in chat; pending written-spec review  
**Scope:** VectorAI engineering-annotation plugin (second layer)

## 1. Objective

Add a durable semantic foundation for engineering datums and geometric dimensioning and tolerancing (GD&T). The first delivery must support AI-recommended controlled features, datum systems, and geometric characteristic types; future deterministic algorithms will calculate tolerance values. Users can review and override calculated values without destroying the calculated result.

The golden drawing remains an output oracle. It must never become a production input or an identity-based special case.

## 2. Scope

The first delivery includes:

- versioned datum and GD&T data contracts;
- persistence in engineering annotation drafts and revisions;
- validation, stale detection, and edit operations;
- a versioned tolerance-calculation provider boundary;
- second-layer preview rendering and editing;
- AI tools that recommend feature and characteristic identities only;
- user override and restore-to-calculated-value behavior;
- golden-oracle and generalization tests.

The first delivery does not include:

- production tolerance formulas or standards tables;
- AI-generated tolerance numbers;
- inference of manufacturing capability;
- automatic selection between ISO GPS and ASME Y14.5 rules;
- DXF export of feature-control frames unless the existing exporter can represent them without loss.

## 3. Ownership and package boundaries

`@vectorai/engineering-annotation` owns engineering meaning. A focused `src/gdt/` module defines types, validation, edit operations, effective-value resolution, stale handling, and the future calculation-provider interface.

The DSH annotation host owns session workflow, version persistence, tool registration, and AI-to-local handoff. AI output contains stable geometry identifiers and semantic recommendations, not coordinates or tolerance values.

The DSH annotation client owns the datum marker, feature-control-frame overlay, inspector, visibility controls, and preview/confirm interaction.

The first-layer drawing space owns geometry, anchors, coordinate conversion, selection, and generic extension rendering. GD&T policy and calculation remain in the second layer.

## 4. Semantic model

The existing `EngineeringDatum` remains the datum-feature record and gains only fields that are necessary for GD&T use. Datum labels are stable identifiers such as A, B, and C; display order is not inferred from array position.

```ts
interface EngineeringDatum {
  id: string;
  drawingRef: DrawingRef;
  name: string;
  geometryId: GeometryId;
  anchor: EntityAnchor;
  role: 'primary' | 'secondary' | 'tertiary' | 'origin';
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: 'candidate' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
}
```

GD&T is modeled separately from dimensional tolerance because a feature-control frame constrains geometry rather than upper and lower size limits.

```ts
type GeometricCharacteristic =
  | 'straightness' | 'flatness' | 'circularity' | 'cylindricity'
  | 'profile-line' | 'profile-surface'
  | 'parallelism' | 'perpendicularity' | 'angularity'
  | 'position' | 'coaxiality' | 'symmetry'
  | 'circular-runout' | 'total-runout';

type MaterialCondition = 'rfs' | 'mmc' | 'lmc';

interface DatumReference {
  datumId: string;
  materialCondition?: MaterialCondition;
}

interface ComputedGeometricTolerance {
  status: 'pending' | 'resolved' | 'conflict' | 'stale';
  value?: number;
  unit: 'mm';
  ruleRef?: { id: string; version: string };
  inputDigest?: string;
  diagnostics: EngineeringDiagnostic[];
}

interface GeometricToleranceOverride {
  value: number;
}

interface GeometricToleranceIntent {
  id: string;
  drawingRef: DrawingRef;
  characteristic: GeometricCharacteristic;
  controlledTargets: DimensionTarget[];
  toleranceZone: {
    shape: 'linear' | 'diametrical' | 'spherical';
    materialCondition?: MaterialCondition;
    projectedZoneLength?: number;
  };
  datumReferenceFrame: DatumReference[];
  computed: ComputedGeometricTolerance;
  override?: GeometricToleranceOverride;
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: 'candidate' | 'pending-calculation' | 'resolved' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
}
```

`EngineeringAnnotationDraft` and `EngineeringAnnotationRevision` gain a `geometricTolerances` collection. Schema versioning and migration are required so existing persisted revisions remain readable.

The effective tolerance value is always:

```ts
effectiveValue = intent.override?.value ?? intent.computed.value
```

Recalculation updates `computed` only. It never removes or changes `override`. Removing the override restores the current calculated value.

## 5. Recommendation and calculation flow

1. The user requests datum/GD&T annotation for an active drawing.
2. The AI recommends controlled geometry IDs, datum geometry IDs, datum roles, and a geometric characteristic.
3. The host validates all IDs against the active drawing and grounds display anchors locally.
4. A deterministic provider is asked to calculate the tolerance. Until a provider exists, calculation remains `pending` and no numeric result is invented.
5. The second-layer UI previews datum markers and feature-control frames. The inspector permits target, datum order, characteristic, zone modifiers, and value override edits.
6. Confirming creates a revision. Canceling discards the draft.
7. A later calculation refresh updates only `computed`; an existing override remains effective.

AI is never authoritative for coordinates, arithmetic, standard selection, or tolerance values.

## 6. Calculation provider boundary

The provider interface is versioned so formulas and standards can be added later without changing persisted intent records.

```ts
interface GeometricToleranceRuleProvider {
  listRules(): GeometricToleranceRuleDescriptor[];
  evaluate(request: GeometricToleranceRuleRequest): GeometricToleranceRuleResult;
}
```

Requests contain normalized feature facts, units, datum references, rule identity, and explicit inputs. Results contain a numeric value, unit, rule/version identity, canonical input digest, and diagnostics. A provider failure produces `conflict`; it does not fall back to AI-generated data.

## 7. Validation and lifecycle rules

- Datum names must be unique within the active revision.
- Every datum and controlled target must resolve to visible drawing geometry.
- Datum references must exist and must not repeat within one frame.
- Calculated and override values, when present, must be finite and greater than zero.
- Form controls (straightness, flatness, circularity, cylindricity) may omit datum references.
- Orientation, location, and runout controls that require a datum remain candidates when the reference frame is incomplete.
- A missing or incompatible target produces `conflict`; deleted or materially changed geometry produces `stale`.
- If calculation inputs change, `computed` becomes stale. An override is retained but the UI requires review.
- A candidate cannot become confirmed without a valid effective value.

## 8. Presentation and editing

The second-layer overlay renders datum feature symbols and feature-control frames using non-scaling strokes and screen-stable text. The right-top layer manager gains independent datum and GD&T visibility controls.

Selection opens an inspector for:

- characteristic type;
- controlled feature;
- tolerance-zone shape and modifiers;
- ordered datum reference frame;
- calculated value and calculation status;
- optional user override;
- restore-to-calculated-value action.

The existing cancel/preview/confirm toolbar is reused. Editing presentation position must not mutate semantic values or geometry associations.

## 9. Golden oracle without production coupling

The annotated golden DXF is a black-box expected output, not an algorithm input. The following constraints are mandatory:

- production packages cannot import golden fixtures or test-support modules;
- production source cannot branch on drawing ID, file name, fixture hash, fixed golden coordinates, or expected annotation values;
- expected GD&T frames and datum identities live only in test fixtures;
- output comparison is semantic: characteristic, controlled feature, effective value, datum order, and modifiers;
- presentation positions use bounded layout tolerances rather than exact pixels;
- translated, scaled, mirrored, and entity-order-shuffled variants must produce equivalent semantic output;
- at least one non-golden shaft drawing must exercise each supported characteristic family;
- mutation tests must change golden dimensions and ensure calculated results change from geometry/rules rather than remain fixed;
- a production-source guard rejects fixture identities and known golden constants, but this guard supplements rather than replaces generalization tests.

Passing the golden oracle proves compatibility with the target drawing. Passing the transformed and non-golden suites provides evidence that the implementation is rule-driven.

In this foundation delivery, the golden oracle verifies that supplied datum/GD&T semantics and supplied calculation results round-trip, validate, and render correctly. It does not claim that tolerance values were inferred. Automatic-value comparison becomes an acceptance criterion only after a production rule provider is implemented; a test-only table of golden answers must not masquerade as that provider.

## 10. Error handling

Invalid AI recommendations are rejected with stable diagnostic codes and remain visible for correction. Missing calculation rules produce `pending-calculation`, not failure. Provider exceptions, unit mismatches, invalid values, and incompatible datum references produce `conflict`. Stale geometry never silently rebinds to a nearby feature.

## 11. Verification strategy

- contract round-trip and migration tests;
- datum uniqueness and reference-frame validation tests;
- effective-value precedence and restore tests;
- recalculation-preserves-override tests;
- stale and conflict transition tests;
- AI recommendation grounding tests using geometry IDs only;
- overlay interaction tests for edit, preview, confirm, and layer visibility;
- golden semantic-oracle comparison;
- transform/metamorphic tests and non-golden fixture tests;
- source-boundary guard against runtime fixture coupling.

## 12. Delivery sequence

1. Add versioned contracts, migration, validation, and edit functions.
2. Add host persistence and candidate workflow with a pending calculation adapter.
3. Add second-layer overlay, inspector, and layer controls.
4. Add AI recommendation tools with strict geometry-ID grounding.
5. Add golden semantic oracle and generalization guards.
6. Integrate deterministic tolerance providers in a later feature without changing the contract.
