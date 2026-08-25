// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { classifyEngineeringDrop } from './engineering-drop';

function file(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

describe('engineering drop classification', () => {
  it('claims one case-insensitive DXF with ordered supported documents even when MIME is empty', () => {
    expect(classifyEngineeringDrop([
      file('INITIAL.DXF'),
      file('limits.PDF'),
      file('轴段.yaml'),
      file('data.XLSX'),
    ])).toMatchObject({
      kind: 'import',
      dxf: { name: 'INITIAL.DXF' },
      documents: [{ name: 'limits.PDF' }, { name: '轴段.yaml' }, { name: 'data.XLSX' }],
    });
  });

  it('claims supported document-only drops as pending context', () => {
    expect(classifyEngineeringDrop([file('notes.txt'), file('table.csv')])).toMatchObject({
      kind: 'pending',
      documents: [{ name: 'notes.txt' }, { name: 'table.csv' }],
    });
  });

  it('passes ordinary DSH image drops through untouched', () => {
    expect(classifyEngineeringDrop([file('photo.png', 'image/png')])).toEqual({ kind: 'pass' });
  });

  it('rejects ambiguous or unsupported engineering sets with stable file-specific codes', () => {
    expect(classifyEngineeringDrop([file('a.dxf'), file('b.DXF')])).toMatchObject({
      kind: 'reject', code: 'ENGINEERING_DROP_MULTIPLE_DXF', filenames: ['a.dxf', 'b.DXF'],
    });
    expect(classifyEngineeringDrop([file('drawing.dxf'), file('legacy.doc')])).toMatchObject({
      kind: 'reject', code: 'DOCUMENT_LEGACY_FORMAT_UNSUPPORTED', filenames: ['legacy.doc'],
    });
    expect(classifyEngineeringDrop([file('drawing.dxf'), file('unknown.bin')])).toMatchObject({
      kind: 'reject', code: 'ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED', filenames: ['unknown.bin'],
    });
    expect(classifyEngineeringDrop([file('drawing.dxf'), file('photo.png', 'image/png')])).toMatchObject({
      kind: 'reject', code: 'ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED', filenames: ['photo.png'],
    });
    expect(classifyEngineeringDrop([file('drawing.dxf'), file('a.txt'), file('A.TXT')])).toMatchObject({
      kind: 'reject', code: 'ENGINEERING_DOCUMENT_DUPLICATE_NAME', filenames: ['a.txt', 'A.TXT'],
    });
  });

  it('rejects count and byte limits before any file is read', () => {
    const tooMany = Array.from({ length: 17 }, (_, index) => file(`part-${index}.txt`));
    expect(classifyEngineeringDrop(tooMany)).toMatchObject({ kind: 'reject', code: 'ENGINEERING_DOCUMENT_COUNT_LIMIT' });
    const huge = { name: 'huge.pdf', size: 21 * 1024 * 1024, type: 'application/pdf' } as File;
    expect(classifyEngineeringDrop([file('drawing.dxf'), huge])).toMatchObject({
      kind: 'reject', code: 'ENGINEERING_DOCUMENT_SIZE_LIMIT', filenames: ['huge.pdf'],
    });
  });
});
