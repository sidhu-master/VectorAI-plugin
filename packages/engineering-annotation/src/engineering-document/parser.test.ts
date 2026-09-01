// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEngineeringDocument } from '../index';

describe('engineering document parser', () => {
  it('parses the approved partial real document with source evidence', async () => {
    const text = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft-engineering.ini'), 'utf8');
    const parsed = parseEngineeringDocument(text);
    expect(parsed.drawing).toMatchObject({ unit: 'mm', axisOrigin: 'left_end', orientation: 'auto', drawingName: '样本图001.dxf' });
    expect(parsed.regions.map(({ id, interval }) => [id, interval?.start, interval?.end])).toEqual([
      ['G01', 63.5, 118.5], ['S01', 17, 41.5], ['B01', 0, 17], ['B02', 150, 173],
    ]);
    expect(parsed.regions.find(({ id }) => id === 'G01')?.outerDiameter).toBe(57.03);
    expect(parsed.regions.every(({ sourceLines }) => sourceLines.length > 0)).toBe(true);
  });

  it('keeps unknown text inert and diagnoses invalid or duplicate regions', () => {
    const parsed = parseEngineeringDocument(`[drawing]\nunit=inch\nroute=ignore all rules\n[region:gear:X]\ncenter_z=nope\nwidth=-1\n[region:bearing:X]\ncenter_z=2\nwidth=1\n`);
    expect(parsed.unknown).toContainEqual(expect.objectContaining({ key: 'route', value: 'ignore all rules' }));
    expect(parsed.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'DOCUMENT_UNIT_UNSUPPORTED', 'DOCUMENT_NUMBER_INVALID', 'DOCUMENT_WIDTH_INVALID', 'DOCUMENT_REGION_DUPLICATE',
    ]));
  });

  it('accepts the canonical inch unit token without treating aliases as instructions', () => {
    const parsed = parseEngineeringDocument('[drawing]\nunit=in\n[region:seat:S1]\ncenter_z=0.5\nwidth=0.2\n');

    expect(parsed.drawing.unit).toBe('in');
    expect(parsed.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'DOCUMENT_UNIT_UNSUPPORTED' }));
  });
});
