# Tolerance and Fit Selection Popup

**Date:** 2026-08-31  
**Status:** Approved in chat; pending written-spec review  
**Scope:** VectorAI engineering-annotation plugin (second layer)

## 1. Objective

Add a local, standards-driven tolerance and fit selector to the engineering drawing
canvas. A user can select a linear feature-of-size dimension, inspect applicable
tolerance bands, preview a choice on the drawing, and apply it without leaving the
canvas or resizing the drawing workspace.

The first supported standard is GB/T 1800.1/2-2020. It is represented by a
versioned provider so later ISO editions, enterprise standards, or other national
standards can be added without changing annotation workflow or persisted records.

AI may recommend functional intent and candidate tolerance designations. It is
never authoritative for numeric deviations. All upper and lower deviations,
limit sizes, and fit results are resolved locally by a deterministic standard
provider.

## 2. Standards scope

The selector applies to linear features of size supported by the ISO 286 code
system and GB/T 1800:

- cylindrical internal and external sizes, including hole and shaft diameters;
- two parallel opposite surfaces, including slot width, key thickness, part
  thickness, and qualifying step widths;
- compatible internal/external pairs that form a fit.

The UI uses the labels `孔/内部尺寸` and `轴/外部尺寸` so the traditional
hole/shaft terminology does not incorrectly imply that only diameters are valid.

The selector does not assign radius, angle, surface texture, geometric tolerance,
or arbitrary location/centre-distance tolerances. When a selected annotation is
not a supported linear feature of size, the popup explains why and offers the
existing manual upper/lower-deviation editor. If that editor does not support the
target annotation kind, the popup presents the target as unsupported and performs
no edit.

References:

- GB/T 1800.1-2020, Product geometrical specifications (GPS) — ISO code system
  for tolerances on linear sizes — Part 1.
- GB/T 1800.2-2020, standard tolerance classes and limit deviations for holes and
  shafts.
- ISO 286-1:2010 and ISO 286-2:2010, whose scope covers cylinders and two parallel
  opposite surfaces.

## 3. Architectural placement

The feature remains entirely in the second-layer engineering annotation plugin.
It reuses first-layer dimension selection, stable annotation IDs, canvas
coordinate conversion, undo/redo, and generic extension rendering.

Package responsibilities are:

- `@vectorai/engineering-annotation`: standard-provider interface, feature-of-size
  classification, tolerance and fit assignments, deterministic calculation,
  validation, recommendation candidate normalization, and edit operations;
- DSH annotation host: popup session lifecycle, persistence adapters, tool
  registration, drawing-revision validation, and AI recommendation handoff;
- DSH annotation client: popup window, table navigation, result inspection,
  drawing preview, context-menu integration, and interaction isolation;
- first-layer portable contracts: confirmed `ToleranceProjection` values and
  provenance needed by generic renderers and DXF export.

The UI never calculates deviations. The DSH adapter never contains standards
tables or formula policy. The first layer never owns recommendation rules or popup
workflow state.

## 4. Interaction model

### 4.1 Entry points

The primary entry is `设置公差` in the context menu of a supported dimension.
Double-clicking an existing tolerance designation opens the same editor. A
`公差与配合` icon in the existing left activity bar reopens the most recently used
popup when a dimension is selected.

No popup opens merely because a drawing or document was imported. The feature is
activated only by an explicit user action or an active annotation task that has
already routed to the second-layer plugin.

### 4.2 Popup window behavior

The selector is a single-instance, non-modal popup window rendered above the
drawing canvas. It does not push, resize, or reflow the drawing or chat regions.

- Initial position is near the selected annotation, adjusted to avoid covering it.
- Once dragged, the popup is fixed in viewport coordinates and does not follow
  canvas pan or zoom.
- The title bar is the only window-drag handle.
- The window opens at 760 by 520 CSS pixels, is resizable down to 560 by 380 CSS
  pixels, and cannot exceed 80% of the drawing viewport.
- The popup is opaque and prevents pointer and wheel events from reaching the
  canvas.
- Position, size, active tab, table zoom, and standard edition are restored for
  the next use.
- Clicking outside does not close it. `Escape` or the close button closes it.
- If a preview is dirty, closing requests an explicit apply or discard decision.

The single instance supports repetitive work. After applying one dimension, the
popup remains open and selecting another dimension replaces its current target.

### 4.3 Popup layout

The header shows the selected dimension, inferred feature class, source/status,
and active standard. The main navigation contains:

- 推荐;
- 轴/外部尺寸;
- 孔/内部尺寸;
- 基孔配合;
- 基轴配合.

The main body contains a searchable, pannable, and zoomable tolerance-band table
and a result inspector. Direct search accepts designations such as `H7`, `u6`, or
`H7/g6`.

The result inspector shows:

