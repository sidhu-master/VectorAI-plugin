# Semantic Fragment Authorization and Composer Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace region-implies-write behavior with locality-gated, model-proven fragment authorization and move live task controls into the chat composer, then prove the real test2 right-arm edit in the browser.

**Architecture:** A semantic region becomes a read-only `SearchEnvelope`. The server derives stable atomic candidates, renders a proof view, asks the configured model to select exact candidate IDs, validates that proof, and materializes only those IDs into a `FragmentAuthorization` consumed by the existing Drawing IR compiler and validator. The frontend projects the latest real progress event into a compact status strip attached to the composer; the existing send-button slot becomes send, pause, resume, or retry based on task and input state.

**Tech Stack:** TypeScript 5.8, Node.js, React 18, Zustand, Vitest, Sharp, Drawing IR scene renderer, Express/Vite, in-app browser automation.

## Global Constraints

- Work directly on `main` with the user's explicit consent; do not create branches, worktrees, or sub-agents.
- Search envelopes authorize observation only; no geometry write is allowed without an explicit fragment authorization.
- Unselected content is protected even when it overlaps the envelope or an editable fragment.
- Visual intersections are not topology unless Drawing IR has an explicit relation, shared stable endpoint, or audited import-time topology.
- Same-source polyline/spline edits use virtual fragments and preserve unselected source ranges.
- Model calls are replaceable; deterministic locality, authorization, hashing, validation, audit, and replay do not depend on a model name.
- Candidate attempts 1 and 2 use the light model; candidate attempt 3 uses the repair model.
- Public UI does not display model names or a fixed fake stage list.
- A 30-second response is a UX target, not a hard task deadline; long steps keep publishing honest status and elapsed time.
- Keep `test1.jpg`, `test2.png`, `.local/`, provider replies, generated media, and audit artifacts untracked.
- Follow strict red-green-refactor for every production behavior and run the named focused test after both the red and green steps.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/contracts/drawing-spatial-region.ts` | Public search-envelope, proof-selection, locality, and fragment-authorization contracts and parsers |
| `api/services/drawing-spatial/locality-guard.ts` | Pure deterministic envelope and authorized-selection size checks |
| `api/services/drawing-spatial/selection-authorization.ts` | Stable candidate extraction, proof-view rendering, selection verification, and final authorization |
| `api/services/drawing-spatial/region-resolver.ts` | Read-only envelope-to-raw-candidate discovery; it no longer supplies final write authority |
| `api/services/drawing-agent/protocol-schemas.ts` | Strict model response schema for fragment selection |
| `api/services/drawing-agent/semantic-adapters.ts` | Target-hinted grounding and fragment-selection model adapters |
| `api/services/drawing-agent/runtime.ts` | Envelope retry, proof selection, authorization audit, and authorized design/compile orchestration |
| `api/services/drawing-spatial/spatial-edit-compiler.ts` | Enforce authorization at the final Drawing IR compilation boundary |
| `src/components/ComposerTaskStatus.tsx` | Compact latest-status strip attached to the composer |
| `src/components/AIDialog.tsx` | Composer layout and send/pause/resume/retry main-button state machine |
| `src/components/ConstructionTimeline.tsx` | Removed after the compact status migration |
| `scripts/e2e-test2-semantic-edit.ts` | Real-provider semantic edit gate and visual/audit report |

---

### Task 1: Add search-envelope, locality, selection-proof, and authorization contracts

**Files:**
- Modify: `src/contracts/drawing-spatial-region.ts`
- Create: `api/services/drawing-spatial/locality-guard.ts`
- Create: `api/services/drawing-spatial/locality-guard.test.ts`
- Modify: `src/contracts/drawing-spatial-region.test.ts`

**Interfaces:**
- Consumes: existing `SemanticRegion`, `SpatialSelection`, `Bounds2D`, `GeometryId`, and `RevisionId`.
- Produces: `TargetHint`, `LocalityBudget`, `LocalityMetrics`, `SearchEnvelopeAssessment`, `SelectionProofProposal`, `SelectionProofEvidence`, `FragmentAuthorization`, `parseSelectionProofProposal()`, and `assessSearchEnvelope()`.

- [ ] **Step 1: Write failing protocol tests**

Add tests that parse only server-issued fragment IDs and reject unknown, duplicate, empty, and overlong evidence lists:

```ts
const proposal = parseSelectionProofProposal({
  editableFragmentIds: ['fragment_arm_upper', 'fragment_arm_lower'],
  anchorIds: ['anchor_shoulder'],
  evidence: [
    { fragmentId: 'fragment_arm_upper', reason: '右臂上边界', confidence: 0.96 },
    { fragmentId: 'fragment_arm_lower', reason: '右臂下边界', confidence: 0.94 },
  ],
  confidence: 0.95,
}, {
  allowedFragmentIds: ['fragment_arm_upper', 'fragment_arm_lower', 'fragment_body'],
  allowedAnchorIds: ['anchor_shoulder'],
});
expect(proposal.editableFragmentIds).toEqual(['fragment_arm_upper', 'fragment_arm_lower']);
expect(() => parseSelectionProofProposal({
  editableFragmentIds: ['fragment_head'], anchorIds: [], evidence: [], confidence: 0.8,
}, { allowedFragmentIds: ['fragment_arm'], allowedAnchorIds: [] }))
  .toThrow('fragment_head');
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run src/contracts/drawing-spatial-region.test.ts`

Expected: FAIL because `parseSelectionProofProposal` and its types do not exist.

- [ ] **Step 3: Implement strict contracts and parser**

Add the following exact shapes and validate all IDs against server allowlists:

```ts
export interface TargetHint {
  semanticDescription: string;
  approximateBounds?: Bounds2D;
  preferredScale: 'detail' | 'part' | 'assembly' | 'drawing';
}

