# Adaptive Drawing Perception Feedback Loop Design

**Status:** Approved by the user for direct implementation

## Goal

Make complex image/PDF perception iterative instead of one-shot. The pipeline must measure what each region has read, refine regions that are incomplete or saturated, merge new observations idempotently, and stop with an explicit coverage result rather than silently treating a bounded model response as complete.

## Chosen approach

Three approaches were considered:

1. Fixed additional tiling. It is deterministic and cheap, but spends calls on simple areas and still cannot detect high-confidence omissions.
2. Model-only completeness assessment. It can reason about visual omissions, but its completeness claim is itself probabilistic.
3. Outline-first hybrid adaptive refinement. This is selected. A whole-view pass establishes global contour identity before any crop is interpreted. A bounded vision tool then assesses coverage, while deterministic signals such as tool errors, response saturation and geometry touching internal crop boundaries can force refinement even when the model says complete.

## Global contour registry

Region crops are not authoritative for large geometry because a crop can turn one circle into two apparent arcs or one long line into unrelated segments. Each view is therefore read in two layers:

1. `detect_global_contours` receives the complete view and returns a coarse `GlobalContourRegistry`: stable contour ID, expected geometry family, whole-view bounds, closed/open state, confidence and any coarse analytic parameters.
2. Region tools read small standalone primitives, annotations and `ContourEvidence` tied to a global contour ID. Evidence may contain sampled points or visible fragment bounds, but it is never emitted directly as Drawing geometry when it touches an internal crop edge.

A `ContourAssembler` merges all evidence for a contour and produces one authoritative geometry observation. Analytic contours are fitted and checked as one line/circle/arc/ellipse; free-form contours are assembled by endpoint continuity into one polyline or spline. A region-only candidate for a large contour must be rechecked in an expanded or whole-view crop before it can enter the registry.

## Coverage contract

Every perception run persists a byte-free `DrawingCoverageLedger` under the run's drawing audit directory. Each region records its page bounds, parent, depth, status, attempt count, observation counts, assessment and refinement reasons.

```ts
interface DrawingCoverageAssessment {
  complete: boolean;
  confidence: number;
  unreadBounds: NormalizedImageBounds[];
  reasons: string[];
}

interface DrawingCoverageRegion {
  id: string;
  viewId: string;
  parentId?: string;
  depth: number;
  pageBounds: NormalizedImageBounds;
  status: 'pending' | 'running' | 'complete' | 'refine' | 'failed' | 'budget_exhausted';
  attempts: number;
  geometryCount: number;
  annotationCount: number;
  assessment: DrawingCoverageAssessment | null;
  refinementReasons: string[];
}
```

The ledger stores no image, crop, prompt, token or model name. It is written after each completed refinement wave so an interrupted run with the same run ID can skip terminal regions and continue pending descendants.

## Coverage assessment

`DrawingVisionTools.assessCoverage` receives the current crop plus bounded summaries of global contours, local contour evidence, standalone geometry and annotations. It returns strict JSON containing `complete`, `confidence`, `unreadBounds` and `reasons`. Bounds are relative to the current crop and must remain inside 0–1.

The deterministic policy forces refinement when any of these occur:

- geometry or annotation extraction failed after its existing retry;
- geometry count reaches 16 or annotation count reaches 24 in one region;
- an unassigned geometry or contour evidence bound touches an internal crop edge, suggesting a clipped entity;
- the assessment reports incomplete or non-empty unread bounds.

An assessment failure does not discard valid observations. It creates an uncertain assessment and forces one bounded refinement when budget remains.

## Adaptive scheduler

After the whole-view contour registry is established, initial detail regions come from the page/view segmentation policy. Refinement proceeds in breadth-first waves so progress, persistence and budgets are deterministic.

- A refinable region splits into two children along its longest physical pixel axis with 4% overlap.
- Default maximum refinement depth is 1 beyond the initial regions.
- Default maximum region count is 12 per view.
- At most three regions are perceived concurrently.
- A child ID is derived from its parent and index; retrying produces the same ID.
- Parent observations remain evidence. Child observations are stitched to page coordinates and conservatively deduplicated with all prior observations.
- A crop-edge fragment never becomes a standalone Drawing entity unless expanded-view verification proves it is complete.

When depth or region budget prevents requested refinement, the region becomes `budget_exhausted`. The run may still produce valid Drawing IR, but the coverage ledger and analysis summary state that perception is incomplete.

## Convergence and commands

The loop converges when every registered global contour is assembled or explicitly unresolved and no region requests refinement. After convergence, assembled contours and standalone observations across all waves are deduplicated, topology and dimension associations are rebuilt, and the deterministic Resolver emits only final DrawingCommand batches.

Stable observation-derived Drawing node IDs make retries idempotent. Runtime Preview → Commit remains the only write boundary; partial components already committed are retained if a later component fails.

## Progress and audit

The pipeline adds `coverage_assessed` and `coverage_completed` stages. Public progress reports human-readable coverage activity without model names or hidden reasoning. Audit records and the observation store retain:

- region/wave counts;
- complete/refined/budget-exhausted counts;
- assessment reasons and confidence;
- final coverage-complete flag.

The terminal analysis summary includes an explicit warning when coverage is incomplete. The existing immediate acceptance and 25-second silence heartbeat continue to satisfy the under-30-second receipt SLA.

## Error handling

- Tool error: retain other tool results and force bounded refinement.
- Coverage schema error: retry once, then force bounded refinement.
- Region budget exhausted: retain observations and finish with an incomplete warning.
- Deadline/stop: persist the latest ledger before propagating cancellation.
- Duplicate observations across overlap or refinement: keep the highest-confidence valid observation.

## Verification

- Unit tests for coverage response validation, deterministic refinement signals, child bounds and budgets.
- A cross-region circle test proving two visible fragments remain evidence for one global circle and never become two Drawing arcs.
- Contour assembly tests for line/circle fitting, endpoint continuity and unresolved evidence.
- Pipeline tests proving a coarse incomplete region creates child reads, merges child-only geometry, persists the ledger, and converges.
- Tests proving simple complete regions do not add calls and exhausted budgets produce warnings.
- Runtime tests proving incomplete coverage appears in the terminal analysis without invalidating committed Drawing IR.
- Real `test1.jpg` baseline comparing geometry/annotation counts, region waves, latency and coverage status.

## Scope boundary

This phase covers adaptive raster perception for one image or the first PDF page. Cross-page continuation, vector PDF extraction, server-restart run resurrection, layers, blocks, fills and 3D remain outside this implementation.