- designation and standard reference;
- basic size;
- upper and lower deviations;
- upper and lower limit sizes;
- tolerance magnitude;
- for a pair, minimum and maximum clearance or interference and the resulting fit
  class.

The footer contains `恢复自动推荐`, `取消`, and `应用`. Restore returns to the
current rule-based recommendation; it does not erase the tolerance.

### 4.4 Table presentation

The provider, not the UI, classifies entries as preferred, common, other, or
unavailable for the current size range. Presentation uses:

- preferred: red outline and a textual `优选` marker;
- common: blue outline;
- other valid: neutral styling;
- current selection: high-contrast cyan fill;
- unavailable: reduced opacity with an explanation on hover.

Hover updates only the inspector. A click creates a drawing preview. Keyboard
arrows navigate available cells, Enter previews the focused cell, Command+Enter
applies on macOS, Control+Enter applies on Windows/Linux, and Escape cancels the
current preview before closing a clean popup.

## 5. User flows

### 5.1 Single dimension

1. The user selects a dimension and opens `设置公差`.
2. Local geometry classification supplies internal/external/unsupported status.
3. The popup loads the basic size and applicable tolerance bands.
4. A deterministic rule may focus a recommended band; otherwise nothing is
   preselected.
5. Clicking a band creates a temporary preview on the drawing.
6. Applying commits only the current dimension as one undoable edit.

If the user selects another dimension while the current preview is dirty, an
inline decision appears: `放弃并切换` or `应用并切换`. There is no implicit
commit and no system modal dialog.

### 5.2 Fit pair

1. The user opens a basic-hole or basic-shaft tab with one dimension active.
2. The canvas enters a temporary `选择配合对象` state.
3. The user selects a second dimension.
4. Local validation requires complementary internal/external classes and equal
   basic sizes.
5. Selecting a fit designation previews both dimensions and the computed fit
   range.
6. Apply writes both assignments plus one `fitGroupId` in an atomic undo entry.

If the pair is incompatible, the popup shows the actual feature classes and sizes
and does not produce a result.

### 5.3 AI-assisted automatic annotation

AI or semantic rules may propose a functional intent such as sliding, locating,
press, or interference fit, plus one or more candidate designations and evidence.
The proposal is normalized and validated locally. The standard provider resolves
all numeric results.

When evidence is sufficient, the candidate is shown as a recommendation preview.
When evidence or confidence is insufficient, the dimension is `待选择`; the table
opens without a preselected band. No model output can bypass provider validation
or become a confirmed numeric tolerance directly.

## 6. Domain model

The existing `ToleranceSpec` and portable `ToleranceProjection` remain the base
contracts. A standard-backed assignment adds the fields necessary for exact
recalculation and traceability:

```ts
interface ToleranceAssignment {
  dimensionId: string;
  featureClass: 'internal' | 'external';
  basicSize: number;
  unit: 'mm';
  selection: {
    designation: string;
    source: 'rule' | 'ai-recommended' | 'manual';
    evidenceRefs: string[];
  };
  resolved: {
    upperDeviation: number;
    lowerDeviation: number;
    upperLimitSize: number;
    lowerLimitSize: number;
    standardRef: { id: 'GB/T 1800'; edition: '2020' };
    ruleRef: { id: string; version: string; inputDigest: string };
  };
  override?: {
    upperDeviation: number;
    lowerDeviation: number;
  };
}
```

A paired fit is explicit rather than inferred from adjacent array entries:

```ts
interface FitAssignment {
  fitGroupId: string;
  holeDimensionId: string;
  shaftDimensionId: string;
  basis: 'hole' | 'shaft';
  designation: string;
  fitType: 'clearance' | 'transition' | 'interference';
  minimumClearance: number;
  maximumClearance: number;
  standardRef: { id: string; edition: string };
}
```

`selection.source` records how the designation was chosen, while `resolved`
records how its numeric result was calculated. An override never overwrites the
calculated result, so `恢复标准值` can remove the override without recalculation.
Every standard-backed numeric result carries immutable standard/rule identity and
an input digest.

## 7. Standard-provider boundary

```ts
interface ToleranceStandardProvider {
  readonly standardId: string;
  readonly edition: string;

  listBands(request: ListToleranceBandsRequest): ToleranceBand[];
  resolveBand(request: ResolveToleranceBandRequest): ResolvedTolerance;
  resolveFit(request: ResolveFitRequest): ResolvedFit;
}
```

The provider is synchronous, deterministic, local, and side-effect free. It may
not read ambient DSH state, mutate a drawing, call a model, or access the network.
The same provider edition and canonical request digest must produce the same
result.

Provider registration is extensible. A drawing records the provider edition used
to resolve each confirmed result; opening a drawing with a newer provider does not
silently rewrite existing tolerances.