export interface LocalityBudget {
  maxAreaRatio: number;
  maxSpanRatio: number;
  maxWholeNodes: number;
  maxCrossingNodes: number;
  maxBoundaryAnchors: number;
  maxCandidateFragments: number;
}

export interface SelectionProofProposal {
  editableFragmentIds: string[];
  anchorIds: string[];
  evidence: Array<{ fragmentId: string; reason: string; confidence: number }>;
  confidence: number;
}

export interface FragmentAuthorization {
  id: string;
  revision: RevisionId;
  regionId: string;
  editableFragmentIds: string[];
  protectedFragmentIds: string[];
  boundaryAnchorIds: string[];
  protectedHashes: Record<string, string>;
  selectionProofId: string;
  locality: LocalityMetrics;
}
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `npx vitest run src/contracts/drawing-spatial-region.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing locality tests with the real failed envelope ratios**

Use a literal document bounds fixture `{minX:20.26,minY:36.48,maxX:470.99,maxY:636.29}` and the normalized failed contour mapped to world coordinates. Assert that a `part` budget rejects the envelope before design with codes `ENVELOPE_AREA_EXCEEDED`, `ENVELOPE_SPAN_EXCEEDED`, or `ENVELOPE_COMPLEXITY_EXCEEDED`. Add a compact arm envelope case that passes. The break caught is removal of the pre-design breadth gate.

- [ ] **Step 6: Run locality tests and verify RED**

Run: `npx vitest run api/services/drawing-spatial/locality-guard.test.ts`

Expected: FAIL because `assessSearchEnvelope` does not exist.

- [ ] **Step 7: Implement the deterministic locality guard**

Implement `assessSearchEnvelope({ documentBounds, envelopeBounds, targetHint, counts, budget })`. Compute literal area and span ratios, candidate counts, and weak target-distance evidence. Return `{ accepted, metrics, issues }`; do not throw for an ordinary overbroad model result. Never reject solely because the horizontal center disagrees with a left/right word.

- [ ] **Step 8: Run locality tests and verify GREEN**

Run: `npx vitest run api/services/drawing-spatial/locality-guard.test.ts src/contracts/drawing-spatial-region.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/contracts/drawing-spatial-region.ts src/contracts/drawing-spatial-region.test.ts api/services/drawing-spatial/locality-guard.ts api/services/drawing-spatial/locality-guard.test.ts
git commit -m "feat: gate semantic search envelopes by locality"
```

---

### Task 2: Build atomic proof candidates and fragment authorization

**Files:**
- Create: `api/services/drawing-spatial/selection-authorization.ts`
- Create: `api/services/drawing-spatial/selection-authorization.test.ts`
- Modify: `api/services/drawing-spatial/region-resolver.ts`
- Modify: `api/services/drawing-spatial/region-resolver.test.ts`
- Modify: `api/services/drawing-spatial/atomic-graph.ts`
- Modify: `api/services/drawing-spatial/atomic-graph.test.ts`

**Interfaces:**
- Consumes: raw `SpatialSelection` discovered from the envelope, `AtomicGeometryGraph`, Drawing IR document, and `SelectionProofProposal`.
- Produces: `SelectionCandidateSet`, `SelectionProofView`, `buildSelectionCandidateSet()`, `renderSelectionProofView()`, and `authorizeSelection()`.

- [ ] **Step 1: Write failing candidate identity and overlap tests**

Build a document with two independent lines sharing the same pixel path and distinct IDs. Resolve a broad envelope covering both. Assert candidate IDs remain distinct and selecting `node:foreground` does not authorize `node:background`. Add a polyline fixture and assert each selectable parameter range retains `sourceNodeId` and stable lineage. The break caught is region membership being treated as shared write authority.

- [ ] **Step 2: Run candidate tests and verify RED**

Run: `npx vitest run api/services/drawing-spatial/selection-authorization.test.ts api/services/drawing-spatial/atomic-graph.test.ts`

Expected: FAIL because the candidate/authorization APIs do not exist.

- [ ] **Step 3: Implement candidate extraction with stable IDs**

Define:

```ts
export interface AtomicSelectionCandidate {
  fragmentId: string;
  sourceNodeId: GeometryId;
  kind: AtomicSegmentRef['kind'];
  range?: readonly [number, number];
  start: Vec2;
  end: Vec2;
  bounds: Bounds2D;
  adjacentSegmentIds: string[];
  baselineHash: string;
}

