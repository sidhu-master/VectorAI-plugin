# DSH Alpha Official Layout Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade VectorAI to DSH `0.1.2-alpha.1`, replace the compiled-source workspace patch with an official overlay-slot layout adapter, and make the golden reference dimension policy the default.

**Architecture:** The first-layer Client owns a `VectorAIWorkspaceOverlay` registered through DSH's public `shell.overlay` slot and derives Drawing-column visibility from session-scoped Drawing Surface state. It preserves the official root and reserves space inside the measured Conversation column. The Launcher pins alpha.1 and performs read-only compatibility validation; no DSH installation file is rewritten. The annotation Host defaults dimension inference to the reference terminal-closure policy while preserving an explicit hierarchical override.

**Tech Stack:** TypeScript, React 18, Cordis/DSH Web Client slots, Typert remotes, Vitest, Swift/AppKit/WKWebView, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-29-dsh-alpha-layout-migration-design.md`

## Global Constraints

- Pin the real DSH runtime to exact tag/commit `0.1.2-alpha.1`; do not invent unpublished npm package versions.
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

### Task 2: Replace `conversation.workspace` with the Official Overlay Layout

**Files:**
- Create: `packages/plugin-dsh-space-client/src/VectorAIWorkspaceOverlay.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.css`
- Create: `packages/plugin-dsh-space-client/src/VectorAIWorkspaceOverlay.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Modify: `packages/plugin-dsh-space-client/src/workspace-slot.ts`
- Modify: `packages/plugin-dsh-space-client/src/client.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/index.ts`

**Interfaces:**
- Consumes: official `shell.overlay`, session-scoped Drawing Surface snapshot, official Conversation bounds and existing `DrawingSurfaceHost`.
- Produces: one ID-addressed overlay entry with an optional Drawing column beside the untouched Conversation.

- [x] Write component tests for active Drawing and horizontal geometry at normal and constrained widths.
- [x] Write registration tests proving the first layer registers `shell.overlay` and no package declares or injects `conversation.workspace`.
- [x] Confirm the former rc.8 workspace registration does not use the alpha overlay contract.
- [x] Implement the overlay adapter with measured horizontal columns, explicit min sizes and Drawing visibility from runtime state.
- [x] Replace the old workspace-slot registration, keep contribution ownership inside `DrawingSurfaceHost`, and preserve all official shell ownership.
- [x] Run focused tests, component tests, `pnpm check` and Client build.
- [x] Implement the official overlay-slot shell.

### Task 3: Make Layout State Session-Scoped and Hot-Reload Safe

**Files:**
- Modify: `packages/plugin-dsh-space-client/src/VectorAIWorkspaceOverlay.tsx`
- Modify: `packages/plugin-dsh-space-client/src/VectorAIWorkspaceOverlay.test.tsx`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.ts`
- Modify: `packages/plugin-dsh-space-client/src/surface-registry.test.ts`
- Modify: `scripts/e2e-drawing-surface-contribution.ts`

**Interfaces:**
- Consumes: existing surface registry claims and current DSH session identity.
- Produces: an observable `hasActiveDrawing(sessionId)` projection with no DOM observation and stable registration across contribution replacement.

- [x] Cover session switching and contribution lifecycle through component, registry and real-browser acceptance tests.
- [x] Implement the minimum session-scoped projection and subscriptions needed by `VectorAIWorkspaceOverlay`.
- [x] Run focused tests and the drawing-surface E2E; confirm no stale Drawing column survives a session change.
- [x] Implement session-safe layout state.

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
- Create: `scripts/install-dsh-alpha-runtime.sh`

**Interfaces:**
- Consumes: pinned alpha DSH executable and profile dump.
- Produces: read-only compatibility result with exact version and required VectorAI package rows; Launcher never writes into the DSH package.

- [x] Write Swift tests proving Launcher selects only the pinned alpha executable and accepts only a current-port authenticated ready URL.
- [x] Replace npx/cache resolution with the exact official source tag and commit.
- [x] Remove patch scripts and copied resources from the build.
- [x] Run Launcher tests and Launcher build.
- [x] Implement the patch-free alpha Launcher.

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

- [x] Write a tool test that omits `policy` and expects the reference terminal-closure policy.
- [x] Confirm the former hierarchical default caused the failure.
- [x] Change only the default resolution and user-facing tool description.
- [x] Keep the golden E2E on the service default rather than a sample-specific phrase.
- [x] Run tool tests and golden E2E.

### Task 6: Alpha Integration and Real App Acceptance

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/development.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Consumes: built first/second layer bundles, alpha DSH profile and macOS Launcher.
- Produces: cold-start browser and native App acceptance with measured DOM dimensions.

- [x] Start alpha DSH on an isolated port/profile and measure no-Drawing and Drawing DOM geometry in a real browser.
- [x] Verify Drawing uses a middle column, Conversation stays on the right, resize recomputes both columns, and a new session restores full-width Conversation.
- [x] Complete profile/build wiring and document installation/rollback.
- [ ] Run full `pnpm test`, `pnpm check`, `pnpm lint`, both plugin builds, Launcher tests/build, Drawing E2E and golden dimension E2E.
- [x] Install the freshly built App, cold start the pinned alpha runtime, and verify authenticated startup plus process ownership; browser acceptance covers layout resize and session switching.
- [ ] Run `git diff --check` and confirm a clean committed worktree.
- [ ] Commit acceptance assets, push one PR, merge it to `main` after checks, and update the installed App from merged `main`.
