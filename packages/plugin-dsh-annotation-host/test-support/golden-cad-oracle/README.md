# Golden CAD oracle (acceptance support only)

`manifest.json` is a frozen, item-level record of `golden-shaft-001/target.dxf`,
whose dimensions, tolerances, GD&T and roughness are explicitly authorized reference
requirements for this acceptance fixture. Production code must never import this
directory, infer production defaults from it, or use its paper positions to
construct the actual drawing.

The real acceptance journey is initial DXF + engineering INI + an explicit,
independently grounded fixture requirements state → production planners → confirmed
state → production exporter → actual DXF → this checker → native CAD rendered review.
The old golden integration uses two placeholder datum targets and pending GD&T;
it is not a successful execution of that journey.

## Run

Use a development Python environment with `ezdxf` (this is an offline test utility,
not a production vectorizer interpreter). From the repository root:

`requirements.txt` records the development versions used for this review. Install
it into a separate development virtual environment and replace the temporary
interpreter path below with that environment's Python. No Python interpreter is
selected or invoked by the production plugin.

```sh
pnpm exec tsx packages/plugin-dsh-annotation-host/test-support/golden-cad-oracle/run-acceptance.ts
/tmp/vectorai-dxf-review.Q8QGB8/venv/bin/python packages/plugin-dsh-annotation-host/test-support/golden-cad-oracle/oracle.py check .local/dxf-export-review/real-acceptance/actual.dxf --report .local/dxf-export-review/real-acceptance/oracle-report.json
/tmp/vectorai-dxf-review.Q8QGB8/venv/bin/python packages/plugin-dsh-annotation-host/test-support/golden-cad-oracle/review-source-bindings.py .local/dxf-export-review/real-acceptance
/tmp/vectorai-dxf-review.Q8QGB8/venv/bin/python -m unittest discover -s packages/plugin-dsh-annotation-host/test-support/golden-cad-oracle -p 'test_oracle.py'
```

`check` only reads the actual DXF and frozen manifest, and writes the specified
report. It never reads target DXF to update the expected result. `freeze` is a
separate explicit maintenance command; changes to reference requirements require
review. Manifest source SHA-256 values identify all three fixture inputs.

Exit 1 means automated failure. Exit 0 means automated checks passed, with report
status `requires-rendered-review`; it never asserts the target CAD application can
render the font glyphs correctly. The target-versus-target self-check tests the
oracle, not the production exporter. Tests intentionally mutate copies to prove
same-count regressions are caught.

`run-acceptance.ts` reads only the initial DXF, engineering INI, and the independent
`acceptance-requirements.ts`. It grounds explicit requirements against source
geometry, calls production annotation/candidate planners, uses real drawing
transactions and plan-store edits/confirmation, then JSON serializes and strictly
parses both workspace and plan before export. It writes actual DXF, input and
grounding evidence, the confirmed state, and drawing commands under
`.local/dxf-export-review/real-acceptance/`. No expected paper coordinate enters
this journey. The frozen oracle is evaluated separately after output exists.

## Supplemental actual rendering audit

Run `audit-render-details.py .local/dxf-export-review/real-acceptance` with the
same development Python after `oracle.py check`. It requires a matching actual
DXF SHA and writes `additional-render-audit.json` and `.md` without changing the
DXF, frozen manifest, or strict thresholds. It checks actual anonymous-picture
witness colors through the drawing renderer, all nine reference TEXT width
factors, seven roughness glyph arm lengths/angle/gap/facing, eleven text
orientations, and actual LINE/LWPOLYLINE/HATCH intersections with `[B]8`'s locally
resolved font bounds and glyphs. Profile width consistency is reported separately
from strict reference width equality. Native target CAD font availability remains
unverified. A matching text rotation alone does not prove glyph facing.

## Recorded and compared

The manifest has 55 independently identified annotation items: 28 dimensions, 2
datums, 4 GD&T frames comprising 8 rows, 7 roughness symbols, 2 detail bubbles,
3 feature notes, and 9 reference callout texts. `inventory.md` lists their content.
Every item records its reference handle for evidence, semantic ID, visible
content, native definition points or symbol leader/arrow geometry, text positions,
typography, layers, and rendered primitives. Nested INSERTs inside DIMENSION
pictures are expanded; otherwise most bilateral tolerances would be missed.

Actual matching is one-to-one by semantic kind, content and nearest normalized
target/position. Reference handles, anonymous block names and entity ordering are
never matching keys. Differences include their paths, expected values and actual
values; missing and extra items fail. Geometry and section hatches are compared
entity by entity, including spline control points, arcs and hatch boundaries.
Used layers, dimension styles, body bounds and axial tier gaps are independent
checks. Coordinates allow 0.05 mm; numeric values allow 0.00001. Graphics compare
the target's entity representation as well as shape, so alternate valid
representations can fail and require an explicit reviewed equivalence rule.