export interface SelectionCandidateSet {
  revision: RevisionId;
  regionId: string;
  candidates: AtomicSelectionCandidate[];
  protectedNodeIds: GeometryId[];
}
```

Whole-node candidates use `node:<nodeId>`. Partial candidates reuse the deterministic atomic ref ID. Candidate extraction must not combine IDs based on raster overlap. Update atomic adjacency so different source nodes connect only through an explicit Drawing IR relation or an audited shared endpoint; same-source consecutive ranges remain adjacent.

- [ ] **Step 4: Run candidate identity tests and verify GREEN**

Run: `npx vitest run api/services/drawing-spatial/selection-authorization.test.ts api/services/drawing-spatial/atomic-graph.test.ts`

Expected: the identity/overlap cases PASS.

- [ ] **Step 5: Write failing same-polyline authorization tests**

Using `test2SharedPolylineDocument()`, feed a proof selecting only the three arm range IDs plus `node:node_test2_hand_outline`. Assert the resulting `SpatialSelection` has target range `[0,3]`, protected range `[3,4]`, one shoulder boundary anchor, and that the body range hash is protected. Also assert an unknown fragment and an over-budget selection are rejected without materializing commands.

- [ ] **Step 6: Run authorization tests and verify RED**

Run: `npx vitest run api/services/drawing-spatial/selection-authorization.test.ts`

Expected: FAIL because `authorizeSelection` does not yet produce a filtered selection and authorization.

- [ ] **Step 7: Implement selection verification and authorization**

`authorizeSelection()` must:

1. Verify every selected and anchor ID against the candidate set.
2. Filter `wholeNodes` and `partialSegments` to the explicit proof.
3. Rebuild every crossing node split plan so selected source ranges are `target` and all other ranges are `protected`.
4. Filter boundary anchors to transitions involving a selected target fragment.
5. Put every unselected whole node and range in the protection baseline.
6. Return `{ selection, authorization }` without committing or previewing commands.

- [ ] **Step 8: Add and implement proof-view rendering**

First add a failing test asserting the output is a PNG data URL and its mapping contains stable `F001`, `F002` labels, distinct colors, candidate IDs, bounds, and source lineage. Then implement `renderSelectionProofView()` by building a temporary fragment-only Drawing IR document, rendering it with the shared server scene renderer, and returning the image plus label/color mapping. This is a read-only artifact and must not enter the canonical repository.

- [ ] **Step 9: Run Task 2 focused tests and verify GREEN**

Run: `npx vitest run api/services/drawing-spatial/selection-authorization.test.ts api/services/drawing-spatial/region-resolver.test.ts api/services/drawing-spatial/atomic-graph.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add api/services/drawing-spatial/selection-authorization.ts api/services/drawing-spatial/selection-authorization.test.ts api/services/drawing-spatial/region-resolver.ts api/services/drawing-spatial/region-resolver.test.ts api/services/drawing-spatial/atomic-graph.ts api/services/drawing-spatial/atomic-graph.test.ts
git commit -m "feat: authorize semantic edits by atomic fragment proof"
```

---

### Task 3: Add the fragment-selection model protocol

**Files:**
- Modify: `api/services/drawing-agent/protocol-schemas.ts`
- Modify: `api/services/drawing-agent/protocol-schemas.test.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.test.ts`

**Interfaces:**
- Consumes: `TargetHint`, `SelectionCandidateSet`, `SelectionProofView`, `VisualObservation`, and model gateway.
- Produces: `DrawingFragmentSelectionModelAdapter.select()` and `FRAGMENT_SELECTION_RESPONSE_SCHEMA`.

- [ ] **Step 1: Write failing grounding-context tests**

Assert the region model prompt receives `targetHint` including planner scope bounds, calls the result a read-only search envelope, explicitly forbids treating every enclosed object as editable, and requests the smallest context that includes the target and attachment points.

- [ ] **Step 2: Run semantic adapter tests and verify RED**

Run: `npx vitest run api/services/drawing-agent/semantic-adapters.test.ts`

Expected: FAIL because `SemanticCallInput` and the grounding prompt do not include `targetHint`.

- [ ] **Step 3: Implement target-hinted search-envelope grounding**

Add `targetHint?: TargetHint` to `SemanticCallInput`, serialize it into the user prompt, and replace wording that asks for an unrestricted complete semantic region with wording that asks for a minimal read-only search envelope. Preserve normalized coordinates and protocol repair.

- [ ] **Step 4: Run grounding-context tests and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/semantic-adapters.test.ts`

