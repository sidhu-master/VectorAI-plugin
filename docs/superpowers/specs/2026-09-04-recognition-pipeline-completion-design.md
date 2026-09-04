# Recognition Pipeline Completion Design

## 1. Goal

Complete the recognition-runtime migration so every automatic engineering
recognition path used by the annotation Host is registered once, executed from
one composition root, and shared by production and contract evaluation. The
change must preserve current drawing behavior, local engineering authority,
persistence, editing, and export semantics.

This design extends
[`2026-09-04-recognition-evaluation-runtime-design.md`](2026-09-04-recognition-evaluation-runtime-design.md).
The existing DSH boundary, evaluation protocol, sanitized observations, exact
runtime-version gate, cancellation behavior, and fingerprint rules remain
authoritative.

## 2. Confirmed Product Requirements

- VectorAI maintains one production implementation for each recognition path.
  Tests and evaluations must not copy or approximate production prompts,
  geometry extraction, engineering rules, validation, layout, or grounding.
- All production recognition enters through the one
  `RecognitionPipelineRunner` constructed by `DrawingAnnotationHostService`.
- The global entry point is a registry and composition root, not one monolithic
  algorithm file. Each engineering domain keeps a focused pipeline with typed
  input and output.
- Deterministic geometry and engineering algorithms do not acquire a model call
  merely to conform to the shared runtime.
- DSH remains an optional bounded semantic-review stage only for partition and
  shaft functional-feature review. The model cannot invent coordinates,
  dimensional arithmetic, datum precedence, GD&T characteristics, tolerance
  values, roughness values, or final annotation anchors.
- No UI, status indicator, persistence schema, edit interaction, or export
  representation changes in this migration.

## 3. Authoritative Pipeline Catalog

The annotation Host registers exactly four production recognition pipelines:

| Pipeline | Owns | Model stage |
| --- | --- | --- |
| `partition-semantic-review` | Existing partition observation, bounded semantic classification, validation, consolidation, and local application | Optional bounded review |
| `deterministic-engineering-annotation-plan` | Opening angles, diameters, centerline, radii, collision-aware layout, associations, and edit program planning | Never |
| `axial-dimension-inference` | Engineering-document parsing and unit normalization, topology, candidates, policy inference, validation, and projection | Never |
| `shaft-gdt-semantic-review` | Functional-feature review, local datum order, GD&T characteristic selection, tolerance and roughness rules, controlled-surface resolution, and geometry grounding | Optional bounded review |

Datum, GD&T, and surface texture stay in one shaft engineering-semantic pipeline.
They are not independent recognizers: datum precedence affects valid GD&T
frames, and surface-texture attachment uses the same classified functional
segments and controlled cylindrical surfaces. Splitting them would duplicate
feature classification and allow inconsistent surface identities.

Opening angle, diameter, centerline, and radius remain one deterministic
annotation-planning pipeline. The caller selects the requested kinds in the
typed input; all combinations still execute the existing
`planEngineeringAnnotations` implementation, including cross-kind collision
avoidance.

## 4. Composition and Dependency Boundaries

`createAnnotationRecognitionRunner(model, space)` is the only production
composition root. It constructs one `RecognitionPipelineRunner` and registers
all four pipeline factories in a stable order.

Production adapters are thin closures around `runner.run()`:

- the annotation tool receives an `EngineeringAnnotationPlanner` and remains
  responsible for applying the returned edit program;
- `DimensionInferenceService` receives an `AxialDimensionInference` function
  and remains responsible for reading session state, merging the returned
  projection, and persisting the draft;
- `PartitionWorkflowService` and `GdtService` retain their existing thin runner
  adapters.

Pipeline code is pure with respect to product persistence. It may read the
provided drawing snapshot and render an observation when its documented model
stage needs one, but it cannot mutate Drawing, partition state, dimension-plan
state, or session state. Services remain the transaction and persistence
owners.

A dependency-boundary test enforces that production services and tools do not
import the low-level recognition algorithms directly. Those imports are allowed
only inside their pipeline modules. All DSH request, attachment, and subagent
APIs remain exclusive to `dsh-recognition-model-adapter.ts`.

## 5. Deterministic Annotation Pipeline

The pipeline input is the current `DrawingDocument`, `DrawingRef`, objective,
and requested deterministic annotation kinds. It calls the existing
`planEngineeringAnnotations` once and returns the complete
`EngineeringAnnotationPlan` unchanged.

