# Region-First Spatial Editing Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current main workflow.

**Goal:** Replace node-first visual editing with a region-first engine that can select semantic areas independently of existing primitive boundaries, materialize only the necessary sub-geometry in Preview, preserve topology and unrelated geometry, reuse full feedback context, and support geometric, generative, and hybrid edits as Drawing IR transactions.

**Architecture:** Keep Drawing IR, SceneCompiler, DrawingApplication, transaction preview, repository commits, audit storage, and SSE projection as the stable core. Add a revision-bound SemanticRegion contract, a lazy Virtual Atomic Geometry Graph, a deterministic RegionResolver and split materializer, a strategy router, a multi-version Preview Workspace, and a durable EditEpisode store. The runtime must call region selection before any target-node decision; every edit mode must compile to the same DrawingCommand transaction and pass the same deterministic plus visual verification path.

**Tech Stack:** TypeScript 5.8, Node.js/Express, React 18, Zustand, Vitest, Sharp, the existing Python/OpenCV vectorization worker, existing Drawing IR/SceneCompiler/Repository APIs, and replaceable multimodal/image-edit model adapters.

**Global Constraints:** Work directly on `main` as requested; do not create branches, worktrees, feature flags, parallel node-first fallbacks, or sub-agents. Use `test2.png` as the engineering golden fixture. Keep model names out of public progress/UI. Keep media bytes behind handles. Publish visible progress or heartbeat while long model/generation calls run. Use higher reasoning for semantic region selection, strategy choice, generated-shape planning, and final visual acceptance; keep intersection, splitting, fitting, hashing, validation, replay, and commit logic deterministic.

## File and responsibility map

| Existing area | Responsibility after migration | Change |
| --- | --- | --- |
| `src/drawing/**` | Canonical Drawing IR, commands, patch, transaction, scene and replay | Reuse unchanged except shared Preview overlay types |
| `src/contracts/drawing-spatial-agent.ts` | Legacy node-first contracts | Delete after runtime migration and move region contracts to a new file |
| `src/contracts/drawing-spatial-region.ts` | Region proposal, resolved selection, strategy, lineage, Episode and parser contracts | Add |
| `api/services/drawing-vision/**` | Revision-bound before/preview observations and media handles | Add region-overlay rendering and normalized image/world transforms |
| `api/services/drawing-spatial/**` | Region conversion, lazy atomic geometry, resolution, splitting, compilation and validation | Add as deterministic domain service |
| `api/services/drawing-agent/semantic-adapters.ts` | Current VisualFeatureGraph/EditIntent adapters | Replace with SemanticRegion, strategy and target-shape adapters |
| `api/services/drawing-agent/runtime.ts` | Agent orchestration, progress, Preview verification, commit and safe points | Replace semantic node-first segment with region-first Episode flow |
| `api/services/drawing-agent/tool-registry.ts` | Transaction Preview handles and commit authority | Extend to track active/superseded Preview versions and metadata |
| `api/services/drawing-agent/file-audit-store.ts` | Immutable run audit | Reuse; append Episode/region/split/strategy/lineage events |
| `api/services/drawing-episode/**` | Durable Episode state and bounded model context | Add |
| `api/services/drawing-generation/**` | Replaceable masked image-edit provider and crop/vectorization bridge | Add |
| `api/services/drawing-vectorization/**` | Generated clean-line candidate to Drawing IR geometry | Reuse and add local-crop coordinate projection |
| `src/drawing/preview/**`, `src/hooks/useStore.ts`, `src/components/Canvas.tsx` | Single active Preview and region overlay | Extend without creating a second canvas state model |
| `src/components/agent/task-presentation.ts` | Business-language stages | Replace node-first labels with region/split/generate/vectorize/verify stages |
| `scripts/e2e-test2-semantic-edit.ts` | Current semantic E2E gate | Rewrite around region/split/closure/preservation/Episode evidence |
| `scripts/e2e-region-hair-edit.ts` | Generative/hybrid golden gate | Add with deterministic fake provider plus optional real-provider run |

## Milestone A — Region-first engineering edit and test2

### Task 1: Define strict region-first contracts

**Files:**

- Create: `src/contracts/drawing-spatial-region.ts`
- Create: `src/contracts/drawing-spatial-region.test.ts`
- Modify: `api/services/drawing-agent/protocol-schemas.ts`
- Modify: `src/contracts/drawing-agent.ts`
- Modify: `src/drawing/preview/types.ts`

**Step 1: Write the failing parser tests**

Add tests proving that normalized contours must stay in `[0, 1]`, every value is finite, source view IDs are allow-listed, revisions are mandatory, empty regions are rejected, and partial segment references cannot be parsed against a different revision.

