# DSH Space Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Every production behavior follows RED → GREEN → REFACTOR.

**Goal:** Deliver the first installable DSH Space plugin slice: one DSH image attachment becomes a pending drawing source, the Agent is instructed to call the visible `drawing_import` tool, an in-memory session repository owns the imported Drawing, a `conversation.view` tab previews it, and `drawing_summarize` reports the same authoritative revision.

**Architecture:** Four workspace packages separate the public wire contract, DSH Host adapter, DSH Client adapter, and installable profile bundle. The Host uses DSH's durable `ImageAttachmentRef` and `ctx.attachments.readImage()`; no HTTP/Express endpoint is added. A strict-codec TypeRT Remote method returns a session-scoped, JSON-only Canvas projection. Slice 1 intentionally uses a provisional image-footprint vectorizer (four candidate boundary lines over the source raster) behind an injected `ImageVectorizer` port, proving the complete integration seam without presenting the boundary as final engineering geometry. The later WASM vectorizer replaces this port without changing tools, Remote, or Canvas.

**Tech Stack:** TypeScript 5.8, React 18, Vitest 3, pnpm workspaces, DSH `0.1.0-rc.8`, Cordis 4, Vite library build

**Specs:** `docs/dsh-plugin-migration.md`, `docs/superpowers/specs/2026-08-20-dsh-drawing-interaction-design.md`

> **Superseded implementation note (2026-08-20):** The provisional four-edge
> footprint described in this historical Slice 1 plan has been removed from
> the shipped Host. `LocalCleanLineVectorizer` now runs the packaged local
> Python/OpenCV worker and returns analytic/polyline geometry plus topology and
> compound-path features. The footprint remains described below only as the
> original seam-proving step, not as current product behavior.

## Global Constraints

- Work only on `codex/dsh-plugin-migration`.
- Add no VectorAI cloud service, Express route, or arbitrary Host path input.
- Keep `@deepseek-ai/*`, Cordis, Typert, DSH messages, and slots outside `drawing-core` and `plugin-space-contracts`.
- Bind pending sources and Drawing projections to the DSH session id; a Client request cannot choose another Host path or attachment.
- Return source image bytes only through the session-scoped Remote projection; never append base64 or Drawing snapshots to the DSH session log.
- Slice 1 supports exactly the most recent single PNG/JPEG/WebP/GIF attachment in a prompt.
- Mark footprint geometry `candidate` and the projection `provisional`; do not call it completed line extraction.
- Keep HyperFrames files untouched.

---

### Task 1: Public Space contract and in-memory repository

**Files:**
- Create: `packages/plugin-space-contracts/package.json`
- Create: `packages/plugin-space-contracts/tsconfig.json`
- Create: `packages/plugin-space-contracts/src/index.ts`
- Create: `packages/plugin-dsh-space-host/src/repository.test.ts`
- Create: `packages/plugin-dsh-space-host/src/repository.ts`
- Create: `packages/plugin-dsh-space-host/src/vectorizer.ts`

**Interfaces:**
- `DrawingRef { drawingId, revision }`
- `DrawingCanvasProjection { version, ref, source, bounds, geometry, provisional }`
- `DrawingSummary { ref, unit, bounds, geometryByType, provisional }`
- `ImageVectorizer.vectorize({ attachment, data, signal })`
- `InMemoryDrawingRepository.bindPending/getPending/importPending/getProjection/summarize/disposeSession`

- [x] **Step 1: Add contract metadata and pure JSON types**

Create `@vectorai/plugin-space-contracts` with no DSH/runtime-host dependencies. It owns the shared Zod v4 wire schemas required by TypeRT strict codecs. The Canvas projection includes an image data URL, intrinsic pixel bounds, and only JSON-safe line geometry for this slice.

- [x] **Step 2: Write repository RED tests**

Tests must prove independently derived behavior:

1. binding two images retains only the latest pending image for that session;
2. a successful import stores one projection and summary with the same `{ drawingId, revision }`;
3. importing the same attachment again is idempotent and calls the vectorizer once;
4. an aborted/throwing vectorizer leaves no Drawing projection;
5. disposing a session removes both pending source and Drawing state;
6. another session cannot read the projection.

Run:

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/repository.test.ts
```

Expected RED: module-not-found for `./repository`, not a test configuration error.

- [x] **Step 3: Implement the minimal repository and vectorizer port**

The repository accepts an injected vectorizer and id/time factories. Commit state only after vectorization resolves and `signal.throwIfAborted()` succeeds. Clone all returned projections so callers cannot mutate authoritative state.

The default provisional vectorizer creates a `DrawingDocument` with four candidate `line` nodes around `[0, 0, width, height]`, `unitSystem.length = 'mm'`, and returns a `DrawingCanvasProjection` containing `data:<mediaType>;base64,...`. Its summary says `provisional: true`.

- [x] **Step 4: Run GREEN and package checks**

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/repository.test.ts
pnpm --filter @vectorai/plugin-space-contracts check
```

- [x] **Step 5: Commit**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-space-host/src/repository.ts packages/plugin-dsh-space-host/src/repository.test.ts packages/plugin-dsh-space-host/src/vectorizer.ts
git commit -m "feat: add session drawing repository"
```

---

### Task 2: DSH Host tools and pre-step intake

**Files:**
- Create: `packages/plugin-dsh-space-host/package.json`
- Create: `packages/plugin-dsh-space-host/tsconfig.json`
- Create: `packages/plugin-dsh-space-host/src/intake.test.ts`
- Create: `packages/plugin-dsh-space-host/src/intake.ts`
- Create: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Create: `packages/plugin-dsh-space-host/src/tools.ts`
- Create: `packages/plugin-dsh-space-host/src/service.ts`
- Create: `packages/plugin-dsh-space-host/src/index.ts`

**Interfaces:**
- `findLatestImage(messages)` returns the last image block in prompt order.
- `createPreStepIntake(repository)` returns a cooperative DSH pre-step listener.
- `createDrawingImportTool(repository, attachments)` registers `drawing_import` with `{}` arguments.
- `createDrawingSummarizeTool(repository)` registers `drawing_summarize` with `{}` arguments.
- `DrawingSpaceHostService.getProjection(sessionId)` is a direct Typert Remote method.

- [x] **Step 1: Write intake RED tests**

Prove that the intake:

1. selects the last image from the accepted message batch;
2. binds it to `agent.id`;
3. appends one plugin snapshot telling the model to call `drawing_import` before inspecting/modifying the drawing;
4. delegates and preserves a downstream rejection;
5. adds no context when no image exists.

Run the test and observe a failure because `./intake` is absent.

- [x] **Step 2: Implement intake GREEN**

Use `createUserMessage()` and a DSH plugin source `{ kind: 'plugin', plugin: '@vectorai/plugin-dsh-space-host', form: 'snapshot', sections: [...] }`. Do not modify the user's original image block.

- [x] **Step 3: Write tool RED tests**

Call each real `defineTool` definition's `execute()` with a complete fake `ToolRunContext`. Prove:

1. `drawing_import` rejects calls without an owning Agent;
2. it reads the pending attachment through `attachments.readImage(ref, exec.signal)`;
3. success returns the repository's exact DrawingRef and provisional status;
4. `drawing_summarize` reports `DRAWING_REQUIRED` before import;
5. after import it returns the same ref and literal `geometryByType.line = 4`.

- [x] **Step 4: Implement tools and Host service GREEN**

`DrawingSpaceHostService` extends `TypertRemoteService`, injects `tools` and `attachments`, owns the repository, registers both tools and `agent/pre-step`, cleans session state on `session/disposed`, and exposes a decorated source-mode Remote `getProjection(sessionId: string)`. Its `dispose` path is owned by Cordis effects.

- [x] **Step 5: Check Host package and commit**

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/intake.test.ts packages/plugin-dsh-space-host/src/tools.test.ts packages/plugin-dsh-space-host/src/repository.test.ts
pnpm --filter @vectorai/plugin-dsh-space-host check
git add packages/plugin-dsh-space-host
git commit -m "feat: integrate drawing tools with DSH host"
```

