# DSH Semantic Editing Parity Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder DSH semantic-edit path with the same provider-neutral observation, grounding, topology, connected-transform, diagnostics, and visual-revision behavior previously used by the Web production path.

**Architecture:** Extract the mature algorithms from `api/services` into the existing Host-neutral `@vectorai/drawing-spatial` and `@vectorai/drawing-edit-core` packages, then make both the legacy Web adapter and DSH Host consume those packages. DSH tools expose bounded semantic and observation references; the Host owns coordinate resolution, interface discovery, pose solving, Preview diagnostics, and revision decisions.

**Tech Stack:** TypeScript, Zod, Vitest, DSH rc.8 tools/attachments/subagents, local Sharp rendering, VectorAI Drawing IR.

**Spec:** `docs/superpowers/specs/2026-08-21-dsh-semantic-edit-auto-safe-design.md`

## Global Constraints

- No Express or VectorAI cloud service is required by the DSH runtime.
- Production code contains no object-category or action-specific rules such as hand, arm, wave, or greeting.
- Drawing IR is the only writable source of truth; observation, topology, grounding, and reviewer output are revision-bound evidence.
- Models never hand-calculate affine transforms, arbitrary pivots, or connector endpoints when a deterministic resolver can compute them.
- Every formal write remains previewed, durable, idempotent, and undoable.
- The existing Web adapter and DSH adapter must share the extracted algorithms rather than maintain copies.

---

### Task 1: Freeze Real Parity Regressions

**Files:**
- Create: `packages/drawing-edit-core/src/connected-transform-parity.test.ts`
- Create: `packages/plugin-dsh-space-host/src/semantic-parity.test.ts`
- Modify: `scripts/test2-self-semantic-edit.ts`

**Interfaces:**
- Consumes: the current Drawing IR fixture and the recorded legacy connected-transform audit.
- Produces: provider-independent assertions for exact contacted endpoints, minimum-deformation pose, unchanged unrelated geometry, and revise-before-finalize behavior.

