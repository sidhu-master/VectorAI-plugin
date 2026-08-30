// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from 'node:assert';
import {
  createEmptyDrawing,
  exportDrawingDxf,
  type GeometryId,
} from '../packages/drawing-core/src/index';
import {
  analyzeDimensionChain,
  orderDimensionIntents,
  projectEngineeringAnnotations,
  resolveToleranceSpec,
  type DimensionFunctionalRole,
  type DimensionIntent,
  type EngineeringAnnotationDraft,
  type ToleranceRuleProvider,
  type ToleranceSpec,
} from '../packages/engineering-annotation/src/index';
import {
  DimensionPlanStore,
  type DimensionPlanStorage,
} from '../packages/plugin-dsh-annotation-host/src/dimension-plan-store';

class JsonMemoryStorage implements DimensionPlanStorage {
  readonly #values = new Map<string, string>();
  load(sessionId: string): unknown | null {
    const value = this.#values.get(sessionId);
    return value === undefined ? null : JSON.parse(value);
  }
  save(sessionId: string, value: unknown): void {
    this.#values.set(sessionId, JSON.stringify(value));
  }
}

const drawingRef = { drawingId: 'drawing-tolerance-e2e', revision: 1 };
const intent = (id: string, functionalRole: DimensionFunctionalRole, nominalValue: number): DimensionIntent => ({
  id,
  drawingRef,
  kind: 'linear',
  targets: [{ geometryId: `line-${id}` as GeometryId, anchor: { kind: 'end' } }],
  datumIds: [],
  nominalValue,
  unit: 'mm',
  functionalRole,
  source: 'manual',
  status: 'confirmed',
  evidenceIds: [`manual:${id}`],
});
const intents = [
  intent('closure', 'closure', 20),
  intent('component', 'process', 20),
  intent('overall', 'overall', 40),
  intent('datum', 'datum', 0),
];
const provider: ToleranceRuleProvider = {
  listRules: () => [{
    id: 'fixture-shaft-tolerance', version: '1', inputSchema: { grade: 'string' }, outputModes: ['bilateral'],
  }],
  evaluate: () => ({ mode: 'bilateral', upperDeviation: 0.02, lowerDeviation: -0.01 }),
};
const unresolved: ToleranceSpec = {
  id: 'tolerance-component',
  dimensionIntentId: 'component',
  mode: 'formula',
  source: 'enterprise-rule',
  ruleRef: { id: 'fixture-shaft-tolerance', version: '1' },
  inputs: { grade: 'A' },
  status: 'candidate',
  evidenceIds: ['fixture:rule'],
  diagnostics: [],
};
const resolved = resolveToleranceSpec({
  intent: intents.find(({ id }) => id === 'component')!,
  spec: unresolved,
  provider,
  now: () => 7,
});
assert.deepEqual(resolved.diagnostics, []);
assert.match(resolved.spec.resolved!.inputDigest, /^sha256:[0-9a-f]{64}$/);
const closureTolerance: ToleranceSpec = {
  id: 'tolerance-closure',
  dimensionIntentId: 'closure',
  mode: 'bilateral',
  source: 'manual',
  inputs: {},
  resolved: {
    upperDeviation: 0.03,
    lowerDeviation: -0.02,
    inputDigest: 'manual:closure',
    evaluatedAt: 7,
  },
  status: 'confirmed',
  evidenceIds: ['manual:closure-tolerance'],
  diagnostics: [],
};
const draft: EngineeringAnnotationDraft = {
  version: 1,
  drawingRef,
  datums: [],
  intents,
  tolerances: [resolved.spec, closureTolerance],
  geometricTolerances: [],
  chains: [{
    id: 'chain-main', drawingRef, name: '主尺寸链', datumIds: [],
    members: [
      { dimensionIntentId: 'component', coefficient: 1, role: 'component' },
      { dimensionIntentId: 'closure', coefficient: -1, role: 'closure' },
    ],
    equation: { closureIntentId: 'closure', targetValue: 0 },
    analysisMode: 'worst-case', status: 'confirmed', evidenceIds: ['manual:chain-main'], diagnostics: [],
  }],
  dependencies: [
    { beforeIntentId: 'datum', afterIntentId: 'overall', reason: 'datum-before-dependent', evidenceIds: ['manual:order-1'] },
    { beforeIntentId: 'overall', afterIntentId: 'component', reason: 'overall-before-functional', evidenceIds: ['manual:order-2'] },
    { beforeIntentId: 'component', afterIntentId: 'closure', reason: 'component-before-closure', evidenceIds: ['manual:order-3'] },
  ],
  diagnostics: [],
};

