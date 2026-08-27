// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeShaftPartition, validatePartition, type EvidenceOrigin, type PartitionDraft } from '../packages/engineering-annotation/src/index';
import { InMemoryDrawingRepository } from '../packages/plugin-dsh-space-host/src/repository';
import { AnnotationSessionStateStore } from '../packages/plugin-dsh-annotation-host/src/session-state';
import { PartitionWorkflowService } from '../packages/plugin-dsh-annotation-host/src/partition-service';
import { PartitionSessionStore } from '../packages/plugin-dsh-annotation-host/src/partition-store';
import { createHatchRenderPlan, normalizeHatchRegion } from '../packages/drawing-hatch/src/index';

const dxfPath = resolve('packages/dxf-import/test/fixtures/initial-shaft.dxf');
const documentPath = resolve('packages/dxf-import/test/fixtures/initial-shaft-engineering.ini');
const [bytes, documentBytes] = await Promise.all([readFile(dxfPath), readFile(documentPath)]);
const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const documentDigest = `sha256:${createHash('sha256').update(documentBytes).digest('hex')}`;
const drawings = new InMemoryDrawingRepository({ vectorizer: { async vectorize() { throw new Error('IMAGE_VECTORIZER_MUST_NOT_RUN'); } }, now: () => 1 });
const agent = { id: 'e2e' } as Parameters<PartitionWorkflowService['importAndAnalyze']>[0];
const partitions = new PartitionSessionStore(undefined, { now: () => 7, id: () => 'partition:e2e' });
const annotations = new AnnotationSessionStateStore(undefined, { now: () => 7 });
const service = new PartitionWorkflowService({
  importDxf: async (_agent, input, signal) => drawings.importDxf('e2e', { ...input, signal }),
  getSnapshot: () => drawings.getSnapshot('e2e'),
  renderObservation: async () => { throw new Error('OBSERVATION_MUST_NOT_RUN'); },
}, partitions, annotations);
let state = await service.importAndAnalyze(agent, {
  dxf: { name: 'initial-shaft.dxf', digest, base64: bytes.toString('base64') },
  engineeringDocuments: [{
    name: '样本图001# DXF工程数据文档.txt',
    mediaType: 'text/plain',
    digest: documentDigest,
    base64: documentBytes.toString('base64'),
  }],
});
const snapshot = drawings.getSnapshot('e2e');
assert(snapshot);
const drawingDigestBefore = hash(snapshot.document.geometry);
const hatches = snapshot.document.annotations.filter((annotation) => annotation.type === 'section-hatch');
assert.equal(hatches.length, 2);
for (const hatchNode of hatches) {
  assert(hatchNode.hatch);
  assert.equal(hatchNode.pattern, 'ANSI31');
  assert(Math.abs(hatchNode.spacing - 3.175) < 1e-9);
  assert.equal(normalizeHatchRegion(hatchNode.hatch, 0.0001).status, 'ok');
  const plan = createHatchRenderPlan(hatchNode.hatch, 0.0001);
  if (plan.status !== 'ok') throw new Error(plan.code);
  const angle = (hatchNode.hatch.patternLines[0]!.angle + hatchNode.hatch.patternAngle) * Math.PI / 180;
  const normal: [number, number] = [-Math.sin(angle), Math.cos(angle)];
  const projections = plan.plan.lines.map(({ start }) => start[0] * normal[0] + start[1] * normal[1]).sort((a, b) => a - b);
  assert(projections.slice(1).every((projection, index) => Math.abs(projection - projections[index]! - 3.175) < 1e-6));
}
assert.equal(state.phase, 'editing');
assert(state.draft);
const reviewed = state.draft as unknown as PartitionDraft;
assert.equal(validatePartition(reviewed).length, 0);
const functionalRanges = reviewed.semanticGroups
  .filter((group) => group.evidenceIds.some((id) => id.startsWith('document:')))
  .map(({ name, range }) => [name, range?.zStart, range?.zEnd] as const)
  .sort((a, b) => Number(a[1]) - Number(b[1]));
