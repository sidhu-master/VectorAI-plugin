import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { importDxf } from '../packages/dxf-import/src/import.ts';
import { renderDrawingObservation } from '../packages/plugin-dsh-space-host/src/review-renderer.ts';

const fixtureDirectory = resolve('packages/engineering-annotation/test/fixtures/external-golden-001');
const input = process.argv[2] ? resolve(process.argv[2]) : resolve(fixtureDirectory, 'initial.dxf');
const output = process.argv[3] ? resolve(process.argv[3]) : resolve(fixtureDirectory, 'initial-preview.png');
const bytes = await readFile(input);
const imported = importDxf({
  bytes,
  source: { digest: 'sha256:educational-shaft-preview', name: 'initial.dxf' },
  drawingId: 'drawing:educational-shaft-preview',
  now: () => 1,
});

if (imported.status !== 'imported') {
  throw new Error(`Preview import failed: ${JSON.stringify(imported.diagnostics)}`);
}

const horizontalPadding = Math.max((imported.bounds.maxX - imported.bounds.minX) * 0.04, 8);
const verticalPadding = Math.max((imported.bounds.maxY - imported.bounds.minY) * 0.12, 8);
const rendered = await renderDrawingObservation({
  document: imported.document,
  viewport: {
    minX: imported.bounds.minX - horizontalPadding,
    minY: imported.bounds.minY - verticalPadding,
    maxX: imported.bounds.maxX + horizontalPadding,
    maxY: imported.bounds.maxY + verticalPadding,
  },
});
await writeFile(output, rendered.png);

console.log(JSON.stringify({
  output,
  bounds: imported.bounds,
  counts: imported.counts,
  diagnostics: imported.diagnostics,
  digest: rendered.contentDigest,
}, null, 2));