- [ ] **Step 1: Write a failing generic carrier regression**

  Build a fixture containing one closed carrier, two true open connectors, one nearby non-contacting connector, and one line whose opposite endpoint is near the carrier but not on its boundary. Assert that only the two true contacted endpoint slots are changed and the solver chooses `orientationMode: 'minimum-deformation'` when rotation is omitted.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm vitest run packages/drawing-edit-core/src/connected-transform-parity.test.ts`

  Expected: FAIL because the new core has no contact projection or minimum-deformation solver.

- [ ] **Step 3: Add a failing DSH semantic-chain regression**

  Assert that `observe` returns a render artifact, `buildContext` returns bounded vector/topology facts, the model-facing pose request contains no raw pivot, and a negative reviewer outcome cannot be finalized without a replacement candidate.

- [ ] **Step 4: Run the Host regression and verify RED**

  Run: `pnpm vitest run packages/plugin-dsh-space-host/src/semantic-parity.test.ts`

  Expected: FAIL on empty `artifactRefs`, digest-only Context, raw-pivot pose API, and missing revise enforcement.

- [ ] **Step 5: Commit the red parity baseline**

  Commit: `test: freeze semantic edit parity regressions`

### Task 2: Extract Spatial Observation, World Model, and Point Resolution

**Files:**
- Create: `packages/drawing-spatial/src/geometry-sampling.ts`
- Create: `packages/drawing-spatial/src/world-model.ts`
- Create: `packages/drawing-spatial/src/point-resolver.ts`
- Create: `packages/drawing-spatial/src/grounding-ledger.ts`
- Create: `packages/drawing-spatial/src/topology-part-resolver.ts`
- Modify: `packages/drawing-spatial/src/index.ts`
- Modify: `packages/drawing-spatial/package.json`
- Modify: legacy modules under `api/services/drawing-world-model`, `api/services/drawing-grounding`, `api/services/drawing-spatial-program`, and `api/services/drawing-spatial` to import/re-export the shared implementation.

**Interfaces:**
- Consumes: `DrawingDocument`, revision, bounded node/bounds filters, observation transform metadata, semantic anchors, and injected `digest(value)`.
- Produces: `compileWorldModel(document, revision, request)`, `resolveSpatialPoint(ref, context)`, `GroundingLedger`, and `TopologyPartResolver.resolve(input)` with no DSH, Express, React, filesystem, or model dependencies.

- [ ] **Step 1: Port existing unit tests to package-level imports and verify RED**

  Preserve the legacy tests for SourceSpan/half-edge/face construction, incidence-vs-connected separation, observation Y inversion, node anchors, ledger scope, sparse-anchor traversal, protected boundaries, and truncation.

- [ ] **Step 2: Extract geometry sampling and World Model with injected digest**

  Replace direct Node `crypto` use with:

  ```ts
  export interface SpatialCorePorts {
    digest(value: string): string;
  }
  ```

  Keep canonical ordering and the existing continuation/truncation semantics.

- [ ] **Step 3: Extract observation/world/node-anchor point resolution**

  Preserve strict drawing/revision/view identity checks and resolve normalized image coordinates through the stored `worldToImage` inverse; never expose the matrix for model calculation.

- [ ] **Step 4: Extract Grounding Ledger and TopologyPartResolver**

  Preserve exact evidence events, selected hypothesis state, SourceSpan/HalfEdge ranges, protected contact rejection, and traversal budgets.

- [ ] **Step 5: Convert legacy modules into compatibility adapters**

  Existing Web imports must call the package implementation so future fixes cannot diverge.

- [ ] **Step 6: Verify and commit**

  Run: `pnpm vitest run packages/drawing-spatial api/services/drawing-world-model api/services/drawing-grounding api/services/drawing-spatial-program/point-resolver.test.ts api/services/drawing-spatial/topology-part-resolver.test.ts`

  Commit: `refactor: extract shared spatial grounding core`

### Task 3: Extract the Mature Connected-Transform Strategy and Diagnostics

**Files:**
- Create: `packages/drawing-edit-core/src/connected-transform.ts`
- Create: `packages/drawing-edit-core/src/connected-transform.test.ts`
- Modify: `packages/drawing-edit-core/src/compiler.ts`
- Modify: `packages/drawing-edit-core/src/index.ts`
- Modify: `api/services/drawing-spatial-actions/connected-transform.ts`

**Interfaces:**
- Consumes: a closed carrier target, desired target center or resolved displacement, optional explicit rotation, and the current Drawing.
- Produces:

  ```ts
  compileConnectedTransform({ document, carrierNodeId, targetCenter, rotationDegrees? }): {
    commands: DrawingTransactionCommand[];
    diagnostics: Diagnostic[];
    audit: ConnectedTransformAudit;
  }
  ```

- [ ] **Step 1: Run the Task 1 parity test and retain the expected RED failure**

- [ ] **Step 2: Port boundary projection and scale-relative contact discovery**

  Use the legacy `0.0025 * drawingDiagonal` contact tolerance, closest-point projection for circle/ellipse carriers, and only open endpoint slots. Never infer contacts from bounding-box overlap or object labels.

- [ ] **Step 3: Port minimum-deformation orientation**

  When rotation is absent, solve the 2D orthogonal Procrustes angle from ordered carrier ports to fixed external anchors. Explicit rotation remains available only when grounded observation evidence supplies it.

- [ ] **Step 4: Port diagnostics and audit**

  Preserve stretch ratio, deformation cost, orientation inversion, and area collapse diagnostics. Diagnostics identify nodes and measured facts but never grant write authority.

- [ ] **Step 5: Route `connected_transform` compilation through the shared strategy**

  The generic compiler translates a semantic pose into the strategy call; it must not independently transform raw endpoint coordinates.

- [ ] **Step 6: Make the Web module a compatibility re-export and verify GREEN**

  Run: `pnpm vitest run packages/drawing-edit-core api/services/drawing-spatial-actions/connected-transform.test.ts api/services/drawing-spatial-program/compiler.test.ts`

  Commit: `feat: share connected transform solver across adapters`

### Task 4: Replace DSH Placeholder Observation, Context, and Grounding

**Files:**
- Create: `packages/plugin-dsh-space-host/src/observation-service.ts`
- Create: `packages/plugin-dsh-space-host/src/context-service.ts`
- Create: `packages/plugin-dsh-space-host/src/grounding-service.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Modify: `packages/drawing-edit-protocol/src/refs.ts`
- Modify: `packages/drawing-edit-protocol/src/spatial-edit-program.ts`

**Interfaces:**
- Consumes: current DrawingRef, optional SelectionProjectionRef, bounded viewport, and model-provided observation anchors/candidate refs.
- Produces: an Observation with local image artifact, Context with bounded exact geometry/connected-carrier/world facts, and Grounding with exact node/range/interface/protected scopes.

- [ ] **Step 1: Extend strict protocol codecs and verify unknown-field rejection**

  Add provider-neutral `ObservationArtifactRef`, `SpatialPointRef`, bounded World Model summary, semantic candidates, knowledge state, and continuation fields. DSH attachment handles remain adapter-only presentation data.

