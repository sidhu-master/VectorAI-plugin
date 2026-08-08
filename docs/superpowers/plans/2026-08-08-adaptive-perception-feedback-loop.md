# Adaptive Perception Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded, persistent feedback loop that recursively rereads incomplete drawing regions and reports whether perception coverage converged.

**Architecture:** A whole-view pass first establishes global contour identity. Region passes collect annotations, small standalone entities and contour evidence referencing that registry; a deterministic assembler produces one geometry per global contour. A standalone coverage policy then drives breadth-first refinement, persists a byte-free ledger after each wave and resolves final Drawing commands only after convergence or explicit budget exhaustion.

**Tech Stack:** TypeScript 5.8, Vitest 3, Drawing Perception, Drawing Vision Tools, local observation store, Drawing Agent Runtime.

## Global Constraints

- Work on `main`; do not create branches, worktrees or subagents.
- Do not modify or commit `test1.jpg`.
- No media bytes, model names or hidden reasoning in the coverage ledger, audit or public run view.
- Default refinement depth is 1, maximum 12 regions per view and maximum 3 concurrent region calls. Model-reported unread bounds produce one focused child; unknown failures retain the two-child fallback.
- Existing immediate receipt and 25-second heartbeat behavior must remain unchanged.
- Valid observations survive assessment errors and budget exhaustion.

---

### Task 1: Coverage domain and refinement policy

**Files:** Create `api/services/drawing-perception/coverage.ts`; create `coverage.test.ts`; modify `regions.ts` and `regions.test.ts`.

**Interfaces:** Produces `DrawingCoverageAssessment`, `DrawingCoverageRegion`, `DrawingCoverageLedger`, `decideRegionRefinement(input)` and `splitPerceptionRegion(input)`.

- [ ] Write failing tests for model-incomplete, extraction-error, saturation, internal-edge clipping, complete-simple and exhausted-budget decisions.
- [ ] Run the focused tests and confirm failures because the coverage API does not exist.
- [ ] Implement pure deterministic coverage decisions and two-child long-axis splitting with stable IDs.
- [ ] Run focused tests and commit.

### Task 2: Global contour and coverage vision protocols

**Files:** Modify `vision-tools.ts`, `vision-tools.test.ts`, `validate.ts` if shared validation is useful.

**Interfaces:** Adds `detectGlobalContours(input): Promise<GlobalContour[]>`, `assessCoverage(input, context): Promise<DrawingCoverageAssessment>`, and the `detect_global_contours`/`assess_coverage` tool contracts.

- [ ] Write failing protocol tests for global contour identity, valid assessment JSON and rejection of invalid bounds/confidence/reasons.
- [ ] Run tests and confirm the missing tool behavior.
- [ ] Add the bounded prompt, context serialization and strict parser without exposing media in returned records.
- [ ] Run vision tests and commit.

### Task 3: Contour evidence and assembler

**Files:** Create `contour-assembler.ts` and `contour-assembler.test.ts`; modify perception observation types.

**Interfaces:** Produces `GlobalContour`, `ContourEvidence`, a combined regional geometry/evidence read, `assembleContours(input)` and an explicit unresolved-contour result.

- [ ] Write a failing cross-region circle test where two crop fragments reference one global circle and produce one circle observation.
- [ ] Write failing tests preventing crop-edge fragments from becoming standalone geometry and preserving unresolved evidence.
- [ ] Run tests and confirm the assembler API is missing.
- [ ] Implement bounded analytic fitting, stable IDs and continuity validation.
- [ ] Run focused tests and commit.

### Task 4: Adaptive breadth-first perception scheduler

**Files:** Modify `pipeline.ts`, `pipeline.test.ts`, `observation-store.ts` and their tests.

**Interfaces:** Pipeline runs global contours before region details, persists `coverage-ledger`, emits `coverage_assessed`/`coverage_completed`, rereads child regions and exposes final coverage/contour counts in stage details.

- [ ] Write a failing integration test where a whole-view circle crosses two regions and remains one assembled circle after refinement.
- [ ] Write failing tests for simple convergence, assessment failure fallback, region budget exhaustion and byte-free ledger persistence.
- [ ] Run the focused tests and confirm failures against the one-shot scheduler.
- [ ] Implement wave scheduling, focused assessment rereads, terminal unverified status, ledger checkpoints, child creation, stitching and final deduplication.
- [ ] Run perception tests and commit.

### Task 5: Runtime coverage result

**Files:** Modify `runtime.ts`, `runtime.test.ts` and progress-stage mapping.

**Interfaces:** Runtime tracks final incomplete region counts and includes them in `analysisSummary` and perception audit events.

- [ ] Write a failing runtime test for successful Drawing commits with an explicit incomplete-coverage warning.
- [ ] Run it and confirm the warning is absent.
- [ ] Implement bounded coverage counters from stage receipts and terminal summary wording.
- [ ] Run runtime and audit tests; commit.

### Task 6: Real baseline and final verification

**Files:** Update architecture documentation only if implementation changes the declared contract; do not add `test1.jpg`.

**Interfaces:** Produces fresh local baseline evidence for adaptive region count, coverage status, Drawing node counts and receipt latency.

- [ ] Run the complete test suite, typecheck, production build and `git diff --check`.
- [ ] Run `test1.jpg` through analysis and reconstruction and inspect the persisted coverage ledger.
- [ ] Verify public progress/audit contain no model names or media bytes and retain under-30-second receipts.
- [ ] Commit final documentation adjustments and report measured limitations.
