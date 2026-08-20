import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseEngineeringDocument } from './engineering-document';

describe('parseEngineeringDocument', () => {
  it('parses the real UTF-8 companion document without treating comments as values', async () => {
    const source = await readFile(
      resolve(process.cwd(), '样本图001# DXF工程数据文档.txt'),
      'utf8',
    );

    const document = parseEngineeringDocument(source);

    expect(document.drawing).toMatchObject({
      drawingName: '样本图001.dxf',
      unit: 'mm',
      axisOrigin: 'left_end',
      orientation: 'auto',
    });
    expect(document.regions).toEqual([
      expect.objectContaining({ id: 'G01', type: 'gear', centerZ: 91, width: 55, outerDiameter: 57.03 }),
      expect.objectContaining({ id: 'S01', type: 'spline', centerZ: 29.25, width: 24.5, outerDiameter: 45 }),
      expect.objectContaining({ id: 'B01', type: 'bearing', centerZ: 8.5, width: 17, outerDiameter: 35 }),
      expect.objectContaining({ id: 'B02', type: 'bearing', centerZ: 161.5, width: 23, outerDiameter: 35 }),
    ]);
  });

  it('rejects duplicate region IDs and non-finite required numeric values', () => {
    expect(() => parseEngineeringDocument([
      '[drawing]', 'unit=mm',
      '[region:gear:G01]', 'center_z=10', 'width=20',
      '[region:bearing:G01]', 'center_z=30', 'width=abc',
    ].join('\n'))).toThrowError(/ENGINEERING_DOCUMENT_/);
  });
});
