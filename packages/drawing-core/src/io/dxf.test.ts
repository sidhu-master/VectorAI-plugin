// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { createEmptyDrawing, type DimensionAnnotation } from '../document';
import { exportDrawingDxf } from './dxf';
import { DEFAULT_DXF_EXPORT_PROFILE } from './dxf-profile';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };
const gbProfile = {
  ...DEFAULT_DXF_EXPORT_PROFILE,
  cadConvention: 'gb' as const,
  dimensionStyles: DEFAULT_DXF_EXPORT_PROFILE.dimensionStyles.map((style) => ({
    ...style,
    toleranceDecimalPlaces: 3,
  })),
};

function toleranceDimension(
  id: string,
  toleranceProjection: NonNullable<DimensionAnnotation['toleranceProjection']>,
): DimensionAnnotation {
  return {
    id: id as never,
    type: 'dimension',
    dimensionKind: 'linear',
    associationStatus: 'resolved',
    targets: [],
    computedValue: 13,
    displayText: '13',
    unit: 'mm',
    textPosition: [6.5, 5],
    definitionPoints: [[0, 0], [13, 0]],
    visible: true,
    quality,
    toleranceProjection,
  };
}

function dxfEntities(dxf: string, type: string): string[] {
  const lines = dxf.split(/\r?\n/);
  const records: string[][] = [];
  let current: string[] | undefined;
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const pair = [lines[index]!, lines[index + 1]!];
    if (pair[0].trim() === '0') {
      if (current !== undefined) records.push(current);
      current = pair;
    } else if (current !== undefined) {
      current.push(...pair);
    }
  }
  if (current !== undefined) records.push(current);
  return records
    .filter((record) => record[1]?.trim() === type)
    .map((record) => `${record.join('\r\n')}\r\n`);
}