The normalized evaluation result records stable domain output only: annotation
IDs and kinds, dimension values, target geometry IDs, definition points, text
positions, association targets, suppression reasons, and whether an edit program
exists. It does not record source DXF bytes or mutable session state.

The production tool applies exactly the returned plan. Individual opening-angle
and diameter tools use the same injected planner with a restricted kind list;
there is no direct fallback that bypasses the registry.

## 6. Axial Dimension Pipeline

The pipeline input contains the current drawing snapshot, current partition
draft or revision, staged engineering-document text, and policy ID. The pipeline
owns the complete existing calculation sequence:

1. verify drawing identity and partition geometry fingerprint;
2. parse and normalize engineering-document coordinates into drawing units;
3. build axial topology;
4. generate candidates and evidence;
5. apply the named inference policy;
6. validate the selected scheme;
7. project the scheme into an `EngineeringAnnotationDraft` fragment.

The pipeline returns the projection without reading or writing the plan store.
`DimensionInferenceService` merges it with the current editable draft through
the existing `mergeAxialDimensionProjection` function and then persists it. This
preserves datums, GD&T, tolerances, roughness, manual edits, revision ownership,
undo/redo, and stale-state behavior.

The service becomes asynchronous because all registered pipelines use the same
runner contract. Tool and automatic-workflow callers await it. This is an
internal Host contract change; the DSH tool response and visible workflow remain
unchanged.

## 7. GD&T, Datum, and Surface-Texture Completion

The existing `shaft-gdt-semantic-review` pipeline remains the sole recognizer for
these outputs. Its contract evaluation must assert all three final domains:

- selected datum features and order;
- controlled geometry and characteristic identities;
- roughness value, material-removal mode, and attachment to the same functional
  cylindrical surface selected by the production grounder.

The evaluator calls the registered production pipeline. It may use a fixed
`RecognitionModelPort` candidate to make the test repeatable, but it cannot
replace the production prompt, validation, local rules, or grounding.

## 8. Evaluation Suite and Real DSH Probe

Contract cases use production-shaped imported drawings, partition data, and
engineering documents. The initial suite covers the maintained golden shaft and
the independently designed educational shaft where the domain is supported.
Every deterministic case uses the production runner and asserts that the model
port was not called.

The repository provides one opt-in headless probe command that imports the built
annotation bundle and invokes `DshRecognitionModelAdapter`. It validates the
installed DSH versions, capabilities, structured result, child-session
correlation, provider/model facts, and sanitized request digest. Probe output is
written only to an ignored local directory and never contains prompt, persona,
image, document, credential, header, or environment-value content.

Contract tests are the required merge gate. The live DSH probe is an explicit
environment check because it consumes a real provider request and depends on the
developer's configured DSH profile.

## 9. Error and Lifecycle Behavior

- Existing stable product errors remain unchanged, including
  `DIMENSION_PARTITION_REQUIRED`, `DIMENSION_PARTITION_STALE`,
  `GDT_PARTITION_STALE`, and drawing/session requirements.
- Deterministic pipeline failures propagate to the existing service transaction,
  which owns failure state and persistence rollback behavior.
- Optional model-review failures preserve each pipeline's documented local
  fallback. Caller aborts still propagate.
- Pipeline evaluation never writes Drawing, partition, dimension-plan, or
  annotation-session state.
- Every model run and listener is disposed by the existing DSH adapter.

## 10. Acceptance Criteria

- `createAnnotationRecognitionRunner()` lists exactly the four authoritative
  pipeline IDs.
- Automatic annotation, standalone opening-angle annotation, standalone
  diameter annotation, and standalone dimension-chain inference all execute
  through that runner in the production service.
- No production tool or service directly calls
  `planEngineeringAnnotations`, `buildAxialTopology`,
  `generateAxialDimensionCandidates`, `inferAxialDimensionScheme`, or DSH
  recognition APIs.
- Contract evaluation runs the exact registered pipeline objects for partition,
  deterministic annotations, axial dimensions, and shaft engineering semantics.
- Golden automatic annotation still produces dimensions, datums, GD&T controls,
  and roughness without an unnecessary model request when the engineering
  document resolves the result locally.
- Golden and educational drawing regressions, Host type-check, annotation bundle
  build, dependency-boundary checks, and a fresh installed-runtime probe pass.
- The migration adds no UI and changes no persisted schema.
