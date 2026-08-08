# Drawing Application and Local Repository Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server-side Drawing Application and local file repository the sole authority for manual CAD editing, project the Canonical DrawingDocument into the UI, and remove the corresponding legacy SpatialModel mutation paths without adding dual writes or compatibility translators.

**Architecture:** A pure repository state transition module will be shared by the in-memory and local-file repositories. The server exposes Drawing Application operations over HTTP; the browser keeps only the latest document projection, revision, selection, and transient UI state. Manual edits become typed DrawingTransactions. Agent and perception mutation are intentionally not adapted in this phase: their UI controls report that the runtime migration is pending until the next plan replaces those protocols.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Express 5, React 19, Zustand 5, Vitest, existing `src/drawing` public API.

## Global Constraints

- Continue directly on `main`; do not create a branch or worktree.
- Do not use sub-agents.
- Use test-first development and commit each task independently.
- `DrawingDocument` is the only editing authority; do not retain or derive a second writable `SpatialModel`.
- Do not add a SpatialModel ↔ DrawingDocument compatibility translator or dual-write path.
- AI and UI must not mutate DrawingDocument arrays directly.
- Every formal edit follows Command → Transaction → Verify → Commit.
- Local persistence uses a temporary file, file sync, and atomic rename; a successful HTTP response must mean the revision is durable.
- The first response or progress heartbeat budget remains 30 seconds / 25 seconds, although Agent runtime migration is outside this plan.
- Preserve `test1.jpg` unchanged and untracked.
- Do not migrate Agent Runtime, perception, DXF/PDF adapters, or audit event formats in this plan.

---

### Task 1: Extract Pure Repository State Transitions

**Files:**
- Create: `src/drawing/repository/state.ts`
- Modify: `src/drawing/repository/types.ts`
- Modify: `src/drawing/repository/memory.ts`
- Test: `src/drawing/tests/repository-state.test.ts`
- Test: `src/drawing/tests/repository.test.ts`

**Interfaces:**
- Consumes: `previewTransaction()`, `applyDrawingPatch()`, `DrawingCommit`, `IdFactory`.
- Produces:

```ts
export interface DrawingRepositoryState {
  initialDocument: DrawingDocument;
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export interface RepositoryTransitionDependencies {
  idFactory: IdFactory;
  now: () => number;
}

export function createRepositoryState(
  document: DrawingDocument,
  revision: RevisionId,
): DrawingRepositoryState;

export function commitRepositoryState(
  state: DrawingRepositoryState,
  transaction: DrawingTransaction,
  dependencies: RepositoryTransitionDependencies,
): { result: RepositoryCommitResult; state: DrawingRepositoryState };

export function revertRepositoryState(
  state: DrawingRepositoryState,
  input: { drawingId: DrawingId; commitId: CommitId; actor: Actor },
  dependencies: RepositoryTransitionDependencies,
): { result: RepositoryCommitResult; state: DrawingRepositoryState };
```

- All inputs and returned public values are cloned. Rejected and already-satisfied transitions return a state structurally equal to the input and allocate no commit/revision IDs.

- [ ] **Step 1: Write failing pure transition tests**

Add tests that create a state, commit a circle, reject a stale transaction without changing the state, revert the circle commit, and prove that mutating returned state/commit objects does not mutate the input fixture.

```ts
const transitioned = commitRepositoryState(state, transaction, dependencies);
expect(transitioned.result.status).toBe('committed');
expect(state.document.geometry).toEqual([]);
expect(transitioned.state.document.geometry).toHaveLength(1);

const stale = commitRepositoryState(transitioned.state, transaction, dependencies);
expect(stale.result).toMatchObject({
  status: 'rejected', errors: [{ code: 'STALE_REVISION' }],
});
expect(stale.state).toEqual(transitioned.state);
```

- [ ] **Step 2: Verify repository-state tests fail**

Run: `npx vitest run src/drawing/tests/repository-state.test.ts`

Expected: FAIL because `repository/state.ts` does not exist.

- [ ] **Step 3: Implement the pure transition functions**

