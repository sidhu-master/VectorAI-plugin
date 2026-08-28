// SPDX-License-Identifier: Apache-2.0

import { analyzeShaftPartition } from '../partition/analyze';
import { inferRegularShaftRegions } from '../partition/regular';
import { parseEngineeringDocument } from '../engineering-document/parser';
import { generateAxialDimensionCandidates } from './candidates';
import { loadGoldenDrawing } from './golden-fixture-test-support';
import { buildAxialTopology } from './topology';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function analyzeGoldenInferenceInput() {
  const document = await loadGoldenDrawing('initial.dxf');
  const engineeringText = await readFile(resolve(
    import.meta.dirname,
    '../../test/fixtures/golden-shaft-001/engineering-data.ini',
  ), 'utf8');
  const analyzed = analyzeShaftPartition({
    document,
    drawingRef: { drawingId: 'drawing:golden', revision: 1 },
    engineeringText,
    drawingSourceName: 'initial.dxf',
  });
  if (analyzed.status !== 'drafted') throw new Error(JSON.stringify(analyzed.diagnostics));
  const partition = inferRegularShaftRegions(analyzed.draft);
  const parsedDocument = parseEngineeringDocument(engineeringText);
  const topology = buildAxialTopology({ partition, unit: parsedDocument.drawing.unit });
  const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: parsedDocument });
  return { partition, parsedDocument, topology, candidateSet };
}