Expected: the grounding tests PASS.

- [ ] **Step 5: Write failing fragment-selection adapter tests**

Provide a proof view with `F001→fragment_arm` and `F002→fragment_head`; return only `fragment_arm`. Assert the adapter sends the proof image, exact allowed IDs, source lineage, adjacency, goal, anchors, and default invariants. Assert parsing rejects `fragment_head_unknown`.

- [ ] **Step 6: Run adapter/schema tests and verify RED**

Run: `npx vitest run api/services/drawing-agent/semantic-adapters.test.ts api/services/drawing-agent/protocol-schemas.test.ts`

Expected: FAIL because the selector and response schema do not exist.

- [ ] **Step 7: Implement the fragment-selection adapter and schema**

Add strict schema fields `editableFragmentIds`, `anchorIds`, `evidence`, and `confidence`. The system prompt must state: select only exact IDs; overlapping unselected candidates stay unchanged; choose both boundaries needed to keep a limb closed; do not infer topology from a visual crossing; and prefer the smallest complete semantic part.

- [ ] **Step 8: Run Task 3 tests and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/semantic-adapters.test.ts api/services/drawing-agent/protocol-schemas.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add api/services/drawing-agent/protocol-schemas.ts api/services/drawing-agent/protocol-schemas.test.ts api/services/drawing-agent/semantic-adapters.ts api/services/drawing-agent/semantic-adapters.test.ts
git commit -m "feat: select editable fragments with visual proof"
```

---

### Task 4: Migrate the runtime and compiler to explicit authorization

**Files:**
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-spatial/spatial-edit-compiler.ts`
- Modify: `api/services/drawing-spatial/spatial-edit-compiler.test.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.ts`
- Modify: `api/services/drawing-spatial/spatial-validator.test.ts`
- Modify: `api/app.ts`