```ts
it('accepts a revision-bound semantic region proposal without node ids', () => {
  expect(parseSemanticRegionProposal({
    label: 'right arm', sourceViewId: 'overview',
    contours: [[[0.69, 0.43], [0.91, 0.52], [0.91, 0.72], [0.70, 0.64]]],
    holes: [],
    anchors: [{ id: 'shoulder', role: 'body-connection', point: [0.70, 0.60], confidence: 0.94 }],
    confidence: 0.92, evidenceRefs: ['overview'],
  }, { allowedViewIds: ['overview'] }).sourceViewId).toBe('overview');
});

it('rejects stale atomic ranges', () => {
  expect(() => assertSelectionRevision(selection('rev_old'), 'rev_new' as RevisionId))
    .toThrow('SPATIAL_SELECTION_STALE');
});
```

**Step 2: Run RED**

Run: `npx vitest run src/contracts/drawing-spatial-region.test.ts`

Expected: FAIL because the module and parsers do not exist.

**Step 3: Implement the contracts and strict parsers**

Define these exact public shapes:

```ts
export type NormalizedPoint = readonly [number, number];
export interface SemanticRegionProposal {
  label: string;
  sourceViewId: string;
  contours: NormalizedPoint[][];
  holes: NormalizedPoint[][];
  anchors: Array<{ id: string; role: string; point: NormalizedPoint; confidence: number }>;
  confidence: number;
  evidenceRefs: string[];
}
export interface SemanticRegion extends Omit<SemanticRegionProposal, 'contours' | 'holes' | 'anchors'> {
  id: string; drawingId: DrawingId; revision: RevisionId; maskHandle: string;
  worldContours: Vec2[][]; worldHoles: Vec2[][]; anchors: SemanticAnchor[];
}
export interface AtomicSegmentRef {
  id: string; revision: RevisionId; nodeId: GeometryId;
  kind: 'whole-node' | 'vertex-range' | 'parameter-range';
  vertexRange?: readonly [number, number]; parameterRange?: readonly [number, number];
  start: Vec2; end: Vec2; bounds: Bounds2D; adjacentSegmentIds: string[];
}
export interface SpatialSelection {
  regionId: string; revision: RevisionId; wholeNodes: GeometryId[];
  partialSegments: AtomicSegmentRef[]; crossingNodes: GeometryId[];
  protectedNodes: string[]; boundaryAnchors: SpatialBoundaryAnchor[];
  uncertainParts: SelectionCandidate[]; splitPlan: VirtualSplitPlan[];
}
export type SpatialEditMode = 'geometric-edit' | 'generative-redraw' | 'hybrid-edit';
```

Add `region_overlay`, `region_resolved`, `split_materialized`, `generating`, and `vectorizing` progress types. Extend `PerceptionPreviewDelta` with an optional revision-bound overlay whose contours are world coordinates; it must not contain raster bytes.

**Step 4: Add JSON schemas**

Export `SEMANTIC_REGION_RESPONSE_SCHEMA` and `SPATIAL_STRATEGY_RESPONSE_SCHEMA` from `protocol-schemas.ts`. Keep `additionalProperties: false` at every object level and require all arrays even when empty.

**Step 5: Run GREEN**

Run: `npx vitest run src/contracts/drawing-spatial-region.test.ts src/contracts/drawing-agent.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/contracts/drawing-spatial-region.ts src/contracts/drawing-spatial-region.test.ts api/services/drawing-agent/protocol-schemas.ts src/contracts/drawing-agent.ts src/drawing/preview/types.ts
git commit -m "feat: define region-first spatial contracts"
```

### Task 2: Convert model regions to revision-bound world-space regions

**Files:**

- Create: `api/services/drawing-spatial/region-media-store.ts`
- Create: `api/services/drawing-spatial/semantic-region.ts`
- Create: `api/services/drawing-spatial/semantic-region.test.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.ts`
- Modify: `api/services/drawing-agent/semantic-adapters.test.ts`
- Modify: `api/services/drawing-agent/types.ts`

**Step 1: Write failing transform and mask-handle tests**

Use an observation whose image coordinate system has Y down and world system has Y up. Assert normalized contour points become correct world points, the region keeps the observation revision, the mask store returns PNG only by handle, and serialized audit payloads never include `data:image`.