Move commit construction and revert construction out of `MemoryDrawingRepository`. Validate the initial document in `createRepositoryState`; call `previewTransaction` for commits; append rather than mutate history; and preserve the exact existing `RepositoryCommitResult` contract.

- [ ] **Step 4: Refactor MemoryDrawingRepository to delegate**

Keep only maps, revision ownership, cloning, and synchronous critical sections in `memory.ts`. Its externally observable IDs, stale revision behavior, immutable copies, and chronological history must remain unchanged.

- [ ] **Step 5: Run repository tests and commit**

Run: `npx vitest run src/drawing/tests/repository-state.test.ts src/drawing/tests/repository.test.ts src/drawing/tests/replay.test.ts`

Expected: PASS.

```bash
git add src/drawing/repository src/drawing/tests/repository-state.test.ts src/drawing/tests/repository.test.ts
git commit -m "refactor(drawing-repo): extract pure state transitions"
```

---

### Task 2: Durable Local File Drawing Repository

**Files:**
- Create: `api/services/drawing-application/file-drawing-repository.ts`
- Create: `api/services/drawing-application/file-drawing-repository.test.ts`
- Modify: `src/drawing/repository/types.ts`
- Modify: `src/drawing/index.ts`

**Interfaces:**
- Consumes: `DrawingRepositoryState`, pure repository transitions, `DrawingRepository`.
- Produces:

```ts
export interface DrawingRepositorySnapshot {
  schemaVersion: 1;
  initialDocument: DrawingDocument;
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export class FileDrawingRepository implements DrawingRepository {
  constructor(input: { rootDirectory: string; idFactory?: IdFactory; now?: () => number });
}
```

- Each drawing is stored at `<root>/<sha256(drawingId)>.json`; the JSON content retains and verifies the actual drawing ID. Never place a user-provided ID directly into a filesystem path.
- A snapshot is accepted only when schema is 1, IDs match, `replayDrawingCommits(initialDocument, commits)` equals the stored document/revision, and `validateDrawingDocument(document)` succeeds.
- On startup, scan only regular `*.json` snapshot files in the configured root, validate them, and build an in-memory `RevisionId → DrawingId` index containing both current and historical revisions. `commit(transaction)` uses that index to identify the drawing, then lets the pure transition return `STALE_REVISION` when the base revision is historical rather than current.
- Serialize all create/commit/revert writes through one in-process promise queue. Write `<target>.<uuid>.tmp`, call `FileHandle.sync()`, close it, rename over the target, then sync the parent directory.

- [ ] **Step 1: Write failing persistence and recovery tests**

Use `mkdtemp()` and remove only that exact temporary directory in test cleanup. Cover:

1. Create → new repository instance → getCurrent restores the exact document and revision.
2. Commit and revert remain after reopening.
3. Stale concurrent transactions produce one commit and one `STALE_REVISION` rejection.
4. A corrupted snapshot returns a structured load error and is never silently replaced.
5. Failed rename leaves the previously committed snapshot readable; inject a filesystem adapter at the rename boundary rather than mocking Node's entire filesystem module.

- [ ] **Step 2: Verify file repository tests fail**

Run: `npx vitest run api/services/drawing-application/file-drawing-repository.test.ts`

Expected: FAIL because `FileDrawingRepository` does not exist.

- [ ] **Step 3: Implement safe snapshot parsing and deterministic recovery**

Use `JSON.parse` into `unknown`, validate the envelope explicitly, validate/replay the Drawing Core contents, and throw a `DrawingRepositoryLoadError` containing `code`, `drawingId`, and a safe message. Do not expose filesystem paths in HTTP-facing errors.

- [ ] **Step 4: Implement atomic writes and serialized transitions**

Only update the repository's in-memory cache after rename succeeds. On write failure, reject the operation and retain the previous cached state and durable file.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run api/services/drawing-application/file-drawing-repository.test.ts src/drawing/tests/repository.test.ts src/drawing/tests/replay.test.ts`

Expected: PASS.

```bash
git add api/services/drawing-application/file-drawing-repository.ts api/services/drawing-application/file-drawing-repository.test.ts src/drawing/repository/types.ts src/drawing/index.ts
git commit -m "feat(drawing-repo): persist atomic local snapshots"
```

