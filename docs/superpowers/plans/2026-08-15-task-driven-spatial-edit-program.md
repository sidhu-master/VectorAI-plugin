# Task-Driven Spatial Edit Program Implementation Plan

> **Execution note:** This plan is executed continuously on `main` in the current workspace. Existing user changes must be preserved. Each task follows test-first development and is verified before moving on.

**Goal:** Let a model express a compact, task-specific spatial edit plan while deterministic code resolves coordinates and compiles it into an auditable Drawing IR Preview.

**Architecture:** Add one `preview_spatial_program` fast-path tool. It parses a typed program, resolves observation/world/node-anchor references, compiles generic operations into Drawing Commands, creates a normal Preview, projects real interaction evidence, and enters the existing independent review loop. Grounding candidates remain optional for ambiguity and raw transactions remain available for full control.

**Tech Stack:** TypeScript, Vitest, existing Drawing IR/transaction/application/tool/runtime modules, React canvas interaction protocol.

## Global constraints

- No semantic or test2-specific production rules.
- Drawing IR remains the only writable truth.
- No commit before Preview and existing decision flow.
- A simple resolved task must not require an extra model call.
- Observation coordinates are resolved by code, never by prompt-side matrix arithmetic.
- Compile errors are atomic and machine-readable; no partial Preview or silent guessing.

### Task 1: Observation-bound coordinate lookup

**Files:**
- Modify: `api/services/drawing-vision/observation-builder.ts`
- Modify: `api/services/drawing-vision/observation-builder.test.ts`
- Modify: `api/services/drawing-application/application.ts`
- Modify: `api/services/drawing-application/application.test.ts`
- Create: `api/services/drawing-spatial-program/point-resolver.ts`
- Create: `api/services/drawing-spatial-program/point-resolver.test.ts`

- [ ] Add failing tests for reading a view by observation ID, drawing/revision isolation, expiry, and affine inverse round-trip including inverted Y.
- [ ] Expose immutable revision-bound observation metadata without exposing image bytes or mutable cache state.
- [ ] Implement `SpatialPointRef` resolution for observation, document-world, and node-anchor references.
- [ ] Return stable error codes for missing, stale, foreign, unsupported, or singular references.
- [ ] Run the three focused suites until green.

### Task 2: Program protocol and generic compiler

**Files:**
- Create: `api/services/drawing-spatial-program/types.ts`
- Create: `api/services/drawing-spatial-program/parser.ts`
- Create: `api/services/drawing-spatial-program/parser.test.ts`
- Create: `api/services/drawing-spatial-program/compiler.ts`
- Create: `api/services/drawing-spatial-program/compiler.test.ts`
- Create: `api/services/drawing-spatial-program/index.ts`

- [ ] Add failing schema tests for valid programs and malformed operations, point refs, confidence, empty targets, and out-of-range normalized points.
- [ ] Implement strict parsing with bounded operation/node/reference counts.
- [ ] Add failing compiler tests for generic translate, endpoint edits on open geometry, path creation, deletion, sequential composition, preserve conflicts, and atomic failure.
- [ ] Implement compilation to existing Drawing Commands without mutating canonical state.
- [ ] Add postcondition diagnostics for anchor coincidence, anchor-at, unchanged nodes, and closed paths.
- [ ] Prove unmentioned nodes remain byte-equivalent and rerun focused tests.

### Task 3: `preview_spatial_program` model tool

**Files:**
- Modify: `api/services/drawing-tools/drawing-tools.ts`
- Modify: `api/services/drawing-tools/drawing-tools.test.ts`
- Modify: `api/services/drawing-tools/catalog.ts`
- Modify: `api/services/drawing-tools/index.ts`
- Modify: `api/services/drawing-tools/types.ts`

- [ ] Add a failing tool contract test requiring the program schema and compact result contract.
- [ ] Add failing integration tests for canonical-based Preview, observation point mapping, `replacesPreviewHandle`, stale observation rejection, and preserve conflict.
- [ ] Compile the program and feed its commands into the existing Preview/counterfactual machinery.
- [ ] Return normalized program, resolution/operation receipts, diagnostics, Preview observation, counterfactual reference, and interaction frame.
- [ ] Ensure the existing registry still owns audit, timeout, revision and write semantics.
- [ ] Run DrawingModelTools and registry focused suites until green.

### Task 4: Live interaction projection

**Files:**
- Modify: `api/services/drawing-interaction/projector.ts`
- Modify: `api/services/drawing-interaction/projector.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`

- [ ] Add failing projector tests for program targets, observation/node anchors, interfaces, motion vectors and Preview before/after strokes.
- [ ] Project a bounded pre-execution planning frame from model inputs and a precise post-execution delta frame from the compiled Preview.
- [ ] Add the new tool to projectable intent, overlay forwarding, progress presentation and preview-delta extraction.
- [ ] Assert UI progress is based on actual tool data and independent review starts for the new Preview.
- [ ] Run projector and runtime suites until green.

### Task 5: Model policy and review loop

**Files:**
- Modify: `api/services/drawing-agent/tool-catalog-policy.ts`
- Modify: `api/services/drawing-agent/tool-catalog-policy.test.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Modify: `api/services/drawing-agent/context-ledger.ts`
- Modify: `api/services/drawing-agent/context-ledger.test.ts`
- Modify: `api/services/drawing-agent/preview-verifier.ts`
- Modify: `api/services/drawing-agent/preview-verifier.test.ts`

- [ ] Add failing prompt/policy tests proving the program is the default resolved-task path while local grounding and raw editing stay reachable.
- [ ] Tell the model to externalize an action plan, use observation refs, preserve unmentioned content, and avoid manual coordinate inversion.
- [ ] Teach alias/context compaction about program node references and compact receipts without losing Preview identity.
- [ ] Ensure the independent reviewer receives the program summary and the exact Preview handle it evaluates.
- [ ] Verify the main model can explicitly revise a Preview or replace it from canonical after feedback.

### Task 6: Generic regression and architecture documents

**Files:**
- Create: `api/services/drawing-spatial-program/spatial-program.integration.test.ts`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/agent-execution-flow.md`

- [ ] Build a semantic-neutral fixture with a carrier geometry, two connector paths, nearby unrelated geometry and an observation transform.
- [ ] Execute a program that moves the carrier, reconnects explicit interfaces, preserves unrelated geometry and satisfies declared postconditions.
- [ ] Assert canonical is unchanged before commit, the Preview has no dangling interfaces, unrelated geometry is unchanged, and commit is atomic/auditable.
- [ ] Update product and architecture docs so task-driven programs are primary, local candidates are optional, and free redraw remains an escape hatch.
- [ ] Search production source for prohibited example-specific rules and remove any remaining ones.

### Task 7: Full verification and browser acceptance

**Files:**
- Modify only when verification exposes a defect.

- [ ] Run all spatial-program, tool, runtime, verifier and application focused suites together.
- [ ] Run `pnpm check`, `pnpm lint`, `pnpm build`, and the repository test command.
- [ ] Run `git diff --check` and inspect the task-specific diff for accidental user-file changes.
- [ ] Restart local services and use the in-app browser to upload the clean line drawing and submit a general spatial edit.
- [ ] Verify the canvas shows actual target/anchor/motion/Preview evidence, review feedback binds to the right Preview, and canonical changes only after acceptance.
- [ ] Record any remaining model-quality limitation separately from architecture/test failures.
