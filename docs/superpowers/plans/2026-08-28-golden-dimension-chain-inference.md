# Golden Dimension-Chain Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, reviewable axial dimension-chain inference workflow that reproduces the golden shaft's nominal dimension scheme without hardcoded sample values or fabricated tolerances.

**Architecture:** Add a pure `dimension-inference` domain module before the existing `DimensionIntent` and `DimensionChain` layer. It converts partition topology and document evidence into a weighted laminar interval scheme, persists that scheme inside the existing dimension-plan lifecycle, and exposes an explicit DSH tool plus editable canvas preview. The golden target is parsed only by tests and never imported by runtime code.

**Tech Stack:** TypeScript 5.8, Vitest 3, Zod, React 18, DSH Typert remotes/tools, existing VectorAI DXF importer and drawing surface.

**Spec:** `docs/superpowers/specs/2026-08-28-golden-dimension-chain-inference-design.md`

## Global Constraints

- The golden target drawing is a test oracle only; production code must not load it or identify it by filename, digest, coordinate, or nominal value.
- Runtime inference and policy configuration must not contain the golden-only values `3.5`, `39`, or `23` as decision constants.
- AI may propose semantic roles only; local deterministic code owns stations, nominal values, coefficients, selection, and arithmetic.
- Missing tolerance data must not block nominal dimension-scheme inference.
- Uploading a DXF or document must never start dimension-chain inference by itself.
- No VectorAI cloud or Express service may be introduced.
- The first milestone covers axial nominal linear chains only; it must not generate radius, diameter, arc, angular, GD&T, or numeric tolerance annotations.
- Existing partition and dimension-plan persistence semantics—durable save before publication, revision binding, cancel, confirm, undo, redo—must be preserved.
- All new source files use `// SPDX-License-Identifier: Apache-2.0`.

---

## File Structure

### Domain package

- `packages/engineering-annotation/src/dimension-inference/types.ts`: inference contracts and decision diagnostics.
- `packages/engineering-annotation/src/dimension-inference/topology.ts`: canonical station and elementary-span construction.
- `packages/engineering-annotation/src/dimension-inference/candidates.ts`: bounded evidence-driven interval generation.
- `packages/engineering-annotation/src/dimension-inference/policy.ts`: immutable generic and reference policy descriptors plus scoring.
- `packages/engineering-annotation/src/dimension-inference/infer.ts`: laminar selection and closure ranking.
- `packages/engineering-annotation/src/dimension-inference/edit.ts`: pure display and closure edits with revalidation.
- `packages/engineering-annotation/src/dimension-inference/validate.ts`: arithmetic, coverage, crossing, ambiguity, and stale-reference validation.
- `packages/engineering-annotation/src/dimension-inference/project.ts`: confirmed scheme projection into existing intent/chain contracts.
- `packages/engineering-annotation/src/dimension-inference/*.test.ts`: focused TDD coverage.
- `packages/engineering-annotation/src/dimension-inference/golden.integration.test.ts`: semantic golden comparison.
- `packages/engineering-annotation/test/fixtures/golden-shaft-001/*`: canonical source, target, document, and semantic manifest.

### Contracts and host

- `packages/plugin-space-contracts/src/index.ts`: strict scheme, edit-command, and dimension-plan schemas.
- `packages/plugin-space-contracts/src/index.test.ts`: strict parsing and backward compatibility.
- `packages/plugin-dsh-annotation-host/src/dimension-inference-service.ts`: explicit start/edit workflow over current drawing, partition, and staged documents.
- `packages/plugin-dsh-annotation-host/src/dimension-inference-service.test.ts`: workflow authority and revision tests.
- `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`: scheme-aware draft editing and rebase support.
- `packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`: lifecycle regression.
- `packages/plugin-dsh-annotation-host/src/partition-service.ts`: read-only staged-document accessor.
- `packages/plugin-dsh-annotation-host/src/tools.ts`: explicit `drawing_dimension_chain_start` and status tools.
- `packages/plugin-dsh-annotation-host/src/tools.test.ts`: intent-gating and no-unrelated-annotation assertions.
- `packages/plugin-dsh-annotation-host/src/service.ts`: remote methods and tool registration.

### Client

- `packages/plugin-dsh-annotation-client/src/dimension-chain-controller.ts`: remote state/edit actions.
- `packages/plugin-dsh-annotation-client/src/dimension-chain-controller.test.ts`: serialized actions and error handling.
- `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx`: displayed/closure interval world overlay.
- `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.test.tsx`: semantic rendering tests.
- `packages/plugin-dsh-annotation-client/src/DimensionChainInspector.tsx`: nested chains, evidence, alternatives, and conflicts.
- `packages/plugin-dsh-annotation-client/src/DimensionChainInspector.test.tsx`: editing and accessibility tests.
- `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`: workflow composition and shared toolbar reuse.
- `packages/plugin-dsh-annotation-client/src/drawing-layers.ts`: `尺寸链` layer registration.
- `packages/plugin-dsh-annotation-client/src/client.css`: overlay and inspector styling.
- `packages/plugin-dsh-annotation-client/src/remote.ts`: strict Typert descriptors.

### Acceptance

- `scripts/e2e-golden-dimension-chain.ts`: real DXF/document semantic acceptance.
- `package.json`: `e2e:golden-dimension-chain` command.

---

### Task 1: Canonical Golden Fixture and Semantic Oracle

**Files:**
- Create: `packages/engineering-annotation/test/fixtures/golden-shaft-001/manifest.json`
- Create: `packages/engineering-annotation/src/dimension-inference/golden-fixture.test.ts`
- Move: `初始图.dxf` to `packages/engineering-annotation/test/fixtures/golden-shaft-001/initial.dxf`
- Move: `样本图001.dxf` to `packages/engineering-annotation/test/fixtures/golden-shaft-001/target.dxf`
- Move: `样本图001# DXF工程数据文档.txt` to `packages/engineering-annotation/test/fixtures/golden-shaft-001/engineering-data.ini`
- Modify: `packages/engineering-annotation/src/partition/sample.integration.test.ts`

**Interfaces:**
- Consumes: `importDxf({ bytes, source, drawingId, now })` from `@vectorai/dxf-import`.
- Produces: a test-only manifest with `stations`, `displayedIntervals`, `closureIntervals`, and `chains` used by Task 4.

- [ ] **Step 1: Move the tracked golden assets into one canonical fixture directory**