---

### Task 3: Drawing Application Service

**Files:**
- Create: `src/contracts/drawing-application.ts`
- Create: `api/services/drawing-application/application.ts`
- Create: `api/services/drawing-application/application.test.ts`

**Interfaces:**
- Consumes: public `DrawingRepository`, `DrawingTransaction`, `DrawingCommand`, and repository results.
- Produces:

```ts
export interface DrawingWorkspaceSnapshot {
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export class DrawingApplication {
  constructor(input: { repository: DrawingRepository; idFactory?: IdFactory });
  create(input?: { unit?: 'mm' | 'cm' | 'm' }): Promise<DrawingWorkspaceSnapshot>;
  open(drawingId: DrawingId): Promise<DrawingWorkspaceSnapshot>;
  execute(input: {
    drawingId: DrawingId;
    transaction: DrawingTransaction;
  }): Promise<RepositoryCommitResult>;
  revert(input: {
    drawingId: DrawingId;
    commitId: CommitId;
    actor: Actor;
  }): Promise<RepositoryCommitResult>;
}
```

- `DrawingWorkspaceSnapshot` lives in `src/contracts/drawing-application.ts` so the server and browser share one transport contract without the browser importing from `api/` and without putting HTTP concerns inside Drawing Core.

- `execute()` must open the drawing first and reject with `DRAWING_REVISION_MISMATCH` if the transaction's base revision does not belong to the drawing named in the request.
- The service contains no Express types and no UI projection logic.

- [ ] **Step 1: Write failing application tests**

Test create/open, a manual geometry update transaction, stale rejection, drawing/revision mismatch, already-satisfied without a commit, and revert returning the latest durable snapshot.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run api/services/drawing-application/application.test.ts`

Expected: FAIL because the application module is missing.

- [ ] **Step 3: Implement the orchestration service**

Keep it thin: create documents through `createEmptyDrawing`, call repository methods, and return clones supplied by the repository. Do not rebuild validation, Patch application, or history logic here.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run api/services/drawing-application/application.test.ts api/services/drawing-application/file-drawing-repository.test.ts`

Expected: PASS.

```bash
git add api/services/drawing-application/application.ts api/services/drawing-application/application.test.ts src/contracts/drawing-application.ts
git commit -m "feat(drawing-app): add canonical application service"
```

---

### Task 4: Drawing HTTP API

**Files:**
- Create: `api/routes/drawings.ts`
- Create: `api/routes/drawings.test.ts`
- Modify: `api/app.ts`

**Interfaces:**
- Consumes: `DrawingApplication`.
- Produces these JSON routes:

```text
POST /api/drawings
  body: { unit?: 'mm' | 'cm' | 'm' }
  201: { success: true, workspace: DrawingWorkspaceSnapshot }

GET /api/drawings/:drawingId
  200: { success: true, workspace: DrawingWorkspaceSnapshot }

POST /api/drawings/:drawingId/transactions
  body: { transaction: DrawingTransaction }
  200: { success: true, result: RepositoryCommitResult }

POST /api/drawings/:drawingId/reverts
  body: { commitId: CommitId, actor: Actor }
  200: { success: true, result: RepositoryCommitResult }
```

- Rejected domain results still use HTTP 200 so the client receives structured retry information. Invalid JSON/envelopes return 400; unknown drawings return 404; corrupt durable state returns 409; unexpected failures return 500.
- `api/app.ts` constructs one `FileDrawingRepository` rooted at `.local/vectorai/drawings`, one `DrawingApplication`, and mounts the router.

- [ ] **Step 1: Write failing route contract tests**

Use an injected fake `DrawingApplication` for router tests. Assert exact status classes and that the path drawing ID, rather than a body-provided drawing ID, is passed to execute/revert.

- [ ] **Step 2: Verify route tests fail**

Run: `npx vitest run api/routes/drawings.test.ts`

Expected: FAIL because `createDrawingsRouter()` is missing.

- [ ] **Step 3: Implement validation and routes**