---

### Task 3: DSH `conversation.view` Canvas client

**Files:**
- Create: `packages/plugin-dsh-space-client/package.json`
- Create: `packages/plugin-dsh-space-client/tsconfig.json`
- Create: `packages/plugin-dsh-space-client/src/DrawingCanvas.test.tsx`
- Create: `packages/plugin-dsh-space-client/src/DrawingCanvas.tsx`
- Create: `packages/plugin-dsh-space-client/src/remote.ts`
- Create: `packages/plugin-dsh-space-client/src/client.tsx`
- Create: `packages/plugin-dsh-space-client/src/index.ts`

**Interfaces:**
- `DrawingCanvas({ projection, loading, error })`
- `DrawingSpaceRemote.getProjection(sessionId)`
- Client `apply(ctx)` mounts the Remote contribution then registers `id: 'drawing'` in `conversation.view`.

- [x] **Step 1: Write Canvas RED tests**

Using `react-dom/server`, prove:

1. no projection renders a localized empty state;
2. a projection renders the original raster and four SVG lines in one pixel-coordinate `viewBox`;
3. the header exposes drawing id, revision, and an explicit provisional badge;
4. Remote errors render without discarding a previously loaded projection.

- [x] **Step 2: Implement the pure Canvas GREEN**

Use an SVG `<image>` plus line overlays with `vectorEffect="non-scaling-stroke"`. Keep styling inline so the out-of-tree client bundle has no unserved CSS asset.

- [x] **Step 3: Implement Remote mounting and slot registration**

Provide matching Host and Client descriptors for `drawingSpace/getProjection` with shared strict Zod codecs. `apply(ctx)` first awaits `remote.$mount(contribution)`, then starts a nested `remote.drawingSpace`-injected Cordis fiber before registering the view:

```ts
ctx.slots.inject('conversation.view', () => ctx.slots.register({
  name: 'conversation.view',
  id: 'drawing',
  order: 20,
  label: () => '图纸',
  inject: (sessionId) => ({
    loadDrawing: () => drawingSpace.getProjection(sessionId),
  }),
}, DrawingConversationView));
```

The view loads on mount and reloads when the DSH conversation snapshot changes from a running tool call to a settled result.

- [x] **Step 4: Check and commit**

```bash
pnpm vitest run packages/plugin-dsh-space-client/src/DrawingCanvas.test.tsx
pnpm --filter @vectorai/plugin-dsh-space-client check
git add packages/plugin-dsh-space-client
git commit -m "feat: add DSH drawing canvas view"
```

---

### Task 4: Buildable and installable DSH profile bundle

