# Real Arm Spatial Solve Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abstract arm in the HyperFrames spatial-solve scene with the real `test2` right-arm geometry, anchor, and 35-degree deterministic rotation.

**Architecture:** Keep the existing single-file HyperFrames composition and its 38-second timeline. Add traceable fixture constants and deterministic coordinate helpers inside `index.html`, generate the SVG paths synchronously, then animate a target group around the fixed shoulder anchor while the faded character context remains static.

**Tech Stack:** HyperFrames HTML composition, SVG, GSAP 3, HyperFrames CLI, FFmpeg/ffprobe.

## Global Constraints

- Preserve 1920×1080, 30 fps, 38-second duration, and transparent root canvas.
- Use `TEST2_SHARED_POLYLINE_POINTS`, `node_test2_hand_outline`, shoulder anchor `[118.992468, 203.546338]`, and a `35°` rotation.
- Do not embed the white background from `test2.png`.
- Do not change the timing or content of the other three scenes.
- Preserve the palette, typography, and motion language in `video-assets/hyperframes/vectorai-model-program-roles/DESIGN.md`.

---

### Task 1: Establish the real-data verification baseline

**Files:**
- Create: `video-assets/hyperframes/vectorai-model-program-roles/verify-real-arm-data.mjs`
- Test: `video-assets/hyperframes/vectorai-model-program-roles/verify-real-arm-data.mjs`

**Interfaces:**
- Consumes: `api/services/drawing-spatial/test2-fixture.ts`, `scripts/test2-self-semantic-edit.ts`, and the composition HTML.
- Produces: a zero-exit verification that the HTML embeds every fixture point, the exact anchor, and the 35-degree transform.

- [ ] **Step 1: Write a verification script that reads both source files and initially fails because the composition has no fixture constants**

The script must extract the five shared-polyline points and six hand-outline points, assert that each appears in `index.html`, assert the exact anchor and `REAL_ARM_ANGLE_DEGREES = 35`, and recompute rotated points with the standard 2D rotation formula.

- [ ] **Step 2: Run the verification and confirm the missing constants fail**

Run: `node verify-real-arm-data.mjs`

Expected: non-zero exit identifying absent `REAL_ARM_*` data in `index.html`.

### Task 2: Replace the abstract spatial-solve drawing

**Files:**
- Modify: `video-assets/hyperframes/vectorai-model-program-roles/index.html`
- Modify: `video-assets/hyperframes/vectorai-model-program-roles/DESIGN.md`

**Interfaces:**
- Consumes: the exact `test2` points and anchor checked by Task 1.
- Produces: `REAL_ARM_SHARED_POINTS`, `REAL_ARM_HAND_POINTS`, `REAL_ARM_ANCHOR`, `REAL_ARM_ANGLE_DEGREES`, SVG path builders, and a GSAP-addressable `#real-arm-target` group.

- [ ] **Step 1: Add explicit fixture constants and deterministic SVG mapping helpers**

Use the document-to-SVG mapping `x' = originX + x * scale`, `y' = originY - y * scale`. Compute the group pivot from `REAL_ARM_ANCHOR`; do not hardcode rotated screen coordinates.

- [ ] **Step 2: Build the hero-frame layout before animation**

Draw a faded simplified character context, the protected body fragment, the highlighted target fragment and hand outline, the locked shoulder anchor, a rotation arc, and compact status labels for `θ = 35°`, `ANCHOR LOCKED`, `TOPOLOGY PRESERVED`, and `PREVIEW VALID`.

- [ ] **Step 3: Replace the previous line-endpoint tweens**

Animate `#real-arm-target` with `rotation: -35` and `svgOrigin` set to the mapped shoulder anchor. Keep the anchor group stationary and reveal validation labels only after the rotation resolves.

- [ ] **Step 4: Run the real-data verifier and confirm it passes**

Run: `node verify-real-arm-data.mjs`

Expected: zero exit with counts for five shared points, six hand points, one anchor, and a 35-degree rotation.

### Task 3: Validate composition structure and visual layout

**Files:**
- Verify: `video-assets/hyperframes/vectorai-model-program-roles/index.html`

**Interfaces:**
- Consumes: the updated composition.
- Produces: clean HyperFrames validation and inspected hero frames.

- [ ] **Step 1: Run lint and browser validation**

Run the direct HyperFrames CLI with `lint` and `validate` in the composition directory.

Expected: zero errors and zero warnings.

- [ ] **Step 2: Inspect the edited scene at build, pre-rotation, mid-rotation, and resolved timestamps**

Run `inspect --at 13.8,15.5,17.1,18.4,19.5 --json`.

Expected: no overflow, clipping, or contrast issues.

- [ ] **Step 3: Render a QA contact sheet and visually inspect it**

Capture the same timestamps and assemble them against a contrasting background. Confirm that the character context is legible, the real arm remains attached to the shoulder, and the data labels do not obscure the target.

### Task 4: Render and verify transparent deliverables

**Files:**
- Replace: `video-assets/hyperframes/vectorai-model-program-roles/renders/vectorai-model-program-roles-transparent.webm`
- Replace: `video-assets/hyperframes/vectorai-model-program-roles/renders/vectorai-model-program-roles-transparent-prores4444.mov`

**Interfaces:**
- Consumes: the validated composition.
- Produces: transparent WebM and ProRes 4444 deliverables.

- [ ] **Step 1: Render the transparent WebM**

Run HyperFrames `render --format webm --quality high --fps 30` with the existing output filename.

- [ ] **Step 2: Convert the WebM to ProRes 4444**

Run FFmpeg with `prores_ks`, profile 4, and `yuva444p10le`.

- [ ] **Step 3: Verify codec, dimensions, frame rate, duration, and Alpha**

Use `ffprobe` on both outputs. Composite a ProRes frame over a saturated green background and visually confirm the green remains visible outside the overlay.

- [ ] **Step 4: Commit only the animation-specific source and verification files**

Stage the composition directory and this plan without including unrelated dirty-worktree files.