**Interfaces:**
- Consumes: locality guard, candidate/proof APIs, `DrawingFragmentSelectionModelAdapter`, and existing Drawing IR preview/validator.
- Produces: envelope→proof→authorization→design runtime flow and compiler-level authorization enforcement.

- [ ] **Step 1: Write the failing broad-envelope runtime regression**

Use the literal failed contour from run `run_1a8f55ca-957d-40a6-b970-7ec0c3df1732`. Assert the first overbroad result emits a `search-envelope-rejected` audit/progress event and causes a second grounding call with measured feedback before any design, split materialization, or preview call. Assert no destructive region overlay is published for the rejected envelope.

- [ ] **Step 2: Run the focused runtime test and verify RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts -t "rejects an overbroad search envelope before selection or design"`

Expected: FAIL because the runtime currently resolves and materializes the first envelope directly.

- [ ] **Step 3: Implement target hint and bounded envelope repair**

Derive `TargetHint.approximateBounds` from `plan.goal.scope.bounds`, set `preferredScale` to `part` for ordinary modification goals, and add at most two envelope grounding attempts within one logical candidate. Build the raw graph/selection only to measure complexity. Reject before publishing an editable overlay or calling selection/design. Audit the proposal, metrics, issue codes, and feedback.

- [ ] **Step 4: Run the broad-envelope test and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts -t "rejects an overbroad search envelope before selection or design"`

Expected: PASS.

- [ ] **Step 5: Write the failing proof-selection runtime test**

Return a valid compact envelope containing arm, body, and head candidates. The fragment selector chooses only the arm ranges. Assert runtime event order `grounding → candidate_extraction → selecting_fragments → selection_authorized → split_materialized → designing`, the designer receives only authorized target geometry, and audit contains proof ID, editable IDs, protected hashes, and locality metrics.

- [ ] **Step 6: Run the proof-selection runtime test and verify RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts -t "designs only fragments authorized by selection proof"`

Expected: FAIL because the runtime has no selector/authorization stage.

- [ ] **Step 7: Implement runtime proof selection and context reuse**

Add `fragmentSelector` to runtime options. In `#prepareSpatialRepairContext`, build candidates, render proof, call the selector, authorize, then materialize splits. Extend `SpatialRepairContext` with proof and authorization. Design/topology retries reuse them; only selection-classified defects invalidate the proof, and only envelope-classified defects invalidate the search envelope.

- [ ] **Step 8: Write failing compiler authorization tests**

Call `compileSpatialEdit()` with a design that references or transforms an unselected overlapping node and assert `SPATIAL_EDIT_UNAUTHORIZED_TARGET:<id>`. Assert a valid test2 arm authorization changes only authorized fragments and preserves the body, face, and unrelated hashes.

- [ ] **Step 9: Run compiler tests and verify RED**

Run: `npx vitest run api/services/drawing-spatial/spatial-edit-compiler.test.ts`

Expected: FAIL because the compiler does not accept or enforce `FragmentAuthorization`.

- [ ] **Step 10: Enforce authorization in compiler and validator**

Require `authorization` in `compileSpatialEdit()`. Verify revision/region/proof identity, ensure computed target IDs equal the authorized editable materialization, and reject any command touching an unauthorized existing ID. Carry authorization ID and protected hashes into `CompiledSpatialEditCandidate`; validate all protected hashes after preview.

