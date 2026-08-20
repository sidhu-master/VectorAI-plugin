# DSH Spatial Query and Preview Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Every production behavior follows RED → GREEN → REFACTOR.

**Goal:** Add revision-bound `drawing_query/worldSlice` and Host-authoritative Preview / Commit / Discard to the first-layer DSH 2D Space plugin, then expose the candidate state to the shared canvas without adding any cloud or Express dependency.

**Architecture:** A new host-neutral `@vectorai/drawing-spatial` package performs deterministic bounded queries over `DrawingDocument`. Strict public schemas live in `@vectorai/plugin-space-contracts`. The session repository remains the authoritative owner of formal drawings and holds one ephemeral Preview per session. DSH tools and Typert Remote methods delegate to that repository. The shared workspace carries formal and candidate snapshots separately so the viewer can render a truthful Preview state.

**Tech Stack:** TypeScript 5.8, Zod 4, Zustand 5, React 18, Vitest 3, pnpm workspaces, DSH/Cordis/Typert `0.1.0-rc.8`

**Specs:** `docs/superpowers/specs/2026-08-20-dsh-spatial-query-preview-foundation-design.md`

## Global Constraints

- Work only on `codex/dsh-plugin-migration`.
- Use RED → GREEN → REFACTOR for every behavior.
- Keep `drawing-spatial`, `drawing-core`, `drawing-workspace`, and public contracts free of DSH/Cordis/Express imports.
- All model and Remote operations are scoped to the owning DSH Agent; callers cannot provide another session id or filesystem path.
- Keep the formal snapshot and Preview snapshot distinct.
- Persist formal commits only; never persist Preview state.
- Keep HyperFrames files untouched.

---

### Task 1: Pure spatial-query package and strict public codecs

**Files:**
- Create: `packages/drawing-spatial/package.json`
- Create: `packages/drawing-spatial/tsconfig.json`
- Create: `packages/drawing-spatial/src/index.ts`
- Create: `packages/drawing-spatial/src/query.ts`
- Create: `packages/drawing-spatial/src/query.test.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Write RED tests for line/circle/polyline/text/dimension bounds, deterministic plane order, relation/feature inclusion, default limit, truncation and invalid bounds.
- [ ] Implement minimal pure query engine with `world-slice`, `node`, and depth-1 `neighbors`.
- [ ] Add strict Zod schemas and exported TypeScript contracts for requests/results.
- [ ] Verify focused tests and package type checks.

Commands:

```bash
pnpm vitest run packages/drawing-spatial/src/query.test.ts packages/plugin-space-contracts/src/index.test.ts
pnpm --filter @vectorai/drawing-spatial check
pnpm --filter @vectorai/plugin-space-contracts check
```

---

### Task 2: Revision-bound repository query

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/repository.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.test.ts`

- [ ] Write RED tests proving exact ref matching, stale-revision rejection, cross-drawing rejection, valid world slices and cloned results.
- [ ] Add `query(sessionId, request)` delegating to `@vectorai/drawing-spatial`.
- [ ] Normalize stable repository error codes without leaking implementation exceptions.
- [ ] Verify repository tests.

Command:

```bash
pnpm vitest run packages/plugin-dsh-space-host/src/repository.test.ts
```

---

### Task 3: `drawing_query` tool and Remote service

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.test.ts`

- [ ] Write RED tests for tool session binding, strict query arguments and exact result ref.
- [ ] Register `drawing_query` and delegate to the repository.
- [ ] Add a direct `query` Remote descriptor using the same codecs.
- [ ] Verify focused tests and Host/Client package checks.

---

### Task 4: `node.create` and Host-authoritative Preview lifecycle

**Files:**
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-workspace/src/commands.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.ts`
- Modify: `packages/plugin-dsh-space-host/src/repository.test.ts`

- [ ] Write RED contract tests for strict `node.create` and Preview codecs.
- [ ] Write RED repository tests for create-without-commit, diff ids, atomic one-revision commit, discard, replacement, direct-commit invalidation, import invalidation and stale handle rejection.
- [ ] Add `node.create` with plane/type, duplicate-id and reference-integrity validation.
- [ ] Add one ephemeral Preview slot per session with opaque injected handle/time factories.
- [ ] Add `createPreview`, `getPreview`, `commitPreview`, and `discardPreview`.
- [ ] Keep persistence exclusive to formal commits.
- [ ] Verify focused tests and Drawing Workspace/Contract/Host checks.

---

### Task 5: Preview DSH tools and Remote methods

**Files:**
- Modify: `packages/plugin-dsh-space-host/src/tools.ts`
- Modify: `packages/plugin-dsh-space-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-space-host/src/service.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.ts`
- Modify: `packages/plugin-dsh-space-client/src/remote.test.ts`

- [ ] Write RED tool tests for Preview create/commit/discard and owning-Agent binding.
- [ ] Register all three tools with strict parameters and model-readable output.
- [ ] Add Typert Remote methods/codecs for reading and controlling Preview.
- [ ] Verify tool, Remote and package checks.

---

### Task 6: Shared workspace and canvas Preview projection

**Files:**
- Modify: `packages/drawing-workspace/src/contracts.ts`
- Modify: `packages/drawing-workspace/src/store.ts`
- Modify: `packages/drawing-workspace/src/store.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.ts`
- Modify: `packages/plugin-dsh-space-client/src/dsh-workspace-port.test.ts`
- Modify: `packages/drawing-viewer-react/src/DrawingWorkspace.tsx`
- Modify or create focused viewer tests under `packages/drawing-viewer-react/src`

- [ ] Write RED store tests proving formal snapshot remains identifiable while `displaySnapshot` follows Preview and selection uses candidate ids.
- [ ] Extend the port with optional `loadPreview` and store with separate `preview` / `displaySnapshot`.
- [ ] Load Preview through DSH Remote without altering formal commit semantics.
- [ ] Render a visible Preview badge and diff-specific overlay/classes using the existing contribution seam.
- [ ] Verify store, client and viewer interaction tests.

---

### Task 7: Integration, migration status and full verification

**Files:**
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `packages/plugin-dsh-space/README.md`
- Modify other package metadata only if required by build output.

- [ ] Update migration status and public tool list.
- [ ] Run all focused tests from Tasks 1–6.
- [ ] Run full test, type check, build, DSH bundle build and lint.
- [ ] Inspect `git diff --check`, dependency boundaries and generated bundle output.
- [ ] Commit the completed foundation with no HyperFrames changes.

Commands:

```bash
pnpm test
pnpm check
pnpm build
pnpm build:dsh-space
pnpm lint
git diff --check
```