Export `createDrawingsRouter(application: DrawingApplication): Router`. Validate required object fields without coercing arbitrary JSON into branded IDs. Encode all errors as `{ success: false, error: { code, message } }`.

- [ ] **Step 4: Mount the production service**

Instantiate dependencies once at module startup. Do not create a repository per request.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run api/routes/drawings.test.ts api/routes/agent-runs.test.ts`

Expected: PASS.

```bash
git add api/routes/drawings.ts api/routes/drawings.test.ts api/app.ts
git commit -m "feat(api): expose drawing application routes"
```

---

### Task 5: Browser Drawing Client

**Files:**
- Create: `src/services/drawing-client.ts`
- Create: `src/services/drawing-client.test.ts`

**Interfaces:**
- Consumes: HTTP route contracts and public Drawing types.
- Produces:

```ts
export class DrawingClient {
  constructor(options?: { fetcher?: typeof fetch });
  create(unit?: 'mm' | 'cm' | 'm'): Promise<DrawingWorkspaceSnapshot>;
  open(drawingId: DrawingId): Promise<DrawingWorkspaceSnapshot>;
  execute(drawingId: DrawingId, transaction: DrawingTransaction): Promise<RepositoryCommitResult>;
  revert(drawingId: DrawingId, commitId: CommitId, actor: Actor): Promise<RepositoryCommitResult>;
}
```

- [ ] **Step 1: Write failing client tests**

Use a small fetch double returning complete real response envelopes. Assert URL encoding, methods, request bodies, successful parsing, and propagation of the server's safe error message for non-2xx responses.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/services/drawing-client.test.ts`

Expected: FAIL because the client module is missing.

- [ ] **Step 3: Implement the client**

Keep transport logic in one private request method. Do not store a document or revision in the client.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/services/drawing-client.test.ts`

Expected: PASS.

```bash
git add src/services/drawing-client.ts src/services/drawing-client.test.ts
git commit -m "feat(client): add drawing application client"
```

---

### Task 6: Canonical Workspace Store and Manual Transactions

**Files:**
- Create: `src/hooks/drawing-store.ts`
- Create: `src/hooks/drawing-store.test.ts`
- Create: `src/services/agent-types.ts`
- Modify: `src/services/agent-client.ts`
- Modify: `src/services/agent-client.test.ts`
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useStore.test.ts`
- Delete: `src/components/PerceptionPanel.tsx` after confirming it has no imports

**Interfaces:**
- Consumes: `DrawingClient`, public Drawing types.
- Produces canonical state fields and actions:

```ts
interface CanonicalWorkspaceState {
  document: DrawingDocument | null;
  revision: RevisionId | null;
  commits: DrawingCommit[];
  drawingStatus: 'loading' | 'ready' | 'error';
  drawingError: string | null;
  selectedIds: string[];
  initializeDrawing(): Promise<void>;
  updateNode(id: string, changes: Record<string, unknown>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  clearDrawing(): Promise<void>;
  revertLatest(): Promise<void>;
}
```

- `initializeDrawing()` opens the drawing ID from `localStorage['vectorai.drawingId']`; if missing or not found, it creates a drawing and stores only the returned ID.
- `updateNode()` locates the node's plane, includes current property values as `expected`, builds one typed update command, and sends a transaction using the current revision.
- `deleteNode()` builds the plane-specific delete command.
- `clearDrawing()` builds deterministic delete commands in relation → feature → annotation → geometry order.
- On `committed`, replace document/revision and append the returned commit. On `already_satisfied`, retain state. On rejection, retain the previous snapshot and expose the first structured error.
- `revertLatest()` targets the last commit, so reverting a Revert Commit provides redo semantics without a cursor.
- Remove `model`, `history`, `applyIntent`, `updateEntity`, `deleteEntity`, `undo`, `redo`, `sendPrompt`, `perceiveImage`, `confirmResults`, `confirmAll`, `executeNextStep`, and `exportDXF` from `AppState`. Keep selection, viewport, chat presentation, and run-control presentation state.
- Replace frontend imports of `TaskPlan`, `StepResult`, `AgentRunState`, and SpatialModel-bearing Agent client responses with presentation-only wire types in `src/services/agent-types.ts`. These types contain task IDs/descriptions, progress status, timestamps, and error/progress fields, but no drawing document or history.
- `AgentClient.start()` must no longer accept or serialize `spatialModel`. The guarded Phase 2 UI must not invoke it; Phase 3 will redefine the server request around drawing ID and revision.
- Until Phase 3/4, `startAgent()` and perception submission must fail locally with the explicit message `Agent Runtime 正在迁移到 Drawing Core`; they must not send a legacy SpatialModel request.

