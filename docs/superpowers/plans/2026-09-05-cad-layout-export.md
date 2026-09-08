# CAD Layout and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Produce auditable professional CAD annotation output against every item in the provided reference, through the real layout/export pipeline.

**Architecture:** Keep engineering decisions separate from a pure CAD paper projection and from DXF serialization. Explicit automatic/manual layout ownership protects editing and persistence. An independent, test-only reference manifest verifies content, geometry binding, presentation, and native regeneration.

**Tech Stack:** TypeScript, Vitest, existing Drawing/DSH contracts, acad-ts; development-only ezdxf audit/rendering.

**Spec:** `docs/superpowers/specs/2026-09-05-cad-layout-export-design.md`

## Global Constraints

- Preserve the existing uncommitted export fixes.
- No target DXF, sample identifiers, coordinates, or fixed dimension lists in production code.
- `layout.mode === automatic` is the only permission for dimension paper repositioning; absent metadata preserves old positions.
- Export a clone of the current visible draft/confirmed document; preserve manual state and native tolerance data.
- Check real items and actual geometry, not counts or image resemblance.
- No commits or publication as part of this request; rebuild both local bundles before delivery.

### Task 1: Reference inventory and failed baseline

**Files:** Test-only `packages/plugin-dsh-annotation-host/test-support/golden-cad-oracle/` manifest/checker and acceptance inputs; existing golden integration test.

- [x] Extract all dimension and symbol items, original handles, coordinate normalization, styles and hatch structure from the target.
- [x] Check the current actual exported DXF, recording each missing/different item rather than passing structural counts.
- [x] Record explicit numerical engineering requirements separately from desired placement; no output coordinates in semantic input.

### Task 2: Layout ownership through the lifecycle

**Files:** canonical document types, strict annotation wire schema, deterministic plan/projection, edit compiler/transaction and space Host edit application, focused tests.

**Interfaces:** optional `DimensionAnnotation.layout: { mode: 'automatic' | 'manual'; generatedText?: string }`; `AxialDimensionScheme.hiddenCandidateIds` distinguishes explicit user hiding from the default dashed closure display.

- [x] Verify new generation is automatic, legacy records preserve positions, manual movement marks manual, and undo/redo restores ownership.
- [x] Verify persisted strict-schema round trip and repeated annotation preserve manual positions.
- [x] Implement only the ownership transitions required by these cases.

### Task 3: Pure dimension paper projection

**Files:** `cad-dimension-layout.ts` and its tests; export integration; core DXF dimension graphics as needed.

**Interfaces:** `projectCadDimensionLayout(document, profile)` returns a cloned document and dimension placement records; `measureCadDimensionFootprint` supplies text/tolerance extents.

- [x] Demonstrate failures with the real reference dimensions and a non-shaft plate with vertical/horizontal/circular/radial dimensions.
- [x] Place automatic text using paper size/gap, tight dimension lanes, outside-arrow fit and readable angular/radial positions.
- [x] Leave manual/legacy coordinates untouched; consume manual chain offsets exactly.
- [x] Render line/profile diameters and circular diameters using their correct native CAD expression without changing engineering semantics.

### Task 4: Symbol layout and export composition

**Files:** extracted CAD symbol layout module, `engineering-dxf-export.ts`, profile/renderer integration and focused tests.

- [x] Group GD&T rows by actual target and datum relation; size cells from content.
- [x] Place automatic datum frames and roughness symbols around the controlled geometry, attach related symbols, route leaders around text/frame obstacles.
- [x] Respect stored label/frame anchors and emit all explicitly required visible notes.
- [x] Export one deterministic scene with content and placement records usable by acceptance checks.

### Task 5: Real reference acceptance

**Files:** real-flow golden acceptance test/runner and test-only explicit requirement input.

- [x] Import initial DXF and region document, use production planners and actual reducers/services to apply explicit reference requirements.
- [x] Persist and restore the resulting Drawing/plan, then call the same exporter as the plugin endpoint.
- [x] Compare every dimension/symbol/annotation against the independent manifest, including targets, values, tolerances, placement and native regeneration.
- [ ] Address each failure without hiding it or importing target pictures into production.

### Task 6: Product verification and delivery

- [x] Inspect full-size rendered output and per-item report; unresolved/unsupported items remain visible failures.
- [x] Run relevant lifecycle, export and non-shaft checks, TypeScript checks and diff checks.
- [x] Run `pnpm build:dsh-space`, `pnpm build:dsh-annotation`, and `pnpm check:dsh-build-freshness`.
- [x] Deliver actual output files and itemized results with any concrete remaining limitation.

### Verification evidence and open acceptance boundary

- Latest relevant export suite: 117 checks passed, including actual DXF arrow triangles, plain TEXT width, BYBLOCK witness color, merged native tolerance/gap overrides and CAXA roughness lengths/angles.
- Lifecycle/domain/Host-contract suite: 183 checks passed, including manual positions, custom text, hidden closures, saved-state recovery, leader branches and source station ownership.
- Annotation Host TypeScript and diff checks passed after the final code changes. Non-shaft plate/circle/radius/rotated cases remain part of the export checks.
- The complete golden acceptance checkbox above remains open: exact reference placement/encoding differences, unbound plain reference labels, common-datum typing and target CAD fonts/regeneration limitations must remain visible in the delivered report.
