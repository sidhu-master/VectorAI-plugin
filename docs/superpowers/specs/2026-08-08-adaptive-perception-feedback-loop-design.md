# Adaptive Drawing Perception Feedback Loop Design

**Status:** Approved by the user for direct implementation

## Goal

Make complex image/PDF perception iterative instead of one-shot. The pipeline must measure what each region has read, refine regions that are incomplete or saturated, merge new observations idempotently, and stop with an explicit coverage result rather than silently treating a bounded model response as complete.

## Chosen approach

Three approaches were considered:

1. Fixed additional tiling. It is deterministic and cheap, but spends calls on simple areas and still cannot detect high-confidence omissions.
2. Model-only completeness assessment. It can reason about visual omissions, but its completeness claim is itself probabilistic.
3. Hybrid adaptive refinement. This is selected. A bounded vision tool assesses coverage, while deterministic signals such as tool errors, response saturation and geometry touching internal crop boundaries can force refinement even when the model says complete.

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

`DrawingVisionTools.assessCoverage` receives the current crop plus a bounded list of detected geometry/annotation types and crop-local bounds. It returns strict JSON containing `complete`, `confidence`, `unreadBounds` and `reasons`. Bounds are relative to the current crop and must remain inside 0–1.

The deterministic policy forces refinement when any of these occur:

- geometry or annotation extraction failed after its existing retry;
- geometry count reaches 16 or annotation count reaches 24 in one region;
- an observed geometry bound touches an internal crop edge, suggesting a clipped entity;
- the assessment reports incomplete or non-empty unread bounds.

An assessment failure does not discard valid observations. It creates an uncertain assessment and forces one bounded refinement when budget remains.

## Adaptive scheduler

Initial regions still come from the page/view segmentation policy. Refinement proceeds in breadth-first waves so progress, persistence and budgets are deterministic.

- A refinable region splits into two children along its longest physical pixel axis with 4% overlap.
- Default maximum refinement depth is 1 beyond the initial regions.
- Default maximum region count is 12 per view.
- At most three regions are perceived concurrently.
- A child ID is derived from its parent and index; retrying produces the same ID.
- Parent observations remain evidence. Child observations are stitched to page coordinates and conservatively deduplicated with all prior observations.

When depth or region budget prevents requested refinement, the region becomes `budget_exhausted`. The run may still produce valid Drawing IR, but the coverage ledger and analysis summary state that perception is incomplete.

## Convergence and commands

The loop converges when no region requests refinement. After convergence, all observations across all waves are deduplicated, topology and dimension associations are rebuilt, and the deterministic Resolver emits only final DrawingCommand batches.

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
- Pipeline tests proving a coarse incomplete region creates child reads, merges child-only geometry, persists the ledger, and converges.
- Tests proving simple complete regions do not add calls and exhausted budgets produce warnings.
- Runtime tests proving incomplete coverage appears in the terminal analysis without invalidating committed Drawing IR.
- Real `test1.jpg` baseline comparing geometry/annotation counts, region waves, latency and coverage status.

## Scope boundary

This phase covers adaptive raster perception for one image or the first PDF page. Cross-page continuation, vector PDF extraction, server-restart run resurrection, layers, blocks, fills and 3D remain outside this implementation.