Each provider ships an offline dataset manifest containing its standard ID,
edition, supported nominal-size intervals, normalized-data checksum, and source
references. Production datasets are generated from the named standard and are
independently checked against published standard values. Golden drawings, fixture
outputs, and inferred sample constants are forbidden provider inputs.

## 8. Recalculation and editing rules

- Changing a basic size preserves a standard designation and re-resolves it for
  the new nominal-size interval.
- A designation invalid in the new interval becomes unresolved and blocks
  confirmation; old numeric values are not retained as if current.
- Direct editing of deviations creates a manual override while retaining the
  original designation, calculated result, and provenance.
- `恢复标准值` removes the override and exposes the current provider result.
- Moving annotation graphics changes layout only.
- Editing a dimension chain must not remove its tolerances, datums, GD&T, opening
  angles, or diameter annotations.
- Changing either member of a fit makes the pair stale and triggers deterministic
  recomputation. Incompatible pairs require user correction.

## 9. Preview, persistence, and undo

Preview state is held in the popup session and references the current drawing
revision and stable dimension IDs. It is not published as a confirmed engineering
annotation revision.

Apply validates drawing revision, target existence, provider identity, result
finiteness, limit ordering, and pair compatibility. It then persists the
second-layer assignment and projects the confirmed portable result atomically.

Cancel discards only the popup preview. A single undo reverts one single-dimension
application or the complete paired-fit application. Redo restores the same
standard and provenance, without rerunning AI.

## 10. Rendering and CAD export

The drawing renderer can display the confirmed result as:

- deviations only;
- designation only;
- designation plus deviations.

This is a presentation choice. The canonical assignment always retains all
resolved fields.

DXF export consumes confirmed portable tolerance data. When the target DXF version
supports it, export uses native dimension tolerance fields and DIMSTYLE-compatible
settings rather than exploded display text. Any compatibility fallback must keep
the canonical designation, deviations, and standard reference in stable extension
data. Export never reruns recommendation or standard selection.

## 11. Error handling

Required stable diagnostics include:

- `TOLERANCE_FEATURE_UNSUPPORTED`;
- `TOLERANCE_FEATURE_CLASS_AMBIGUOUS`;
- `TOLERANCE_STANDARD_UNAVAILABLE`;
- `TOLERANCE_DESIGNATION_INVALID`;
- `TOLERANCE_SIZE_RANGE_UNSUPPORTED`;
- `TOLERANCE_RESULT_INVALID`;
- `TOLERANCE_TARGET_STALE`;
- `FIT_PAIR_CLASS_INCOMPATIBLE`;
- `FIT_PAIR_BASIC_SIZE_MISMATCH`;
- `FIT_PAIR_STALE`.

Provider failure or missing data blocks application. There is no AI numeric
fallback. Ambiguous feature class is resolved by an explicit internal/external
choice in the popup.

## 12. Verification

Implementation must verify:

- standard-provider determinism and edition identity;
- representative cylinder, slot-width, key-thickness, and part-thickness cases;
- size-interval boundaries and unavailable designations;
- upper/lower deviation and limit-size arithmetic;
- clearance, transition, and interference fit classification;
- rejection of incompatible or unequal-size fit pairs;
- no AI numeric authority and no network access in providers;
- popup pointer/wheel isolation from canvas interactions;
- viewport-stable popup behavior during canvas pan and zoom;
- preview, apply, cancel, close-with-dirty-state, undo, and redo;
- single-instance target switching and dirty-switch decisions;
- base-size recalculation and manual-override restoration;
- preservation of unrelated annotation families during edits;
- portable projection and native DXF tolerance round-trip;
- source guards preventing golden drawing IDs, hashes, coordinates, names, or
  expected tolerance values from entering production packages.

Golden drawings may validate output semantics and presentation compatibility only.
Transformed and non-golden fixtures must prove that selection and calculation are
standard-driven.

## 13. First-release acceptance criteria

- The popup edits hole diameter, shaft diameter, slot width, key thickness, and
  other supported two-opposite-surface dimensions.
- Search and table selection resolve exact GB/T 1800.1/2-2020 values offline.
- A single edit never changes unrelated dimensions or annotation families.
- A valid internal/external pair can be applied and undone atomically.
- Popup size and position remain stable while the drawing pans or zooms.
- A confirmed tolerance survives session restart and DXF export.
- Unsupported, ambiguous, stale, and low-confidence states are explicit and do
  not invent values.
- Production logic contains no golden-sample-specific branch or lookup.

## 14. Non-goals

The first release does not implement arbitrary general tolerances, angular
tolerance tables, geometric tolerance calculations, surface-texture selection,
manufacturing-capability inference, statistical tolerance synthesis, cloud
calculation, or automatic enterprise-rule authoring.
