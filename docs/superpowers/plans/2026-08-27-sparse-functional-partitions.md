# Sparse Functional Partitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make functional shaft regions retain exact independent axial ranges, allow gaps, and prevent unsupported AI proposals from filling the shaft.

**Architecture:** Keep physical `segments` as the continuous geometric partition while adding an optional independent range to `semanticGroups`. Document fusion writes exact source ranges, AI writes segment-derived ranges only after deterministic acceptance checks, and the client dispatches distinct semantic-range and physical-boundary edit commands.

**Tech Stack:** TypeScript 5.8, React 18, Zod, Vitest, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-08-27-sparse-functional-partitions-design.md`

## Global Constraints

- Existing saved version-1 sessions without semantic ranges must remain readable.
- Physical shaft segments must remain contiguous and cover the complete axis.
- Functional regions may overlap or leave gaps.
- AI output must not contain or control numeric coordinates.
- Preserve unrelated working-tree changes in `scripts/dsh-inline-workspace-patch.mjs` and its test.

---

### Task 1: Independent semantic ranges and exact document fusion

**Files:**
- Modify: `packages/engineering-annotation/src/partition/types.ts`
- Modify: `packages/engineering-annotation/src/partition/fuse.ts`
- Modify: `packages/engineering-annotation/src/partition/invariants.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Test: `packages/engineering-annotation/src/partition/sample.integration.test.ts`
- Test: `packages/plugin-space-contracts/src/index.test.ts`

**Interfaces:**
- Produces: `ShaftSemanticGroup.range?: { zStart: number; zEnd: number }`
- Preserves: legacy groups without `range`

- [ ] **Step 1: Write failing tests for exact sample document ranges and legacy/new schema parsing**
- [ ] **Step 2: Run the focused tests and verify they fail because functional ranges are absent**
- [ ] **Step 3: Add the optional range contract, write exact document intervals during fusion, and validate finite ordered in-axis ranges**
- [ ] **Step 4: Run the focused tests and verify they pass**

### Task 2: Functional presentation and independent range editing

**Files:**
- Modify: `packages/plugin-dsh-annotation-client/src/partition-view-model.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/PartitionOverlay.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-controller.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-store.ts`
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/engineering-annotation/src/partition/edit.ts`
- Test: `packages/plugin-dsh-annotation-client/src/partition-view-model.test.ts`
- Test: `packages/plugin-dsh-annotation-client/src/PartitionOverlay.test.tsx`
- Test: `packages/plugin-dsh-annotation-client/src/partition-controller.test.ts`
- Test: `packages/plugin-dsh-annotation-host/src/partition-store.test.ts`
- Test: `packages/engineering-annotation/src/partition/edit.test.ts`

**Interfaces:**
- Produces: `semantic-range.move` edit command with `groupId`, `edge`, `requestedZ`, and `snapTolerance`
- Preserves: `boundary.move` for physical axial segments

- [ ] **Step 1: Write failing view and editing tests proving exact ranges render with gaps and functional drags do not mutate segments**
- [ ] **Step 2: Run focused client, host, contract, and domain tests and verify failure**
- [ ] **Step 3: Implement semantic range resolution, handles, controller dispatch, host storage dispatch, and domain editing**
- [ ] **Step 4: Run focused tests and verify they pass**

### Task 3: Abstaining AI semantic review

**Files:**
- Modify: `packages/engineering-annotation/src/partition/semantic.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.ts`
- Test: `packages/engineering-annotation/src/partition/semantic.test.ts`
- Test: `packages/plugin-dsh-annotation-host/src/semantic-reviewer.test.ts`

**Interfaces:**
- Produces: accepted AI groups with segment-derived `range`
- Produces: rejection/skip of low-confidence, generic, or incompletely evidenced proposals

- [ ] **Step 1: Write failing tests for abstention, concrete-type validation, complete visual evidence, and AI ranges**
- [ ] **Step 2: Run semantic tests and verify the unsupported proposals are currently applied**
- [ ] **Step 3: Implement deterministic acceptance gates without allowing AI coordinates**
- [ ] **Step 4: Run semantic tests and verify they pass**

### Task 4: Sample and regression verification

**Files:**
- Modify: `scripts/e2e-dxf-smart-partition.ts`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`

**Interfaces:**
- Verifies: exact sparse functional regions and continuous physical segments

- [ ] **Step 1: Add E2E assertions for the four documented exact ranges and intentional gaps**
- [ ] **Step 2: Update product and architecture documentation with the two-layer partition semantics**
- [ ] **Step 3: Run focused tests, TypeScript checks, the DXF E2E, and the full test suite**
- [ ] **Step 4: Inspect the diff for unrelated changes and record verification evidence**