```ts
const region = await buildSemanticRegion({ proposal, observation, drawingId, mediaStore });
expect(region.worldContours[0][0]).toEqual([10, 90]);
expect(region.revision).toBe(observation.revision);
expect(region.maskHandle).toMatch(/^region_mask_/);
expect(JSON.stringify(region)).not.toContain('base64');
```

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-spatial/semantic-region.test.ts api/services/drawing-agent/semantic-adapters.test.ts`

Expected: FAIL because the new adapter and builder do not exist.

**Step 3: Implement normalized-to-world conversion and mask storage**

Invert `VisualObservationView.worldToImage` deterministically, rasterize contours/holes into a monochrome PNG with Sharp, store it in a bounded LRU keyed by drawing/revision/view/proposal hash, and return only the handle in `SemanticRegion`.

**Step 4: Replace `DrawingFeatureGraphAdapter` with `DrawingSemanticRegionAdapter`**

The system prompt must tell the model to select the complete semantic area without reading primitive boundaries and to emit normalized contours, holes, anchors, confidence, and view evidence. It must not request or accept node IDs.

```ts
export interface DrawingSemanticRegionModelAdapter {
  propose(input: SemanticRegionModelInput): Promise<SemanticRegionProposal>;
}
```

Use protocol-correction retry exactly once, retaining the current gateway schema path.

**Step 5: Run GREEN**

Run: `npx vitest run api/services/drawing-spatial/semantic-region.test.ts api/services/drawing-agent/semantic-adapters.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add api/services/drawing-spatial api/services/drawing-agent/semantic-adapters.ts api/services/drawing-agent/semantic-adapters.test.ts api/services/drawing-agent/types.ts
git commit -m "feat: ground semantic regions in drawing space"
```

### Task 3: Build the lazy Virtual Atomic Geometry Graph

**Files:**

- Create: `api/services/drawing-spatial/geometry-sampling.ts`
- Create: `api/services/drawing-spatial/atomic-graph.ts`
- Create: `api/services/drawing-spatial/atomic-graph.test.ts`
- Create: `api/services/drawing-spatial/polygon.ts`
- Create: `api/services/drawing-spatial/polygon.test.ts`

**Step 1: Write failing geometry coverage tests**

Cover Line, Polyline including bulge, Circle, Arc, Ellipse, Spline and Point. Assert deterministic IDs from `revision + nodeId + range`, stable adjacency, bounds-filtered construction, and no DrawingDocument mutation.

```ts
const graph = buildAtomicGeometryGraph({ document, revision, regionBounds, padding: 5 });
expect(graph.segmentsFor('shared_body_polyline')).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: 'vertex-range', vertexRange: [0, 1] }),
  expect.objectContaining({ kind: 'vertex-range', vertexRange: [3, 4] }),
]));
expect(document).toEqual(before);
```

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-spatial/atomic-graph.test.ts api/services/drawing-spatial/polygon.test.ts`

Expected: FAIL.

**Step 3: Implement deterministic sampling and polygon helpers**

Use exact endpoints for Line/Polyline segments, analytic sampling bounds for Circle/Arc/Ellipse, de Boor evaluation for Spline, point-in-polygon with hole exclusion, segment/polygon intersection, and epsilon derived from document span rather than a fixed pixel value.

**Step 4: Implement lazy graph construction**

Filter scene-node bounds against `regionBounds + padding` before expanding geometry. Store only virtual references and adjacency; never create Drawing IR nodes. Cache by `drawingId/revision/regionBounds/padding`.

**Step 5: Run GREEN**

Run: `npx vitest run api/services/drawing-spatial/atomic-graph.test.ts api/services/drawing-spatial/polygon.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add api/services/drawing-spatial/geometry-sampling.ts api/services/drawing-spatial/atomic-graph.ts api/services/drawing-spatial/atomic-graph.test.ts api/services/drawing-spatial/polygon.ts api/services/drawing-spatial/polygon.test.ts
git commit -m "feat: add virtual atomic geometry graph"
```

### Task 4: Resolve regions into whole nodes, shared segments and split plans

**Files:**

- Create: `api/services/drawing-spatial/region-resolver.ts`
- Create: `api/services/drawing-spatial/region-resolver.test.ts`
- Create: `api/services/drawing-spatial/test2-fixture.ts`

**Step 1: Write the failing test2 shared-Polyline test**

Construct the actual problematic Polyline using these vertices:

```ts
[
  [101.910828, 193.412466],
  [103.937462, 193.991562],
  [117.255351, 203.546338],
  [118.992468, 203.546338],
  [118.992468, 71.22675],
]
```

Use a region covering the hand and the first four points but excluding the long body vertical. Assert the resolver returns the lower-arm range as partial target, marks the node `shared-boundary`, creates a split plan at the existing turn, and protects the vertical range.

**Step 2: Add classification tests**