- [ ] **Step 2: Render the canonical observation locally**

  Reuse the local scene renderer, save the PNG through DSH attachments, and retain the matching `worldToImage`, viewport, pixel dimensions, DrawingRef, and content digest in the Host observation store.

- [ ] **Step 3: Build bounded exact Context**

  Include node facts for the selected/queried workset, connected-carrier capability facts, SourceSpan/half-edge topology, knowledge state, and continuation—not merely a digest.

- [ ] **Step 4: Ground semantic candidates through verified evidence**

  Accept selection projection, exact node refs, observation anchors, or World Model candidate refs. Resolve target and interface scopes deterministically; reject unresolved/truncated scopes and keep ambiguous candidates review-only.

- [ ] **Step 5: Replace raw transform parameters with a semantic pose request**

  The preferred DSH tool accepts grounded target plus a resolved destination/displacement reference and optional evidence-bound orientation hint. It does not accept arbitrary `pivot`. The Host selects the connected or rigid strategy from grounded geometry.

- [ ] **Step 6: Verify and commit**

  Run: `pnpm vitest run packages/drawing-edit-protocol packages/plugin-dsh-space-host/src/semantic-parity.test.ts packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts packages/plugin-dsh-space-host/src/tools.test.ts`

  Commit: `feat: restore DSH observation and grounding context`

### Task 5: Restore Visual Revision Feedback as a Real Loop

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/reviewer.ts`
- Modify: `packages/plugin-dsh-space-host/src/review-renderer.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-edit-service.ts`
- Modify: `packages/plugin-dsh-space-host/src/semantic-tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/intake.ts`

**Interfaces:**
- Consumes: authoritative objective, before/after render manifest, changed scopes, deterministic diagnostics, and current candidate lineage.
- Produces: `satisfied | needs_revision | unavailable` with bounded defects and evidence; `needs_revision` makes the current candidate non-finalizable until a new candidate resolves or explicitly supersedes each defect.

- [ ] **Step 1: Add RED tests for negative-review finalize rejection and defect-guided revision**

- [ ] **Step 2: Return reviewer artifacts and repair hints to the root model**

  Keep the reviewer tool-free and read-only. Normalize its structured output and bind defects to candidate/effect/render digests.

- [ ] **Step 3: Enforce candidate replacement after `needs_revision`**

  `drawing_finalize_preview` returns `needs-revision`, never a confirmation card, while sticky defects remain unresolved. `drawing_revise_*` must create a new digest and evaluation before finalize.

- [ ] **Step 4: Keep fail-closed unavailable semantics**

  Reviewer unavailability may require exact human confirmation but may not be reported as visually satisfied.

- [ ] **Step 5: Verify and commit**

  Run: `pnpm vitest run packages/plugin-dsh-space-host/src/reviewer.test.ts packages/plugin-dsh-space-host/src/semantic-parity.test.ts packages/plugin-dsh-space-host/src/semantic-edit-service.test.ts packages/plugin-dsh-space-host/src/tools.test.ts`

  Commit: `feat: restore visual revision feedback loop`

### Task 6: Real DSH Acceptance, Web Parity, and Documentation

**Files:**
- Modify: `docs/architecture/dsh-semantic-edit.md`
- Modify: `docs/dsh-local-development.md`
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `scripts/e2e-visual-edit.ts`

**Interfaces:**
- Consumes: built DSH plugin and a clean imported Drawing fixture.
- Produces: recorded operation receipts, before/after artifacts, exact changed scopes, reviewer result, commit/Undo proof, and a truthful migration-status table.

- [ ] **Step 1: Run provider-independent generic E2E fixtures**

  Cover connected carrier motion with a false nearby line, multi-node rigid transform, observation point resolution, protected topology boundary, reviewer correction, commit, and Undo.

- [ ] **Step 2: Run the real DSH model acceptance**

  Import a clean unmodified drawing, issue the same semantic instruction used in the legacy audit, and verify the model receives the current observation image/context, the Host changes only grounded scopes, reviewer evidence is consumed, and one commit results.

- [ ] **Step 3: Compare against legacy Web invariants**

  Require equivalent target semantics, connected endpoint preservation, unrelated-node equality, diagnostics, Preview rendering, and Undo—not byte-identical model prose or action-specific coordinates.

- [ ] **Step 4: Run full release gates**

  Run: `pnpm test && pnpm check && pnpm build:dsh-space && git diff --check`

- [ ] **Step 5: Update truthful status and commit**

  Remove any statement that Phase 1/5 is complete unless the real acceptance artifacts exist.

  Commit: `docs: record completed DSH semantic parity migration`
