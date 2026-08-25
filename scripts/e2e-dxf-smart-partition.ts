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
assert.equal(state.phase, 'editing');
assert(state.draft);
const reviewed = state.draft as unknown as PartitionDraft;
assert.equal(validatePartition(reviewed).length, 0);
assert.equal(annotations.get('e2e').workspaceClaimed, true);
const lifecycle: string[] = [state.phase];
const boundary = reviewed.segments[0]!.zEnd;
state = service.edit(agent, { type: 'boundary.move', expectedDrawingRef: snapshot.ref, boundaryIndex: 1, requestedZ: boundary + 0.1, snapTolerance: 0.5 });
state = service.confirm(agent, snapshot.ref); lifecycle.push(state.phase);
state = service.undo(agent, snapshot.ref); lifecycle.push(state.phase);
state = service.redo(agent, snapshot.ref); lifecycle.push(state.phase);
state = service.undo(agent, snapshot.ref); lifecycle.push(state.phase);
assert.deepEqual(lifecycle, ['editing', 'confirmed', 'editing', 'confirmed', 'editing']);
const noDocument = analyzeShaftPartition({ document: snapshot.document, drawingRef: snapshot.ref });
assert.equal(noDocument.status, 'drafted');
if (noDocument.status !== 'drafted') throw new Error('NO_DOCUMENT_ANALYSIS_FAILED');
assert(noDocument.unclassifiedSegmentIds.every((id) => noDocument.draft.segments.some((segment) => segment.id === id)));
const drawingDigestAfter = hash(drawings.getSnapshot('e2e')!.document.geometry);
assert.equal(drawingDigestAfter, drawingDigestBefore);
const origins = reviewed.evidence.reduce<Record<EvidenceOrigin, number>>((counts, evidence) => {
  counts[evidence.origin] += 1; return counts;
}, { document: 0, geometry: 0, fused: 0, ai: 0, manual: 0 });
const manifest = {
  drawingRef: snapshot.ref,
  entityCounts: [...snapshot.document.geometry, ...snapshot.document.annotations].reduce<Record<string, number>>((counts, node) => {
    const type = node.sourceRef?.objectType ?? node.type; counts[type] = (counts[type] ?? 0) + 1; return counts;
  }, {}),
  axisLength: reviewed.axis.zMax - reviewed.axis.zMin,
  segmentCount: reviewed.segments.length,
  coveredLength: reviewed.segments.reduce((sum, segment) => sum + segment.zEnd - segment.zStart, 0),
  documentedGroups: reviewed.semanticGroups.filter((group) => group.evidenceIds.some((id) => id.startsWith('document:'))).map(({ name }) => name),
  origins,
  diagnosticCodes: reviewed.diagnostics.map(({ code }) => code),
  lifecycle,
  drawingGeometryDigest: drawingDigestAfter,
};
assert(Math.abs(manifest.axisLength - 173) < 0.001);
assert(manifest.segmentCount > 4);
assert(Math.abs(manifest.coveredLength - manifest.axisLength) < 1e-6);
console.log(JSON.stringify(manifest, null, 2));

function hash(value: unknown): string { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
