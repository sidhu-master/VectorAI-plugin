// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeShaftPartition, applySemanticProposals, validatePartition, type EvidenceOrigin } from '../packages/engineering-annotation/src/index';
import { InMemoryDrawingRepository } from '../packages/plugin-dsh-space-host/src/repository';
import { PartitionSessionStore } from '../packages/plugin-dsh-annotation-host/src/partition-store';

const dxfPath = resolve('packages/dxf-import/test/fixtures/initial-shaft.dxf');
const documentPath = resolve('packages/dxf-import/test/fixtures/initial-shaft-engineering.ini');
const [bytes, engineeringText] = await Promise.all([readFile(dxfPath), readFile(documentPath, 'utf8')]);
const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const drawings = new InMemoryDrawingRepository({ vectorizer: { async vectorize() { throw new Error('IMAGE_VECTORIZER_MUST_NOT_RUN'); } }, now: () => 1 });
await drawings.importDxf('e2e', { bytes, digest, name: 'initial-shaft.dxf' });
const snapshot = drawings.getSnapshot('e2e');
assert(snapshot);
const drawingDigestBefore = hash(snapshot.document.geometry);
const analysis = analyzeShaftPartition({ document: snapshot.document, drawingRef: snapshot.ref, engineeringText, drawingSourceName: 'initial-shaft.dxf' });
assert.equal(analysis.status, 'drafted');
if (analysis.status !== 'drafted') throw new Error('PARTITION_ANALYSIS_FAILED');
assert.equal(validatePartition(analysis.draft).length, 0);
const proposals = analysis.unclassifiedSegmentIds.map((id, index) => ({
  segmentIds: [id], semanticType: 'unclassified-shaft-segment', name: `AI 候选 S${index + 1}`,
  confidence: 0.4, reason: 'bounded visual candidate awaiting user confirmation', visualEvidenceIds: [`observation:${id}`],
}));
const reviewed = applySemanticProposals(analysis.draft, proposals).draft;
const partitions = new PartitionSessionStore(undefined, { now: () => 7, id: () => 'partition:e2e' });
partitions.beginAnalysis('e2e', snapshot.ref);
let state = partitions.setDraft('e2e', reviewed);
const lifecycle = [state.phase];
const boundary = reviewed.segments[0]!.zEnd;
state = partitions.edit('e2e', { type: 'boundary.move', expectedDrawingRef: snapshot.ref, boundaryIndex: 1, requestedZ: boundary + 0.1, snapTolerance: 0.5 });
state = partitions.confirm('e2e', snapshot.ref); lifecycle.push(state.phase);
state = partitions.undo('e2e', snapshot.ref); lifecycle.push(state.phase);
state = partitions.redo('e2e', snapshot.ref); lifecycle.push(state.phase);
state = partitions.undo('e2e', snapshot.ref); lifecycle.push(state.phase);
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
