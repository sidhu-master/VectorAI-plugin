// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createEmptyDrawing, type DimensionAnnotation } from '../document';
import { exportDrawingDxf, type DxfExportEntity } from './dxf';
import { DEFAULT_DXF_EXPORT_PROFILE } from './dxf-profile';

const profile = { ...DEFAULT_DXF_EXPORT_PROFILE, cadConvention: 'gb' as const };
const dimension: DimensionAnnotation = {
  id: 'd' as never, type: 'dimension', dimensionKind: 'diameter',
  associationStatus: 'resolved', targets: [], visible: true,
  quality: { status: 'confirmed', evidenceRefs: [] }, unit: 'mm',
  computedValue: 47.931914, displayText: '⌀48',
  layout: { mode: 'automatic', generatedText: '⌀47.931914' },
  definitionPoints: [[20, -23.965957], [20, 23.965957], [10, -23.965957], [10, 23.965957]],
  textPosition: [20, 0],
};
function drawing(node = dimension) {
  const doc = createEmptyDrawing({ idFactory: { next: () => 'presentation' }, now: () => 1 });
  doc.annotations = [structuredClone(node)];
  return doc;
}
function entities(dxf: string, type: string): string[] {
  const pairs = dxf.split(/\r?\n/);
  const records: string[][] = [];
  for (let index = 0; index + 1 < pairs.length; index += 2) {
    if (pairs[index].trim() === '0') records.push([]);
    records.at(-1)?.push(pairs[index], pairs[index + 1]);
  }
  return records.filter((record) => record[1] === type).map((record) => record.join('\r\n'));
}