```bash
mkdir -p packages/engineering-annotation/test/fixtures/golden-shaft-001
git mv 初始图.dxf packages/engineering-annotation/test/fixtures/golden-shaft-001/initial.dxf
git mv 样本图001.dxf packages/engineering-annotation/test/fixtures/golden-shaft-001/target.dxf
git mv '样本图001# DXF工程数据文档.txt' packages/engineering-annotation/test/fixtures/golden-shaft-001/engineering-data.ini
```

- [ ] **Step 2: Write the reviewed semantic manifest**

```json
{
  "version": 1,
  "unit": "mm",
  "stations": [0, 17, 41.5, 45, 53, 92, 147, 150, 173],
  "displayedIntervals": [[0, 17], [17, 41.5], [17, 45], [45, 53], [45, 150], [92, 147], [147, 150], [0, 173]],
  "closureIntervals": [[41.5, 45], [53, 92], [150, 173]],
  "chains": [
    { "parent": [17, 45], "children": [[17, 41.5]], "closure": [41.5, 45] },
    { "parent": [45, 150], "children": [[45, 53], [92, 147], [147, 150]], "closure": [53, 92] },
    { "parent": [0, 173], "children": [[0, 17], [17, 45], [45, 150]], "closure": [150, 173] }
  ],
  "expectedDiagnostics": ["DIMENSION_DOCUMENT_DISPLAY_CONFLICT"]
}
```

- [ ] **Step 3: Write the failing fixture-integrity test**

```ts
it('keeps the target as annotations over the same clean geometry', async () => {
  const initial = await loadFixtureDrawing('initial.dxf');
  const target = await loadFixtureDrawing('target.dxf');
  const initialGeometry = coreGeometrySignatures(initial);
  const targetGeometry = coreGeometrySignatures(target);
  expect(initialGeometry.every((signature) => targetGeometry.includes(signature))).toBe(true);
  expect(targetGeometry.length - initialGeometry.length).toBe(2);
  expect(sortIntervals(readAxialLinearIntervals(target))).toEqual(sortIntervals(manifest.displayedIntervals));
  expect(manifest.stations).toEqual([0, 17, 41.5, 45, 53, 92, 147, 150, 173]);
});
```

- [ ] **Step 4: Run the test and verify the test helper is missing**

Run: `pnpm --filter @vectorai/engineering-annotation test -- golden-fixture.test.ts`

Expected: FAIL because `loadFixtureDrawing`, `coreGeometrySignatures`, and `readAxialLinearIntervals` are not implemented.

- [ ] **Step 5: Implement test-only DXF normalization**

```ts
async function loadFixtureDrawing(name: string) {
  const bytes = await readFile(resolve(import.meta.dirname, '../../test/fixtures/golden-shaft-001', name));
  const result = importDxf({ bytes, source: { digest: `sha256:test-${name}`, name }, drawingId: name, now: () => 1 });
  if (result.status !== 'imported') throw new Error(JSON.stringify(result.diagnostics));
  return result.document;
}

function coreGeometrySignatures(document: DrawingDocument): string[] {
  return document.geometry.map(({ id: _id, visible: _visible, quality: _quality, sourceRef: _sourceRef, ...geometry }) => (
    JSON.stringify(roundFiniteNumbers(geometry, 1e-6))
  )).sort();
}
```

`roundFiniteNumbers` recursively rounds finite numeric fields to the supplied
precision while preserving arrays, booleans, strings, and property names. This
signature includes primitive kind and world geometry but excludes node IDs, DXF
handles, layers, annotations, and display order.
`readAxialLinearIntervals` must read imported linear-dimension definition points,
normalize endpoint order, round to `1e-6`, and return sorted `[start, end]` pairs.

- [ ] **Step 6: Update the existing partition integration fixture path and run tests**

Run: `pnpm --filter @vectorai/engineering-annotation test -- golden-fixture.test.ts sample.integration.test.ts`

Expected: PASS, including the existing `41.5` and `45` shoulder regression.

- [ ] **Step 7: Commit the canonical fixture**

```bash
git add packages/engineering-annotation/test packages/engineering-annotation/src/dimension-inference/golden-fixture.test.ts packages/engineering-annotation/src/partition/sample.integration.test.ts
git commit -m "test: establish golden shaft dimension oracle"
```

---

### Task 2: Axial Topology Contracts and Canonical Stations

**Files:**
- Create: `packages/engineering-annotation/src/dimension-inference/types.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/topology.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/topology.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Consumes: `PartitionDraft | PartitionRevision` from `partition/types.ts`.
- Produces: `buildAxialTopology(input: BuildAxialTopologyInput): AxialTopology`.

- [ ] **Step 1: Define the public topology and evidence types**

```ts
export type DimensionEvidenceOrigin = 'geometry' | 'partition' | 'document' | 'manual' | 'ai';
export type AxialStationKind = 'drawing-end' | 'shoulder' | 'partition-boundary' | 'datum';

export interface AxialStation {
  id: string;
  coordinate: number;
  sourceCoordinate: number;
  unit: 'mm' | 'cm' | 'm';
  kinds: AxialStationKind[];
  geometryNodeIds: string[];
  evidenceIds: string[];
}

export interface AxialElementarySpan {
  id: string;
  startStationId: string;
  endStationId: string;
  nominalValue: number;
  segmentIds: string[];
  evidenceIds: string[];
}

export interface AxialTopology {
  drawingRef: DrawingRef;
  axis: ShaftAxis;
  unit: 'mm' | 'cm' | 'm';
  stations: AxialStation[];
  elementarySpans: AxialElementarySpan[];
}

export interface BuildAxialTopologyInput {
  partition: PartitionDraft | PartitionRevision;
  unit?: 'mm' | 'cm' | 'm';
  coordinateTolerance?: number;
}
```

- [ ] **Step 2: Write failing canonicalization tests**

```ts
it('builds one ordered station per accepted shaft boundary', () => {
  const topology = buildAxialTopology({ partition: fixturePartition() });
  expect(topology.stations.map(({ coordinate }) => coordinate)).toEqual([0, 17, 41.5, 45]);
  expect(topology.elementarySpans.map(({ nominalValue }) => nominalValue)).toEqual([17, 24.5, 3.5]);
});