Test `inside`, `outside`, `crossing`, `shared-boundary`, `uncertain`, holes, multiple contours and stale revision. Require region confidence plus geometric coverage evidence for each result.

**Step 3: Run RED**

Run: `npx vitest run api/services/drawing-spatial/region-resolver.test.ts`

Expected: FAIL.

**Step 4: Implement `RegionResolver.resolve()`**

```ts
export class RegionResolver {
  resolve(input: {
    document: DrawingDocument;
    revision: RevisionId;
    region: SemanticRegion;
    graph: AtomicGeometryGraph;
    tolerance: number;
  }): SpatialSelection;
}
```

Derive boundary anchors from transitions between target and protected ranges. Complete nodes become `wholeNodes`; mixed nodes become `partialSegments + splitPlan`; nodes outside padded region become protected by content hash rather than being copied into model context.

**Step 5: Run GREEN**

Run: `npx vitest run api/services/drawing-spatial/region-resolver.test.ts`

Expected: PASS with the real shared-Polyline range selected.

**Step 6: Commit**

```bash
git add api/services/drawing-spatial/region-resolver.ts api/services/drawing-spatial/region-resolver.test.ts api/services/drawing-spatial/test2-fixture.ts
git commit -m "feat: resolve semantic regions across primitive boundaries"
```

### Task 5: Materialize splits with stable identity and lineage

**Files:**

- Create: `api/services/drawing-spatial/split-materializer.ts`
- Create: `api/services/drawing-spatial/split-materializer.test.ts`
- Create: `api/services/drawing-spatial/reference-migration.ts`
- Create: `api/services/drawing-spatial/reference-migration.test.ts`

**Step 1: Write failing split tests**

Assert that Line/Polyline/Arc/Circle/Ellipse splits cover the original parameter domain without gaps or overlap; Spline uses a bounded Polyline candidate when exact knot insertion is unavailable. For the test2 shared Polyline, assert the protected body fragment keeps the original ID, target fragments receive deterministic new IDs, and the body vertices are byte-for-byte unchanged.

**Step 2: Write failing reference tests**

Cover `TopologyRelation.nodeIds`, `ConstraintRelation.geometryIds`, `AssociationRelation.geometryIds`, dimension targets, feature geometry membership, and semantic relations. If a reference can unambiguously remain on the protected original-ID fragment, keep it. If a reference spans multiple fragments and cannot be mapped safely, return `SPLIT_REFERENCE_AMBIGUOUS` and block Preview.

**Step 3: Run RED**

Run: `npx vitest run api/services/drawing-spatial/split-materializer.test.ts api/services/drawing-spatial/reference-migration.test.ts`

Expected: FAIL.

**Step 4: Implement split materialization**

Return commands and lineage together:

```ts
export interface MaterializedSplit {
  commands: DrawingCommand[];
  fragments: GeometryNode[];
  lineage: Array<{
    sourceNodeId: GeometryId;
    fragmentId: GeometryId;
    sourceRange: readonly [number, number];
    role: 'target' | 'protected';
  }>;
  fidelityWarnings: string[];
}
```

Create/update commands only in the Preview transaction. Do not mutate the canonical document and do not persist virtual fragments.

**Step 5: Run GREEN**

Run: `npx vitest run api/services/drawing-spatial/split-materializer.test.ts api/services/drawing-spatial/reference-migration.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add api/services/drawing-spatial/split-materializer.ts api/services/drawing-spatial/split-materializer.test.ts api/services/drawing-spatial/reference-migration.ts api/services/drawing-spatial/reference-migration.test.ts
git commit -m "feat: materialize revision-safe spatial splits"
```

### Task 6: Compile and validate geometric region edits

**Files:**

- Create: `api/services/drawing-spatial/strategy-router.ts`
- Create: `api/services/drawing-spatial/strategy-router.test.ts`
- Create: `api/services/drawing-spatial/spatial-edit-compiler.ts`
- Create: `api/services/drawing-spatial/spatial-edit-compiler.test.ts`
- Create: `api/services/drawing-spatial/spatial-validator.ts`
- Create: `api/services/drawing-spatial/spatial-validator.test.ts`
- Modify: `api/services/drawing-edit/preserve-report.ts`
- Modify: `api/services/drawing-edit/preserve-report.test.ts`

**Step 1: Write failing strategy tests**

Engineering/CAD language, dimensions, explicit transforms and topology constraints must route to `geometric-edit`; appearance additions route to `generative-redraw`; mixed protected hard geometry plus free-form appearance routes to `hybrid-edit`. This is a high-reasoning model decision in production, but deterministic safety rules may override an unsafe mode.