- [ ] **Step 1: Write failing canonical store tests**

Cover initialization/open recovery, update success, stale rejection with no local mutation, delete cascade projection, clear transaction order, revert-latest, localStorage restoration, and the temporary Agent/perception migration guard.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/hooks/drawing-store.test.ts src/hooks/useStore.test.ts`

Expected: FAIL because canonical workspace state is absent and legacy state is still authoritative.

- [ ] **Step 3: Implement canonical transaction helpers**

Place node-plane lookup and command construction in `drawing-store.ts`; keep them deterministic and independently testable. Inject `DrawingClient`, `AgentClient`, `Storage`, `IdFactory`, and `now` into `createAppStore` tests. Project Agent responses only into presentation fields and never copy their legacy history/model into canonical drawing state.

- [ ] **Step 4: Replace legacy authoritative fields and mutations**

Delete legacy imports and methods in the same change that adds canonical replacements. Never keep both `model` and `document` as writable state.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/hooks/drawing-store.test.ts src/hooks/useStore.test.ts src/services/drawing-client.test.ts`

Expected: PASS.

```bash
git add src/hooks/drawing-store.ts src/hooks/drawing-store.test.ts src/hooks/useStore.ts src/hooks/useStore.test.ts src/services/agent-types.ts src/services/agent-client.ts src/services/agent-client.test.ts src/components/PerceptionPanel.tsx
git commit -m "refactor(workspace): use canonical drawing transactions"
```

---

### Task 7: Render the Canonical Drawing Projection

**Files:**
- Modify: `src/components/canvas/EntityRenderer.tsx`
- Modify: `src/components/canvas/EntityRenderer.test.tsx`
- Modify: `src/components/canvas/geometry.ts`
- Modify: `src/components/canvas/geometry.test.ts`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/ObjectList.tsx`
- Modify: `src/components/ParameterEditor.tsx`
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/components/TopToolbar.tsx`
- Modify: `src/components/AIDialog.tsx`
- Modify: `src/components/ConstructionTimeline.tsx`
- Modify: `src/components/agent/task-presentation.ts`
- Modify: `src/components/agent/task-presentation.test.ts`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `DrawingDocument.geometry`, `DrawingDocument.annotations`, `DrawingDocument.relations`, canonical store actions.
- Produces: UI projection only; components never receive a repository or mutate document arrays.

- [ ] **Step 1: Change component tests to canonical fixtures**

Use nodes with complete `quality` metadata. Test confirmed and candidate red rendering, geometry plus annotation counts, selection, parameter updates through `updateNode`, deletion through `deleteNode`, status revision display, and Home initialization.

- [ ] **Step 2: Verify component tests fail**

Run: `npx vitest run src/components/canvas/EntityRenderer.test.tsx src/components/canvas/geometry.test.ts src/pages/Home.test.tsx`

Expected: FAIL because components still consume `GeometryEntity` and `SpatialModel`.

- [ ] **Step 3: Migrate renderer and geometry utilities**

Accept `GeometryNode | AnnotationNode`. Treat `quality.status === 'candidate'` or `quality.confidence < 0.6` as red. Reuse `geometryBounds()` through the public query result where appropriate; do not import private `src/drawing/query/bounds.ts` directly.

- [ ] **Step 4: Migrate workspace components**

Project `document.geometry` and `document.annotations` for lists and rendering. Render topology/constraint/association/semantic relations using their typed reference fields. Disable editing while a transaction request is in flight and surface `drawingError` near the affected controls.

Remove the legacy DXF export button behavior rather than converting through SpatialModel; show it disabled with the existing future-adapter explanation. Keep Agent chat and progress presentation visible, but let the canonical store's migration guard surface the Phase 3 message instead of starting a legacy mutation run.

