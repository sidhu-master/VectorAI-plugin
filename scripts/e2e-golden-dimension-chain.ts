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
  SHAFT_HIERARCHICAL_DIMENSIONING_V1,
} from '../packages/engineering-annotation/src/index';
import { importDxf } from '../packages/dxf-import/src/index';

const fixtureDirectory = resolve(import.meta.dirname, '../packages/engineering-annotation/test/fixtures/golden-shaft-001');
const [bytes, engineeringText] = await Promise.all([
  readFile(resolve(fixtureDirectory, 'initial.dxf')),
  readFile(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8'),
]);
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
  policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
});

assert(scheme.chains.length > 0);
assert.equal(scheme.closureCandidateIds.length, scheme.chains.length);
assert.equal(scheme.candidates.some(({ nominalValue }) => !Number.isFinite(nominalValue)), false);
console.log(JSON.stringify({
  status: scheme.status,
  displayedCandidateCount: scheme.displayedCandidateIds.length,
  closureCandidateCount: scheme.closureCandidateIds.length,
  chainCount: scheme.chains.length,
  diagnostics: scheme.diagnostics.map(({ code }) => code),
}, null, 2));