**Step 2: Write failing compiler/validator tests**

For the test2 region, compile split commands followed by target transform/reconstruction. Assert command order, no outside-region changes, no lost source range, no duplicate residual fragment, preserved node hashes, valid references, connected boundary anchors and no unexpected degree-1 endpoints in the edited closed arm contour.

**Step 3: Run RED**

Run: `npx vitest run api/services/drawing-spatial/strategy-router.test.ts api/services/drawing-spatial/spatial-edit-compiler.test.ts api/services/drawing-spatial/spatial-validator.test.ts`

Expected: FAIL.

**Step 4: Implement the compiler**

Accept a region, resolved selection, selected strategy and model-produced target geometry. Merge deterministic split commands before edit commands, snap only declared boundary anchors, and return one `CompiledSpatialEditCandidate` containing commands, lineage, authorized bounds, protected hashes and fidelity warnings.

**Step 5: Implement deterministic validation**

Run both before and after `DrawingApplication.preview()`. Validation must reject stale revisions, out-of-region modifications, changed protected hashes, incomplete lineage coverage, broken references, non-finite coordinates, zero-length residuals, unexpected self-intersections and disconnected required anchors.

**Step 6: Run GREEN**

Run: `npx vitest run api/services/drawing-spatial api/services/drawing-edit/preserve-report.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add api/services/drawing-spatial api/services/drawing-edit/preserve-report.ts api/services/drawing-edit/preserve-report.test.ts
git commit -m "feat: compile and verify region-scoped geometry edits"
```

### Task 7: Replace the runtime semantic path and expose live region Preview

**Files:**

- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/services/drawing-agent/tool-registry.ts`
- Modify: `api/services/drawing-agent/tool-registry.test.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Modify: `api/app.ts`

**Step 1: Write failing runtime-order tests**

Assert this exact observable order:

```text
observation → region proposal → region overlay → atomic graph → region resolution
→ strategy → split materialization → target design → transaction preview
→ deterministic verification → visual verification → commit
```

Assert a region overlay progress event occurs before geometry Preview, model names never appear in public events, and only the latest active Preview handle may commit.

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/services/drawing-agent/tool-registry.test.ts`

Expected: FAIL.

**Step 3: Implement the region-first runtime segment**

Replace `#nextSemanticEdit()` with a region-first method. Remove calls to `DrawingFeatureGraphAdapter`, `DrawingEditIntentAdapter`, `compileEditIntent()` and node-first target selection. Keep explicit-ID command decisions as the Fast Command Lane outside the visual semantic path.

**Step 4: Extend Preview authority**

Store `episodeId`, `previewVersionId`, `regionId`, `selectionVersionId`, strategy and lineage alongside the prepared transaction. Add `supersedePrepared(handle)` and reject commit when the handle is not the latest active version for the Episode.

**Step 5: Audit every boundary**

Append `region`, `atomic_graph`, `selection`, `strategy`, `split`, `preview`, `verification`, `lineage`, and `episode` audit events. Store only media handles and bounded summaries.

**Step 6: Run GREEN**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/services/drawing-agent/tool-registry.test.ts api/services/drawing-agent/file-audit-store.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add api/services/drawing-agent api/app.ts
git commit -m "feat: run semantic edits through region-first previews"
```

### Task 8: Make test2 the engineering release gate

**Files:**

- Rewrite: `scripts/test2-self-semantic-edit.ts`
- Rewrite: `scripts/e2e-test2-semantic-edit.ts`
- Modify: `api/services/drawing-benchmark/semantic-edit.ts`
- Modify: `api/services/drawing-benchmark/semantic-edit.test.ts`
- Modify: `package.json`

**Step 1: Replace the old three-node self test**

The self gate must propose a world-space right-arm region, resolve the actual shared Polyline, materialize its lower-arm fragment, produce a raised and closed arm Preview, and commit through the same runtime services. It must not hard-code the old incomplete three-node target set.

**Step 2: Strengthen benchmark assertions**

Add report fields:

```ts
regionSelectedBeforeNodes: boolean;
sharedPolylineSplit: boolean;
protectedBodyFragmentUnchanged: boolean;
lineageComplete: boolean;
editedContourClosed: boolean;
unexpectedDanglingEndpoints: Vec2[];
feedbackPreviewVersionCount: number;
```

**Step 3: Run the deterministic real-fixture gate**

Run: `npm run test:test2-self-edit -- test2.png` using the script's new one-command fixture mode.

Expected: report `passed: true`, shared Polyline split detected, body vertical unchanged, no unexpected dangling endpoints, replay exact.

**Step 4: Run the replaceable-provider E2E gate**

Run: `npm run e2e:test2-semantic-edit -- test2.png`

Expected: region audit precedes split audit, Preview precedes verification and commit, and the final visual artifact is written under `.local/vectorai/baselines/test2-region-edit/`.

**Step 5: Commit**

```bash
git add scripts/test2-self-semantic-edit.ts scripts/e2e-test2-semantic-edit.ts api/services/drawing-benchmark package.json
git commit -m "test: gate region-first edits on test2 closure"
```

## Milestone B — Durable EditEpisode feedback loop

### Task 9: Persist Episode state and bounded feedback context

**Files:**

- Create: `api/services/drawing-episode/types.ts`
- Create: `api/services/drawing-episode/file-episode-store.ts`
- Create: `api/services/drawing-episode/file-episode-store.test.ts`
- Create: `api/services/drawing-episode/context-builder.ts`
- Create: `api/services/drawing-episode/context-builder.test.ts`
- Modify: `api/services/drawing-agent/types.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`

**Step 1: Write failing persistence and context tests**

Assert atomic JSON writes, restart recovery, monotonic region/selection/Preview version numbers, immutable feedback turns, and a bounded model context containing original goal, latest feedback, active region/selection/strategy, latest Preview/diff/defects and summaries of rejected versions.

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-episode`

