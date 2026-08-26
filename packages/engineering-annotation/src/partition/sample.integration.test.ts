// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { importDxf } from '@vectorai/dxf-import';
import { describe, expect, it } from 'vitest';
import { analyzeShaftPartition, validatePartition } from '../index';

describe('real DXF smart partition', () => {
  it('retains bilateral shoulders that straddle a tolerance bucket boundary', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft.dxf'));
    const engineeringText = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft-engineering.ini'), 'utf8');
    const imported = importDxf({ bytes, source: { digest: 'sha256:fixture', name: 'initial-shaft.dxf' }, drawingId: 'drawing-real', now: () => 1 });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;

    const result = analyzeShaftPartition({
      document: imported.document,
      drawingRef: { drawingId: 'drawing-real', revision: 1 },
      engineeringText,
      drawingSourceName: 'initial-shaft.dxf',
    });
    expect(result.status).toBe('drafted');
    if (result.status !== 'drafted') return;

    const accepted = result.draft.stepCandidates.filter(({ accepted }) => accepted).map(({ z }) => z);
    expect(accepted).toContainEqual(expect.closeTo(41.5, 3));
    expect(accepted).toContainEqual(expect.closeTo(45, 3));
    const spline = result.draft.segments.find(({ name }) => name === '外花键');
    expect(spline).toBeDefined();
    expect(spline!.zEnd - spline!.zStart).toBeCloseTo(24.5, 3);
  });

  it('covers every geometric shaft segment and overlays the partial document', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft.dxf'));
    const engineeringText = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft-engineering.ini'), 'utf8');
    const imported = importDxf({ bytes, source: { digest: 'sha256:fixture', name: 'initial-shaft.dxf' }, drawingId: 'drawing-real', now: () => 1 });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    const result = analyzeShaftPartition({
      document: imported.document,
      drawingRef: { drawingId: 'drawing-real', revision: 1 },
      engineeringText,
      drawingSourceName: 'initial-shaft.dxf',
    });
    expect(result.status).toBe('drafted');
    if (result.status !== 'drafted') return;
    expect(result.draft.axis.zMax - result.draft.axis.zMin).toBeCloseTo(173, 3);
    expect(result.draft.segments.length).toBeGreaterThan(4);
    expect(result.draft.segments[0]?.zStart).toBeCloseTo(result.draft.axis.zMin, 6);
    expect(result.draft.segments.at(-1)?.zEnd).toBeCloseTo(result.draft.axis.zMax, 6);
    expect(result.draft.semanticGroups.map(({ name }) => name)).toEqual(expect.arrayContaining(['一级齿轮', '外花键', '左轴承位', '右轴承位']));
    expect(result.unclassifiedSegmentIds.length).toBeGreaterThan(0);
    expect(result.draft.diagnostics).toContainEqual(expect.objectContaining({ code: 'DOCUMENT_DRAWING_NAME_MISMATCH', severity: 'warning' }));
    expect(validatePartition(result.draft)).toEqual([]);
  });

  it('keeps a no-document run editable and fully geometry partitioned', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft.dxf'));
    const imported = importDxf({ bytes, source: { digest: 'sha256:fixture' }, drawingId: 'drawing-real', now: () => 1 });
    if (imported.status !== 'imported') throw new Error('fixture rejected');
    const result = analyzeShaftPartition({ document: imported.document, drawingRef: { drawingId: 'drawing-real', revision: 1 } });
    expect(result.status).toBe('drafted');
    if (result.status === 'drafted') expect(result.unclassifiedSegmentIds).toEqual(result.draft.segments.map(({ id }) => id));
  });
});