describe('exportDrawingDxf', () => {
  it('exports canonical geometry and annotations as a unit-aware ASCII DXF drawing', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-dxf' }, now: () => 1 });
    document.unitSystem.length = 'cm';
    document.geometry = [
      { id: 'point-1' as never, type: 'point', x: 1, y: 2, visible: true, quality },
      { id: 'line-1' as never, type: 'line', start: [3, 4], end: [5, 6], visible: true, quality },
      { id: 'circle-1' as never, type: 'circle', center: [7, 8], radius: 9, visible: true, quality },
      { id: 'arc-1' as never, type: 'arc', center: [10, 11], radius: 12, startAngle: 0, endAngle: 90, counterClockwise: true, visible: true, quality },
      { id: 'ellipse-1' as never, type: 'ellipse', center: [13, 14], majorAxis: [4, 0], ratio: 0.5, visible: true, quality },
      { id: 'polyline-1' as never, type: 'polyline', vertices: [{ point: [15, 16], bulge: 0.25 }, { point: [17, 18] }], closed: true, visible: true, quality },
      { id: 'spline-1' as never, type: 'spline', degree: 2, controlPoints: [[0, 0], [2, 3], [4, 0]], knots: [0, 0, 0, 1, 1, 1], closed: false, periodic: false, visible: true, quality },
      { id: 'ray-1' as never, type: 'ray', origin: [19, 20], direction: [1, 0], visible: true, quality },
      { id: 'xline-1' as never, type: 'xline', origin: [21, 22], direction: [0, 1], visible: true, quality },
      { id: 'hidden-line' as never, type: 'line', start: [100, 100], end: [200, 200], visible: false, quality },
    ];
    document.annotations = [
      { id: 'text-1' as never, type: 'text', content: '孔位', position: [2, 4], height: 3, rotation: 15, alignment: 'center', verticalAlignment: 'middle', visible: true, quality },
      { id: 'centerline-1' as never, type: 'centerline', targets: [], start: [0, 5], end: [10, 5], extension: 0, visible: true, quality },
      { id: 'leader-1' as never, type: 'leader', target: { geometryId: 'circle-1' as never, anchor: { kind: 'center' } }, points: [[1, 1], [2, 2]], content: 'R9', textHeight: 2, visible: true, quality },
      { id: 'hatch-1' as never, type: 'section-hatch', pattern: 'ANSI31', angle: 45, spacing: 1, segments: [{ start: [1, 3], end: [4, 6] }], visible: true, quality },
    ];

    const dxf = exportDrawingDxf(document);

    expect(dxf).toContain('0\r\nSECTION\r\n2\r\nHEADER');
    expect(dxf).toContain('9\r\n$ACADVER\r\n1\r\nAC1027');
    expect(dxf).toContain('9\r\n$INSUNITS\r\n70\r\n5');
    expect(dxf).toContain('0\r\nPOINT');
    expect(dxf).toContain('0\r\nLINE');
    expect(dxf).toContain('0\r\nCIRCLE');
    expect(dxf).toContain('0\r\nARC');
    expect(dxf).toContain('0\r\nELLIPSE');
    expect(dxf).toContain('0\r\nLWPOLYLINE');
    expect(dxf).toContain('42\r\n0.25');
    expect(dxf).toContain('0\r\nSPLINE');
    expect(dxf).toContain('0\r\nRAY');
    expect(dxf).toContain('0\r\nXLINE');
    expect(dxf).toContain('0\r\nTEXT');
    expect(dxf).toContain('1\r\n孔位');
    expect(dxf).toContain('2\r\nGEOMETRY');
    expect(dxf).toContain('2\r\nCENTERLINE');
    expect(dxf).toContain('2\r\nSECTION_HATCH');
    expect(dxf).toContain('2\r\nTEXT');
    expect(dxf).toContain('2\r\nDIMENSIONS');
    expect(dxf).not.toContain('2\r\n1轮廓实线层');
    expect(dxf).not.toContain('2\r\nANNOTATIONS');
    expect(dxf).not.toContain('100\r\n20\r\n100');
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
  });

  it('escapes line breaks in annotation text so they cannot corrupt DXF group pairs', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-dxf' }, now: () => 1 });
    document.annotations = [{
      id: 'text-1' as never, type: 'text', content: 'A\nB\r\nC', position: [0, 0], height: 2,
      rotation: 0, alignment: 'left', verticalAlignment: 'baseline', visible: true, quality,
    }];

    expect(exportDrawingDxf(document)).toContain('1\r\nA\\PB\\PC');
  });

  it('exports a parametric section hatch as a real DXF HATCH entity', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-hatch' }, now: () => 1 });
    document.annotations = [{
      id: 'hatch-1' as never, type: 'section-hatch', pattern: 'ANSI31', angle: 60, spacing: 6.35,
      hatch: {
        version: 1, style: 'outer', elevation: 2, extrusion: [0, 0, 1], patternAngle: 15,
        patternScale: 2, double: false,
        boundaryPaths: [{ flags: 1, closed: true, edges: [
          { type: 'line', start: [0, 0], end: [10, 0] },
          { type: 'arc', center: [10, 5], radius: 5, startAngle: -90, endAngle: 90, counterClockwise: true },
          { type: 'line', start: [10, 10], end: [0, 10] },
          { type: 'line', start: [0, 10], end: [0, 0] },
        ] }],
        patternLines: [{ angle: 45, base: [0, 0], offset: [-2.2450640303, 2.2450640303], dashLengths: [4, -2] }],
      },
      visible: true, quality,
    }];

    const dxf = exportDrawingDxf(document);
    expect(dxf).toMatch(/0\r\nHATCH\r\n[\s\S]*?8\r\nSECTION_HATCH\r\n100\r\nAcDbHatch/);
    expect(dxf).toContain('2\r\nANSI31\r\n70\r\n0\r\n71\r\n0\r\n91\r\n1');
    expect(dxf).toContain('75\r\n1\r\n76\r\n0\r\n52\r\n15\r\n41\r\n2\r\n77\r\n0\r\n78\r\n1');
    expect(dxf).toContain('79\r\n2\r\n49\r\n4\r\n49\r\n-2');
  });

  it('renders resolved portable and legacy tolerance labels without evaluating formulas', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-tolerance' }, now: () => 1 });
    const dimension = (id: string, displayText: string): DimensionAnnotation => ({
      id: id as never, type: 'dimension', dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], computedValue: 10, displayText,
      unit: 'mm', textPosition: [0, 0], definitionPoints: [[0, 0], [10, 0]],
      visible: true, quality,
    });
    document.annotations = [
      {
        ...dimension('bilateral', '10'),
        toleranceProjection: {
          mode: 'bilateral', upperDeviation: 0.02, lowerDeviation: -0.01, unit: 'mm',
          source: 'enterprise-rule', status: 'resolved', evidenceRefs: ['rule:1'],
        },
      },
      {
        ...dimension('unilateral', '10'),
        toleranceProjection: {
          mode: 'unilateral', upperDeviation: 0.02, unit: 'mm',
          source: 'manual', status: 'confirmed', evidenceRefs: ['manual:1'],
        },
      },
      {
        ...dimension('limits', '10'),
        toleranceProjection: {
          mode: 'limits', upperLimit: 10.02, lowerLimit: 9.98, unit: 'mm',
          source: 'document', status: 'confirmed', evidenceRefs: ['document:1'],
        },
      },
      {
        ...dimension('fit', '10'),
        toleranceProjection: {
          mode: 'fit', fitDesignation: 'H7', unit: 'mm', source: 'standard',
          status: 'confirmed', evidenceRefs: ['standard:1'],
        },
      },
      { ...dimension('legacy', '10'), tolerance: { upper: 0.03, lower: -0.02 } },
    ];

    const dxf = exportDrawingDxf(document);
    const [bilateral, unilateral] = dxfEntities(dxf, 'DIMENSION');
    expect(bilateral).toContain('1001\r\nACAD');
    expect(bilateral).toMatch(/1070\r\n47\r\n1040\r\n0\.02/);
    expect(bilateral).toMatch(/1070\r\n48\r\n1040\r\n0\.01/);
    expect(unilateral).toContain('1001\r\nACAD');
    expect(unilateral).toMatch(/1070\r\n48\r\n1040\r\n0(?:\r\n|$)/);
    expect(dxf).toContain('1\r\n10 [10.02/9.98]');
    expect(dxf).toContain('1\r\n10 H7');
    expect(dxf).toContain('1\r\n10 +0.03/-0.02');
  });

  it('exports sign-spanning deviations as correctly typed native dimension-style overrides', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-native-tolerance' }, now: () => 1 });
    document.annotations = [toleranceDimension('bilateral', {
      mode: 'bilateral', upperDeviation: .02, lowerDeviation: -.01, unit: 'mm',
      source: 'standard', status: 'confirmed', evidenceRefs: ['standard:test'],
    })];

    const dxf = exportDrawingDxf(document, { profile: gbProfile });
    const [entity] = dxfEntities(dxf, 'DIMENSION');

    expect(dxf).toMatch(/0\r\nTABLE\r\n2\r\nAPPID[\s\S]*?2\r\nACAD[\s\S]*?2\r\nVECTORAI/);
    expect(entity).toContain('1001\r\nACAD\r\n1000\r\nDSTYLE\r\n1002\r\n{');
    expect(entity).toMatch(/1070\r\n71\r\n1070\r\n1/);
    expect(entity).toMatch(/1070\r\n47\r\n1040\r\n0\.02/);
    expect(entity).toMatch(/1070\r\n48\r\n1040\r\n0\.01/);
    expect(entity).toMatch(/1070\r\n272\r\n1070\r\n3/);
    expect(entity).toContain('1002\r\n}');
    expect(entity).not.toContain('\\S+0.02^-0.01;');
  });

  it('preserves positive same-sign fit deviations as explicit stacked text and compact semantic XDATA', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-u6-tolerance' }, now: () => 1 });
    document.annotations = [toleranceDimension('u6', {
      mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033, unit: 'mm',
      source: 'standard', status: 'confirmed', featureClass: 'external',
      standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both',
      evidenceRefs: ['standard:u6'],
    })];

    const dxf = exportDrawingDxf(document, { profile: gbProfile });
    const [entity] = dxfEntities(dxf, 'DIMENSION');
    const payload = entity?.match(/1001\r\nVECTORAI\r\n1000\r\n([^\r]+)/)?.[1];

    expect(entity).toContain('\\S+0.044^+0.033;');
    expect(entity).toContain('1\r\n\\A1;<>{\\C3;u6}{\\C2;{\\H0.71x;\\S+0.044^+0.033;}}');
    expect(entity).not.toContain('1001\r\nACAD');
    expect(payload).toBeDefined();
    expect(new TextEncoder().encode(payload).byteLength).toBeLessThan(255);
    expect(JSON.parse(payload!)).toEqual({
      version: 1,
      designation: 'u6',
      upperDeviation: .044,
      lowerDeviation: .033,
      featureClass: 'external',
      standardRef: { id: 'GB/T 1800', edition: '2020' },
    });

    const [defaultProfileEntity] = dxfEntities(exportDrawingDxf(document), 'DIMENSION');
    expect(defaultProfileEntity).toContain('1\r\n\\A1;<>{\\C3;u6}{\\C2;{\\H0.71x;\\S+0.044^+0.033;}}');
    expect(defaultProfileEntity).not.toContain('1001\r\nACAD');
  });

  it('keeps negative same-sign fit members explicit while a sign-spanning fit member stays native', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-fit-members' }, now: () => 1 });
    document.annotations = [
      toleranceDimension('H7', {
        mode: 'bilateral', fitDesignation: 'H7', upperDeviation: .018, lowerDeviation: 0, unit: 'mm',
        source: 'standard', status: 'confirmed', featureClass: 'internal',
        standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both', evidenceRefs: ['standard:H7'],
      }),
      toleranceDimension('g6', {
        mode: 'bilateral', fitDesignation: 'g6', upperDeviation: -.006, lowerDeviation: -.017, unit: 'mm',
        source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both', evidenceRefs: ['standard:g6'],
      }),
    ];

    const [hole, shaft] = dxfEntities(exportDrawingDxf(document, { profile: gbProfile }), 'DIMENSION');

    expect(hole).toContain('H7');
    expect(hole).toMatch(/1070\r\n47\r\n1040\r\n0\.018/);
    expect(hole).toMatch(/1070\r\n48\r\n1040\r\n0(?:\r\n|$)/);
    expect(shaft).toContain('g6');
    expect(shaft).toContain('\\S-0.006^-0.017;');
    expect(shaft).not.toContain('1001\r\nACAD');

    const [defaultProfileHole] = dxfEntities(exportDrawingDxf({ ...document, annotations: [document.annotations[0]!] }), 'DIMENSION');
    expect(defaultProfileHole).toContain('1\r\n<>{\\C3;H7}');
    expect(defaultProfileHole).toContain('1001\r\nACAD');
  });

  it('round-trips effective manual overrides and designation-only presentation without misleading native tolerance text', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-tolerance-presentation' }, now: () => 1 });
    document.annotations = [
      toleranceDimension('override', {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .05, lowerDeviation: .04, unit: 'mm',
        source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both', evidenceRefs: ['manual:override'],
      }),
      toleranceDimension('designation', {
        mode: 'bilateral', fitDesignation: 'H7', upperDeviation: .018, lowerDeviation: 0, unit: 'mm',
        source: 'standard', status: 'confirmed', featureClass: 'internal',
        standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'designation', evidenceRefs: ['standard:H7'],
      }),
    ];

    const [override, designation] = dxfEntities(exportDrawingDxf(document, { profile: gbProfile }), 'DIMENSION');

    expect(override).toContain('\\S+0.05^+0.04;');
    expect(override).toContain('"upperDeviation":0.05');
    expect(override).toContain('"lowerDeviation":0.04');
    expect(designation).toContain('H7');
    expect(designation).not.toContain('\\S');
    expect(designation).not.toContain('1001\r\nACAD');
    expect(designation).toContain('1001\r\nVECTORAI');
  });

  it('keeps legacy deviation text without claiming standard native or VECTORAI semantics', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-legacy-tolerance' }, now: () => 1 });
    const legacy = toleranceDimension('legacy', {
      mode: 'none', unit: 'mm', source: 'document', status: 'candidate', evidenceRefs: [],
    });
    delete legacy.toleranceProjection;
    legacy.tolerance = { upper: .03, lower: -.02 };
    document.annotations = [legacy];

    const [entity] = dxfEntities(exportDrawingDxf(document, { profile: gbProfile }), 'DIMENSION');

    expect(entity).toContain('\\S+0.03^-0.02;');
    expect(entity).not.toContain('1001\r\nACAD');
    expect(entity).not.toContain('1001\r\nVECTORAI');
  });

  it('sanitizes tolerance designation text before writing a DXF group value', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-fit' }, now: () => 1 });
    document.annotations = [{
      id: 'fit' as never, type: 'dimension', dimensionKind: 'linear', associationStatus: 'resolved',
      targets: [], computedValue: 10, displayText: '10', unit: 'mm', textPosition: [0, 0],
      definitionPoints: [[0, 0], [10, 0]], visible: true, quality,
      toleranceProjection: {
        mode: 'fit', fitDesignation: 'H7\n0\nLINE', unit: 'mm', source: 'manual',
        status: 'resolved', evidenceRefs: ['manual:fit'],
      },
    }];
    const dxf = exportDrawingDxf(document);
    expect(dxf).toContain('1\r\n10 H7\\P0\\PLINE');
    expect(dxf).not.toContain('1\r\n10 H7\r\n0\r\nLINE');
  });

  it('exports dimensions as native CAD DIMENSION entities with style and anonymous picture blocks', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-native-dimension' }, now: () => 1 });
    document.annotations = [{
      id: 'dimension-native' as never, type: 'dimension', dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], computedValue: 24.5, displayText: '24.5', unit: 'mm',
      textPosition: [12.25, 15], definitionPoints: [[0, 0], [24.5, 0], [0, 15], [24.5, 15]],
      visible: true, quality,
    }];

    const dxf = exportDrawingDxf(document);

    expect(dxf).toContain('0\r\nTABLE\r\n2\r\nDIMSTYLE');
    expect(dxf).toContain('0\r\nTABLE\r\n2\r\nBLOCK_RECORD');
    expect(dxf).toContain('0\r\nSECTION\r\n2\r\nBLOCKS');
    expect(dxf).toMatch(/0\r\nDIMENSION\r\n[\s\S]*?8\r\nDIMENSIONS/);
    expect(dxf).toContain('100\r\nAcDbDimension');
    expect(dxf).toMatch(/100\r\nAcDbAlignedDimension[\s\S]*?100\r\nAcDbRotatedDimension/);
    expect(dxf).toMatch(/0\r\nDIMENSION[\s\S]*?2\r\n\*D1/);
  });

  it('exports a right-facing angular dimension through the requested short counter-clockwise DXF arc', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-right-angular-dimension' }, now: () => 1 });
    document.annotations = [{
      id: 'dimension-right-angle' as never, type: 'dimension', dimensionKind: 'angular',
      associationStatus: 'resolved', targets: [], computedValue: 60, displayText: '60°', unit: 'deg',
      textPosition: [14, 0],
      definitionPoints: [
        [0, 0],
        [12, 6.928203],
        [12, -6.928203],
        [8.660254, 5],
        [8.660254, -5],
      ],
      visible: true, quality,
    }];

    const dxf = exportDrawingDxf(document);
    const pictureArc = dxf.match(/0\r\nARC\r\n[\s\S]*?50\r\n([^\r]+)\r\n51\r\n([^\r]+)/);
    const nativeDimension = dxf.match(/0\r\nDIMENSION\r\n[\s\S]*?10\r\n([^\r]+)\r\n20\r\n([^\r]+)/);

    expect(pictureArc).not.toBeNull();
    expect(Number(pictureArc?.[1])).toBeCloseTo(330, 4);
    expect(Number(pictureArc?.[2])).toBeCloseTo(30, 4);
    expect(nativeDimension).not.toBeNull();
    expect(Number(nativeDimension?.[1])).toBeCloseTo(10, 4);
    expect(Number(nativeDimension?.[2])).toBeCloseTo(0, 4);
  });

  it('preserves source CAD layer names so drawing semantics survive round-trip export', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-layers' }, now: () => 1 });
    document.geometry = [{
      id: 'outline' as never, type: 'line', start: [0, 0], end: [10, 0], visible: true, quality,
      sourceRef: { sourceId: 'source:golden', objectType: 'LINE', layer: '1轮廓实线层' },
    }];
    document.annotations = [{
      id: 'hatch' as never, type: 'section-hatch', pattern: 'ANSI31', angle: 45, spacing: 2,
      segments: [{ start: [0, 0], end: [2, 2] }], visible: true, quality,
      sourceRef: { sourceId: 'source:golden', objectType: 'HATCH', layer: '5剖面线层' },
    }];

    const dxf = exportDrawingDxf(document);
    expect(dxf).toMatch(/0\r\nLINE\r\n[\s\S]*?8\r\n1轮廓实线层/);
    expect(dxf).toContain('8\r\n5剖面线层');
    expect(dxf).toContain('62\r\n2\r\n6\r\nContinuous');
  });
});