- [ ] **Step 11: Run Task 4 focused tests and verify GREEN**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/services/drawing-spatial/spatial-edit-compiler.test.ts api/services/drawing-spatial/spatial-validator.test.ts`

Expected: PASS.

- [ ] **Step 12: Commit Task 4**

```bash
git add api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts api/services/drawing-spatial/spatial-edit-compiler.ts api/services/drawing-spatial/spatial-edit-compiler.test.ts api/services/drawing-spatial/spatial-validator.ts api/services/drawing-spatial/spatial-validator.test.ts api
git commit -m "feat: require fragment authorization for spatial edits"
```

---

### Task 5: Attach live status and task controls to the composer

**Files:**
- Create: `src/components/ComposerTaskStatus.tsx`
- Create: `src/components/ComposerTaskStatus.test.tsx`
- Modify: `src/components/AIDialog.tsx`
- Modify: `src/components/AIDialog.test.tsx`
- Delete: `src/components/ConstructionTimeline.tsx`
- Delete: `src/components/ConstructionTimeline.test.tsx`

**Interfaces:**
- Consumes: `PresentedAgentTask`, `AgentUiStatus`, the latest domain progress event, and Zustand agent actions.
- Produces: `composerPrimaryAction(status, hasInput, hasAttachment)` and compact `ComposerTaskStatus`.

- [ ] **Step 1: Write failing pure button-state tests**

Cover the full matrix with literal expectations:

```ts
expect(composerPrimaryAction('running', false, false)).toBe('pause');
expect(composerPrimaryAction('running', true, false)).toBe('send-instruction');
expect(composerPrimaryAction('paused', false, false)).toBe('resume');
expect(composerPrimaryAction('paused', true, false)).toBe('send-instruction');
expect(composerPrimaryAction('error', false, false)).toBe('retry');
expect(composerPrimaryAction('error', true, false)).toBe('send-new');
```

The break caught is disabling the send slot whenever no text is present, which currently makes pause/resume/retry unavailable there.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npx vitest run src/components/AIDialog.test.tsx src/components/ComposerTaskStatus.test.tsx`

Expected: FAIL because the state function and component do not exist.

- [ ] **Step 3: Implement the pure action state machine**

Implement `composerPrimaryAction()` without React or store access. `pause_requested` returns `waiting`; `planning/running` empty returns `pause`; paused empty returns `resume`; retryable terminal empty returns `retry`; any allowed typed prompt returns the appropriate send action.

- [ ] **Step 4: Run action tests and verify GREEN**

Run: `npx vitest run src/components/ComposerTaskStatus.test.tsx`

Expected: action matrix PASS.

- [ ] **Step 5: Write failing attached-layout tests**

Render `AIDialog` with a running store state. Assert the status element appears inside the bottom composer container immediately before the textarea shell, only the latest heading/detail appear, there is no standalone `AI 任务进度` card, no fixed event list, and the main button title is `暂停任务`. Add paused, running-with-input, and failed cases using user-visible actions.

- [ ] **Step 6: Run layout tests and verify RED**

Run: `npx vitest run src/components/AIDialog.test.tsx src/components/ComposerTaskStatus.test.tsx`

Expected: FAIL because `ConstructionTimeline` is still a standalone card and the send button has one action.

- [ ] **Step 7: Implement the compact status and composer actions**

Move the status into the bottom `border-t` composer block above pending-image/input content. Render the latest true status, elapsed time, attempt label, low-confidence warning, and a small stop action. Dispatch main-button clicks to `pauseAgent`, `resumeAgent`, `retryAgent`, or `submitAgentInput`. When paused with typed input, queue the instruction and remain paused.

- [ ] **Step 8: Run Task 5 tests and verify GREEN**

Run: `npx vitest run src/components/AIDialog.test.tsx src/components/ComposerTaskStatus.test.tsx src/components/agent/task-presentation.test.ts src/hooks/useStore.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/components/ComposerTaskStatus.tsx src/components/ComposerTaskStatus.test.tsx src/components/AIDialog.tsx src/components/AIDialog.test.tsx src/components/ConstructionTimeline.tsx src/components/ConstructionTimeline.test.tsx
git commit -m "feat: attach live agent controls to the composer"
```

---

### Task 6: Strengthen the real test2 gate and complete browser acceptance

