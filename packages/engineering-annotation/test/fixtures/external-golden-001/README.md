# external-golden-001

VectorAI-authored 286 mm hollow helical-gear shaft used as an independent educational
annotation fixture. The user-provided `初始图.dxf` is a drawing-convention reference only;
the part geometry and dimensions in this fixture are independently defined. This is an
unannotated workflow fixture, not a manufacturing-release drawing.

The central integral gear is a right-hand helical gear with a 2.5 mm normal module,
35 teeth, a 20 degree pressure angle, a 20 degree helix angle, and a 60 mm face width.
The odd tooth count produces a half-axial-pitch phase shift between the upper and lower
axial-section profiles. Visible tooth traces outside the cutting plane are separate from
the closed section-hatch boundaries.

The gear's left side opens onto a smaller shaft diameter and provides natural cutter
clearance. Its right side includes a 3 mm wide, 83.5 mm diameter relief groove with
0.5 mm corner radii so the manufacturing feature has explicit geometry.

The external-spline region follows the user-provided reference drawing's initial-view
treatment: its main longitudinal section keeps only the complete cylindrical outer
profile and does not add a fabricated inset minor-diameter box. The engineering data
identifies the interval as an external spline; no unverified tooth form or spline
parameters are invented in the initial drawing.

The two shaft ends use conventional external-thread representations: M55x2-6g on the
left and M45x1.5-6g on the right. Their thin minor-diameter lines are calculated from
the ISO metric basic profile, extend into the entry chamfers, and end at separate thick
thread-limit lines. The section hatch continues to the thick major-diameter outline.
The design does not claim a bearing or locknut selection until assembly requirements
are supplied.

The through bore opens at the left end with a 60 degree included angle. Its radius
changes from 15 mm to 12 mm over an axial run of 5.196152 mm; the mirrored upper and
lower flanks therefore define the angle directly without a decorative or inferred line.

Reference basis:

- GB/T 4459.1-1995 / ISO 6410-1:1993, conventional representation of screw
  threads and threaded parts.
- GB/T 192-2025 and GB/T 196-2025, ISO metric basic/design profile and basic
  dimensions.
- Timken KM-series metric locknut catalogue: KM9 uses M45x1.5 and KM11 uses
  M55x2.

`initial.dxf` is the current unannotated drawing. `target.dxf` is intentionally deferred
and is not part of the current acceptance scope. `engineering-data.ini` is the AI
partition sidecar, and `DRAWING-AUDIT.md` records verified, representational, and
undefined data.
