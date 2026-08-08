# Reliable Canvas Clear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the top-right trash button reliably empty the current canonical drawing.

**Architecture:** `clearDrawing()` first opens the latest repository workspace, then derives and executes one clear transaction against that revision. It adopts an already-empty workspace locally and clears transient preview state on success.

**Tech Stack:** TypeScript, Zustand, Vitest, Drawing Application API

## Global Constraints

- Do not add confirmation dialogs, new drawing workflows, branches, or dependencies.
- Preserve repository persistence and auditable Drawing transactions.
- Keep the implementation in the main development flow without sub-agents.

---

### Task 1: Reliable canonical clear

**Files:**
- Modify: `src/hooks/useStore.ts`
- Test: `src/hooks/useStore.test.ts`

**Interfaces:**
- Consumes: `DrawingClient.open()`, `DrawingClient.execute()`, `buildClearCommands()`
- Produces: existing `AppState.clearDrawing(): Promise<void>` behavior

- [x] **Step 1: Write the failing tests**

Add tests proving `clearDrawing()` refreshes the workspace before constructing its transaction and adopts an already-empty latest workspace without executing an empty transaction.

- [x] **Step 2: Run the focused tests to verify RED**

Run: `npm test -- src/hooks/useStore.test.ts`

Expected: the new tests fail because the current implementation executes against the visible stale revision and does not refresh the workspace.

- [x] **Step 3: Implement the minimal store change**

Set the busy state, open the latest workspace, build delete commands from it, execute against its revision, adopt the committed result, and clear selection plus perception preview. Preserve a useful error in `drawingError` on failure.

- [x] **Step 4: Verify GREEN and regression safety**

Run `npm test -- src/hooks/useStore.test.ts`, `npm test`, `npm run check`, and `npm run build`.

- [x] **Step 5: Commit**

Commit the focused store, tests, design, and plan changes with a descriptive message.
