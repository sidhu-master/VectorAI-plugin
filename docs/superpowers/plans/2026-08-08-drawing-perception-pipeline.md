# Drawing Perception and Dimension Association Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert drawing images/PDF pages into auditable geometry/annotation observations, deterministic dimension associations, and bounded SpatialPatch commits.

**Architecture:** A Drawing Perception service runs independent tools for normalization, sheet/view analysis, geometry detection, annotation OCR, topology, association and patch building. Media is cached ephemerally; observations and receipts are structured and replayable.

**Tech Stack:** TypeScript 5.8, Express 4, Vitest 3, Poppler, existing OpenAI-compatible gateway, Spatial Protocol v0.2.

## Global Constraints

- Do not couple stages to object names or page top-to-bottom order.
- All image/crop calls use the Agent vision role and default `doubao-seed-2.0-lite`.
- Raw images/crops never enter audit payloads or hot context.
- At most 25 entities per SpatialPatch batch.
- Low-confidence valid entities commit red; missing required parameters are never guessed.
- Ambiguous dimensions remain unresolved with candidates; conflicts never mutate geometry.
- Work on `main` using only the main agent.

---

### Task 1: Observation and Drawing Manifest Types

**Files:**
- Create: `api/services/drawing-perception/types.ts`
- Create: `api/services/drawing-perception/types.test.ts`
- Create: `api/services/drawing-perception/validate.ts`

**Interfaces:**
- Produces `DrawingManifest`, `DrawingView`, `GeometryObservation`, `AnnotationObservation`, `DimensionAssociation`, and strict validators.

```ts
interface DrawingManifest {
  runId: string;
  page: number;
  unit?: 'mm' | 'cm' | 'm';
  scale?: number;
  views: DrawingView[];
  warnings: string[];
}
```

- [ ] Write failing tests for valid observations, normalized image bounds, confidence ranges, missing evidence coordinates, unsupported kinds and media-field rejection.
- [ ] Run focused tests; expect missing-module failure.
- [ ] Implement serializable types and validators that reject `image`, `base64`, `prompt`, `token` and credential-like payload keys.
- [ ] Run focused tests and `pnpm check`.
- [ ] Commit with `feat(perception): define drawing observations`.

### Task 2: Ephemeral Drawing Asset and Crop Cache

**Files:**
- Create: `api/services/drawing-perception/assets.ts`
- Create: `api/services/drawing-perception/assets.test.ts`
- Modify: `api/services/agent-runtime/attachments.ts`

**Interfaces:**
- Produces `DrawingAssetCache.putPage()`, `crop()`, `metadata()`, and `releaseRun()`.
- Crop references contain only `assetId`, bounds, mimeType and SHA-256 hash outside the cache.

- [ ] Write tests proving PDF first-page conversion occurs once, repeated crop requests reuse bytes, invalid/out-of-bounds crops fail, stop/completion releases assets, and serialized metadata has no bytes.
- [ ] Run focused tests; expect missing cache.
- [ ] Implement an in-memory run-scoped cache with explicit byte/count limits and AbortSignal propagation.
- [ ] Run attachment/cache tests and `pnpm check`.
- [ ] Commit with `feat(perception): cache drawing pages and crops`.

### Task 3: Vision Tool Adapters for Sheet, Geometry, and OCR

**Files:**
- Create: `api/services/drawing-perception/vision-tools.ts`
- Create: `api/services/drawing-perception/vision-tools.test.ts`
- Modify: `api/services/ai-gateway.ts`

**Interfaces:**
- Produces `analyzeSheet()`, `segmentViews()`, `detectDatums()`, `detectGeometry()`, and `extractAnnotations()` adapters.
- Every adapter accepts `{ modelName, image, mimeType, signal, deadlineAt }` and returns validated structured data.

- [ ] Write recorded-response tests for JSON parsing, CAD type rejection, OCR symbols (`R`, `Ø`, `°`, `±`), tolerance parsing, malformed output correction errors, AbortSignal, and explicit model forwarding.
- [ ] Run focused tests; expect missing adapters.
- [ ] Add small role-specific prompts and a shared structured-response parser; do not reuse the monolithic Spatial Intent prompt.
- [ ] Run focused tests, gateway tests and `pnpm check`.
- [ ] Commit with `feat(perception): add drawing vision tools`.

### Task 4: Deterministic Topology and Dimension Association