Expected: FAIL.

**Step 3: Implement `FileEditEpisodeStore`**

Persist under `.local/vectorai/runs/<runId>/episode.json` using write-to-temp then rename. Store references to mask/crop/render media, never media bytes. Reject cross-drawing and non-monotonic updates.

**Step 4: Implement bounded context projection**

```ts
export function buildEpisodeModelContext(episode: EditEpisode): EpisodeModelContext {
  return {
    originalGoal: episode.originalGoal,
    latestFeedback: episode.feedbackTurns.at(-1) ?? null,
    activeRegion: latestActive(episode.regionVersions),
    activeSelection: latestActive(episode.selectionVersions),
    activePreview: latestActive(episode.previewVersions),
    rejectedSummary: summarizeRejected(episode.previewVersions).slice(-6),
  };
}
```

**Step 5: Run GREEN and commit**

Run: `npx vitest run api/services/drawing-episode`

```bash
git add api/services/drawing-episode api/services/drawing-agent/types.ts api/services/drawing-agent/audit-types.ts
git commit -m "feat: persist spatial edit episodes"
```

### Task 10: Replan user feedback inside the same Episode

**Files:**

- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/routes/agent-runs.ts`
- Modify: `api/routes/agent-runs.test.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`

**Step 1: Write failing feedback-race tests**

Cover feedback while model runs, while Preview is active, immediately before commit, and after commit. Before commit, feedback must supersede the Preview and remove commit eligibility; after commit, it must create a corrective Preview against the new revision without rewriting history.

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/routes/agent-runs.test.ts src/services/agent-client.test.ts`

Expected: FAIL.

**Step 3: Route instructions into Episode feedback**

Keep `POST /:runId/instructions`; classify user text received during an edit as `UserFeedbackTurn`, persist it immediately, publish `revising`, and trigger replanning at the next safe point. Do not add a new UI strategy switch.

**Step 4: Reuse region and split context**

The high-reasoning replanner receives the bounded Episode context. It may refine the region, replace the target design or change strategy, but every new Preview gets a new version and the previous active version becomes `superseded`.

**Step 5: Run GREEN and commit**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/routes/agent-runs.test.ts src/services/agent-client.test.ts`

```bash
git add api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts api/routes/agent-runs.ts api/routes/agent-runs.test.ts src/services/agent-client.ts src/services/agent-client.test.ts
git commit -m "feat: replan spatial previews from user feedback"
```

### Task 11: Show region, split and replacement progress on one active canvas

**Files:**

- Modify: `src/drawing/preview/types.ts`
- Modify: `src/drawing/preview/reducer.ts`
- Modify: `src/drawing/tests/preview.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/Canvas.test.tsx`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`
- Modify: `src/components/ConstructionTimeline.tsx`

**Step 1: Write failing single-active-Preview tests**

Assert region overlay appears before edit geometry, superseded overlays/nodes disappear atomically, only the current Preview is visible, completion reconciles against the committed DrawingDocument instead of blanking early, and model names remain absent.

**Step 2: Run RED**

Run: `npx vitest run src/drawing/tests/preview.test.ts src/hooks/useStore.test.ts src/components/Canvas.test.tsx src/components/agent/task-presentation.test.ts`

Expected: FAIL.

**Step 3: Extend the existing Preview reducer**

