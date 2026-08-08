# Drawing Core v1 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This project explicitly requires inline execution on the main workflow; do not use subagents, worktrees, or feature branches.

**Goal:** Build the new deterministic `VectorAI-Drawing` Core v1 with four-plane Drawing IR, typed commands, reversible patches, transaction previews, validation, linear commits, and in-memory replay without adding compatibility adapters to the legacy SpatialModel path.

**Architecture:** Add a new isolated `src/drawing/` bounded module whose only dependencies are TypeScript and platform-standard APIs. The module exposes immutable DrawingDocument values, pure query/validation/patch functions, a command compiler, a pure transaction preview engine, and an in-memory repository; existing `src/core/` remains untouched during this foundation plan and is removed only when later application/agent/perception consumers cut over, so there is no dual-write or translation layer.

**Tech Stack:** TypeScript 5.8, Vitest 3, `structuredClone`, `globalThis.crypto.randomUUID`, existing npm scripts.

## Global Constraints

- Protocol name is `VectorAI-Drawing`; initial schema version is exactly `1.0`.
- Support only 2D geometry, Text, and Dimension; do not add 3D, layers, editable blocks, or fill.
- Core must not import React, Zustand, Express, AI gateway code, Node filesystem APIs, or environment variables.
- Every mutation must follow Command → Transaction → Verify → Commit.
- IDs are stable across property edits; type replacement is delete + add.
- History is append-only and linear; Undo is a new Revert Commit, not cursor movement.
- Do not add SpatialModel/SpatialIntent converters, legacy compatibility readers, feature flags, or dual writes.
- Do not modify, stage, or commit `test1.jpg`.
- Use the main workflow only; do not create branches, worktrees, or subagents.
- Use high reasoning for Tasks 1, 3, 6, 7, and 8. Lower reasoning is acceptable for the mechanical portions of Tasks 2, 4, 5, and 9 after interfaces are fixed.

---

## File Structure

Create the following bounded module:

```text
src/drawing/
  document/types.ts          Canonical four-plane Drawing IR and branded IDs
  document/create.ts         Empty document creation and injected ID factory
  validation/types.ts        Validation issue/report contracts
  validation/document.ts     Schema, numeric, reference, and plane validation
  query/types.ts             Stable selectors and query result contracts
  query/bounds.ts            Bounds for every geometry and annotation type
  query/query.ts             Search and inspect operations
  patch/types.ts             Plane-specific patch operations
  patch/apply.ts             Atomic patch apply and inverse generation
  command/types.ts           Typed commands and assertions
  command/compile.ts         Deterministic Command → Patch compilation
  transaction/types.ts       Transaction, preview, outcome, and error contracts
  transaction/execute.ts     Pure precondition/patch/validation/postcondition flow
  repository/types.ts        Commit and repository interfaces
  repository/memory.ts       Linear in-memory revision repository
  repository/replay.ts       Deterministic commit replay
  index.ts                   Public Drawing Core API only
  tests/                     Co-located Core v1 tests
```

No file in `src/drawing/` may import from `src/core/`.

---

### Task 1: Canonical DrawingDocument and Stable Identity

**Reasoning level:** High — this locks the protocol contract used by every later task.

**Files:**
- Create: `src/drawing/document/types.ts`
- Create: `src/drawing/document/create.ts`
- Create: `src/drawing/tests/document.test.ts`

**Interfaces:**
- Produces: `DrawingDocument`, all branded ID aliases, four-plane node unions, `IdFactory`, `createEmptyDrawing()`.
- Consumes: no project modules.

- [ ] **Step 1: Write the failing empty-document and identity tests**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyDrawing } from '../document/create';