const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
assert.deepEqual(order.diagnostics, []);
assert.deepEqual(order.orderedIntentIds, ['datum', 'overall', 'component', 'closure']);
const chain = analyzeDimensionChain({ chain: draft.chains[0]!, intents: draft.intents, tolerances: draft.tolerances });
assert.deepEqual(chain.diagnostics, []);
assert.equal(chain.nominalClosure, 0);
assert.equal(chain.lowerDeviation, -0.04);
assert.equal(chain.upperDeviation, 0.04);

const projection = projectEngineeringAnnotations({
  draft,
  orderedIntentIds: order.orderedIntentIds,
  existingAnnotations: [],
});
assert.deepEqual(projection.diagnostics, []);
const componentAnnotation = projection.annotations.find(({ engineeringIntentId }) => engineeringIntentId === 'component');
assert(componentAnnotation?.toleranceProjection?.ruleRef);
assert.deepEqual(componentAnnotation.toleranceProjection.ruleRef, {
  id: 'fixture-shaft-tolerance',
  version: '1',
  inputDigest: resolved.spec.resolved!.inputDigest,
});

const document = createEmptyDrawing({ idFactory: { next: () => drawingRef.drawingId }, now: () => 1 });
document.geometry = intents.map((item, index) => ({
  id: `line-${item.id}` as GeometryId,
  type: 'line' as const,
  start: [0, index * 10] as const,
  end: [item.nominalValue, index * 10] as const,
  visible: true,
  quality: { status: 'confirmed' as const, evidenceRefs: [] },
}));
document.annotations = projection.annotations;
const serializedDrawing = JSON.stringify(document);
assert(!serializedDrawing.includes('formulaSource'));
const dxf = exportDrawingDxf(document);
assert(dxf.includes('1\r\n20 +0.02/-0.01'));

const storage = new JsonMemoryStorage();
const firstStore = new DimensionPlanStore(storage, { now: () => 11, id: () => 'revision-e2e' });
firstStore.begin('session-e2e', drawingRef);
firstStore.setDraft('session-e2e', draft);
const confirmed = firstStore.confirm('session-e2e', drawingRef);
assert.equal(confirmed.phase, 'confirmed');
const restoredStore = new DimensionPlanStore(storage, { now: () => 12, id: () => 'unused' });
assert.equal(restoredStore.get('session-e2e').confirmed?.id, 'revision-e2e');
const undone = restoredStore.undo('session-e2e', drawingRef);
assert.equal(undone.phase, 'editing');
restoredStore.setDraft('session-e2e', { ...draft, diagnostics: [] });
const canceled = restoredStore.cancel('session-e2e', drawingRef);
assert.equal(canceled.phase, 'confirmed');
assert.equal(canceled.confirmed?.id, 'revision-e2e');

console.log(JSON.stringify({
  orderedIntentIds: order.orderedIntentIds,
  toleranceRule: componentAnnotation.toleranceProjection.ruleRef,
  chain: {
    nominalClosure: chain.nominalClosure,
    lowerDeviation: chain.lowerDeviation,
    upperDeviation: chain.upperDeviation,
  },
  projectedAnnotations: projection.annotations.length,
  dxfToleranceRendered: true,
  lifecycle: ['confirmed', undone.phase, canceled.phase],
}, null, 2));