Add a single `activeOverlay` and `previewVersionId` to `PerceptionPreviewState`; never create a parallel region store. Reject out-of-order overlay versions with the existing run/sequence guard.

**Step 4: Render and present business stages**

Canvas renders translucent region fill, outline and boundary anchors in world coordinates behind Preview nodes. Task panel stages become “选择目标区域 / 解析共享轮廓 / 调整几何或外观 / 转换为可编辑图形 / 验证预览”. Technical mode and provider names stay in audit only.

**Step 5: Run GREEN and commit**

Run: `npx vitest run src/drawing/tests/preview.test.ts src/hooks/useStore.test.ts src/components/Canvas.test.tsx src/components/agent/task-presentation.test.ts`

```bash
git add src/drawing/preview src/hooks/useStore.ts src/hooks/useStore.test.ts src/components/Canvas.tsx src/components/Canvas.test.tsx src/components/agent/task-presentation.ts src/components/agent/task-presentation.test.ts src/components/ConstructionTimeline.tsx
git commit -m "feat: visualize region-first edit progress"
```

## Milestone C — Generative and hybrid local redraw

### Task 12: Add a replaceable masked image-edit and vectorization bridge

**Files:**

- Create: `api/services/drawing-generation/types.ts`
- Create: `api/services/drawing-generation/gateway-provider.ts`
- Create: `api/services/drawing-generation/gateway-provider.test.ts`
- Create: `api/services/drawing-generation/redraw-service.ts`
- Create: `api/services/drawing-generation/redraw-service.test.ts`
- Modify: `api/services/ai-gateway.ts`
- Modify: `api/services/source-artifacts/types.ts`
- Modify: `api/services/drawing-vectorization/service.ts`
- Modify: `api/services/drawing-vectorization/service.test.ts`

**Step 1: Write failing provider boundary tests**

Use a fake `DrawingRegionImageEditProvider` returning PNG bytes. Assert request scope contains crop, mask, prompt, protected-mask and seed; no provider response can write Drawing IR; abort/deadline are honored; image bytes are persisted once and referenced by handle/source ID.

**Step 2: Write failing projection tests**

Vectorize the generated crop, map source-pixel coordinates back through crop-to-world transform, clip to the authorized region, preserve Spline/Polyline candidates when analytic fitting fails, and attach confidence/evidence.

**Step 3: Run RED**

Run: `npx vitest run api/services/drawing-generation api/services/drawing-vectorization/service.test.ts`

Expected: FAIL.

**Step 4: Implement the replaceable provider and service**

```ts
export interface DrawingRegionImageEditProvider {
  edit(input: {
    prompt: string; cropPng: Buffer; maskPng: Buffer; protectedMaskPng: Buffer;
    seed: number; signal: AbortSignal; deadlineAt: number;
  }): Promise<{ png: Buffer; providerRequestId: string }>;
}
```

The production gateway adapter reads its endpoint/model from server environment only. When it is unavailable, strategy routing must use geometric/local-vector design if valid or return a recoverable `GENERATION_PROVIDER_UNAVAILABLE`; it must not fake a successful generated result.

**Step 5: Run GREEN and commit**

Run: `npx vitest run api/services/drawing-generation api/services/drawing-vectorization/service.test.ts`

```bash
git add api/services/drawing-generation api/services/ai-gateway.ts api/services/source-artifacts/types.ts api/services/drawing-vectorization/service.ts api/services/drawing-vectorization/service.test.ts
git commit -m "feat: bridge masked redraws into Drawing IR candidates"
```

### Task 13: Route generative and hybrid candidates through the same Preview transaction

**Files:**