it('is invariant to translated and reversed source axes', () => {
  expect(semanticTopology(buildAxialTopology({ partition: translatedReversedFixture() })))
    .toEqual(semanticTopology(buildAxialTopology({ partition: fixturePartition() })));
});
```

- [ ] **Step 3: Run the topology tests and verify failure**

Run: `pnpm --filter @vectorai/engineering-annotation test -- topology.test.ts`

Expected: FAIL because `buildAxialTopology` is not exported.

- [ ] **Step 4: Implement station normalization and stable IDs**

```ts
export function buildAxialTopology(input: BuildAxialTopologyInput): AxialTopology {
  const tolerance = input.coordinateTolerance ?? Math.max((input.partition.axis.zMax - input.partition.axis.zMin) * 1e-7, 1e-6);
  const raw = collectBoundaryEvidence(input.partition);
  const merged = mergeCoordinates(raw, tolerance);
  const stations = merged
    .map((entry) => toCanonicalStation(entry, input.partition.axis, input.unit ?? 'mm', tolerance))
    .sort((left, right) => left.coordinate - right.coordinate);
  return {
    drawingRef: input.partition.drawingRef,
    axis: input.partition.axis,
    unit: input.unit ?? 'mm',
    stations,
    elementarySpans: consecutiveSpans(stations, input.partition.segments),
  };
}
```

Use coordinates relative to the canonical physical start and derive IDs from
quantized relative coordinate plus stable geometry references. Never use array
indices in IDs.

- [ ] **Step 5: Add validation for non-finite, duplicate, and zero-length spans**

```ts
if (!Number.isFinite(entry.z)) throw new Error('DIMENSION_STATION_UNRESOLVED');
if (end.coordinate - start.coordinate <= tolerance) throw new Error('DIMENSION_STATION_CONFLICT');
```

- [ ] **Step 6: Export the module and run package tests**

Run: `pnpm --filter @vectorai/engineering-annotation test && pnpm --filter @vectorai/engineering-annotation check`

Expected: PASS.

- [ ] **Step 7: Commit axial topology**

```bash
git add packages/engineering-annotation/src/dimension-inference packages/engineering-annotation/src/index.ts
git commit -m "feat: build canonical axial dimension topology"
```

---

### Task 3: Evidence-Bounded Dimension Candidates

**Files:**
- Modify: `packages/engineering-annotation/src/dimension-inference/types.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/candidates.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/candidates.test.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Consumes: `AxialTopology`, `PartitionDraft | PartitionRevision`, and optional `ParsedEngineeringDocument`.
- Produces: `generateAxialDimensionCandidates(input: GenerateCandidateInput): AxialCandidateSet`.

- [ ] **Step 1: Add candidate and evidence contracts**

```ts
export type AxialDimensionRole = 'overall' | 'composite' | 'functional' | 'process' | 'local' | 'reference' | 'closure';

export interface DimensionEvidence {
  id: string;
  origin: DimensionEvidenceOrigin;
  kind: 'drawing-end' | 'elementary-span' | 'functional-region' | 'document-interval' | 'process-envelope' | 'manual-requirement';
  label: string;
  required: boolean;
  sourceIds: string[];
}

export interface AxialDimensionCandidate {
  id: string;
  startStationId: string;
  endStationId: string;
  nominalValue: number;
  roles: AxialDimensionRole[];
  evidenceIds: string[];
  required: boolean;
}

export interface GenerateCandidateInput {
  topology: AxialTopology;
  partition: PartitionDraft | PartitionRevision;
  document?: ParsedEngineeringDocument;
  manualIntervals?: Array<{ start: number; end: number; label: string }>;
}

export interface AxialCandidateSet {
  candidates: AxialDimensionCandidate[];
  evidence: DimensionEvidence[];
  diagnostics: EngineeringDiagnostic[];
}
```

- [ ] **Step 2: Write failing bounded-generation tests**

```ts
it('merges geometry, functional, and document evidence on the same interval', () => {
  const { candidates } = generateAxialDimensionCandidates(goldenCandidateInput());
  expect(findInterval(candidates, 17, 41.5)).toMatchObject({
    nominalValue: 24.5,
    roles: expect.arrayContaining(['functional']),
    evidenceIds: expect.arrayContaining(['document:region:S01']),
  });
});

it('does not generate unconstrained all-pairs intervals', () => {
  const { candidates } = generateAxialDimensionCandidates(goldenCandidateInput());
  expect(findInterval(candidates, 0, 92)).toBeUndefined();
  expect(findInterval(candidates, 0, 173)?.roles).toContain('overall');
});
```

- [ ] **Step 3: Run the candidate tests and verify failure**

Run: `pnpm --filter @vectorai/engineering-annotation test -- candidates.test.ts`

Expected: FAIL because the generator is missing.

- [ ] **Step 4: Implement adjacent, functional, document, process-envelope, and overall candidates**

```ts
export function generateAxialDimensionCandidates(input: GenerateCandidateInput): AxialCandidateSet {
  const accumulator = new CandidateAccumulator(input.topology);
  for (const span of input.topology.elementarySpans) accumulator.add(span.startStationId, span.endStationId, 'local', geometryEvidence(span));
  for (const group of input.partition.semanticGroups) addFunctionalInterval(accumulator, group, input.topology);
  for (const region of input.document?.regions ?? []) addDocumentInterval(accumulator, region, input.topology);
  for (const envelope of deriveProcessEnvelopes(input.partition, input.topology)) accumulator.add(envelope.start, envelope.end, 'composite', envelope.evidence);
  accumulator.add(input.topology.stations[0]!.id, input.topology.stations.at(-1)!.id, 'overall', overallEvidence(input.topology));
  for (const interval of input.manualIntervals ?? []) addManualInterval(accumulator, interval);
  return {
    candidates: accumulator.values(),
    evidence: accumulator.evidence(),
    diagnostics: accumulator.diagnostics(),
  };
}
```

`deriveProcessEnvelopes` may extend a functional interval only across adjacent
transition spans whose profile changes monotonically toward a stable shoulder. It
must stop at the next functional boundary or stable ordinary shaft span. This is a
geometry rule, not a sample-coordinate rule.

- [ ] **Step 5: Add unresolved-document diagnostics instead of coordinate invention**

```ts
const endpoints = resolveIntervalToStations(region.interval, topology, tolerance);
if (!endpoints) evidenceDiagnostics.push(diagnostic('DIMENSION_STATION_UNRESOLVED', region.id));
```

- [ ] **Step 6: Run candidate, parser, and partition regressions**