- [ ] **Step 5: Run UI tests and commit**

Run: `npx vitest run src/components src/pages/Home.test.tsx src/hooks/drawing-store.test.ts`

Expected: PASS.

```bash
git add src/components src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "refactor(ui): render canonical drawing projection"
```

---

### Task 8: Remove Migrated Legacy Mutation Paths and Verify Phase 2 Boundary

**Files:**
- Delete only after `rg` shows no remaining production imports:
  - `src/core/history/history.ts`
  - `src/core/history/types.ts`
  - `src/core/patch/apply.ts`
  - `src/core/patch/types.ts`
- Modify: `src/core/index.ts`
- Modify or delete affected legacy tests under `src/core/tests/`
- Modify: `docs/superpowers/specs/2026-08-08-drawing-as-code-system-architecture-design.md`
- Create: `src/drawing/tests/legacy-ui-boundary.test.ts`

**Interfaces:**
- Consumes: canonical store and Drawing Application HTTP API.
- Produces: a regression guard proving production UI code has no imports from `@/core`, no `SpatialModel`/`SpatialHistory` state, and no direct `commitPatch`/`applyPatch` calls.

- [ ] **Step 1: Write the failing legacy UI boundary test**

Scan production files under `src/hooks`, `src/components`, `src/pages`, and `src/services`. Extract imports and fail on `@/core`, `/core/`, `SpatialModel`, `SpatialHistory`, `commitPatch`, `applyPatch`, `executeNextStep`, or direct assignments to `.geometry`, `.annotations`, `.relations`, or `.features` outside store fixture construction.

- [ ] **Step 2: Verify the boundary test fails before cleanup**

Run: `npx vitest run src/drawing/tests/legacy-ui-boundary.test.ts`

Expected: FAIL and list the remaining legacy production files.

- [ ] **Step 3: Remove only unreferenced legacy files**

Run `rg` before every deletion. If Agent Runtime, perception, DXF, or old audit still imports a file, retain it for its owning later phase and record that fact in the architecture status table. Do not create re-export shims.

- [ ] **Step 4: Update implementation status honestly**

Mark Drawing Application, durable local repository, and manual UI transaction cutover as implemented. Keep Agent Runtime, perception, adapters, and legacy audit marked pending. Do not mark architecture Stage 1 globally complete while any manual UI mutation path bypasses Drawing Application.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npx vitest run src/drawing/tests
npm test
npm run check
npm run build
npx eslint src/drawing api/services/drawing-application api/routes/drawings.ts src/services/drawing-client.ts src/hooks src/components src/pages
git diff --check
git status --short --untracked-files=all
```

Expected: all new and existing applicable tests pass; type check and build pass; lint has no errors in migrated files; status contains only intended migration changes plus untouched `?? test1.jpg` before staging.

- [ ] **Step 6: Commit the Phase 2 boundary**

```bash
git add src api docs/superpowers/specs/2026-08-08-drawing-as-code-system-architecture-design.md
git commit -m "refactor(architecture): make drawing application authoritative"
```

## Completion Gate

- Restarting the local server restores the exact current DrawingDocument, revision, and commit list.
- A failed or stale transaction leaves both memory and disk unchanged.
- Manual property edit, visibility change, delete, clear, undo, and redo all use HTTP DrawingTransactions.
- UI state contains a projection, revision, selection, and transient interaction state but no second drawing history.
- The UI and Drawing Application never import legacy SpatialModel or SpatialIntent.
- Agent/perception controls cannot silently write through the legacy path while their migration is pending.
- No user-provided drawing ID becomes a filesystem path.
- No compatibility translator, dual write, feature flag, branch, worktree, sub-agent, or `test1.jpg` modification is introduced.

## Next Plan Boundary

After this gate passes, write the Phase 3 Agent Runtime migration plan. It must replace SpatialIntent execution with Drawing Query tools, typed DrawingCommands, GoalSpec/Workflow Graph, structured progress, and Application commits before re-enabling Agent mutation in the UI.