BYLAYER/BYBLOCK color, lineweight and linetype values are resolved before comparison;
equivalent omitted and explicit attributes do not fail. Null block handle `0` and
an absent arrow block are equivalent when no block named `0` exists; omitted and
zero spline boundary tangents both mean no tangent constraint. A second `engineeringChecks`
section compares normalized visible nominal/deviation values, GD&T rows, roughness,
text height and effective font families, arrowhead shape/size, and axial/radial
layout zones. `engineeringLayoutRelations` separately checks tier ordering. This
does not replace strict reference differences or authorize relaxed thresholds.

Every native dimension is regenerated by `ezdxf` in memory and checked against the
reference's visible nominal and tolerance. Cached pictures alone cannot prove CAD
edit/regeneration correctness. The reference itself has regeneration discrepancies:
its four cached 60°/120° angles regenerate as 300°/240°, and some fractional values
regenerate at different precision. `referenceDiscrepancies` reports these; reproducing
the reference's defective definition/precision is not an acceptance requirement.

Normalization subtracts the leftmost vertical contour face X and contour bounding-box
Y midpoint from world positions. It does not rescale or rotate. The target's contour
bounds extend 5 mm left of that body end; this discrepancy is retained in body bounds.
Translation and top-level entity reordering are tested.

Each target geometry record identifies whether its shape exists in the initial
DXF. The report also has independent source-preservation checks, excluding layer
and pen-style changes. Target-only geometry failures are thus distinguished from
loss or mutation of imported source geometry. A strict reference mismatch never
authorizes altering the input body to resemble the target.

The target renders `Ø44.59`, `Ø42.21` and `Ø48`; native measurements are respectively
44.5861047, 42.2062758 and 47.931914 mm. Its gear span is displayed as `57.03`
without a diameter prefix. These are separate content and measurement facts;
rounding or silently replacing them with INI outer diameters is not acceptable.

## Semantics requiring explicit care

`review-source-bindings.py <acceptance-output-directory>` adds an independent
55-row source-feature audit (`source-binding-review.md` and JSON). It uses
reviewed **initial** DXF handles solely as test evidence and checks stored target
ownership separately from emitted native witnesses. Different positions along
one physical surface/extension are distinguished from a different controlled
surface. The exact reference oracle remains unchanged.

The runner also writes `acceptance-paper-scene.json` from the final production
projection, to expose actual controlled geometry IDs and symbol anchors. This
metadata does not by itself prove DXF graphical attachment. A separate 18-row
`emitted-symbol-binding-review.md` checks actual DXF arrow tips and leader starts
against independently verified source anchors, datum connectors against actual
diameter witnesses, frame-mounted roughness against the actual GDT top edge,
and detail circle centers/leader intersections against the source R0.8 features.
Native dimension witness checks are separate. The 9 plain-text references have
no persistent dimension/GDT binding; native CAD font/glyph availability remains
unsupported. Exact reference placement and typography rotation still apply.

The binding audit found and corrected test-input errors: layer-0 inner opening
slopes, the x=45 left shoulder face, radians for the two R1 arc anchors, and both
upper detail circles' R0.8 features. It also detects axial intent geometry
references that do not own their claimed stations, even when exported native
dimension stations are correct. The discovered upstream station regression was
fixed in the production topology selector; the acceptance runner does not rewrite
those targets to hide an upstream failure.

- A is the right bearing datum; B is the left bearing datum. Their arrows attach
  to the diameter extension lines. `A-B` means one common datum, not two sequential
  datum-reference compartments.
- Each bearing has circularity 0.003, cylindricity 0.005 and total runout 0.01 A-B.
  Two faces have circular runout 0.015 A-B. The `amgdt` glyph codes are retained.
- The roughness numeric values are explicit, but Ra/Rz is not written in the DXF;
  the manifest does not invent a parameter.
- Detail bubbles I/II, `C0.5`, `C0.5两侧`, a two-tip `R1` note and `[B]1`…`[B]9`
  are reference items even when current production contracts cannot express them.
  Their omission must be reported, not hidden by comparing entity counts.
- Native DXF does not contain application domain geometry IDs. The manifest
  checks definition points, leader paths and arrowheads; fixture-specific
  manufacturing interpretations must be grounded separately against source
  geometry and must never be inferred from expected paper coordinates.
- The checker cannot verify installed CAD fonts, final glyph rasterization or
  visual legibility. These remain explicit unsupported rendered-review checks.