Run: `pnpm --filter @vectorai/engineering-annotation test -- candidates.test.ts parser.test.ts sample.integration.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit candidate generation**

```bash
git add packages/engineering-annotation/src/dimension-inference packages/engineering-annotation/src/index.ts
git commit -m "feat: generate evidence-bounded axial dimensions"
```

---

### Task 4: Laminar Selection, Closure Inference, Validation, and Projection

**Files:**
- Create: `packages/engineering-annotation/src/dimension-inference/policy.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/infer.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/edit.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/validate.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/project.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/infer.test.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/edit.test.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/project.test.ts`
- Create: `packages/engineering-annotation/src/dimension-inference/golden.integration.test.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/types.ts`
- Modify: `packages/engineering-annotation/src/index.ts`

**Interfaces:**
- Consumes: `AxialTopology` and `AxialCandidateSet` from Tasks 2–3.
- Produces:
  - `inferAxialDimensionScheme(input: InferAxialDimensionSchemeInput): AxialDimensionScheme`
  - `validateAxialDimensionScheme(scheme: AxialDimensionScheme): EngineeringDiagnostic[]`
  - `projectAxialDimensionScheme(input: ProjectAxialSchemeInput): EngineeringAnnotationDraft`

- [ ] **Step 1: Define policy, decision, chain, and scheme contracts**

```ts
export interface AxialInferencePolicy {
  id: 'shaft-hierarchical-dimensioning-v1' | 'shaft-reference-terminal-closure-v1';
  version: '1';
  weights: Readonly<Record<DimensionScoreFeature, number>>;
  ambiguityMargin: number;
  preferTerminalRootClosure: boolean;
}

export interface DimensionDecisionTrace {
  candidateId: string;
  decision: 'displayed' | 'closure' | 'rejected' | 'alternative';
  score: number;
  features: Array<{ feature: DimensionScoreFeature; contribution: number; evidenceIds: string[] }>;
  reasonCodes: string[];
}

export interface AxialChainNode {
  id: string;
  parentCandidateId: string;
  childCandidateIds: string[];
  closureCandidateId: string;
  alternativeClosureCandidateIds: string[];
  status: 'resolved' | 'needs-review' | 'conflict';
}

export interface AxialDimensionScheme {
  version: 1;
  drawingRef: DrawingRef;
  partitionRevisionId?: string;
  policy: { id: AxialInferencePolicy['id']; version: '1' };
  inputDigest: string;
  topology: AxialTopology;
  evidence: DimensionEvidence[];
  candidates: AxialDimensionCandidate[];
  displayedCandidateIds: string[];
  closureCandidateIds: string[];
  chains: AxialChainNode[];
  decisions: DimensionDecisionTrace[];
  diagnostics: EngineeringDiagnostic[];
  status: 'resolved' | 'needs-review' | 'conflict' | 'stale';
}

export interface InferAxialDimensionSchemeInput {
  topology: AxialTopology;
  candidateSet: AxialCandidateSet;
  policy: AxialInferencePolicy;
  partitionRevisionId?: string;
}

export interface ProjectAxialSchemeInput {
  scheme: AxialDimensionScheme;
  baseRevisionId?: string;
}
```

- [ ] **Step 2: Write failing selection and ambiguity tests**

```ts
it('selects a non-crossing nested family and one closure per parent', () => {
  const scheme = inferAxialDimensionScheme(referencePolicyInput());
  expect(intervals(scheme.displayedCandidateIds, scheme)).toEqual([
    [0, 17], [0, 173], [17, 41.5], [17, 45], [45, 53], [45, 150], [92, 147], [147, 150],
  ]);
  expect(intervals(scheme.closureCandidateIds, scheme)).toEqual([[41.5, 45], [53, 92], [150, 173]]);
});

it('does not silently confirm a close closure tie', () => {
  const scheme = inferAxialDimensionScheme(ambiguousInput());
  expect(scheme.status).toBe('needs-review');
  expect(scheme.diagnostics).toContainEqual(expect.objectContaining({ code: 'DIMENSION_CLOSURE_AMBIGUOUS' }));
});
```

- [ ] **Step 3: Run the inference tests and verify failure**

Run: `pnpm --filter @vectorai/engineering-annotation test -- infer.test.ts`

Expected: FAIL because the policy and inference functions are missing.

- [ ] **Step 4: Implement named evidence scoring**

```ts
export function scoreCandidate(candidate: AxialDimensionCandidate, evidence: readonly DimensionEvidence[], policy: AxialInferencePolicy): DimensionDecisionTrace {
  const features = collectScoreFeatures(candidate, evidence).map((item) => ({
    ...item,
    contribution: policy.weights[item.feature],
  }));
  return {
    candidateId: candidate.id,
    decision: 'rejected',
    score: features.reduce((sum, item) => sum + item.contribution, 0),
    features,
    reasonCodes: features.map(({ feature }) => `DIMENSION_SCORE_${feature.toUpperCase().replaceAll('-', '_')}`),
  };
}
```

Weights must be named semantic constants such as `manual-required`,
`document-exact`, `functional-region`, `overall-root`, `ordinary-residual`, and
`terminal-residual`. They must not depend on nominal values.

- [ ] **Step 5: Implement interval dynamic programming and closure ranking**

```ts
export function inferAxialDimensionScheme(input: InferAxialDimensionSchemeInput): AxialDimensionScheme {
  const scored = input.candidateSet.candidates.map((candidate) => scoreCandidate(candidate, input.candidateSet.evidence, input.policy));
  const root = requireOverallCandidate(input.candidateSet.candidates);
  const selection = solveLaminarInterval(root, input.topology, input.candidateSet.candidates, scored);
  const chains = materializeChains(selection, input.topology, scored, input.policy);
  const scheme = assembleScheme(input, selection, chains, scored);
  return { ...scheme, diagnostics: validateAxialDimensionScheme(scheme) };
}
```

`solveLaminarInterval` memoizes by station-index interval. Each state compares
skipping a candidate, selecting disjoint children, and selecting a containing
parent. `materializeChains` groups consecutive uncovered elementary spans into
residual runs, ranks them by negative control importance, and emits alternatives
when the top-two margin is below `policy.ambiguityMargin`.

- [ ] **Step 6: Implement arithmetic and crossing validation**

```ts
const arithmeticError = Math.abs(parent.nominalValue - childTotal - closure.nominalValue);
if (arithmeticError > Math.max(parent.nominalValue * 1e-8, 1e-6)) {
  diagnostics.push(error('DIMENSION_CHAIN_ARITHMETIC_MISMATCH', chain.id));
}
if (selectedIntervals.some((left, index) => selectedIntervals.slice(index + 1).some((right) => crosses(left, right)))) {
  diagnostics.push(error('DIMENSION_CANDIDATE_CROSSES_SELECTED', scheme.inputDigest));
}
```

- [ ] **Step 7: Implement pure manual scheme edits and their tests**

```ts
export type ApplyDimensionSchemeEditInput =
  | { type: 'candidate.display'; candidateId: string; displayed: boolean }
  | { type: 'closure.choose'; chainId: string; candidateId: string };

