// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  analyzeShaftPartition,
  buildAxialTopology,
  generateAxialDimensionCandidates,
  inferAxialDimensionScheme,
  inferRegularShaftRegions,
  parseEngineeringDocument,
  SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
  type AxialDimensionScheme,
} from '../packages/engineering-annotation/src/index';
import { importDxf } from '../packages/dxf-import/src/index';

interface GoldenManifest {
  displayedIntervals: Array<[number, number]>;
  closureIntervals: Array<[number, number]>;
}

const fixtureDirectory = resolve(import.meta.dirname, '../packages/engineering-annotation/test/fixtures/golden-shaft-001');
const [bytes, engineeringText, manifestText] = await Promise.all([
  readFile(resolve(fixtureDirectory, 'initial.dxf')),
  readFile(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8'),
  readFile(resolve(fixtureDirectory, 'manifest.json'), 'utf8'),
]);
const manifest = JSON.parse(manifestText) as GoldenManifest;
const imported = importDxf({
  bytes,
  source: { digest: 'sha256:e2e-fixture', name: 'initial.dxf' },
  drawingId: 'golden-e2e',
  now: () => 1,
});
assert.equal(imported.status, 'imported');
if (imported.status !== 'imported') throw new Error('GOLDEN_DXF_IMPORT_FAILED');
const analyzed = analyzeShaftPartition({
  document: imported.document,
  drawingRef: { drawingId: 'golden-e2e', revision: 1 },
  engineeringText,
  drawingSourceName: 'initial.dxf',
});
assert.equal(analyzed.status, 'drafted');
if (analyzed.status !== 'drafted') throw new Error('GOLDEN_PARTITION_FAILED');
const partition = inferRegularShaftRegions(analyzed.draft);
const parsedDocument = parseEngineeringDocument(engineeringText);
const topology = buildAxialTopology({ partition, unit: parsedDocument.drawing.unit ?? 'mm' });
const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: parsedDocument });
const scheme = inferAxialDimensionScheme({
  topology,
  candidateSet,
  policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
});

assert.deepEqual(toIntervals(scheme.displayedCandidateIds, scheme), sortIntervals(manifest.displayedIntervals));
assert.deepEqual(toIntervals(scheme.closureCandidateIds, scheme), sortIntervals(manifest.closureIntervals));
assert.equal(scheme.chains.length, 3);
assert(scheme.diagnostics.some(({ code }) => code === 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT'));
assert.equal(scheme.candidates.some(({ nominalValue }) => !Number.isFinite(nominalValue)), false);
assert.equal(scheme.status, 'resolved');
console.log(JSON.stringify({
  status: scheme.status,
  displayedIntervals: toIntervals(scheme.displayedCandidateIds, scheme),
  closureIntervals: toIntervals(scheme.closureCandidateIds, scheme),
  chainCount: scheme.chains.length,
  diagnostics: scheme.diagnostics.map(({ code }) => code),
}, null, 2));

function toIntervals(ids: readonly string[], value: AxialDimensionScheme): Array<[number, number]> {
  const stations = new Map(value.topology.stations.map((station) => [station.id, station.coordinate]));
  const candidates = new Map(value.candidates.map((candidate) => [candidate.id, candidate]));
  return ids.map((id) => {
    const candidate = candidates.get(id);
    if (!candidate) throw new Error(`missing candidate ${id}`);
    const start = stations.get(candidate.startStationId);
    const end = stations.get(candidate.endStationId);
    if (start === undefined || end === undefined) throw new Error(`missing station for ${id}`);
    return [start, end] as [number, number];
  }).sort(intervalOrder);
}

function sortIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  return [...intervals].sort(intervalOrder);
}

function intervalOrder([leftStart, leftEnd]: [number, number], [rightStart, rightEnd]: [number, number]): number {
  return leftStart - rightStart || leftEnd - rightEnd;
}
