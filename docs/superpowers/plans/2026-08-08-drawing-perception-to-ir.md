# Drawing Perception to Drawing IR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make image/PDF Agent inputs produce auditable Drawing IR commits and optionally continue with a text modification on the resulting revision.

**Architecture:** Store uploads as local source artifacts, classify combined input, convert validated observations directly into typed DrawingCommand batches, and execute every batch through the existing Drawing Application transaction boundary. The existing text planner resumes only after reconstruction commits establish the latest revision.

**Tech Stack:** TypeScript 5.8, Express 4, Vitest 3, Drawing Core V1, Drawing Agent Runtime, Drawing Perception, Poppler, local file stores.

## Global Constraints

- Work on `main`; do not create branches or subagents.
- No `SpatialIntent` or `SpatialModel` in the production perception path.
- No media bytes, model names or hidden reasoning in public run views or audit payloads.
- At most 25 nodes per perception transaction.
- Confidence below `0.6` creates a red candidate; required geometry values are never guessed.
- The first progress response is immediate and silence heartbeat remains below 30 seconds.

---

### Task 1: Drawing-native observation contract

**Files:** Modify `api/services/drawing-perception/types.ts`; modify its tests and geometry helpers.

**Produces:** Observation types depending only on `src/drawing`, with explicit `sourceId`, evidence references and Drawing-native anchors.

- [ ] Add failing dependency and validation tests rejecting legacy Core types and embedded media.
- [ ] Run the focused tests and confirm the legacy dependency failure.
- [ ] Replace legacy type imports with Drawing IR equivalents and validate source/evidence metadata.
- [ ] Run focused tests, typecheck and commit.

### Task 2: Observation to DrawingCommand resolver

**Files:** Replace `api/services/drawing-perception/build-patches.ts`; update `build-patches.test.ts`.

**Produces:** `buildObservationCommandBatches(input): DrawingCommandBatch[]` with stable IDs, commands, postconditions, evidence and confidence.

- [ ] Write failing tests for every supported primitive, text/dimension references, candidate quality, stable IDs, invalid omission and 25-node limits.
- [ ] Verify tests fail because batches still contain SpatialIntent.
- [ ] Implement deterministic DrawingCommand construction and postconditions.
- [ ] Run resolver, Drawing Core and type tests; commit.

### Task 3: Source Artifact Store and combined-input interpreter

**Files:** Create `api/services/source-artifacts/*`; create `api/services/drawing-agent/input-interpreter.ts`; update their tests.

**Produces:** content-addressed local artifact references and `DrawingInputMode` classification without retaining bytes in runtime state.

- [ ] Write failing storage tests for dedupe, MIME/size validation, byte-free metadata and scoped reads.
- [ ] Write failing interpreter tests for text-only, image-only, analysis-only and reconstruct-then-modify.
- [ ] Implement the minimal stores and deterministic classification with a structured-model fallback interface.
- [ ] Run focused tests and commit.

### Task 4: Perception pipeline DrawingCommand output

**Files:** Modify `pipeline.ts`, `pipeline.test.ts`, `observation-store.ts` and audit types.

**Produces:** stage receipts, analysis summary and DrawingCommand batches; never SpatialIntent.

- [ ] Update recorded pipeline tests first and confirm compile/failure against old patch output.
- [ ] Route topology/association output through the Drawing-native resolver.
- [ ] Persist source-linked observations and bounded summaries without media.
- [ ] Run perception/audit tests and commit.

### Task 5: Runtime reconstruction and revision handoff

**Files:** Modify Drawing Agent runtime/types/state/tool tests.

**Produces:** analyze-only completion, per-component transactional reconstruction and reconstruction-then-modify continuation.

- [ ] Write failing runtime integration tests for the three input modes, per-component atomicity, candidates, pause/stop cleanup and revision handoff.
- [ ] Add perception/source dependencies and execute batches through preview/commit tools.
- [ ] Refresh revision after commits and call the existing planner only for the remaining modification goal.
- [ ] Persist source/stage/observation/commit audit events and run focused tests; commit.

### Task 6: HTTP client and UI upload integration

**Files:** Modify `agent-runs.ts`, `agent-client.ts`, `useStore.ts`, task presentation and tests.

**Produces:** one bounded attachment request, structured rejection, perception stages, analysis summary and canonical workspace refresh.

- [ ] Write failing route/client/store tests for PNG/PDF, combined text, no toggle, byte-free run projection and terminal summaries.
- [ ] Save the artifact before starting runtime and pass only its reference.
- [ ] Remove the local migration guard and render perception progress using the existing task card.
- [ ] Run HTTP/UI tests and commit.

### Task 7: Real baseline and migration closure

**Files:** Add a local baseline script and update architecture status/docs.

**Produces:** reproducible `test1.jpg` measurements and a clean production dependency boundary.

- [ ] Add a failing dependency test that scans production perception code for `SpatialIntent`/legacy Core imports.
- [ ] Add and run the local baseline against `test1.jpg`, writing only ignored metrics/structured observations.
- [ ] Exercise image-only, analysis-only and image+modification browser flows.
- [ ] Run full tests, typecheck, lint, build and `git diff --check`; commit.