export function applyDimensionSchemeEdit(
  scheme: AxialDimensionScheme,
  command: ApplyDimensionSchemeEditInput,
): AxialDimensionScheme {
  const edited = command.type === 'candidate.display'
    ? setCandidateDisplayed(scheme, command.candidateId, command.displayed)
    : chooseChainClosure(scheme, command.chainId, command.candidateId);
  const diagnostics = validateAxialDimensionScheme(edited);
  return { ...edited, diagnostics, status: statusFromDiagnostics(diagnostics) };
}
```

Test unknown IDs, removal of a required interval, closure alternatives, arithmetic
revalidation, and immutability of the input scheme.

- [ ] **Step 8: Write the failing projection test**

```ts
it('projects geometry-owned nominal values and coefficients without tolerances', () => {
  const draft = projectAxialDimensionScheme({ scheme: resolvedScheme(), baseRevisionId: undefined });
  expect(draft.tolerances).toEqual([]);
  expect(draft.intents.every(({ nominalValue, source }) => Number.isFinite(nominalValue) && source === 'geometry')).toBe(true);
  expect(draft.chains.flatMap(({ members }) => members).every(({ coefficient }) => coefficient === 1 || coefficient === -1)).toBe(true);
});
```

- [ ] **Step 9: Implement deterministic projection**

```ts
export function projectAxialDimensionScheme(input: ProjectAxialSchemeInput): EngineeringAnnotationDraft {
  const intents = projectDisplayedAndClosureIntents(input.scheme);
  return {
    version: 1,
    drawingRef: input.scheme.drawingRef,
    datums: [],
    intents,
    tolerances: [],
    chains: projectChainEquations(input.scheme, intents),
    dependencies: projectDimensionDependencies(input.scheme, intents),
    diagnostics: input.scheme.diagnostics,
    axialScheme: input.scheme,
    ...(input.baseRevisionId === undefined ? {} : { baseRevisionId: input.baseRevisionId }),
  };
}
```

- [ ] **Step 10: Write and run the real golden semantic integration test**

```ts
it('reproduces the reviewed target scheme without runtime fixture constants', async () => {
  const input = await analyzeGoldenInitialDrawing();
  const generic = inferAxialDimensionScheme({ topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });
  expect(generic.status).toBe('needs-review');
  expect(generic.diagnostics.map(({ code }) => code)).toContain('DIMENSION_DOCUMENT_DISPLAY_CONFLICT');
  const scheme = inferAxialDimensionScheme({ topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1 });
  expect(sortIntervals(toCoordinateIntervals(scheme.displayedCandidateIds, scheme))).toEqual(sortIntervals(manifest.displayedIntervals));
  expect(sortIntervals(toCoordinateIntervals(scheme.closureCandidateIds, scheme))).toEqual(sortIntervals(manifest.closureIntervals));
  expect(scheme.diagnostics.map(({ code }) => code)).toContain('DIMENSION_DOCUMENT_DISPLAY_CONFLICT');
});
```

Run: `pnpm --filter @vectorai/engineering-annotation test && pnpm --filter @vectorai/engineering-annotation check`

Expected: PASS.

- [ ] **Step 11: Add a source guard against golden overfitting**

The test reads production files under `src/dimension-inference`, excluding tests,
and fails if it finds fixture filenames/digests or numeric decision constants in
policy/inference modules:

```ts
expect(runtimeSource).not.toMatch(/样本图001|golden-shaft-001|closure\s*[:=]\s*(3\.5|23|39)\b/);
```

- [ ] **Step 12: Commit the inference engine**

```bash
git add packages/engineering-annotation/src/dimension-inference packages/engineering-annotation/src/index.ts
git commit -m "feat: infer hierarchical axial dimension chains"
```

---

### Task 5: Strict Contracts and Scheme-Aware Dimension Plan Lifecycle

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/engineering-annotation/src/dimension/types.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts`

**Interfaces:**
- Consumes: `AxialDimensionScheme` from Task 4.
- Produces:
  - optional `EngineeringAnnotationDraft.axialScheme`;
  - `DimensionSchemeEditCommand`;
  - `DimensionPlanStore.editScheme(sessionId, command)`;
  - existing snapshot lifecycle with strict schema round trips.

- [ ] **Step 1: Write failing strict-schema tests**

```ts
it('round-trips a dimension plan with an axial inference scheme', () => {
  expect(dimensionPlanSessionSnapshotSchema.parse(snapshotWithAxialScheme())).toEqual(snapshotWithAxialScheme());
});

it('rejects model-supplied coordinates in a display toggle edit', () => {
  expect(() => dimensionSchemeEditCommandSchema.parse({
    type: 'candidate.display', candidateId: 'candidate:1', displayed: true, coordinate: 41.5,
    expectedDrawingRef: ref,
  })).toThrow();
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run: `pnpm --filter @vectorai/plugin-space-contracts test -- index.test.ts`

Expected: FAIL because the scheme schemas are absent.

- [ ] **Step 3: Add strict Zod schemas and the optional draft field**

```ts
export const dimensionSchemeEditCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('candidate.display'), candidateId: idSchema, displayed: z.boolean(), expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('closure.choose'), chainId: idSchema, candidateId: idSchema, expectedDrawingRef: drawingRefSchema }).strict(),
]);

