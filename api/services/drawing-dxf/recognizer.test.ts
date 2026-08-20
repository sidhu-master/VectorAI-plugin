import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseEngineeringDocument } from './engineering-document';
import { projectDxfToDrawing } from './projector';
import { parseAsciiDxf } from './raw-parser';
import { recognizeDxfFacts } from './recognizer';

describe('recognizeDxfFacts', () => {
  it('confirms only fully corroborated regions and preserves real document conflicts', async () => {
    const [dxf, companion] = await Promise.all([
      readFile(resolve(process.cwd(), '样本图001.dxf'), 'utf8'),
      readFile(resolve(process.cwd(), '样本图001# DXF工程数据文档.txt'), 'utf8'),
    ]);
    const manifest = parseAsciiDxf(dxf);
    const projection = projectDxfToDrawing(manifest, { sourceId: 'source_sample' });

    const recognition = recognizeDxfFacts({
      sourceId: 'source_sample',
      manifest,
      projection,
      engineeringDocument: parseEngineeringDocument(companion),
      engineeringSourceId: 'source_document',
    });

    expect(recognition.unit).toBe('mm');
    expect(recognition.mainAxis).toMatchObject({
      direction: [1, 0],
      y: 635.1574874077739,
      status: 'confirmed',
    });
    expect(recognition.overallLength).toBeCloseTo(173, 6);
    expect(recognition.regions.map((region) => [region.id, region.status]))
      .toEqual([
        ['G01', 'conflict'],
        ['S01', 'conflict'],
        ['B01', 'confirmed'],
        ['B02', 'candidate'],
      ]);
    expect(recognition.regions.find((region) => region.id === 'G01')?.reasons.join(' '))
      .toContain('119.5');
    expect(recognition.regions.find((region) => region.id === 'S01')?.reasons.join(' '))
      .toMatch(/44\.5/);
    expect(recognition.features.find((feature) => feature.semanticType === 'engineering-region'
      && feature.properties.regionId === 'B01')?.quality.status).toBe('confirmed');
    expect(recognition.features.find((feature) => feature.semanticType === 'engineering-region'
      && feature.properties.regionId === 'G01')?.properties.recognitionStatus).toBe('conflict');
  });

  it('still produces source facts and a bounded candidate axis without a companion document', async () => {
    const dxf = await readFile(resolve(process.cwd(), '初始图.dxf'), 'utf8');
    const manifest = parseAsciiDxf(dxf);
    const projection = projectDxfToDrawing(manifest, { sourceId: 'source_initial' });

    const recognition = recognizeDxfFacts({
      sourceId: 'source_initial', manifest, projection,
    });

    expect(recognition.overallLength).toBeCloseTo(173, 6);
    expect(recognition.features.some((feature) => feature.semanticType === 'dxf-import')).toBe(true);
    expect(recognition.geometry).toEqual([
      expect.objectContaining({ type: 'xline', quality: expect.objectContaining({ status: 'candidate' }) }),
    ]);
    expect(recognition.regions).toEqual([]);
  });
});
