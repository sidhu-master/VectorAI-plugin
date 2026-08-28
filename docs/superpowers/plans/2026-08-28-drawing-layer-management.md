# Drawing Layer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-layer drawing-layer registry and reusable top-right manager, then migrate the Engineering Annotation partition overlay into it.

**Architecture:** `@vectorai/drawing-surface-api` defines namespaced layer metadata and lifecycle-safe registration. `plugin-dsh-space-client` owns the registry and passes it to elected workspaces; `drawing-viewer-react` renders a controlled manager; the annotation plugin registers its partition layer and owns session-scoped visibility preferences.

**Tech Stack:** TypeScript 5.8, React 18, Vitest, react-test-renderer, lucide-react, Cordis, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-28-drawing-layer-management-design.md`

## Global Constraints

- Preserve DXF source layers in `DrawingNodeSourceRef.layer`; do not modify `VectorAI-Drawing` 1.0.
- Hiding a work layer must not mutate documents, partition data, selection, history, or workflow.
- Layer IDs are namespaced; the second layer registers `vectorai.annotation.partition`.
- The manager overlays the canvas upper-right and must not resize it.
- Preferences are session-isolated and migrate the legacy partition key.
- Apply strict red-green-refactor; rebuild generated bundles only after source tests pass.

---

### Task 1: Public layer contracts and first-layer registry

**Files:**
- Modify: `packages/drawing-surface-api/src/index.ts`
- Modify: `packages/drawing-surface-api/src/index.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.ts`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.test.ts`

**Interfaces:**
- Produces: `DrawingLayerCategory`, `DrawingLayerIcon`, `DrawingLayerDefinition`, `DrawingLayerRegistry`.
- Produces: `DrawingSurfaceRegistry.registerLayer/getLayers/subscribeLayers`.
- Produces: optional `layerRegistry` on `DrawingSurfaceComponentProps`.

- [ ] **Step 1: Write failing registry tests**

Use a literal fixture:

```ts
const partitionLayer: DrawingLayerDefinition = {
  id: 'vectorai.annotation.partition',
  label: '智能分区',
  category: 'engineering',
  icon: 'partition',
  order: 100,
  defaultVisible: true,
};
const registration = registry.registerLayer(partitionLayer);
expect(registry.getLayers()).toEqual([partitionLayer]);
expect(() => registry.registerLayer(partitionLayer))
  .toThrow('DUPLICATE_DRAWING_LAYER:vectorai.annotation.partition');
registration.dispose();
expect(registry.getLayers()).toEqual([]);
```

Also assert ordering by `order` then `id`, subscriber notification on register/dispose, and idempotent disposal.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/drawing-surface-api/src/index.test.ts packages/plugin-dsh-space-client/src/surface-registry.test.ts
```

Expected: missing layer types and methods.

- [ ] **Step 3: Implement minimal contracts and registry**

```ts
export type DrawingLayerCategory = 'engineering' | 'cad' | 'assistant' | 'interaction';
export type DrawingLayerIcon = 'partition' | 'angle' | 'dimension' | 'tolerance' | 'cad' | 'assistant';

export interface DrawingLayerDefinition {
  id: string;
  label: string;
  category: DrawingLayerCategory;
  icon?: DrawingLayerIcon;
  order: number;
  defaultVisible: boolean;
}

export interface DrawingLayerRegistry {
  registerLayer(definition: DrawingLayerDefinition): Disposable;
  getLayers(): readonly DrawingLayerDefinition[];
  subscribeLayers(listener: () => void): () => void;
}
```

Make `DrawingSurfaceRegistry` extend it. Store layers in a map and listeners in a set; return a new sorted array.

- [ ] **Step 4: Verify GREEN with the Task 1 command**
- [ ] **Step 5: Commit**

```bash
git add packages/drawing-surface-api/src packages/plugin-dsh-space-client/src/surface-registry.ts packages/plugin-dsh-space-client/src/surface-registry.test.ts
git commit -m "feat(surface): register drawing layers"
```

### Task 2: Reusable upper-right layer manager

**Files:**
- Create: `packages/drawing-viewer-react/src/panels/DrawingLayerManager.tsx`
- Create: `packages/drawing-viewer-react/src/panels/DrawingLayerManager.test.tsx`
- Modify: `packages/drawing-viewer-react/src/index.ts`
- Modify: `packages/drawing-viewer-react/src/styles.css`

**Interfaces:**
- Consumes: `DrawingLayerDefinition`.
- Produces: `DrawingLayerManager`, `DrawingLayerManagerItem`, `DrawingLayerManagerProps`.

- [ ] **Step 1: Write a failing component test**

Render one engineering item, expand `管理图层`, click `隐藏智能分区`, and assert:

```ts
expect(onVisibilityChange)
  .toHaveBeenCalledWith('vectorai.annotation.partition', false);