**Files:**
- Create: `packages/plugin-dsh-space/package.json`
- Create: `packages/plugin-dsh-space/cordis.patch.yml`
- Create: `packages/plugin-dsh-space/README.md`
- Create: `scripts/build-dsh-space.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- `@vectorai/plugin-dsh-space` declares `dsh.bundle.patch`.
- Patch inserts `@vectorai/plugin-dsh-space-host` and `@vectorai/plugin-dsh-space-client` rows.
- Client package declares `dsh.client.platform = 'web'`, exports `./client`, and injects the DSH Remote and conversation packages.

- [x] **Step 1: Add exact rc.8 dependencies and bundle metadata**

Pin all DSH dependencies to `0.1.0-rc.8`; do not use `latest`. The installable bundle depends on the two adapter packages, and its patch inserts both rows with stable ids.

- [x] **Step 2: Add the out-of-tree build**

Use Vite's library API to emit:

- Host ESM: `packages/plugin-dsh-space-host/lib/index.js`;
- Host TypeRT manifest: `packages/plugin-dsh-space-host/lib/typert.js`;
- Client Node no-op ESM: `packages/plugin-dsh-space-client/lib/index.js`;
- Client lazy-CJS factory: `packages/plugin-dsh-space-client/lib/client.js`, wrapped as `window.__ModuleLoader__.load({ id: '@vectorai/plugin-dsh-space-client', factory(require) { ... } })`.

Externalize React and DSH browser modules from the Client bundle; inline VectorAI contract code. Fail the build if the generated Client bundle lacks the ModuleLoader wrapper or contains Node builtin imports.

- [x] **Step 3: Build and inspect artifacts**

```bash
pnpm build:dsh-space
node --check packages/plugin-dsh-space-host/lib/index.js
node --check packages/plugin-dsh-space-host/lib/typert.js
node --check packages/plugin-dsh-space-client/lib/index.js
node --check packages/plugin-dsh-space-client/lib/client.js
```

- [x] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/build-dsh-space.mjs packages/plugin-dsh-space packages/plugin-dsh-space-host/package.json packages/plugin-dsh-space-client/package.json
git commit -m "build: package DSH space plugin"
```

---

### Task 5: DSH rc.8 mount and browser smoke

**Files:**
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `docs/superpowers/plans/2026-08-20-dsh-space-slice-1.md`

- [x] **Step 1: Run focused and full regression**

```bash
pnpm --filter @vectorai/plugin-space-contracts check
pnpm --filter @vectorai/plugin-dsh-space-host check
pnpm --filter @vectorai/plugin-dsh-space-client check
pnpm test
pnpm check
pnpm install --frozen-lockfile
```

- [x] **Step 2: Install the local bundle into DSH Web**

From the repository root:

```bash
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client
dsh --profile web --dump-config
```

Verify the composed tree contains both `vectorai-space-host` and `vectorai-space-client`. This intentionally changes the user's local DSH Web profile; record the exact dependency and bundle entry added.

Verified local profile dependencies:

- `@vectorai/plugin-dsh-space` → repository bundle path;
- `@vectorai/plugin-dsh-space-host` → repository Host path;
- `@vectorai/plugin-dsh-space-client` → repository Client path.

`dsh --profile web --dump-config` contains `vectorai-space-host` and `vectorai-space-client`.

- [ ] **Step 3: Run live UI smoke**

Start DSH with `--no-open`, open the local URL, send one supported image, and verify:

1. Chat shows a visible `drawing_import` tool call before a drawing claim;
2. the “图纸” tab exists alongside Chat;
3. the tab shows the source raster plus four provisional boundary lines;
4. asking the Agent to summarize invokes `drawing_summarize` and returns the same drawing id/revision;
5. closing the DSH app/window stops the Host process according to the existing wrapper behavior.

If the selected model ignores the injected instruction, capture the transcript and treat it as an Agent-prompt defect; do not hide the import inside the Client.

Mount/UI subset verified on `http://127.0.0.1:3090`: the plugin booted without a current loader error, “图纸” appeared beside “对话/轨迹”, the accessible Canvas rendered its empty state, and `drawingSpace/getProjection` returned through the Host TypeRT route. Sending a new image and model prompt remains a user-triggered acceptance step because it transmits content to the configured model.

- [x] **Step 4: Record Slice 1 status and limitations**

Document that image-footprint geometry is a provisional integration vectorizer, memory state does not yet survive a Host restart, and generic DXF/PDF plus WASM line extraction remain Slice 2 work.

- [x] **Step 5: Final verification and commit**

```bash
git diff --check
git status --short
git add docs/dsh-plugin-migration.md docs/superpowers/plans/2026-08-20-dsh-space-slice-1.md
git commit -m "docs: record DSH space slice one"
```

Then use `superpowers:verification-before-completion` and `superpowers:finishing-a-development-branch` before claiming completion or offering integration choices.
