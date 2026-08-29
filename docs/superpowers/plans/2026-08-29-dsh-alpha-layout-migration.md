# DSH Alpha Official Layout Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade VectorAI to DSH `0.1.2-alpha.1`, replace the compiled-source workspace patch with an official root-slot shell, and make the golden reference dimension policy the default.

**Architecture:** The first-layer Client owns a `VectorAIAppFrame` registered through DSH's public `root` slot and derives Drawing-column visibility from session-scoped Drawing Surface state. The Launcher pins alpha.1 and performs read-only compatibility validation; no DSH installation file is rewritten. The annotation Host defaults dimension inference to the reference terminal-closure policy while preserving an explicit hierarchical override.

**Tech Stack:** TypeScript, React 18, Cordis/DSH Web Client slots, Typert remotes, Vitest, Swift/AppKit/WKWebView, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-29-dsh-alpha-layout-migration-design.md`

## Global Constraints

- Pin every `@deepseek-ai/*` runtime dependency to exactly `0.1.2-alpha.1`.
- Do not modify DSH npm cache or compiled JavaScript.
- Preserve DSH sidebar, conversation, details, overlay, session and Host-owned state.
- Keep Drawing and Annotation data local; add no VectorAI server.
- Use failing behavioral tests before each production change.
- The real App must remain side-by-side through resize, session switch and restart.

---

### Task 1: Establish Alpha Package and Slot Contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/plugin-dsh-space-client/package.json`
- Modify: `packages/plugin-dsh-space-host/package.json`
- Modify: `packages/plugin-dsh-annotation-client/package.json`
- Modify: `packages/plugin-dsh-annotation-host/package.json`
- Modify: `packages/plugin-dsh-space-client/src/dependency-boundary.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/dependency-boundary.test.ts`

**Interfaces:**
- Consumes: DSH alpha public Client slot declarations and Host `@Remote` services.
- Produces: one dependency graph with no rc.8 package and compile-time access to `root`, `sidebar`, `conversation`, `details`, and `shell.overlay`.

- [ ] Write dependency tests that fail while any manifest or lockfile resolves rc.8 and a compile-only slot contract test for the five official slots.
- [ ] Run the focused tests and `pnpm check`; confirm failure is caused by rc.8 dependencies or missing alpha contracts.
- [ ] Upgrade all DSH dependencies and lockfile to exact `0.1.2-alpha.1`; adapt renamed public imports without changing behavior.
- [ ] Run focused tests, `pnpm check`, Host/Client bundle-boundary tests and both DSH builds.
- [ ] Commit the alpha dependency foundation.

### Task 2: Replace `conversation.workspace` with the Official Root Shell

**Files:**
- Create: `packages/plugin-dsh-space-client/src/VectorAIAppFrame.tsx`
- Create: `packages/plugin-dsh-space-client/src/VectorAIAppFrame.module.css`
- Create: `packages/plugin-dsh-space-client/src/VectorAIAppFrame.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Delete: `packages/plugin-dsh-space-client/src/workspace-slot.ts`
- Modify: `packages/plugin-dsh-space-client/src/client.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/index.ts`

**Interfaces:**
- Consumes: official `PropsRuntime<'root'>`, root child renderers, session-scoped Drawing Surface snapshot and existing `DrawingSurfaceHost`.
- Produces: `VectorAIAppFrame` with `sidebar`, optional Drawing column, `conversation`, `details`, `shell.overlay`; `registerVectorAIAppFrame(ctx)`.

- [ ] Write component tests for ordinary conversation, active Drawing, details/overlay preservation and horizontal geometry at narrow/default/wide viewports.
- [ ] Write registration tests proving the first layer registers `root` and no package declares or injects `conversation.workspace`.
- [ ] Run tests and confirm they fail against the current rc.8 workspace registration.
- [ ] Implement the root shell with CSS grid/flex columns, explicit min sizes, a 360–640px chat resizer and Drawing visibility from runtime state.
- [ ] Replace the old workspace-slot registration, keep contribution ownership inside `DrawingSurfaceHost`, and preserve all official child slots.
- [ ] Run focused tests, component tests, `pnpm check` and Client build.
- [ ] Commit the official root-slot shell.

### Task 3: Make Layout State Session-Scoped and Hot-Reload Safe

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/VectorAIAppFrame.tsx`
- Modify: `packages/plugin-dsh-space-client/src/VectorAIAppFrame.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.ts`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.test.ts`
- Modify: `scripts/e2e-drawing-surface-contribution.ts`

**Interfaces:**
- Consumes: existing surface registry claims and current DSH session identity.
- Produces: an observable `hasActiveDrawing(sessionId)` projection with no DOM observation and stable registration across contribution replacement.

- [ ] Write failing tests for new session isolation, switching between Drawing and non-Drawing sessions, contribution hot replacement and resize notifications.
- [ ] Implement the minimum session-scoped projection and subscriptions needed by `VectorAIAppFrame`.
- [ ] Run focused tests and the drawing-surface E2E; confirm no stale Drawing column survives a session change.
- [ ] Commit session-safe layout state.

### Task 4: Remove the rc.8 Source Patch and Migrate Launcher

**Files:**
- Delete: `scripts/dsh-inline-workspace-patch.mjs`
- Delete: `scripts/dsh-inline-workspace-patch.test.ts`
- Modify: `package.json`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherCore.swift`
- Modify: `apps/dsh-launcher-macos/Sources/LauncherApp.swift`
- Modify: `apps/dsh-launcher-macos/Tests/LauncherCoreTests/LauncherCoreTests.swift`
- Modify: `apps/dsh-launcher-macos/build.sh`
- Modify: `apps/dsh-launcher-macos/README.md`
- Create: `scripts/verify-dsh-alpha-contract.mjs`
- Create: `scripts/verify-dsh-alpha-contract.test.ts`

**Interfaces:**
- Consumes: pinned alpha DSH executable and profile dump.
- Produces: read-only compatibility result with exact version and required VectorAI package rows; Launcher never writes into the DSH package.

- [ ] Write failing Swift and Node tests proving Launcher rejects rc.8, accepts alpha.1, reports missing plugin rows, and never invokes a patch command.
- [ ] Replace patch execution with compatibility verification and pin npx/cache resolution to alpha.1.
- [ ] Remove patch scripts and copied resources from the build.
- [ ] Run Node contract tests, Launcher tests and Launcher build.
- [ ] Commit the patch-free alpha Launcher.

### Task 5: Default Dimension Inference to the Reference Policy

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-inference-service.test.ts`
- Modify: `scripts/e2e-golden-dimension-chain.ts`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/development.md`

**Interfaces:**
- Consumes: optional `policy` tool argument.
- Produces: omitted policy resolves to `shaft-reference-terminal-closure-v1`; explicit hierarchical policy remains available.

- [ ] Write a failing tool test that omits `policy` and expects the reference terminal-closure policy.
- [ ] Run it and confirm current hierarchical default causes the failure.
- [ ] Change only the default resolution and user-facing tool description.
- [ ] Update the golden E2E to exercise omission rather than passing a sample-specific phrase or policy.
- [ ] Run tool tests and golden E2E, then commit the default-policy change.

### Task 6: Alpha Integration and Real App Acceptance

**Files:**
- Create: `scripts/e2e-dsh-alpha-layout.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/development.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: built first/second layer bundles, alpha DSH profile and macOS Launcher.
- Produces: repeatable cold-start layout smoke with DOM dimensions and a real App acceptance record.

- [ ] Write an E2E that starts alpha DSH on an isolated port/profile and asserts no-Drawing and Drawing DOM geometry, required root ownership, official sub-slot preservation and no source patch marker.
- [ ] Run it before final wiring and confirm it fails for the expected missing root owner or alpha profile.
- [ ] Complete profile/build wiring and document installation/rollback.
- [ ] Run full `pnpm test`, `pnpm check`, `pnpm lint`, both plugin builds, Launcher tests/build, Drawing E2E and golden dimension E2E.
- [ ] Install the freshly built App, cold start it, verify side-by-side layout, resize to minimum/fullscreen, switch to a new session and back, restart, and inspect logs for plugin or layout errors.
- [ ] Run `git diff --check` and confirm a clean committed worktree.
- [ ] Commit acceptance assets, push one PR, merge it to `main` after checks, and update the installed App from merged `main`.

