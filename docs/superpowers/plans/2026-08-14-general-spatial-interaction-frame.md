# General Spatial Interaction Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project exact semantic and edit evidence into one bounded world-coordinate interaction protocol that the canvas renders precisely for arbitrary 2D tasks.

**Architecture:** A pure backend projector resolves World Model references and Drawing IR deltas into `spatial` overlay frames. Model tools attach these frames to real tool outputs, the runtime forwards them without adding model stages, and the existing SVG canvas renders a restrained CAD-style animation layer.

**Tech Stack:** TypeScript, Vitest, React 19 server rendering tests, SVG, existing Drawing IR and World Model modules.

## Global Constraints

- Drawing IR remains the only writable truth.
- No object-specific semantics or action rules.
- No mandatory extra model call for simple tasks.
- Overlay payloads are bounded to 96 strokes, markers, and vectors.
- Existing uncommitted workspace changes must be preserved.

---

### Task 1: Spatial interaction protocol and exact projector

**Files:**
- Modify: `src/contracts/drawing-agent.ts`
- Create: `api/services/drawing-interaction/projector.ts`
- Create: `api/services/drawing-interaction/projector.test.ts`
- Create: `api/services/drawing-interaction/index.ts`

**Interfaces:**
- Consumes: `WorldModelSlice`, `SemanticEntityHypothesis`, `DrawingDocument`.
- Produces: `projectGroundingFrame`, `projectActionFrame`, `projectDrawingDeltaFrame` returning the new `DrawingAgentCanvasOverlay` spatial variant.

- [ ] Write a failing test that selects one SourceSpan of a split line and asserts that only its samples are emitted as a target stroke.
- [ ] Run `pnpm vitest run api/services/drawing-interaction/projector.test.ts` and confirm the missing module/type failure.
- [ ] Add the spatial overlay contract and minimal exact reference projector.
- [ ] Add failing cases for excluded supports, HalfEdge direction, interface points, delta before/after strokes, motion vectors, and output budgets.
- [ ] Implement those cases and rerun the focused test until green.

### Task 2: Grounding and action tools emit precise frames

**Files:**
- Modify: `api/services/drawing-world-model/tools.ts`
- Modify: `api/services/drawing-world-model/tools.test.ts`

**Interfaces:**
- Consumes: Task 1 projector functions.
- Produces: `interactionFrame` on `ground_semantic_entities`, `refine_semantic_entity`, and `propose_spatial_actions` outputs.

- [ ] Extend the existing Grounding tool test to require target SourceSpan, excluded context, and interface marker output; run it and confirm failure because `interactionFrame` is absent.
- [ ] Attach frames generated from the revision-bound Slice and current hypothesis.
- [ ] Extend the proposal test to require a planning frame and verify read-only behavior remains unchanged.
- [ ] Run `pnpm vitest run api/services/drawing-world-model/tools.test.ts` until green.

### Task 3: Preview tools emit generic before/after evidence

**Files:**
- Modify: `api/services/drawing-tools/drawing-tools.ts`
- Modify: `api/services/drawing-tools/drawing-tools.test.ts`

**Interfaces:**
- Consumes: `projectDrawingDeltaFrame(before, after, changedNodeIds, options)`.
- Produces: `interactionFrame` on `preview_transaction`, `preview_connected_transform`, and rendered `evaluate_preview` outputs.

- [ ] Add a failing Preview test asserting before/after strokes and a motion vector for an arbitrary line edit.
- [ ] Generate the frame from canonical and counterfactual Drawing IR without changing transaction semantics.
- [ ] Add a failing connected transform assertion for exact interface markers derived from compiled ports.
- [ ] Implement port marker projection and rerun focused DrawingModelTools tests.

### Task 4: Runtime policy and exact frame forwarding

**Files:**
- Modify: `api/services/drawing-agent/tool-catalog-policy.ts`
- Modify: `api/services/drawing-agent/tool-catalog-policy.test.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.test.ts`

**Interfaces:**
- Consumes: tool output `interactionFrame`.
- Produces: progress events whose overlay is the precise frame, with legacy overlay fallback.

- [ ] Add failing policy and prompt tests proving optional Grounding remains reachable for a resolved World Model and forbids overlap-as-authorization.
- [ ] Add a failing Runtime test expecting `kind: spatial` from a real Grounding tool result.
- [ ] Implement catalog availability, prompt guidance, safe frame forwarding, and fallback behavior.
- [ ] Run the four focused Agent test files until green.

### Task 5: CAD-style spatial frame rendering

**Files:**
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/Canvas.test.tsx`

**Interfaces:**
- Consumes: the spatial overlay contract.
- Produces: non-interactive SourceSpan strokes, interface markers, motion vectors, and one compact phase label.

- [ ] Add a failing server-render test for target, excluded, interface, vector, animation, and `pointer-events: none` attributes.
- [ ] Implement the restrained cyan/amber/slate SVG layer with zoom-independent widths and sizes.
- [ ] Ensure legacy nodes, paths, points, preview, and diagnostics overlays still render.
- [ ] Run `pnpm vitest run src/components/Canvas.test.tsx` until green.

### Task 6: Regression, build, and browser acceptance

**Files:**
- Modify only if a regression test exposes a defect.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified local product behavior.

- [ ] Run all focused suites from Tasks 1–5 together.
- [ ] Run `pnpm check`, `pnpm lint`, `pnpm build`, and `pnpm test` and inspect every failure.
- [ ] Start the local server and use the in-app browser to upload a drawing and submit a semantic edit.
- [ ] Verify Grounding follows exact partial contours, interface points appear at real connections, Preview displays before/after motion, and terminal events clear the overlay.
- [ ] Review `git diff --check`, the final diff, and the design acceptance criteria before reporting completion.