- Modify: `api/services/drawing-spatial/strategy-router.ts`
- Modify: `api/services/drawing-spatial/spatial-edit-compiler.ts`
- Create: `api/services/drawing-spatial/generative-validator.ts`
- Create: `api/services/drawing-spatial/generative-validator.test.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `api/app.ts`

**Step 1: Write failing hybrid tests**

Use “add curly hair without covering eyes or face outline.” Assert region routing selects generative or hybrid, protected masks include eyes/face, generated vectors cannot cross protected geometry, seams are bounded, and the resulting commands enter the same prepared Preview/verification/commit flow.

**Step 2: Run RED**

Run: `npx vitest run api/services/drawing-spatial/generative-validator.test.ts api/services/drawing-agent/runtime.test.ts`

Expected: FAIL.

**Step 3: Integrate generation**

Publish `generating` during image edit and `vectorizing` during conversion. Feed the result to `CompiledSpatialEditCandidate`; do not add a generation-only commit path. Hybrid mode locks protected hashes and boundary anchors before generation.

**Step 4: Add deterministic plus high-reasoning visual acceptance**

Deterministic checks verify protection, seams, bounds, references and vector validity. The final visual acceptance model compares original goal, before, region, generated candidate, Preview and diff. A model-only “looks good” result can never override deterministic failure.

**Step 5: Run GREEN and commit**

Run: `npx vitest run api/services/drawing-spatial/generative-validator.test.ts api/services/drawing-agent/runtime.test.ts`

```bash
git add api/services/drawing-spatial api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts api/app.ts
git commit -m "feat: unify hybrid redraw and geometry previews"
```

### Task 14: Add the creative golden gate and remove node-first history

**Files:**

- Create: `scripts/e2e-region-hair-edit.ts`
- Create: `api/services/drawing-benchmark/region-edit.ts`
- Create: `api/services/drawing-benchmark/region-edit.test.ts`
- Delete: `src/contracts/drawing-spatial-agent.ts`
- Delete: `src/contracts/drawing-spatial-agent.test.ts`
- Delete node-first adapter exports and tests from: `api/services/drawing-agent/semantic-adapters.ts`
- Delete node-first compiler use; remove obsolete files if unreferenced: `api/services/drawing-edit/compile-intent.ts`, `api/services/drawing-edit/compile-intent.test.ts`, `api/services/drawing-edit/strategy-types.ts`
- Modify: `package.json`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/superpowers/specs/2026-08-11-region-first-spatial-editing-design.md`
- Modify: `README.md`

**Step 1: Write the golden gate**

Run once with a deterministic fake image-edit provider to prove architecture, then optionally with the configured real provider to measure model quality. Assert generated/hybrid strategy evidence, protected eyes/face, Drawing IR geometry output, feedback “hair shorter” creating Preview version 2 in the same Episode, commit replay and revert.

**Step 2: Run the benchmark tests**

Run: `npx vitest run api/services/drawing-benchmark/region-edit.test.ts`

Expected: PASS.

**Step 3: Remove the old semantic path**

Use `rg` to prove no runtime import or public request references `VisualFeatureGraph`, `EditIntent`, `targetNodeIds` as the semantic selection source, `DrawingFeatureGraphAdapter`, `DrawingEditIntentAdapter`, or `compileEditIntent`. Exact-ID Fast Command Lane command targets may still contain node IDs.

Run:

```bash
rg -n "VisualFeatureGraph|DrawingFeatureGraphAdapter|DrawingEditIntentAdapter|compileEditIntent" api src scripts
```

Expected: no matches outside historical committed documentation that explicitly describes the removed path.

**Step 4: Update product and architecture status**

Mark Region-First implementation complete only after both deterministic gates pass. Document provider-quality gate separately from system correctness; record that high reasoning is required for semantic region, strategy and visual acceptance, while the kernel remains model-independent.

**Step 5: Run the full verification suite**

```bash
npm test
npm run check
npm run build
npx eslint src/contracts/drawing-spatial-region.ts api/services/drawing-spatial api/services/drawing-episode api/services/drawing-generation api/services/drawing-agent/runtime.ts api/services/drawing-agent/semantic-adapters.ts src/drawing/preview src/hooks/useStore.ts src/components/Canvas.tsx src/components/ConstructionTimeline.tsx
npm run e2e:test2-semantic-edit -- test2.png
npm run e2e:region-hair-edit
git diff --check
```

Expected: all targeted tests, typecheck, build, changed-file lint, deterministic test2 gate, deterministic hair gate and whitespace check pass. If the optional real-provider gate fails while deterministic gates pass, record it as provider capability evidence rather than silently weakening system assertions.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete region-first spatial editing migration"
```

## Completion evidence

The migration is complete only when all of the following are derivable from files, audit events and executable tests:

1. The model selects a continuous semantic region before any primitive ownership decision.
2. The RegionResolver finds test2's lower arm inside the shared body Polyline.
3. Preview materialization splits only the necessary source range and preserves the body vertical exactly.
4. The raised arm has no unexpected dangling endpoints and remains attached at declared anchors.
5. Only the latest Preview version can commit; user feedback supersedes earlier versions and reuses the same Episode.
6. Geometric, generative and hybrid candidates all become DrawingCommand transactions against Drawing IR.
7. Generated vectors cannot invade protected regions, and low-confidence free curves remain visibly candidate quality.
8. Before/region/preview/diff/verification/commit order is auditable and replayable without calling a model.
9. The UI shows one active region/Preview and business progress without model names or strategy controls.
10. Old node-first visual selection code is removed instead of maintained as a parallel path.
