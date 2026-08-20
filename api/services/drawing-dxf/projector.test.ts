import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createEmptyDrawing, validateDrawingDocument } from '../../../src/drawing';
import { parseAsciiDxf } from './raw-parser';
import { projectDxfToDrawing } from './projector';

describe('projectDxfToDrawing', () => {
  it('recursively expands INSERT transforms while retaining the complete source path', () => {
    const manifest = parseAsciiDxf(nestedBlockFixture());

    const projection = projectDxfToDrawing(manifest, { sourceId: 'source_fixture' });

    expect(projection.geometry).toHaveLength(1);
    expect(projection.geometry[0]).toMatchObject({
      type: 'line',
      start: [100, 25],
      end: [100, 35],
      quality: {
        status: 'confirmed',
        evidenceRefs: [
          'dxf:source_fixture:entity:L1:insert:I_OUT/I_IN',
        ],
      },
    });
    expect(projection.summary).toMatchObject({
      expandedInsertCount: 2,
      unsupportedEntityCount: 0,
    });
  });

  it('projects all supported initial-drawing entities into a valid Drawing IR subset', async () => {
    const source = await readFile(resolve(process.cwd(), '初始图.dxf'), 'utf8');
    const projection = projectDxfToDrawing(parseAsciiDxf(source), {
      sourceId: 'source_initial',
    });
    const document = createEmptyDrawing();
    document.geometry = projection.geometry;
    document.annotations = projection.annotations;

    expect(projection.geometry.filter((node) => node.type === 'line')).toHaveLength(89);
    expect(projection.geometry.filter((node) => node.type === 'spline')).toHaveLength(33);
    expect(projection.geometry.filter((node) => node.type === 'arc')).toHaveLength(12);
    const sectionHatches = projection.annotations.filter((node) => (
      String(node.type) === 'section-hatch'
    )) as unknown as Array<{ segments: Array<{ start: [number, number]; end: [number, number] }> }>;
    expect(sectionHatches).toHaveLength(2);
    expect(sectionHatches.every((node) => node.segments.length > 0)).toBe(true);
    expect(sectionHatches.flatMap((node) => node.segments).every(({ start, end }) => (
      [...start, ...end].every(Number.isFinite)
    ))).toBe(true);
    expect(projection.diagnostics.filter((item) => (
      item.code === 'DXF_ENTITY_UNSUPPORTED' && item.entityType === 'HATCH'
    ))).toHaveLength(0);
    expect(validateDrawingDocument(document).valid).toBe(true);
  });

  it('clips an ANSI31 hatch into explicit section segments inside its boundary', () => {
    const projection = projectDxfToDrawing(parseAsciiDxf(rectangularHatchFixture()), {
      sourceId: 'source_hatch_fixture',
    });
    const hatch = projection.annotations.find((node) => (
      String(node.type) === 'section-hatch'
    )) as unknown as {
      angle: number;
      segments: Array<{ start: [number, number]; end: [number, number] }>;
    } | undefined;

    expect(hatch?.angle).toBe(45);
    expect(hatch?.segments).toHaveLength(5);
    expect(hatch?.segments.every(({ start, end }) => (
      [...start, ...end].every((value) => value >= -1e-6 && value <= 10 + 1e-6)
    ))).toBe(true);
  });

  it('imports visible annotations from nested sample blocks without treating them as geometry', async () => {
    const source = await readFile(resolve(process.cwd(), '样本图001.dxf'), 'utf8');
    const projection = projectDxfToDrawing(parseAsciiDxf(source), {
      sourceId: 'source_sample',
    });

    expect(projection.summary.expandedInsertCount).toBeGreaterThanOrEqual(18);
    expect(projection.annotations.filter((node) => node.type === 'dimension').length)
      .toBeGreaterThanOrEqual(20);
    const firstDimension = projection.annotations.find((node) => node.type === 'dimension');
    expect(firstDimension).toMatchObject({
      type: 'dimension',
      computedValue: expect.closeTo(57.03, 2),
      displayText: expect.stringContaining('57.03'),
    });
    expect(firstDimension?.displayText).not.toContain('\\A1');
    expect(firstDimension?.displayText).not.toContain('<>');
    expect(projection.annotations.some((node) => node.quality.evidenceRefs.some(
      (reference) => reference.includes(':insert:'),
    ))).toBe(true);
  });
});

function nestedBlockFixture(): string {
  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1027', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS',
    '0', 'BLOCK', '5', 'B1', '2', 'INNER', '10', '0', '20', '0',
    '0', 'LINE', '5', 'L1', '10', '0', '20', '0', '11', '10', '21', '0',
    '0', 'ENDBLK',
    '0', 'BLOCK', '5', 'B2', '2', 'OUTER', '10', '0', '20', '0',
    '0', 'INSERT', '5', 'I_IN', '2', 'INNER', '10', '5', '20', '0',
    '0', 'ENDBLK',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'INSERT', '5', 'I_OUT', '2', 'OUTER', '10', '100', '20', '20', '50', '90',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

function rectangularHatchFixture(): string {
  return [
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'HATCH', '5', 'H1', '100', 'AcDbHatch', '2', 'ANSI31', '70', '0', '71', '0',
    '91', '1', '92', '2', '72', '0', '73', '1', '93', '4',
    '10', '0', '20', '0', '10', '10', '20', '0',
    '10', '10', '20', '10', '10', '0', '20', '10',
    '97', '0', '75', '0', '76', '1', '52', '0', '41', '1', '77', '0',
    '78', '1', '53', '45', '43', '0', '44', '0', '45', '-2', '46', '2', '79', '0',
    '98', '1', '10', '5', '20', '5',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}