```

Also prove `layers=[]` renders nothing and Escape closes the menu.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/drawing-viewer-react/src/panels/DrawingLayerManager.test.tsx
```

Expected: module missing.

- [ ] **Step 3: Implement the controlled manager**

```ts
export interface DrawingLayerManagerItem {
  definition: DrawingLayerDefinition;
  visible: boolean;
}
export interface DrawingLayerManagerProps {
  layers: readonly DrawingLayerManagerItem[];
  onVisibilityChange(id: string, visible: boolean): void;
}
```

Use `Layers3`, `aria-expanded`, grouped rows, semantic lucide icons, `aria-pressed`, and labels `隐藏${label}` / `显示${label}`. Stop pointer propagation and close on Escape.

```css
.vai-layer-manager { position: absolute; z-index: 11; top: 14px; right: 16px; }
.vai-layer-manager__menu { position: absolute; top: 38px; right: 0; min-width: 190px; }
```

- [ ] **Step 4: Verify GREEN with the Task 2 command**
- [ ] **Step 5: Commit**

```bash
git add packages/drawing-viewer-react/src/panels/DrawingLayerManager.tsx packages/drawing-viewer-react/src/panels/DrawingLayerManager.test.tsx packages/drawing-viewer-react/src/index.ts packages/drawing-viewer-react/src/styles.css
git commit -m "feat(viewer): add drawing layer manager"
```

### Task 3: Pass the registry to elected workspaces

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/DrawingSurfaceHost.tsx`
- Modify: `packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx`

**Interfaces:**
- Consumes: optional `layerRegistry` from Task 1.
- Produces: every elected workspace receives the first-layer registry.

- [ ] **Step 1: Add a failing assertion**

```ts
expect(received.layerRegistry).toBe(registry);
```

Retain existing assertions for session ID, namespace and runtime.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx
```

Expected: `layerRegistry` is undefined.

- [ ] **Step 3: Pass `layerRegistry={registry}` to `SpecializedWorkspace`**
- [ ] **Step 4: Verify GREEN with the Task 3 command**
- [ ] **Step 5: Commit**

```bash
git add packages/plugin-dsh-space-client/src/DrawingSurfaceHost.tsx packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx
git commit -m "feat(dsh): expose layer registry to workspaces"
```

### Task 4: Register the partition layer

**Files:**
- Modify: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`

**Interfaces:**
- Produces: `ANNOTATION_PARTITION_LAYER_ID = 'vectorai.annotation.partition'`.

- [ ] **Step 1: Write a failing lifecycle test**

Capture `registerLayer` and assert the exact definition:

```ts
{
  id: 'vectorai.annotation.partition',
  label: '智能分区',
  category: 'engineering',
  icon: 'partition',
  order: 100,
  defaultVisible: true,
}
```

Dispose the plugin and assert its registration disposer runs once.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/plugin-dsh-annotation-client/src/client.test.tsx
```

Expected: `registerLayer` is not called.

- [ ] **Step 3: Register before `registerWorkspace`, dispose during cleanup, and accept optional `layerRegistry` in workspace props**
- [ ] **Step 4: Verify GREEN with the Task 4 command**
- [ ] **Step 5: Commit**

```bash
git add packages/plugin-dsh-annotation-client/src/client.tsx packages/plugin-dsh-annotation-client/src/client.test.tsx packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx
git commit -m "feat(annotation): register partition layer"
```

### Task 5: Session visibility and legacy migration

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/layer-visibility.ts`
- Create: `packages/plugin-dsh-annotation-client/src/layer-visibility.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`

**Interfaces:**
- Produces: `readLayerVisibility(sessionId, definitions, storage)`.
- Produces: `writeLayerVisibility(sessionId, values, storage)`.

- [ ] **Step 1: Write failing pure-state tests**

```ts
expect(readLayerVisibility('one', [partitionLayer], emptyStorage))
  .toEqual({ 'vectorai.annotation.partition': true });

legacyStorage.setItem('vectorai:annotation:partition-overlay:one', 'false');
expect(readLayerVisibility('one', [partitionLayer], legacyStorage))
  .toEqual({ 'vectorai.annotation.partition': false });
