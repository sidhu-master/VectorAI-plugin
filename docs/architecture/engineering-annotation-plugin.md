# Engineering Annotation Plugin Boundary

## Decision

Automatic engineering annotation is a second, independently installable plugin. It is not an example bundled into the 2D Space implementation and it must not own the canvas, Drawing repository, attachment lifecycle, or chat window.

The two plugins stay in one monorepo initially for atomic contract changes and shared CI, while remaining separate packages, releases, and DSH install entries.

## Responsibilities

The second layer may:

- inspect an immutable `DrawingDocument` and spatial query results;
- recognize engineering features and dimension candidates;
- plan label placement and collision avoidance;
- calculate coverage, ambiguity, and confidence;
- publish temporary readonly preview overlays;
- submit a public high-level `SpatialEditProgram` to the first-layer semantic pipeline;
- expose DSH tools and prompts that orchestrate those public operations.

It may not:

- deep-import first-layer repository, Store, Canvas, or DSH adapter internals;
- write session files or browser storage directly;
- mutate snapshots passed to preview contributions;
- create a second chat UI, Agent loop, HTTP server, or cloud dependency;
- treat a rendered SVG scene as the authoritative engineering document.

## Chat intervention

DSH owns the conversation window and model loop. Engineering Annotation intervenes through ordinary DSH tools and structured results:

1. A user uploads a drawing; the first layer imports it into the session repository.
2. The model calls second-layer recognition or planning tools when the request requires engineering annotations.
3. The second layer reads the first layer's public snapshot/query API.
4. `drawing_auto_annotate` generates confirmed dimension nodes and resolved annotation-target associations as a first-layer Preview.
5. The first layer runs mandatory diagnostics, reviewer evaluation, and `blocked | confirmation_required | auto_safe` policy.
6. Accepted results commit through the first layer's durable operation ledger and remain Undoable.
7. The base Viewer renders the committed annotations even if the second layer is later disabled.

Therefore features such as “vectorize first” and “ask whether intelligent zoning is needed” belong to orchestration at the DSH tool/prompt boundary. Vectorization/import remains a first-layer capability; the decision to run domain-specific zoning and annotation belongs to the second layer.

## Contract rule

The annotation implementation is split into `@vectorai/engineering-annotation` and `@vectorai/plugin-dsh-annotation`. It depends on published Drawing/space contracts and the public Host extension method; dependency-boundary tests reject deep imports. Preview output is disposable; the first layer owns every durable transaction and receipt.

The first version deterministically supports circle diameter, arc radius, and ellipse-aligned dimensions when source geometry is confirmed. Candidate source facts remain pending/confirmation-required rather than being silently materialized. More complex profiles, zoning, collision optimization, and coverage rules extend this package without adding another repository or commit authority.