describe('paper presentation DXF boundary', () => {
  it.each([0, 7, 256])('preserves extension-line ACI %s in actual clipped DXF picture entities', (color) => {
    const colored = { ...profile, dimensionStyles: profile.dimensionStyles.map((style) => ({ ...style, extensionLineColor: color })) };
    const doc = drawing({ ...dimension, dimensionKind: 'linear',
      definitionPoints: [[0, 0], [40, 0], [0, 20], [40, 20]], textPosition: [20, 24],
    });
    const before = structuredClone(doc);
    const dxf = exportDrawingDxf(doc, { profile: colored, dimensionPresentation: {
      note: { textBounds: { minX: -2, maxX: 2, minY: 7, maxY: 12 } },
    } });
    const witnesses = entities(dxf, 'LINE').filter((entry) => entry.includes('10\r\n0\r\n20\r\n0')
      || entry.includes('10\r\n0\r\n20\r\n12') || entry.includes('10\r\n40\r\n20\r\n0'));
    expect(witnesses).toHaveLength(3);
    expect(witnesses.every((entry) => entry.includes(`62\r\n${color}\r\n`) || color === 256 && !entry.includes('\r\n62\r\n'))).toBe(true);
    expect(entities(dxf, 'DIMSTYLE').some((entry) => entry.includes(`177\r\n${color}\r\n`))).toBe(true);
    expect(doc).toEqual(before);
  });

  it.each([false, true])('retains BYBLOCK on angular witnesses with explicit paper placement %s', (explicit) => {
    const colored = { ...profile, dimensionStyles: profile.dimensionStyles.map((style) => ({ ...style, extensionLineColor: 0 })) };
    const doc = drawing({ ...dimension, dimensionKind: 'angular', computedValue: 90, displayText: '90°',
      definitionPoints: [[0, 0], [20, 0], [0, 20], [12, 0], [0, 12]], textPosition: [10, 10],
    });
    const dxf = exportDrawingDxf(doc, { profile: colored, dimensionPresentation: explicit ? { d: {
      angularWitnesses: [{ start: [8, 0], end: [13, 0] }, { start: [0, 8], end: [0, 13] }],
    } } : undefined });
    expect(entities(dxf, 'LINE')).toHaveLength(2);
    expect(entities(dxf, 'LINE').every((entry) => entry.includes('62\r\n0\r\n'))).toBe(true);
  });

  it('writes the profile width into plain TEXT so the emitted label matches its paper obstacle', () => {
    const compressed = { ...profile, textStyles: profile.textStyles.map((style) => ({ ...style, widthFactor: 0.707 })) };
    const doc = drawing();
    doc.annotations = [{ id: 'reference' as never, type: 'text', visible: true, quality: dimension.quality,
      content: '[B]8', position: [20, 12], height: 3.5, rotation: 0, alignment: 'right', verticalAlignment: 'middle',
    }];
    const before = structuredClone(doc);
    const text = entities(exportDrawingDxf(doc, { profile: compressed }), 'TEXT')[0];
    expect(text).toContain('41\r\n0.707');
    expect(text).toContain('72\r\n2');
    expect(text).toContain('11\r\n20\r\n21\r\n12');
    expect(doc).toEqual(before);
  });

  it('overrides only canonical plain TEXT width while retaining dimension and leader MTEXT styles', () => {
    const styled = { ...profile, textStyles: profile.textStyles.map((style) => ({ ...style, widthFactor: 0.707 })) };
    const doc = drawing();
    doc.annotations.push({ id: 'plain' as never, type: 'text', visible: true, quality: dimension.quality,
      content: 'QC', position: [20, 12], height: 3.5, rotation: 0, alignment: 'right', verticalAlignment: 'middle',
    }, { id: 'leader' as never, type: 'leader', visible: true, quality: dimension.quality,
      target: { geometryId: 'edge' as never, anchor: { kind: 'nearest', point: [30, 0] } },
      points: [[30, 0], [35, 5]], content: 'R1', textHeight: 3.5,
    });
    const before = structuredClone(doc);
    const standard = exportDrawingDxf(doc, { profile: styled });
    const overridden = exportDrawingDxf(doc, { profile: { ...styled, plainTextWidthFactor: 0.667 } });
    expect(entities(standard, 'TEXT')[0]).toContain('41\r\n0.707');
    expect(entities(overridden, 'TEXT')[0]).toContain('41\r\n0.667');
    expect(entities(overridden, 'MTEXT')).toEqual(entities(standard, 'MTEXT'));
    expect(entities(overridden, 'STYLE')).toEqual(entities(standard, 'STYLE'));
    expect(doc).toEqual(before);
  });

  it.each([false, true])('writes a local text gap in one native DSTYLE alongside tolerance %s without moving the label', (toleranced) => {
    const doc = drawing({ ...dimension, dimensionKind: 'linear', computedValue: 8, displayText: '8',
      layout: { mode: 'automatic', generatedText: '8' },
      definitionPoints: [[0, 0], [8, 0], [0, 12], [8, 12]], textPosition: [4, 15.25],
      ...(toleranced ? { toleranceProjection: { mode: 'bilateral' as const, upperDeviation: 0.1, lowerDeviation: -0.1,
        unit: 'mm' as const, source: 'manual' as const, status: 'confirmed' as const, evidenceRefs: [] } } : {}),
    });
    const before = structuredClone(doc);
    const native = entities(exportDrawingDxf(doc, { profile, dimensionPresentation: { d: { textGap: 0.5, arrowsOutside: false } } }), 'DIMENSION')[0];
    expect(native.match(/1001\r\nACAD\r\n/g)).toHaveLength(1);
    expect(native.match(/1000\r\nDSTYLE\r\n/g)).toHaveLength(1);
    expect(native).toContain('1070\r\n147\r\n1040\r\n0.5');
    expect(native).toContain('11\r\n4\r\n21\r\n15.25');
    expect(native).toContain('70\r\n160');
    expect(native).toContain('42\r\n8');
    expect(native.includes('1070\r\n47\r\n1040\r\n0.1')).toBe(toleranced);
    expect(native.includes('1070\r\n48\r\n1040\r\n0.1')).toBe(toleranced);
    expect(doc).toEqual(before);
    const ordinary = entities(exportDrawingDxf(doc, { profile }), 'DIMENSION')[0];
    expect(ordinary).not.toContain('1070\r\n147\r\n1040');
  });

  it('uses inline plus/minus for symmetric tolerances while retaining native deviations', () => {
    const doc = drawing({ ...dimension, dimensionKind: 'linear', computedValue: 24.5,
      displayText: '24.5', layout: { mode: 'automatic', generatedText: '24.5' },
      definitionPoints: [[0, 0], [24.5, 0], [0, 8], [24.5, 8]], textPosition: [12.25, 11],
      toleranceProjection: { mode: 'bilateral', upperDeviation: .1, lowerDeviation: -.1,
        unit: 'mm', source: 'manual', status: 'confirmed', evidenceRefs: [] },
    });
    const dxf = exportDrawingDxf(doc, { profile });
    expect(entities(dxf, 'MTEXT')[0]).toContain('24.5{\\C3;%%P0.1}');
    expect(entities(dxf, 'DIMENSION')[0]).toContain('1000\r\nDSTYLE');
  });

  it('writes the same horizontal angular text rotation into the picture and native dimension', () => {
    const doc = drawing({ ...dimension, dimensionKind: 'angular', computedValue: 60, displayText: '60°', unit: 'deg',
      definitionPoints: [[0, 0], [-4, -4 / Math.sqrt(3)], [-4, 4 / Math.sqrt(3)], [-12, -12 / Math.sqrt(3)], [-12, 12 / Math.sqrt(3)]],
      textPosition: [-16, 0],
    });
    const horizontal = { ...profile, dimensionStyles: profile.dimensionStyles.map((style) => ({
      ...style, angularTextOrientation: 'horizontal' as const,
    })) };
    const dxf = exportDrawingDxf(doc, { profile: horizontal });
    expect(entities(dxf, 'MTEXT')[0]).toContain('50\r\n0');
    expect(entities(dxf, 'DIMENSION')[0]).toContain('53\r\n0');
    // The generic/aligned profile retains its existing readable tangent direction.
    expect(entities(exportDrawingDxf(doc, { profile }), 'DIMENSION')[0]).toContain('53\r\n90');
  });

  it('expresses a profile diameter as an editable rotated dimension without changing semantic geometry or explicit nominal', () => {
    const doc = drawing();
    const before = structuredClone(doc);
    const dxf = exportDrawingDxf(doc, { profile, dimensionPresentation: { d: { nativeKind: 'linear' } } });
    const native = entities(dxf, 'DIMENSION')[0];
    expect(native).toContain('100\r\nAcDbRotatedDimension');
    expect(native).toContain('13\r\n10\r\n23\r\n-23.965957');
    expect(native).toContain('14\r\n10\r\n24\r\n23.965957');
    expect(native).toContain('42\r\n47.931914');
    expect(native).toContain('1\r\n%%C48');
    expect(doc).toEqual(before);
  });

  it('retains a legacy explicit nominal even without generated-text provenance', () => {
    const node = structuredClone(dimension);
    delete node.layout;
    const native = entities(exportDrawingDxf(drawing(node), { profile }), 'DIMENSION')[0];
    expect(native).toContain('1\r\n%%C48');
    expect(native).toContain('42\r\n47.931914');
  });

  it('breaks an interior diameter line around the measured text footprint and retains native circle representation', () => {
    const dxf = exportDrawingDxf(drawing(), { profile, dimensionPresentation: { d: {
      rotation: 90, textBounds: { minX: 18, maxX: 22, minY: -5, maxY: 5 },
    } } });
    const lines = entities(dxf, 'LINE');
    expect(lines.some((entry) => entry.includes('10\r\n20\r\n20\r\n-23.965957') && entry.includes('21\r\n-5'))).toBe(true);
    expect(lines.some((entry) => entry.includes('10\r\n20\r\n20\r\n5') && entry.includes('21\r\n23.965957'))).toBe(true);
    expect(entities(dxf, 'DIMENSION')[0]).toContain('100\r\nAcDbDiametricDimension');
  });

  it('writes every supplied graphic kind including its explicit color', () => {
    const dxf = exportDrawingDxf(drawing(), { entities: [
      { type: 'arc', layer: 'NOTES', color: 4, center: [0, 0], radius: 3, startAngle: 10, endAngle: 80 },
      { type: 'mtext', layer: 'NOTES', color: 3, position: [5, 6], content: 'C0.5两侧', height: 3.5 },
      { type: 'solid-hatch', layer: 'NOTES', color: 2, boundary: [[0, 0], [1, 0], [0, 1]] },
    ] });
    expect(entities(dxf, 'ARC').some((entry) => entry.includes('62\r\n4'))).toBe(true);
    expect(entities(dxf, 'MTEXT').some((entry) => entry.includes('C0.5两侧') && entry.includes('62\r\n3'))).toBe(true);
    expect(entities(dxf, 'HATCH').some((entry) => entry.includes('62\r\n2'))).toBe(true);
  });

  it('connects an offset circular-diameter label to the measured circle and stops at the text gap', () => {
    const node: DimensionAnnotation = {
      ...dimension, computedValue: 6, displayText: '⌀6',
      definitionPoints: [[27, 10], [33, 10]], textPosition: [43, 20],
    };
    const dxf = exportDrawingDxf(drawing(node), { profile, dimensionPresentation: { d: {
      leader: { start: [33, 10], end: [43, 20] },
      textBounds: { minX: 40, maxX: 46, minY: 18, maxY: 22 },
    } } });
    expect(entities(dxf, 'LINE').some((entry) => entry.includes('10\r\n33\r\n20\r\n10')
      && entry.includes('11\r\n41\r\n21\r\n18'))).toBe(true);
    const native = entities(dxf, 'DIMENSION')[0];
    expect(native).toContain('100\r\nAcDbDiametricDimension');
    expect(native).toContain('11\r\n43\r\n21\r\n20');
    expect(native).toContain('15\r\n33\r\n25\r\n10');
  });

  it('opens gaps in another tier’s witness line without moving either annotation', () => {
    const doc = drawing({ ...dimension, dimensionKind: 'linear',
      definitionPoints: [[0, 0], [40, 0], [0, 20], [40, 20]], textPosition: [20, 24],
    });
    const dxf = exportDrawingDxf(doc, { profile, dimensionPresentation: {
      otherLabel: { textBounds: { minX: -2, maxX: 2, minY: 7, maxY: 12 } },
    } });
    const lines = entities(dxf, 'LINE');
    expect(lines.some((entry) => entry.includes('10\r\n0\r\n20\r\n0') && entry.includes('21\r\n7'))).toBe(true);
    expect(lines.some((entry) => entry.includes('10\r\n0\r\n20\r\n12') && entry.includes('21\r\n21.25'))).toBe(true);
  });

  it('extends a short dimension line beneath its outside label without moving measured witnesses', () => {
    const node: DimensionAnnotation = { ...dimension, dimensionKind: 'linear', computedValue: 1,
      displayText: '1', definitionPoints: [[0, 0], [1, 0], [0, 8], [1, 8]], textPosition: [12, 11],
    };
    const dxf = exportDrawingDxf(drawing(node), { profile, dimensionPresentation: { d: {
      arrowsOutside: true, textBounds: { minX: 10, maxX: 14, minY: 10, maxY: 12 },
    } } });
    expect(entities(dxf, 'LINE').some((entry) => entry.includes('20\r\n8')
      && entry.includes('11\r\n12\r\n21\r\n8'))).toBe(true);
    const native = entities(dxf, 'DIMENSION')[0];
    expect(native).toContain('13\r\n0\r\n23\r\n0');
    expect(native).toContain('14\r\n1\r\n24\r\n0');
  });

  it('leaves caller-owned extra dimensions unchanged when clipping their pictures', () => {
    const extra: DxfExportEntity = { type: 'dimension', layer: 'DIMENSIONS', dimensionKind: 'linear',
      definitionPoints: [[0, 0], [10, 0]], textPosition: [5, 2], text: '', measurement: 10,
      picture: [{ type: 'line', layer: 'DIMENSIONS', start: [0, 0], end: [10, 0] }],
    };
    const before = structuredClone(extra);
    exportDrawingDxf(drawing(), { entities: [extra], dimensionPresentation: {
      obstacle: { textBounds: { minX: 3, maxX: 7, minY: -1, maxY: 1 } },
    } });
    expect(extra).toEqual(before);
  });

  it('exports a dual-target feature note and a detail circle as grouped annotations', () => {
    const doc = drawing();
    doc.annotations = [{
      id: 'dual-note' as never, type: 'leader', visible: true, quality: dimension.quality,
      target: { geometryId: 'a' as never, anchor: { kind: 'nearest', point: [0, 0] } },
      points: [[0, 0], [5, 5], [10, 5]], content: 'R1', textHeight: 3.5,
      branches: [{ target: { geometryId: 'b' as never, anchor: { kind: 'nearest', point: [0, 2] } }, points: [[0, 2], [5, 5]] }],
    }, {
      id: 'detail' as never, type: 'leader', visible: true, quality: dimension.quality,
      target: { geometryId: 'a' as never, anchor: { kind: 'nearest', point: [20, 20] } },
      points: [[20, 20], [28, 28]], content: 'Ⅱ', textHeight: 5,
      callout: { type: 'detail', radius: 4 },
    }];
    const before = structuredClone(doc);
    const dxf = exportDrawingDxf(doc, { profile });
    expect(entities(dxf, 'INSERT')).toHaveLength(2);
    expect(entities(dxf, 'HATCH')).toHaveLength(2);
    expect(entities(dxf, 'CIRCLE')).toHaveLength(1);
    expect(entities(dxf, 'CIRCLE')[0]).toContain('40\r\n4');
    expect(entities(dxf, 'MTEXT').map((entry) => {
      const pairs = entry.split('\r\n');
      return pairs.find((_, index) => index % 2 === 1 && pairs[index - 1] === '1');
    })).toEqual(['R1', 'Ⅱ']);
    expect(doc).toEqual(before);
  });
});