export const engineeringAnnotationDraftSchema = z.object({
  version: z.literal(1),
  drawingRef: drawingRefSchema,
  datums: z.array(engineeringDatumSchema),
  intents: z.array(dimensionIntentSchema),
  tolerances: z.array(toleranceSpecSchema),
  chains: z.array(dimensionChainSchema),
  dependencies: z.array(annotationDependencySchema),
  diagnostics: z.array(engineeringDiagnosticSchema),
  axialScheme: axialDimensionSchemeSchema.optional(),
  baseRevisionId: idSchema.optional(),
}).strict();
```

Keep `version: 1`; the new field is optional so existing persisted plans remain
valid.

- [ ] **Step 4: Write failing store edit/undo/confirm tests**

```ts
it('edits an inferred candidate and restores it through undo and redo', () => {
  store.begin('s1', ref);
  store.setDraft('s1', inferredDraft());
  store.editScheme('s1', { type: 'candidate.display', candidateId: 'candidate:local', displayed: false, expectedDrawingRef: ref });
  expect(store.get('s1').draft?.axialScheme?.displayedCandidateIds).not.toContain('candidate:local');
  expect(store.undo('s1', ref).draft?.axialScheme?.displayedCandidateIds).toContain('candidate:local');
  expect(store.redo('s1', ref).draft?.axialScheme?.displayedCandidateIds).not.toContain('candidate:local');
});
```

- [ ] **Step 5: Implement scheme edits by revalidating and reprojecting**

```ts
editScheme(sessionId: string, command: DimensionSchemeEditCommand): DimensionPlanSessionSnapshot {
  const state = this.#envelope(sessionId);
  requireRef(state.snapshot, command.expectedDrawingRef);
  if (!state.snapshot.draft?.axialScheme) throw new Error('DIMENSION_SCHEME_DRAFT_REQUIRED');
  const scheme = applyDimensionSchemeEdit(state.snapshot.draft.axialScheme as AxialDimensionScheme, command);
  const draft = projectAxialDimensionScheme({ scheme, baseRevisionId: state.snapshot.draft.baseRevisionId });
  return this.setDraft(sessionId, draft);
}
```

`closure.choose` must replace exactly one closure in the named chain, mark the old
choice as an alternative, recompute display/closure IDs, and rerun validation.

- [ ] **Step 6: Make confirmation block unresolved ambiguity and stale schemes**

```ts
if (draft.axialScheme?.status === 'needs-review' || draft.axialScheme?.status === 'conflict' || draft.axialScheme?.status === 'stale') {
  diagnostics.push(problem('DIMENSION_SCHEME_UNRESOLVED', draft.axialScheme.inputDigest));
}
```

- [ ] **Step 7: Run contract and store suites**

Run: `pnpm --filter @vectorai/plugin-space-contracts test && pnpm --filter @vectorai/plugin-dsh-annotation-host test -- dimension-plan-store.test.ts`

Expected: PASS, including legacy plans with no `axialScheme`.

- [ ] **Step 8: Commit contracts and lifecycle**

```bash
git add packages/plugin-space-contracts packages/engineering-annotation/src/dimension/types.ts packages/plugin-dsh-annotation-host/src/dimension-plan-store.ts packages/plugin-dsh-annotation-host/src/dimension-plan-store.test.ts
git commit -m "feat: persist editable inferred dimension schemes"
```

---

### Task 6: Explicit Host Workflow, DSH Tools, and Typert Remotes

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/dimension-inference-service.ts`
- Create: `packages/plugin-dsh-annotation-host/src/dimension-inference-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/tools.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/index.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/remote.test.ts`

**Interfaces:**
- Consumes: current drawing snapshot, current partition draft/revision, staged engineering text, inference engine, and `DimensionPlanStore`.
- Produces host methods:
  - `startDimensionChain(agent, policyId?): DimensionPlanSessionSnapshot`
  - `getDimensionPlan(agent): DimensionPlanSessionSnapshot`
  - `editDimensionScheme(agent, command): DimensionPlanSessionSnapshot`
  - `confirmDimensionPlan`, `cancelDimensionPlan`, `undoDimensionPlan`, `redoDimensionPlan`.

- [ ] **Step 1: Add a read-only staged-document accessor with isolation tests**

```ts
getStagedEngineeringText(agent: Agent): string | undefined {
  const snapshot = this.space.getSnapshot(agent);
  const staged = this.#stagedDocuments.get(String(agent.id));
  if (!snapshot || !staged || (staged.drawingRef && !sameDrawing(staged.drawingRef, snapshot.ref))) return undefined;
  return staged.entries.map(({ name, text }) => `===== ENGINEERING DOCUMENT: ${name} =====\n${text}\n===== END ENGINEERING DOCUMENT: ${name} =====`).join('\n');
}
```

Test that a document staged for another session or another drawing is never
returned.

- [ ] **Step 2: Write failing host workflow tests**

```ts
it('starts only when invoked and uses the current partition revision', () => {
  const service = fixtureService();
  expect(service.getState(agent).phase).toBe('idle');
  const result = service.start(agent, 'shaft-reference-terminal-closure-v1');
  expect(result.phase).toBe('editing');
  expect(result.draft?.axialScheme?.partitionRevisionId).toBe('partition:r1');
});

it('rejects a missing drawing or partition without fabricating topology', () => {
  expect(() => fixtureService({ partition: undefined }).start(agent)).toThrow('DIMENSION_PARTITION_REQUIRED');
});
```

- [ ] **Step 3: Implement `DimensionInferenceService.start`**

```ts
start(agent: Agent, policyId: AxialInferencePolicy['id'] = 'shaft-hierarchical-dimensioning-v1'): DimensionPlanSessionSnapshot {
  const sessionId = String(agent.id);
  const drawing = this.space.getSnapshot(agent);
  if (!drawing) throw new Error('DRAWING_REQUIRED');
  const partition = this.partitions.get(sessionId);
  const partitionValue = partition.draft ?? partition.confirmed;
  if (!partitionValue) throw new Error('DIMENSION_PARTITION_REQUIRED');
  assertSameDrawing(drawing.ref, partitionValue.drawingRef);
  const document = parseEngineeringDocument(this.partitionWorkflow.getStagedEngineeringText(agent) ?? '');
  const topology = buildAxialTopology({ partition: partitionValue as PartitionDraft | PartitionRevision, unit: document.drawing.unit });
  const candidateSet = generateAxialDimensionCandidates({ topology, partition: partitionValue as PartitionDraft | PartitionRevision, document });
  const scheme = inferAxialDimensionScheme({ topology, candidateSet, policy: policyById(policyId), partitionRevisionId: partition.confirmed?.id });
  this.plans.begin(sessionId, drawing.ref);
  return this.plans.setDraft(sessionId, projectAxialDimensionScheme({ scheme }));
}
```

- [ ] **Step 4: Write failing tool-intent tests**