**Files:**
- Modify: `scripts/e2e-test2-semantic-edit.ts`
- Modify: `api/services/drawing-benchmark/semantic-edit.ts`
- Modify: `api/services/drawing-benchmark/semantic-edit.test.ts`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/prd.md`

**Interfaces:**
- Consumes: final Drawing IR before/after documents, authorization/audit events, real provider output, and browser-visible UI.
- Produces: `.local/vectorai/baselines/test2-region-edit/e2e/report.json`, before/after PNG or SVG artifacts, and an executable browser acceptance record.

- [ ] **Step 1: Write failing benchmark assertions**

Add checks that the final edit has: explicit selection authorization before design; no broad-envelope design; arm target bounds smaller than a part-scale threshold; original body/face/unrelated hashes unchanged; both shoulder/body attachment anchors connected; no new dangling endpoint; arm endpoint moves upward by a meaningful amount; and no duplicate old arm remains.

- [ ] **Step 2: Run benchmark tests and verify RED**

Run: `npx vitest run api/services/drawing-benchmark/semantic-edit.test.ts`

Expected: FAIL until reports and audit facts include the new authorization evidence.

- [ ] **Step 3: Implement benchmark/report changes**

Derive all booleans from Drawing IR, audit, and rendered artifacts rather than model self-report. Include exact failed issue codes and run ID. Exit non-zero whenever structural correctness fails; keep provider timeout separately classified.

- [ ] **Step 4: Run deterministic regressions**

Run:

```bash
npx vitest run
npm run test:test2-self-edit -- test2.png
npm run check
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with no failed tests, TypeScript errors, lint errors, build errors, or whitespace errors.

- [ ] **Step 5: Run the real provider gate and inspect artifacts**

Run: `npm run e2e:test2-semantic-edit -- test2.png "把图形的右手抬起来打招呼"`

Expected: exit 0; report records a valid selection authorization before design, connected arm, unchanged protected hashes, and a committed Drawing IR revision. Open the generated before/after image and verify the visible arm is raised while the head, body, and opposite arm remain unchanged.

- [ ] **Step 6: Start/reuse the local server and perform the user's browser flow**

Using the in-app browser selected for `http://localhost:5173/`:

1. Reload the application and clear the current drawing with the top-right delete action.
2. Upload `/Users/sidhu/AndroidStudioProjects/VectorAI/test2.png` and wait for the vectorized Drawing IR to appear.
3. Enter `把图形的右手抬起来打招呼`.
4. Confirm the attached status strip reports real grounding, fragment selection, authorization, design, verification, and commit actions; confirm there is no standalone task card.
5. During a disposable run, verify the empty send slot becomes pause, pause changes to resume, and typed input changes it to send instruction.
6. For the acceptance run, wait for completion and visually inspect that the anatomical right arm is raised, remains connected/closed against the body, and head/body/opposite arm are unchanged.
7. Read the corresponding audit/report and cross-check the browser result with protected hashes and final revision.

Expected: the browser-visible result and deterministic report agree. Any mismatch is a failed acceptance and returns to systematic debugging, not delivery.

- [ ] **Step 7: Update PRD and architecture status**

Document that `SearchEnvelope → Atomic Candidates → Selection Proof → FragmentAuthorization → Drawing IR transaction` is the production path, include the composer state machine, and record the exact real test2 command and latest verified result without model names in public UI documentation.

- [ ] **Step 8: Run fresh final verification**

Run the complete command set from Step 4 again after docs and any browser-found fixes, rerun the real test2 gate, and inspect `git status --short` so only intended tracked files are included.

- [ ] **Step 9: Commit Task 6**

```bash
git add scripts/e2e-test2-semantic-edit.ts api/services/drawing-benchmark/semantic-edit.ts api/services/drawing-benchmark/semantic-edit.test.ts docs/tech-architecture.md docs/prd.md
git commit -m "test: gate fragment edits on real test2 behavior"
```

---

## Plan Self-Review

- **Spec coverage:** Tasks 1–4 cover search-envelope locality, atomic candidates, selection proof, overlap rules, same-source virtual splits, explicit authorization, deterministic compiler enforcement, audit, retry boundaries, and replaceable models. Task 5 covers the entire composer task-control matrix. Task 6 covers test2 structural and browser acceptance plus PRD/architecture updates.
- **No placeholders:** Every behavior has a named file, interface, failing test, verification command, implementation boundary, and expected result. No deferred compatibility layer or feature flag remains.
- **Type consistency:** `SelectionProofProposal` is the model-returned allowlisted selection. `SelectionCandidateSet` and `SelectionProofView` are server artifacts. `FragmentAuthorization` is the only write authority and is consumed by `compileSpatialEdit()`. `SpatialSelection` remains the geometry/split representation but is filtered by the authorization stage before materialization.
- **Execution choice:** The user has already required one main flow with no sub-agents and explicitly approved direct work on `main`, so execute inline with `superpowers:executing-plans` and TDD checkpoints.