assert.deepEqual(functionalRanges, [
  ['左轴承位', 0, 17],
  ['外花键', 17, 41.5],
  ['一级齿轮', 63.5, 118.5],
  ['右轴承位', 150, 173],
]);
assert(functionalRanges.some((range, index) => index > 0 && Number(range[1]) > Number(functionalRanges[index - 1]![2])));
assert.equal(annotations.get('e2e').workspaceClaimed, true);
const lifecycle: string[] = [state.phase];
const boundary = reviewed.segments[0]!.zEnd;
const gear = reviewed.semanticGroups.find(({ name }) => name === '一级齿轮')!;
state = service.edit(agent, { type: 'semantic-range.move', expectedDrawingRef: snapshot.ref, groupId: gear.id, edge: 'start', requestedZ: 64, snapTolerance: 0 });
assert.equal(state.draft?.semanticGroups.find(({ id }) => id === gear.id)?.range?.zStart, 64);
assert.equal(state.draft?.segments[0]?.zEnd, boundary);
state = service.edit(agent, { type: 'boundary.move', expectedDrawingRef: snapshot.ref, boundaryIndex: 1, requestedZ: boundary + 0.1, snapTolerance: 0.5 });
state = service.confirm(agent, snapshot.ref); lifecycle.push(state.phase);
const confirmedRevisionId = state.confirmed!.id;
state = service.reopen(agent, snapshot.ref); lifecycle.push(state.phase);
assert.equal(state.draft?.basePartitionRevisionId, confirmedRevisionId);
state = service.edit(agent, { type: 'boundary.move', expectedDrawingRef: snapshot.ref, boundaryIndex: 1, requestedZ: boundary + 0.2, snapTolerance: 0 });
state = service.cancel(agent, snapshot.ref); lifecycle.push(state.phase);
assert.equal(state.confirmed?.id, confirmedRevisionId);
assert.deepEqual(lifecycle, ['editing', 'confirmed', 'editing', 'confirmed']);
const noDocument = analyzeShaftPartition({ document: snapshot.document, drawingRef: snapshot.ref });
assert.equal(noDocument.status, 'drafted');
if (noDocument.status !== 'drafted') throw new Error('NO_DOCUMENT_ANALYSIS_FAILED');
assert(noDocument.unclassifiedSegmentIds.every((id) => noDocument.draft.segments.some((segment) => segment.id === id)));
const drawingDigestAfter = hash(drawings.getSnapshot('e2e')!.document.geometry);
assert.equal(drawingDigestAfter, drawingDigestBefore);
const origins = reviewed.evidence.reduce<Record<EvidenceOrigin, number>>((counts, evidence) => {
  counts[evidence.origin] += 1; return counts;
}, { document: 0, geometry: 0, fused: 0, ai: 0, manual: 0 });
const stagedDrawings = new InMemoryDrawingRepository({ vectorizer: { async vectorize() { throw new Error('IMAGE_VECTORIZER_MUST_NOT_RUN'); } }, now: () => 2 });
const stagedAnnotations = new AnnotationSessionStateStore(undefined, { now: () => 8 });
const stagedService = new PartitionWorkflowService({
  importDxf: async (_agent, input, signal) => stagedDrawings.importDxf('e2e-staged', { ...input, signal }),
  getSnapshot: () => stagedDrawings.getSnapshot('e2e-staged'),
  renderObservation: async () => { throw new Error('OBSERVATION_MUST_NOT_RUN'); },
}, new PartitionSessionStore(), stagedAnnotations);
const stagedAgent = { id: 'e2e-staged' } as Parameters<PartitionWorkflowService['importDrawing']>[0];
const opened = await stagedService.importDrawing(stagedAgent, {
  name: 'initial-shaft.dxf', digest, base64: bytes.toString('base64'),
});
assert.equal(opened.phase, 'idle');
assert.equal(stagedAnnotations.get('e2e-staged').workspaceClaimed, false);
const staged = await stagedService.stageDocuments(stagedAgent, [{
  name: '样本图001# DXF工程数据文档.txt', mediaType: 'text/plain', digest: documentDigest, base64: documentBytes.toString('base64'),
}]);
assert.equal(staged.phase, 'idle');
assert.equal(stagedAnnotations.get('e2e-staged').workspaceClaimed, false);
const explicitlyStarted = await stagedService.analyzeCurrent(stagedAgent);
assert.equal(explicitlyStarted.phase, 'editing');
assert(explicitlyStarted.draft?.semanticGroups.some(({ name }) => name === '外花键'));
const manifest = {
  drawingRef: snapshot.ref,
  entityCounts: [...snapshot.document.geometry, ...snapshot.document.annotations].reduce<Record<string, number>>((counts, node) => {
    const type = node.sourceRef?.objectType ?? node.type; counts[type] = (counts[type] ?? 0) + 1; return counts;
  }, {}),
  parametricHatchCount: hatches.length,
  hatchSpacing: hatches.map(({ spacing }) => spacing),
  axisLength: reviewed.axis.zMax - reviewed.axis.zMin,
  segmentCount: reviewed.segments.length,
  coveredLength: reviewed.segments.reduce((sum, segment) => sum + segment.zEnd - segment.zStart, 0),
  documentedGroups: reviewed.semanticGroups.filter((group) => group.evidenceIds.some((id) => id.startsWith('document:'))).map(({ name }) => name),
  functionalRanges,
  origins,
  diagnosticCodes: reviewed.diagnostics.map(({ code }) => code),
  lifecycle,
  stagedIntentFlow: [opened.phase, staged.phase, explicitlyStarted.phase],
  drawingGeometryDigest: drawingDigestAfter,
};
assert(Math.abs(manifest.axisLength - 173) < 0.001);
assert(manifest.segmentCount > 4);
assert(Math.abs(manifest.coveredLength - manifest.axisLength) < 1e-6);
console.log(JSON.stringify(manifest, null, 2));

function hash(value: unknown): string { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