```ts
it('registers an explicit dimension-chain tool with no numeric arguments', () => {
  expect(tool.name).toBe('drawing_dimension_chain_start');
  expect(tool.parameters).toEqual({ policy: expect.any(Object) });
});

it('does not route document upload or opening-angle annotation into dimension inference', async () => {
  await openingAngleTool.execute({}, exec);
  expect(dimensionInference.start).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Register explicit start/status tools**

```ts
export function createDimensionChainStartTool(workflow: Pick<DimensionInferenceService, 'start'>) {
  return defineTool({
    name: 'drawing_dimension_chain_start',
    description: 'Start axial nominal dimension-chain inference only when the user explicitly asks for a dimension chain or an annotation workflow that requires one. Never call this merely because a DXF or document was uploaded. Local geometry owns all coordinates and arithmetic.',
    parameters: {
      policy: { type: 'string', enum: ['shaft-hierarchical-dimensioning-v1', 'shaft-reference-terminal-closure-v1'] },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute(args, exec) {
      if (!exec.agent) throw new Error('DRAWING_SESSION_REQUIRED');
      return summarizeDimensionPlan(workflow.start(exec.agent, args.policy));
    },
  });
}
```

- [ ] **Step 6: Add strict remotes and descriptors**

Add `getDimensionPlan`, `editDimensionScheme`, `confirmDimensionPlan`,
`cancelDimensionPlan`, `undoDimensionPlan`, and `redoDimensionPlan` to the Typert
namespace. Each descriptor uses `dimensionPlanSessionSnapshotSchema`; edits use
`dimensionSchemeEditCommandSchema`; all lifecycle actions require `DrawingRef`.

- [ ] **Step 7: Mark plans stale when partition boundaries or drawing revision change**

```ts
if (dimensionPlan.draft?.axialScheme && partitionRevisionChanged(dimensionPlan.draft.axialScheme, partitionSnapshot)) {
  this.dimensionPlans.markNeedsRebase(sessionId, currentDrawingRef);
}
```

Do this from partition edit/confirm and drawing-revision advancement paths; do not
silently rerun inference.

- [ ] **Step 8: Run host, contracts, and remote tests**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-host test && pnpm --filter @vectorai/plugin-dsh-annotation-host check && pnpm --filter @vectorai/plugin-dsh-annotation-client test -- remote.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the host workflow**

```bash
git add packages/plugin-dsh-annotation-host packages/plugin-dsh-annotation-client/src/remote.ts packages/plugin-dsh-annotation-client/src/remote.test.ts
git commit -m "feat: expose explicit dimension chain workflow"
```

---

### Task 7: Client Controller, Inspector, Canvas Overlay, and Shared Controls

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/dimension-chain-controller.ts`
- Create: `packages/plugin-dsh-annotation-client/src/dimension-chain-controller.test.ts`
- Create: `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.test.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/DimensionChainInspector.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/DimensionChainInspector.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/drawing-layers.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes: dimension-plan Typert remotes from Task 6 and `AxialDimensionScheme` from contracts.
- Produces: `DimensionChainController`, `DimensionChainOverlay`, and `DimensionChainInspector` integrated into `AnnotationWorkspace`.

- [ ] **Step 1: Write failing controller tests**

```ts
it('serializes candidate display and closure choice edits', async () => {
  await controller.actions.setDisplayed('candidate:1', false);
  await controller.actions.chooseClosure('chain:1', 'candidate:2');
  expect(remote.editDimensionScheme).toHaveBeenNthCalledWith(1, 'session:1', {
    type: 'candidate.display', candidateId: 'candidate:1', displayed: false, expectedDrawingRef: ref,
  });
  expect(remote.editDimensionScheme).toHaveBeenNthCalledWith(2, 'session:1', {
    type: 'closure.choose', chainId: 'chain:1', candidateId: 'candidate:2', expectedDrawingRef: ref,
  });
});
```

- [ ] **Step 2: Implement the controller using the partition controller queue pattern**

```ts
export interface DimensionChainControllerState {
  plan: DimensionPlanSessionSnapshot;
  busy: boolean;
  previewHeld: boolean;
  error: string | null;
}

export function createDimensionChainController(sessionId: string, remoteSource: DimensionPlanRemoteSource): DimensionChainController {
  // Use one serialized promise queue, immutable snapshots, strict remote unwrap,
  // and drawingRef-derived lifecycle commands exactly as PartitionController does.
}
```

- [ ] **Step 3: Write failing semantic overlay tests**

```tsx
it('renders displayed spans and muted dashed closures in world coordinates', () => {
  const tree = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} visible />).root;
  expect(tree.findAllByProps({ 'data-dimension-displayed': true })).toHaveLength(8);
  expect(tree.findAllByProps({ 'data-dimension-closure': true })).toHaveLength(3);
  expect(tree.findByProps({ 'data-dimension-conflict': true })).toBeDefined();
});

it('renders nothing while the layer is hidden', () => {
  expect(renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible={false} />).toJSON()).toBeNull();
});
```

- [ ] **Step 4: Implement a scale-stable overlay**

Map station scalar coordinates back through `axis.origin + axis.direction *
sourceCoordinate`. Place nested dimension lines at normal offsets derived from
chain depth. Keep strokes and handles screen-stable with `vectorEffect="non-scaling-stroke"`.

```tsx
return <g data-dimension-chain-overlay="true" pointerEvents="none">
  {displayed.map((item) => <DimensionIntervalGraphic key={item.id} interval={item} kind="displayed" scale={scale} />)}
  {closures.map((item) => <DimensionIntervalGraphic key={item.id} interval={item} kind="closure" scale={scale} />)}
</g>;
```

- [ ] **Step 5: Write failing inspector edit tests**

```tsx
it('shows decision evidence and lets the user choose an alternative closure', async () => {
  const tree = renderer.create(<DimensionChainInspector scheme={scheme} controller={controller} />).root;
  expect(tree.findByProps({ children: '文档与目标标注冲突' })).toBeDefined();
  await act(() => tree.findByProps({ 'aria-label': '选择候选闭环 23 mm' }).props.onClick());
  expect(controller.actions.chooseClosure).toHaveBeenCalledWith('chain:root', 'candidate:23');
});
```

- [ ] **Step 6: Implement the nested inspector**

The inspector shows parent equation, displayed children, closure, confidence,
diagnostics, and alternatives. Candidate display toggles and closure choices call
controller actions; no arithmetic occurs in React.

- [ ] **Step 7: Register the shared layer and compose the workspace**

```ts
export const ANNOTATION_DIMENSION_CHAIN_LAYER_ID = 'vectorai.annotation.dimension-chain';
export const ANNOTATION_DIMENSION_CHAIN_LAYER: DrawingLayerDefinition = {
  id: ANNOTATION_DIMENSION_CHAIN_LAYER_ID,
  label: '尺寸链',
  category: 'engineering',
  icon: 'dimension',
  order: 120,
  defaultVisible: true,
};
```

Add it to `DrawingLayerManager`, render `DimensionChainOverlay` inside
`DrawingSurface.worldLayers`, and place `DimensionChainInspector` in the existing
left overlay activity panel. Reuse the existing preview/cancel/confirm toolbar
design; do not add a second bottom toolbar.

- [ ] **Step 8: Bind shared cancel, preview, confirm, undo, and redo behavior**

When the dimension plan is editing, the action toolbar targets the dimension-chain
controller. Long-press preview hides partition boxes, candidate styling, closures,
and handles but retains the clean projected displayed dimensions. After confirm or
cancel, undo must restore editing state from `DimensionPlanStore`.

- [ ] **Step 9: Run client tests and visual build checks**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-client test && pnpm --filter @vectorai/plugin-dsh-annotation-client check && pnpm build:dsh-annotation`