describe('createEmptyDrawing', () => {
  it('creates an empty VectorAI-Drawing 1.0 document with four planes', () => {
    const document = createEmptyDrawing({
      unit: 'mm',
      idFactory: { next: () => 'drawing_fixed' },
      now: () => 100,
    });

    expect(document).toEqual({
      protocol: 'VectorAI-Drawing',
      schemaVersion: '1.0',
      id: 'drawing_fixed',
      metadata: { createdAt: 100, updatedAt: 100 },
      unitSystem: { length: 'mm', angle: 'deg' },
      coordinateFrames: [{ id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
      geometry: [],
      annotations: [],
      relations: [],
      features: [],
    });
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `npx vitest run src/drawing/tests/document.test.ts`

Expected: FAIL because `../document/create` does not exist.

- [ ] **Step 3: Define the exact four-plane protocol**

In `document/types.ts`, define branded string aliases and these public unions:

```ts
export type DrawingId = string & { readonly __brand: 'DrawingId' };
export type GeometryId = string & { readonly __brand: 'GeometryId' };
export type AnnotationId = string & { readonly __brand: 'AnnotationId' };
export type RelationId = string & { readonly __brand: 'RelationId' };
export type FeatureId = string & { readonly __brand: 'FeatureId' };
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type RevisionId = string & { readonly __brand: 'RevisionId' };
export type CommitId = string & { readonly __brand: 'CommitId' };
export type Vec2 = readonly [number, number];

export interface NodeQuality {
  status: 'confirmed' | 'candidate';
  confidence?: number;
  evidenceRefs: EvidenceId[];
}

export interface BaseNode<TId extends string, TType extends string> {
  id: TId;
  type: TType;
  visible: boolean;
  quality: NodeQuality;
}

export type GeometryNode =
  | (BaseNode<GeometryId, 'point'> & { x: number; y: number })
  | (BaseNode<GeometryId, 'line'> & { start: Vec2; end: Vec2 })
  | (BaseNode<GeometryId, 'ray' | 'xline'> & { origin: Vec2; direction: Vec2 })
  | (BaseNode<GeometryId, 'circle'> & { center: Vec2; radius: number })
  | (BaseNode<GeometryId, 'arc'> & {
      center: Vec2; radius: number; startAngle: number; endAngle: number;
      counterClockwise: boolean;
    })
  | (BaseNode<GeometryId, 'ellipse'> & {
      center: Vec2; majorAxis: Vec2; ratio: number;
      startParam?: number; endParam?: number;
    })
  | (BaseNode<GeometryId, 'polyline'> & {
      vertices: Array<{ point: Vec2; bulge?: number }>; closed: boolean;
    })
  | (BaseNode<GeometryId, 'spline'> & {
      degree: number; controlPoints: Vec2[]; knots: number[]; weights?: number[];
      closed: boolean; periodic: boolean;
    });

export type EntityAnchor =
  | { kind: 'start' | 'end' | 'center' }
  | { kind: 'vertex'; index: number }
  | { kind: 'curve-parameter'; parameter: number }
  | { kind: 'nearest'; point: Vec2 };

export type AnnotationNode =
  | (BaseNode<AnnotationId, 'text'> & {
      content: string; position: Vec2; height: number; rotation: number;
      alignment: 'left' | 'center' | 'right';
      verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top';
      maxWidth?: number;
    })
  | (BaseNode<AnnotationId, 'dimension'> & {
      dimensionKind: 'linear' | 'aligned' | 'angular' | 'radius' | 'diameter' | 'ordinate' | 'arc-length';
      associationStatus: 'resolved' | 'ambiguous' | 'conflict';
      targets: Array<{ geometryId: GeometryId; anchor: EntityAnchor }>;
      candidates?: Array<{
        targets: Array<{ geometryId: GeometryId; anchor: EntityAnchor }>;
        score: number;
        reasons: string[];
      }>;
      observedValue?: number; computedValue?: number; displayText?: string;
      unit?: 'mm' | 'cm' | 'm' | 'deg';
      tolerance?: { upper?: number; lower?: number };
      prefix?: string; suffix?: string;
      textPosition: Vec2; definitionPoints: Vec2[];
    });

export type DrawingRelation =
  | (BaseNode<RelationId, 'topology'> & {
      plane: 'topology'; kind: 'connected' | 'closed' | 'contains' | 'intersects';
      nodeIds: string[];
    })
  | (BaseNode<RelationId, 'constraint'> & {
      plane: 'constraint';
      kind: 'horizontal' | 'vertical' | 'parallel' | 'perpendicular' | 'tangent'
        | 'concentric' | 'equal' | 'distance' | 'radius' | 'angle' | 'symmetry';
      geometryIds: GeometryId[]; value?: number; property?: string;
      status: 'defined' | 'satisfied' | 'violated' | 'unsolved';
    })
  | (BaseNode<RelationId, 'association'> & {
      plane: 'association'; kind: 'annotation-target'; annotationId: AnnotationId;
      geometryIds: GeometryId[];
    })
  | (BaseNode<RelationId, 'semantic'> & {
      plane: 'semantic'; kind: 'feature-member'; featureId: FeatureId; nodeIds: string[];
    });

export interface SemanticFeature extends BaseNode<FeatureId, 'feature'> {
  semanticType: string;
  geometryIds: GeometryId[];
  annotationIds: AnnotationId[];
  relationIds: RelationId[];
  properties: Record<string, unknown>;
}

export interface CoordinateFrame {
  id: string;
  kind: 'document' | 'source' | 'page' | 'view' | 'provisional';
  transform: readonly [number, number, number, number, number, number];
  parentId?: string;
}

export interface DrawingDocument {
  protocol: 'VectorAI-Drawing';
  schemaVersion: '1.0';
  id: DrawingId;
  metadata: { createdAt: number; updatedAt: number };
  unitSystem: { length: 'mm' | 'cm' | 'm'; angle: 'deg' };
  coordinateFrames: CoordinateFrame[];
  geometry: GeometryNode[];
  annotations: AnnotationNode[];
  relations: DrawingRelation[];
  features: SemanticFeature[];
}
```

- [ ] **Step 4: Implement injected identity and empty creation**

```ts
export interface IdFactory {
  next(kind: 'drawing' | 'geometry' | 'annotation' | 'relation' | 'feature' | 'revision' | 'commit'): string;
}

export const randomIdFactory: IdFactory = {
  next: (kind) => `${kind}_${globalThis.crypto.randomUUID()}`,
};

export function createEmptyDrawing(input: {
  unit?: 'mm' | 'cm' | 'm';
  idFactory?: IdFactory;
  now?: () => number;
} = {}): DrawingDocument {
  // Return the exact value asserted in the test; cast only at branded-ID boundaries.
}
```

- [ ] **Step 5: Run the document tests**

Run: `npx vitest run src/drawing/tests/document.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the protocol contract**

```bash
git add src/drawing/document src/drawing/tests/document.test.ts
git commit -m "feat(drawing-core): define canonical drawing document"
```

---

### Task 2: Validation Contracts and Full Document Validation

**Reasoning level:** Lower after Task 1 types are fixed; use high reasoning if a relation/anchor invariant is ambiguous.

**Files:**
- Create: `src/drawing/validation/types.ts`
- Create: `src/drawing/validation/document.ts`
- Create: `src/drawing/tests/validation.test.ts`

**Interfaces:**
- Consumes: `DrawingDocument` and all node unions from Task 1.
- Produces: `ValidationIssue`, `ValidationReport`, `validateDrawingDocument(document)`.

- [ ] **Step 1: Write failing validation tests for every plane**

Create one valid fixture and assert these exact failures:

```ts
expect(validateDrawingDocument(withDuplicateId).issues[0].code).toBe('DUPLICATE_NODE_ID');
expect(validateDrawingDocument(withNegativeRadius).issues[0].code).toBe('INVALID_RADIUS');
expect(validateDrawingDocument(withMissingTarget).issues[0].code).toBe('REFERENCE_NOT_FOUND');
expect(validateDrawingDocument(withBadConfidence).issues[0].code).toBe('INVALID_CONFIDENCE');
expect(validateDrawingDocument(withEmptyText).issues[0].code).toBe('EMPTY_TEXT');
```

Also table-test finite coordinates, normalized ray/xline directions, arc radius/angles, ellipse ratio, polyline vertex counts, spline knot monotonicity, Text height, Dimension anchors, Feature references, and relation arity.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run src/drawing/tests/validation.test.ts`

Expected: FAIL because validation modules do not exist.

- [ ] **Step 3: Define structured validation results**

```ts
export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'candidate' | 'info';
  path: string;
  message: string;
  nodeIds: string[];
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}
```

- [ ] **Step 4: Implement validation as independent passes**

In `document.ts`, keep each pass private and focused:

```ts
export function validateDrawingDocument(document: DrawingDocument): ValidationReport {
  const issues = [
    ...validateEnvelope(document),
    ...validateIds(document),
    ...validateGeometry(document.geometry),
    ...validateAnnotations(document.annotations),
    ...validateReferences(document),
    ...validateFeatures(document.features),
  ];
  return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}
```

Do not mutate or normalize input during validation.

- [ ] **Step 5: Run validation and type checks**

Run: `npx vitest run src/drawing/tests/validation.test.ts`

Expected: PASS.

Run: `npm run check`

Expected: PASS.

- [ ] **Step 6: Commit validation**

```bash
git add src/drawing/validation src/drawing/tests/validation.test.ts
git commit -m "feat(drawing-core): validate drawing document planes"
```

---

### Task 3: Complete Query and Bounds API

**Reasoning level:** High for selector semantics; lower for implementing each geometry bounds case.

**Files:**
- Create: `src/drawing/query/types.ts`
- Create: `src/drawing/query/bounds.ts`
- Create: `src/drawing/query/query.ts`
- Create: `src/drawing/tests/query.test.ts`

**Interfaces:**
- Consumes: immutable `DrawingDocument` from Task 1.
- Produces: `DrawingSelector`, `DrawingQueryResult`, `queryDrawing()`, `inspectNode()`, `geometryBounds()`.

- [ ] **Step 1: Write failing selector and bounds tests**

Cover all nine geometry types and assert that no result contains `undefined` bounds or summary. Include selectors by plane, node type, IDs, candidate status, bounding box, relation kind, and result limit.

```ts
const result = queryDrawing(document, {
  plane: 'geometry',
  types: ['circle'],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  limit: 10,
});
expect(result.items.map((item) => item.id)).toEqual(['circle_1']);
```

- [ ] **Step 2: Verify the query test fails**

Run: `npx vitest run src/drawing/tests/query.test.ts`

Expected: FAIL because the query API is missing.

- [ ] **Step 3: Define stable selectors and bounded results**

```ts
export interface DrawingSelector {
  plane?: 'geometry' | 'annotation' | 'relation' | 'feature';
  ids?: string[];
  types?: string[];
  qualityStatus?: 'confirmed' | 'candidate';
  bounds?: Bounds2D;
  relationKind?: string;
  limit?: number;
}

export interface DrawingQueryResult {
  items: Array<{ id: string; plane: string; type: string; summary: string; bounds?: Bounds2D }>;
  truncated: boolean;
}
```

- [ ] **Step 4: Implement complete analytic bounds**

Implement exact Point/Line/Circle/Arc/Ellipse/Polyline bounds. For Ray and XLine, require a query clipping bounds and return the clipped result. For Spline, use control-point hull bounds in MVP and identify that approximation in the summary; do not return `undefined`.

- [ ] **Step 5: Implement pure query and inspect operations**

`queryDrawing()` must preserve document order for equal matches, apply `limit` last, and never expose mutable internal references. `inspectNode()` returns a cloned node, inbound/outbound relations, Feature membership, and bounds.

- [ ] **Step 6: Run query tests and commit**

Run: `npx vitest run src/drawing/tests/query.test.ts`

Expected: PASS.

```bash
git add src/drawing/query src/drawing/tests/query.test.ts
git commit -m "feat(drawing-core): add complete drawing query API"
```

---

### Task 4: Plane-Specific Patch Apply and Inverse

**Reasoning level:** Lower for repetitive plane cases; use high reasoning for delete cascades and inverse ordering.

**Files:**
- Create: `src/drawing/patch/types.ts`
- Create: `src/drawing/patch/apply.ts`
- Create: `src/drawing/tests/patch.test.ts`

**Interfaces:**
- Consumes: Task 1 document types and Task 2 validator.
- Produces: `DrawingPatch`, `DrawingPatchOperation`, `applyDrawingPatch()`.

- [ ] **Step 1: Write failing add/update/delete/inverse tests**

Table-test geometry, annotation, relation, and feature planes. Assert atomic rejection, immutable `id/type/plane`, delete cascade behavior, and exact round trip:

```ts
const applied = applyDrawingPatch(document, patch);
expect(applied.success).toBe(true);
if (applied.success) {
  const reverted = applyDrawingPatch(applied.document, applied.inversePatch);
  expect(reverted.success && reverted.document).toEqual(document);
}
```

- [ ] **Step 2: Verify patch tests fail**

Run: `npx vitest run src/drawing/tests/patch.test.ts`

Expected: FAIL because patch modules do not exist.

- [ ] **Step 3: Define explicit plane operations**

```ts
export type DrawingPatchOperation =
  | { type: 'geometry.add'; value: GeometryNode }
  | { type: 'geometry.update'; id: GeometryId; changes: Record<string, unknown> }
  | { type: 'geometry.delete'; id: GeometryId }
  | { type: 'annotation.add'; value: AnnotationNode }
  | { type: 'annotation.update'; id: AnnotationId; changes: Record<string, unknown> }
  | { type: 'annotation.delete'; id: AnnotationId }
  | { type: 'relation.add'; value: DrawingRelation }
  | { type: 'relation.update'; id: RelationId; changes: Record<string, unknown> }
  | { type: 'relation.delete'; id: RelationId }
  | { type: 'feature.add'; value: SemanticFeature }
  | { type: 'feature.update'; id: FeatureId; changes: Record<string, unknown> }
  | { type: 'feature.delete'; id: FeatureId };
```

Reject changes containing `id`, `type`, or `plane`.

- [ ] **Step 4: Implement atomic patch apply**

Clone once, apply operations in order, collect inverse operations, run `validateDrawingDocument()` on the final clone, and return the original document on any failure. Deleting geometry removes relations that reference it and removes it from Feature membership; include every cascade in the inverse in reverse order.

- [ ] **Step 5: Run patch tests and commit**

Run: `npx vitest run src/drawing/tests/patch.test.ts`

Expected: PASS.

```bash
git add src/drawing/patch src/drawing/tests/patch.test.ts
git commit -m "feat(drawing-core): apply reversible drawing patches"
```

---

### Task 5: Typed Drawing Commands and Assertions

**Reasoning level:** Lower after operation contracts are fixed; high if a command would allow type mutation or ambiguous targeting.

**Files:**
- Create: `src/drawing/command/types.ts`
- Create: `src/drawing/command/compile.ts`
- Create: `src/drawing/tests/command.test.ts`

**Interfaces:**
- Consumes: Task 1 node types, Task 3 query API, Task 4 patch types.
- Produces: `DrawingCommand`, `DrawingAssertion`, `compileDrawingCommands()`, `evaluateAssertion()`.

- [ ] **Step 1: Write failing command compilation tests**

Cover create/update/delete for Geometry and Annotation, relation/feature creation, expected-property preconditions, missing targets, and type replacement rejection.

```ts
const result = compileDrawingCommands(document, [{
  type: 'geometry.update',
  id: 'circle_1',
  expected: { radius: 25 },
  changes: { radius: 30 },
}]);
expect(result.patch.operations).toEqual([
  { type: 'geometry.update', id: 'circle_1', changes: { radius: 30 } },
]);
expect(result.preconditions).toContainEqual({
  type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25,
});
```

- [ ] **Step 2: Verify command tests fail**

Run: `npx vitest run src/drawing/tests/command.test.ts`

Expected: FAIL because command modules do not exist.

- [ ] **Step 3: Define commands and first assertion set**

Define typed create/update/delete commands for all four planes plus system-only `{ type: 'history.revert'; commitId }`. Define assertions:

```ts
export type DrawingAssertion =
  | { type: 'node.exists'; nodeId: string }
  | { type: 'node.absent'; nodeId: string }
  | { type: 'property.equals'; nodeId: string; path: string; value: unknown }
  | { type: 'document.valid' }
  | { type: 'selection.count'; selector: DrawingSelector; equals: number };
```

- [ ] **Step 4: Implement deterministic compilation and assertion evaluation**

Compilation may allocate IDs only through an injected `IdFactory`; it must not call a model or inspect UI state. `history.revert` is rejected by the compiler with `REPOSITORY_COMMAND_REQUIRED` because the repository owns Commit lookup.

- [ ] **Step 5: Run command tests and commit**

Run: `npx vitest run src/drawing/tests/command.test.ts`

Expected: PASS.

```bash
git add src/drawing/command src/drawing/tests/command.test.ts
git commit -m "feat(drawing-core): compile typed drawing commands"
```

---

### Task 6: Pure Transaction Preview Engine

**Reasoning level:** High — this establishes atomicity and the contract later used by UI and Agent tools.

**Files:**
- Create: `src/drawing/transaction/types.ts`
- Create: `src/drawing/transaction/execute.ts`
- Create: `src/drawing/tests/transaction.test.ts`

**Interfaces:**
- Consumes: Task 2 validation, Task 4 patch apply, Task 5 commands/assertions.
- Produces: `DrawingTransaction`, `TransactionPreview`, `TransactionResult`, `previewTransaction()`.

- [ ] **Step 1: Write failing transaction outcome tests**

Test stale revision, failed precondition, invalid resulting document, failed postcondition, successful preview, candidate warnings, and already-satisfied no-op.

```ts
const result = previewTransaction({ document, currentRevision: 'rev_1' }, {
  id: 'tx_1',
  baseRevision: 'rev_1',
  actor: { type: 'AI', id: 'agent' },
  commands: [{ type: 'geometry.update', id: 'circle_1', changes: { radius: 30 } }],
  preconditions: [{ type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25 }],
  postconditions: [{ type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 30 }],
  evidenceRefs: [],
});
expect(result.status).toBe('ready');
```

- [ ] **Step 2: Verify transaction tests fail**

Run: `npx vitest run src/drawing/tests/transaction.test.ts`

Expected: FAIL because transaction modules do not exist.

- [ ] **Step 3: Define structured transaction errors and preview**

```ts
export interface Actor {
  type: 'AI' | 'user' | 'system';
  id: string;
}

export interface DrawingTransaction {
  id: string;
  baseRevision: RevisionId;
  actor: Actor;
  goalId?: string;
  commands: DrawingCommand[];
  preconditions: DrawingAssertion[];
  postconditions: DrawingAssertion[];
  evidenceRefs: EvidenceId[];
}

export interface DrawingError {
  code: string;
  stage: 'revision' | 'precondition' | 'compile' | 'patch' | 'validation' | 'postcondition';
  retryable: boolean;
  nodeIds: string[];
  message: string;
  suggestedAction?: 'requery' | 'repair' | 'replan' | 'pause';
}

export interface GoalOutcomeReport {
  satisfied: boolean;
  assertions: Array<{ assertion: DrawingAssertion; satisfied: boolean }>;
}

export interface TransactionPreview {
  transactionId: string;
  baseRevision: RevisionId;
  patch: DrawingPatch;
  inversePatch: DrawingPatch;
  affectedNodeIds: string[];
  validationReport: ValidationReport;
  outcomeReport: GoalOutcomeReport;
  candidate: boolean;
}

export type TransactionResult =
  | { status: 'already_satisfied'; outcome: GoalOutcomeReport }
  | { status: 'rejected'; errors: DrawingError[] }
  | { status: 'ready'; preview: TransactionPreview; resultingDocument: DrawingDocument };
```

- [ ] **Step 4: Implement the exact execution order**

`previewTransaction()` must perform revision → preconditions → compile → patch → document validation → postconditions. It returns `ready` but never persists. Detect already-satisfied only when `postconditions.length > 0` and every postcondition is true before commands run; return without allocating IDs or producing a patch. Transactions without postconditions must execute their commands normally.

- [ ] **Step 5: Run transaction tests and commit**

Run: `npx vitest run src/drawing/tests/transaction.test.ts`

Expected: PASS.

```bash
git add src/drawing/transaction src/drawing/tests/transaction.test.ts
git commit -m "feat(drawing-core): preview atomic drawing transactions"
```

---

### Task 7: Linear In-Memory Repository and Drawing Commit

**Reasoning level:** High — revision ownership and atomic commit semantics are architectural invariants.

**Files:**
- Create: `src/drawing/repository/types.ts`
- Create: `src/drawing/repository/memory.ts`
- Create: `src/drawing/tests/repository.test.ts`

**Interfaces:**
- Consumes: Task 1 IDs, Task 4 patch, Task 6 transaction preview.
- Produces: `DrawingCommit`, `DrawingRepository`, `MemoryDrawingRepository`.

- [ ] **Step 1: Write failing repository tests**

Cover create/open, atomic commit, parent/resulting revision chain, stale transaction rejection, no commit for already-satisfied, immutable commit copies, and linear history ordering.

```ts
const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
const opened = await repository.create(document);
const committed = await repository.commit(transaction);
expect(committed.status).toBe('committed');
if (committed.status === 'committed') {
  expect(committed.commit.parentRevision).toBe(opened.revision);
  expect(committed.commit.resultingRevision).not.toBe(opened.revision);
}
```

- [ ] **Step 2: Verify repository tests fail**

Run: `npx vitest run src/drawing/tests/repository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Define repository and commit interfaces**

```ts
export interface DrawingRepository {
  create(document: DrawingDocument): Promise<{ document: DrawingDocument; revision: RevisionId }>;
  getCurrent(drawingId: DrawingId): Promise<{ document: DrawingDocument; revision: RevisionId }>;
  commit(transaction: DrawingTransaction): Promise<RepositoryCommitResult>;
  revert(input: { drawingId: DrawingId; commitId: CommitId; actor: Actor }): Promise<RepositoryCommitResult>;
  listCommits(drawingId: DrawingId): Promise<DrawingCommit[]>;
}

export interface DrawingCommit {
  id: CommitId;
  drawingId: DrawingId;
  parentRevision: RevisionId;
  resultingRevision: RevisionId;
  actor: Actor;
  goalId?: string;
  commands: DrawingCommand[];
  patch: DrawingPatch;
  inversePatch: DrawingPatch;
  validationReport: ValidationReport;
  outcomeReport: GoalOutcomeReport;
  evidenceRefs: EvidenceId[];
  confidence?: number;
  timestamp: number;
}
```

- [ ] **Step 4: Implement atomic in-memory commit**

Store cloned documents and commits in private Maps. Call `previewTransaction()` against the current revision, allocate a resulting revision only for `ready`, then replace the document and append the Commit in one synchronous critical section before resolving the Promise.

- [ ] **Step 5: Implement Revert Commit**

`revert()` finds the target Commit, applies its `inversePatch` to the current document, validates the result, and appends a new Commit whose command is `{ type: 'history.revert', commitId }`. It must not delete or move existing history.

- [ ] **Step 6: Run repository tests and commit**

Run: `npx vitest run src/drawing/tests/repository.test.ts`

Expected: PASS.

```bash
git add src/drawing/repository src/drawing/tests/repository.test.ts
git commit -m "feat(drawing-core): add linear drawing repository"
```

---

### Task 8: Deterministic Replay and Core Integration Scenario

**Reasoning level:** High for replay invariants; lower for fixture construction.

**Files:**
- Create: `src/drawing/repository/replay.ts`
- Create: `src/drawing/tests/replay.test.ts`
- Create: `src/drawing/tests/integration.test.ts`

**Interfaces:**
- Consumes: `DrawingCommit`, `applyDrawingPatch`, `MemoryDrawingRepository`.
- Produces: `replayDrawingCommits(initialDocument, commits)`.

- [ ] **Step 1: Write failing replay tests**

Create an empty drawing, commit a circle and horizontal xline, update the circle radius, revert the update, and assert deterministic equality between repository current state and replayed state.

```ts
const replayed = replayDrawingCommits(initialDocument, commits);
expect(replayed.success).toBe(true);
if (replayed.success) expect(replayed.document).toEqual(current.document);
```

Also reject a commit whose `parentRevision` does not match the replay cursor with `REVISION_CHAIN_BROKEN`.

- [ ] **Step 2: Verify replay tests fail**

Run: `npx vitest run src/drawing/tests/replay.test.ts src/drawing/tests/integration.test.ts`

Expected: FAIL because replay is missing.

- [ ] **Step 3: Implement deterministic replay**

Apply each Commit patch in order, validate each resulting document, advance the expected revision, and return the first structured replay error without mutating the initial input.

- [ ] **Step 4: Run replay and integration tests**

Run: `npx vitest run src/drawing/tests/replay.test.ts src/drawing/tests/integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit replay**

```bash
git add src/drawing/repository/replay.ts src/drawing/tests/replay.test.ts src/drawing/tests/integration.test.ts
git commit -m "test(drawing-core): verify deterministic commit replay"
```

---

### Task 9: Public API, Dependency Guard, and Phase Verification

**Reasoning level:** Lower; interfaces are already fixed.

**Files:**
- Create: `src/drawing/index.ts`
- Create: `src/drawing/tests/dependency-boundary.test.ts`
- Modify: `docs/superpowers/specs/2026-08-08-drawing-as-code-system-architecture-design.md`

**Interfaces:**
- Consumes: all public contracts from Tasks 1–8.
- Produces: the only supported import surface for later migration plans: `@/drawing` or `src/drawing/index.ts`.

- [ ] **Step 1: Write the failing dependency-boundary test**

Read files under `src/drawing` and fail if a source file imports from forbidden areas:

```ts
const forbidden = ['/components/', '/hooks/', '/api/', '/services/', '../core/'];
expect(importSpecifiers.filter((value) => forbidden.some((part) => value.includes(part)))).toEqual([]);
```

Use Node filesystem APIs only inside this test; production Core files remain platform-neutral.

- [ ] **Step 2: Export the minimal public API**

`index.ts` exports document types/creation, validation, query, command types/compiler, patch types/apply, transaction types/preview, repository contracts/memory implementation, and replay. Do not export private validation passes or internal collection helpers.

- [ ] **Step 3: Record Phase 1 implementation status in the architecture spec**

Add a dated “实施状态” table that marks only Phase 1 as implemented after all verification commands pass. Do not change the approved architecture decisions.

- [ ] **Step 4: Run focused and full verification**

Run: `npx vitest run src/drawing/tests`

Expected: all new Drawing Core tests PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

Run: `npm run check`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git status --short --untracked-files=all`

Expected: only intended Drawing Core/spec changes plus untouched `?? test1.jpg` before staging.

- [ ] **Step 5: Commit the public boundary**

```bash
git add src/drawing docs/superpowers/specs/2026-08-08-drawing-as-code-system-architecture-design.md
git commit -m "feat(drawing-core): publish drawing core v1 boundary"
```

## Phase 1 Completion Gate

Phase 1 is complete only when:

- `src/drawing/` has no imports from legacy `src/core/` or application layers.
- Every supported geometry type validates and returns usable query bounds.
- Every plane supports add/update/delete Patch operations with exact inverse behavior.
- Stale revisions and failed assertions reject atomically.
- `already_satisfied` produces no Commit.
- Revert appends a new Commit without moving a cursor.
- Deterministic replay produces the repository's exact current DrawingDocument.
- Full tests, TypeScript check, and production build pass.
- No compatibility translator, dual write, branch, worktree, subagent, or `test1.jpg` change was introduced.

## Next Plan Boundary

After this gate passes, write a separate Phase 2 plan for Drawing Application Service, local file repository, UI projection cutover, and deletion of the first migrated legacy mutation paths. Do not expand this plan into Agent or perception migration.