**Files:**
- Create: `api/services/drawing-perception/topology.ts`
- Create: `api/services/drawing-perception/associate-dimensions.ts`
- Create: `api/services/drawing-perception/association.test.ts`

**Interfaces:**
- Produces connected components, closed contours, endpoint/intersection/tangent candidates, and scored DimensionAssociations.

```ts
interface AssociationWeights {
  arrowContact: number;
  leaderIntersection: number;
  distance: number;
  direction: number;
  symbolCompatibility: number;
}
```

- [ ] Write synthetic tests for diameter-to-circle, radius-to-arc, aligned distance, angular dimensions, ordinate anchors, two close candidates becoming ambiguous, conflicts, repeated features and disconnected views.
- [ ] Run focused tests; expect missing scoring functions.
- [ ] Implement deterministic geometry in image coordinates and return reasons for every score contribution.
- [ ] Mark ambiguous when top-two score delta is below the configured threshold; do not call a model in this module.
- [ ] Run focused tests and `pnpm check`.
- [ ] Commit with `feat(perception): associate drawing dimensions`.

### Task 5: Observation-to-Patch Builder

**Files:**
- Create: `api/services/drawing-perception/build-patches.ts`
- Create: `api/services/drawing-perception/build-patches.test.ts`
- Modify: `src/core/runtime/receipts.ts`

**Interfaces:**
- Produces ordered batches `{ componentId, intent, observationIds, confidence }`, each compiling to at most 25 entities.

- [ ] Write tests for primary contours before internal features, independent connected components, repeated features, low-confidence red entities, unresolved dimensions, stable IDs, and 25-entity batch limits.
- [ ] Run focused tests; expect missing builder.
- [ ] Implement coordinate-transform application, Observation-to-Intent conversion and structured receipts without media.
- [ ] Compile every generated Intent through the real v0.2 compiler in tests.
- [ ] Run Core/perception tests and `pnpm check`.
- [ ] Commit with `feat(perception): build bounded drawing patches`.

### Task 6: Drawing Pipeline Orchestrator and Audit

**Files:**
- Create: `api/services/drawing-perception/pipeline.ts`
- Create: `api/services/drawing-perception/pipeline.test.ts`
- Create: `api/services/drawing-perception/observation-store.ts`
- Modify: `api/services/audit/types.ts`
- Modify: `api/services/audit/file-audit-store.ts`

**Interfaces:**
- Produces `DrawingPerceptionPipeline.run()` as an async sequence of stage receipts and patch batches.
- Stores manifests/observations/associations as JSON without media.

- [ ] Write a recorded two-view integration test covering stage order, crop reuse, geometry/OCR parallelism, deterministic association, local observation files, cancellation and no-media audit assertions.
- [ ] Run focused tests; expect missing pipeline.
- [ ] Implement bounded parallel geometry/OCR calls per view, shared deadlines, release-on-terminal and queued audit writes.
- [ ] Run perception/audit/full tests and `pnpm check`.
- [ ] Commit with `feat(perception): orchestrate drawing reconstruction`.

### Task 7: Agent Runtime Integration and test1 Baseline Command

**Files:**
- Modify: `api/services/agent-runtime/runtime.ts`
- Modify: `api/services/agent-runtime/runtime.test.ts`
- Modify: `src/components/ConstructionTimeline.tsx`
- Create: `scripts/test-drawing.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Image/PDF Agent runs invoke DrawingPerceptionPipeline instead of the monolithic drawing executor.
- Adds `pnpm test:drawing -- <absolute-or-relative-image-path>` for local non-CI baselines.

- [ ] Write runtime tests proving text tasks keep the old executor, drawing tasks emit named perception stages, each valid batch becomes a Commit, a component failure does not corrupt earlier commits, pause/stop release assets, and guidance replans remaining components.
- [ ] Run focused tests; expect the monolithic executor path.
- [ ] Integrate the pipeline through the existing capability registry and progress channel.
- [ ] Implement the local baseline command to print accepted latency, per-stage duration, observations, associations, commits, low-confidence counts and terminal status without printing media.
- [ ] Run the command against local `test1.jpg`; store output only under ignored `.local/vectorai/baselines/`.
- [ ] Run `pnpm test && pnpm check && pnpm build`; run full lint and document unrelated debt.
- [ ] Commit with `feat(agent): reconstruct drawings through perception pipeline`.