Expected: PASS with no duplicate toolbar, no workspace layout change, and no layer
state leakage between sessions.

- [ ] **Step 10: Commit the client workflow**

```bash
git add packages/plugin-dsh-annotation-client
git commit -m "feat: preview and edit inferred dimension chains"
```

---

### Task 8: End-to-End Golden Acceptance, Regression, and Delivery

**Files:**
- Create: `scripts/e2e-golden-dimension-chain.ts`
- Modify: `package.json`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/development.md`

**Interfaces:**
- Consumes: all domain, host, contract, and client work from Tasks 1–7.
- Produces: a repeatable semantic acceptance command and updated current documentation.

- [ ] **Step 1: Write the failing E2E script around real fixtures**

```ts
const fixtureDirectory = resolve(import.meta.dirname, '../packages/engineering-annotation/test/fixtures/golden-shaft-001');
const bytes = await readFile(resolve(fixtureDirectory, 'initial.dxf'));
const engineeringText = await readFile(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(fixtureDirectory, 'manifest.json'), 'utf8')) as GoldenManifest;
const imported = importDxf({ bytes, source: { digest: 'sha256:e2e-fixture', name: 'initial.dxf' }, drawingId: 'golden-e2e', now: () => 1 });
assert.equal(imported.status, 'imported');
if (imported.status !== 'imported') process.exit(1);
const analyzed = analyzeShaftPartition({
  document: imported.document,
  drawingRef: { drawingId: 'golden-e2e', revision: 1 },
  engineeringText,
  drawingSourceName: 'initial.dxf',
});
assert.equal(analyzed.status, 'drafted');
if (analyzed.status !== 'drafted') process.exit(1);
const partition = inferRegularShaftRegions(analyzed.draft);
const parsedDocument = parseEngineeringDocument(engineeringText);
const topology = buildAxialTopology({ partition, unit: parsedDocument.drawing.unit });
const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: parsedDocument });
const scheme = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1 });
assert.deepEqual(toIntervals(scheme.displayedCandidateIds, scheme), sortIntervals(manifest.displayedIntervals));
assert.deepEqual(toIntervals(scheme.closureCandidateIds, scheme), sortIntervals(manifest.closureIntervals));
assert.equal(scheme.chains.length, 3);
assert.ok(scheme.diagnostics.some(({ code }) => code === 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT'));
assert.equal(scheme.candidates.some(({ nominalValue }) => !Number.isFinite(nominalValue)), false);
```

- [ ] **Step 2: Add the root command and verify initial failure**

```json
"e2e:golden-dimension-chain": "tsx scripts/e2e-golden-dimension-chain.ts"
```

Run: `pnpm e2e:golden-dimension-chain`

Expected before completing the script: FAIL on the first missing integration helper.

- [ ] **Step 3: Complete interval normalization using public scheme fields**

```ts
function toIntervals(ids: readonly string[], scheme: AxialDimensionScheme): Array<[number, number]> {
  const stations = new Map(scheme.topology.stations.map((station) => [station.id, station.coordinate]));
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  return ids.map((id) => {
    const candidate = candidates.get(id);
    if (!candidate) throw new Error(`missing candidate ${id}`);
    return [stations.get(candidate.startStationId)!, stations.get(candidate.endStationId)!] as [number, number];
  }).sort(([leftStart, leftEnd], [rightStart, rightEnd]) => leftStart - rightStart || leftEnd - rightEnd);
}

function sortIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  return [...intervals].sort(([leftStart, leftEnd], [rightStart, rightEnd]) => leftStart - rightStart || leftEnd - rightEnd);
}
```

The script imports all inference functions from `@vectorai/engineering-annotation`
and `importDxf` from `@vectorai/dxf-import`. It must not call private test helpers
or bypass validation.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
pnpm e2e:golden-dimension-chain
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/plugin-space-contracts test
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-client test
pnpm check
pnpm lint
pnpm test
pnpm build:dsh-annotation
```

Expected: every command exits `0`. Record exact test counts and any intentionally
skipped browser-only check in the PR body.

- [ ] **Step 5: Run local DSH smoke verification**

Start the existing local DSH app through the repository's current launcher, open a
fresh session, import `initial.dxf`, stage `engineering-data.ini`, explicitly ask
for a dimension chain, and verify:

1. no workflow starts before the explicit request;
2. the drawing and chat retain the established left/right layout;
3. the canvas shows the eight displayed intervals and three closure previews;
4. the 23-width conflict is visible;
5. choosing an alternative, cancel, confirm, undo, redo, long-press preview, and
   the `尺寸链` layer toggle behave correctly;
6. no radius, diameter, arc, angular, or numeric tolerance annotation is created.

Capture a screenshot and the relevant local host log path in the PR record.

- [ ] **Step 6: Update the current PRD and technical documentation**

Document the explicit user-intent gate, nominal-before-tolerance behavior, golden
oracle boundary, policy profiles, ambiguity handling, and the exact acceptance
command. Do not resurrect superseded migration documents.

- [ ] **Step 7: Commit acceptance and documentation**

```bash
git add scripts/e2e-golden-dimension-chain.ts package.json docs
git commit -m "test: verify golden dimension chain workflow"
```

- [ ] **Step 8: Inspect the final branch and open one PR**

```bash
git status --short
git log --oneline main..HEAD
git diff --check main...HEAD
git diff --stat main...HEAD
git push -u origin codex/golden-dimension-chain-inference
gh pr create --base main --head codex/golden-dimension-chain-inference --title "Infer axial dimension chains from golden evidence" --body '## Summary
- infer nominal axial dimension schemes from topology and engineering evidence
- preserve ambiguity and document/display conflicts for review
- add editable DSH preview backed by the existing dimension-plan lifecycle

## Verification
- pnpm e2e:golden-dimension-chain
- pnpm test
- pnpm check
- pnpm lint
- pnpm build:dsh-annotation'
```

Expected: clean worktree, reviewable commits, and one PR containing the design,
implementation, tests, and verification evidence.

- [ ] **Step 9: Merge after checks pass, following the user's standing instruction**

```bash
gh pr checks --watch
gh pr merge --merge --delete-branch
git switch main
git pull --ff-only
```

Expected: remote `main` contains the feature and the feature branch is deleted.