```

Also assert the new key `vectorai:annotation:layer-visibility:one`, unknown IDs ignored, new definitions use defaults, malformed JSON falls back, and sessions are isolated.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/plugin-dsh-annotation-client/src/layer-visibility.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement JSON boolean-map persistence**

Read the legacy key only for the partition ID if the new map lacks it. Catch storage and JSON errors. Never write the legacy key.

- [ ] **Step 4: Verify GREEN with the Task 5 command**
- [ ] **Step 5: Commit**

```bash
git add packages/plugin-dsh-annotation-client/src/layer-visibility.ts packages/plugin-dsh-annotation-client/src/layer-visibility.test.ts packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx
git commit -m "feat(annotation): persist layer visibility"
```

### Task 6: Migrate the UI into the top-right manager

**Files:**
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/PartitionInspector.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/PartitionInspector.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes: `DrawingLayerManager`, registry definitions, visibility helpers.
- Produces: one upper-right control for draft and confirmed partition overlays.

- [ ] **Step 1: Write failing workspace behavior tests**

Assert:

```ts
expect(renderer.root.findAllByProps({ 'aria-label': '管理图层' })).toHaveLength(1);
expect(renderer.root.findAllByProps({ 'aria-label': '隐藏分区框' })).toHaveLength(0);
```

Expand and click `隐藏智能分区`; assert the partition overlay disappears while the drawing, inspector, and `确认分区` or `重新编辑` remain. Assert same-session persistence and different-session isolation. Remove visibility props from inspector tests while preserving their functional assertions.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx packages/plugin-dsh-annotation-client/src/PartitionInspector.test.tsx packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.test.tsx
```

Expected: manager absent and old inspector switches present.

- [ ] **Step 3: Implement minimal migration**

Subscribe to `getLayers/subscribeLayers` using `useSyncExternalStore`. Expose partition only with draft/confirmed data. Render the manager inside the canvas before centered status. Drive both overlays from the new map. Remove Eye/EyeOff imports, visibility props, old buttons and obsolete CSS.

- [ ] **Step 4: Verify GREEN with the Task 6 command**
- [ ] **Step 5: Commit**

```bash
git add packages/plugin-dsh-annotation-client/src
git commit -m "feat(annotation): manage overlays from canvas layers"
```

### Task 7: Full verification, bundles, DSH smoke test and integration

**Files:**
- Modify generated: `packages/plugin-dsh-space-client/lib/client.js`
- Modify generated: `packages/plugin-dsh-space-client/lib/index.js`
- Modify generated: `packages/plugin-dsh-annotation-client/lib/client.js`
- Modify generated: `packages/plugin-dsh-annotation-client/lib/index.js`

- [ ] **Step 1: Run focused tests together**

```bash
pnpm vitest run packages/drawing-surface-api/src/index.test.ts packages/plugin-dsh-space-client/src/surface-registry.test.ts packages/drawing-viewer-react/src/panels/DrawingLayerManager.test.tsx packages/plugin-dsh-space-client/src/DrawingSurfaceHost.test.tsx packages/plugin-dsh-annotation-client/src/client.test.tsx packages/plugin-dsh-annotation-client/src/layer-visibility.test.ts packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx packages/plugin-dsh-annotation-client/src/PartitionInspector.test.tsx packages/plugin-dsh-annotation-client/src/ConfirmedPartitionInspector.test.tsx
```

Expected: zero failures.

- [ ] **Step 2: Run repository-wide verification**

```bash
pnpm test
pnpm lint
pnpm check
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 3: Rebuild bundles**

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
git diff --check
```

Expected: both builds exit 0 with no whitespace errors.

- [ ] **Step 4: Verify the real DSH application**

Restart `/Users/sidhu/Applications/DSH.app` and verify: upper-right anchoring; “工程信息 / 智能分区”; hide affects only boxes/labels/handles; workflow/drawing/inspector/toolbars remain; show restores; resize and inspector opening do not move the anchor or shrink the canvas.

- [ ] **Step 5: Commit bundles**

```bash
git add packages/plugin-dsh-space-client/lib packages/plugin-dsh-annotation-client/lib
git commit -m "build: refresh DSH layer bundles"
```

- [ ] **Step 6: Push, create, and merge the PR**

```bash
git push -u origin codex/drawing-layer-management
gh pr create --base main --head codex/drawing-layer-management --title "feat: add drawing layer management" --body-file /tmp/vectorai-layer-pr.md
gh pr merge --merge --delete-branch
```

Record the two-level architecture, migration, test counts, builds, and DSH smoke evidence in the PR.

