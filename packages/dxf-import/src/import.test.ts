// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  convertLength,
  exportDrawingDxf,
  type DimensionAnnotation,
  type DrawingDocument,
  type ToleranceProjection,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { importDxf } from './import';

const fixture = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
5
10
8
OUTLINE
10
0
20
0
11
10
21
0
0
ARC
5
11
8
OUTLINE
10
5
20
5
40
5
50
0
51
90
0
SPLINE
5
12
8
CURVE
70
0
71
2
72
6
73
3
40
0
40
0
40
0
40
1
40
1
40
1
10
1
20
0
10
1
20
1
10
0
20
1
0
HATCH
5
13
8
HATCHING
100
AcDbHatch
2
ANSI31
70
0
71
0
91
1
92
2
72
0
73
1
93
4
10
0
20
0
10
2
20
0
10
2
20
2
10
0
20
2
97
0
75
0
76
1
52
0
41
1
77
0
78
1
53
45
43
0
44
0
45
-2
46
2
79
0
98
1
10
1
20
1
0
VIEWPORT
5
14
8
0
0
ENDSEC
0
EOF
`;

function toleranceDrawing(input: {
  drawingUnit?: DrawingDocument['unitSystem']['length'];
  dimensionKind?: DimensionAnnotation['dimensionKind'];
  projection?: ToleranceProjection;
} = {}): DrawingDocument {
  const drawingUnit = input.drawingUnit ?? 'mm';
  const document = createEmptyDrawing({
    unit: drawingUnit,
    idFactory: { next: () => `drawing-tolerance-${drawingUnit}` },
    now: () => 1,
  });
  document.geometry = [{
    id: 'line-tolerance' as never,
    type: 'line',
    start: [0, 0],
    end: [13, 0],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  const dimensionKind = input.dimensionKind ?? 'linear';
  document.annotations = [{
    id: 'dimension-tolerance' as never,
    type: 'dimension',
    dimensionKind,
    associationStatus: 'resolved',
    targets: [],
    computedValue: 13,
    displayText: dimensionKind === 'diameter' ? '⌀13' : '13',
    unit: drawingUnit,
    textPosition: [6.5, 2],
    definitionPoints: [[0, 0], [13, 0]],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    ...(input.projection === undefined ? {} : { toleranceProjection: input.projection }),
  } satisfies DimensionAnnotation];
  return document;
}

function importExported(document: DrawingDocument, digest: string) {
  return importDxf({
    bytes: new TextEncoder().encode(exportDrawingDxf(document)),
    source: { digest },
    drawingId: `drawing:imported:${digest}`,
    now: () => 2,
  });
}

function importedDimension(result: ReturnType<typeof importDxf>): DimensionAnnotation {
  expect(result.status).toBe('imported');
  if (result.status !== 'imported') throw new Error('Expected imported DXF');
  const dimension = result.document.annotations.find(
    (annotation): annotation is DimensionAnnotation => annotation.type === 'dimension',
  );
  expect(dimension).toBeDefined();
  if (dimension === undefined) throw new Error('Expected imported DIMENSION');
  return dimension;
}

describe('canonical DXF import', () => {
  it('normalizes supported model-space entities with stable source provenance', () => {
    const result = importDxf({
      bytes: new TextEncoder().encode(fixture),
      source: { name: 'fixture.dxf', digest: 'sha256:fixture' },
      drawingId: 'drawing:fixture',
      now: () => 1,
    });

    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.document.unitSystem.length).toBe('mm');
    expect(result.document.geometry.map(({ type }) => type)).toEqual(['line', 'arc', 'spline']);
    expect(result.document.annotations.map(({ type }) => type)).toEqual(['section-hatch']);
    expect(result.document.geometry[0].sourceRef).toEqual({
      sourceId: 'source:sha256:fixture',
      objectId: '10',
      objectType: 'LINE',
      layer: 'OUTLINE',
    });
    expect(result.counts).toEqual({ LINE: 1, ARC: 1, SPLINE: 1, HATCH: 1, VIEWPORT: 1 });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'DXF_VIEWPORT_IGNORED' }));
    expect(result.bounds).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it('rejects missing units without publishing a partial canonical document', () => {
    const result = importDxf({
      bytes: new TextEncoder().encode(fixture.replace('$INSUNITS', '$OTHER')),
      source: { digest: 'sha256:bad-units' },
      drawingId: 'drawing:bad',
    });

    expect(result.status).toBe('rejected');
    expect(result).not.toHaveProperty('document');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'DXF_UNITS_REQUIRED',
    }));
  });

  it('round-trips native CAD DIMENSION entities as editable canonical annotations', () => {
    const dimension = `0
DIMENSION
5
20
8
7标注层
2
*D1
10
10
20
15
11
5
21
18
70
160
42
10
1
10 mm
3
GB_LINEAR
13
0
23
0
14
10
24
0
`;
    const result = importDxf({
      bytes: new TextEncoder().encode(fixture.replace('0\nVIEWPORT', `${dimension}0\nVIEWPORT`)),
      source: { digest: 'sha256:dimension-roundtrip' }, drawingId: 'drawing:dimension', now: () => 1,
    });

    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.document.annotations).toContainEqual(expect.objectContaining({
      type: 'dimension', dimensionKind: 'linear', computedValue: 10,
      displayText: '10 mm', textPosition: [5, 18], visible: true,
    }));
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'DXF_ENTITY_UNSUPPORTED', message: 'Unsupported DXF entity DIMENSION',
    }));
  });

  it('round-trips an inch drawing and assigns its header unit to imported non-angular dimensions', () => {
    const document = createEmptyDrawing({ unit: 'in', idFactory: { next: () => 'drawing-inch-roundtrip' }, now: () => 1 });
    document.geometry = [{
      id: 'line-inch' as never, type: 'line', start: [0, 0], end: [.5, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    document.annotations = [{
      id: 'diameter-inch' as never, type: 'dimension', dimensionKind: 'diameter', associationStatus: 'resolved',
      targets: [], computedValue: .5, displayText: '⌀0.5', unit: 'in', textPosition: [.25, .2],
      definitionPoints: [[0, 0], [.5, 0]], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      toleranceProjection: {
        mode: 'bilateral', fitDesignation: 'H7', upperDeviation: .018, lowerDeviation: 0,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'internal',
        standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both', evidenceRefs: ['standard:H7'],
      },
    } satisfies DimensionAnnotation];

    const result = importDxf({
      bytes: new TextEncoder().encode(exportDrawingDxf(document)),
      source: { digest: 'sha256:inch-roundtrip' }, drawingId: 'drawing:inch-roundtrip', now: () => 1,
    });

    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.document.unitSystem.length).toBe('in');
    expect(result.document.annotations).toContainEqual(expect.objectContaining({
      type: 'dimension', dimensionKind: 'diameter', computedValue: .5, unit: 'in',
    }));
    expect(importedDimension(result).toleranceProjection).toMatchObject({
      mode: 'bilateral',
      fitDesignation: 'H7',
      upperDeviation: .018,
      lowerDeviation: 0,
      unit: 'mm',
      source: 'standard',
      status: 'confirmed',
      featureClass: 'internal',
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      displayPreference: 'both',
    });
  });

  it.each(['mm', 'cm', 'm', 'in'] as const)(
    'rebuilds the complete portable tolerance from ACAD DSTYLE and short VECTORAI XDATA in a %s drawing',
    (drawingUnit) => {
      const result = importExported(toleranceDrawing({
        drawingUnit,
        projection: {
          mode: 'bilateral',
          fitDesignation: 'H7',
          upperDeviation: .021,
          lowerDeviation: -.012,
          unit: 'mm',
          source: 'standard',
          status: 'confirmed',
          featureClass: 'internal',
          standardRef: { id: 'ISO 286-2', edition: '2010' },
          displayPreference: 'both',
          evidenceRefs: ['standard:ISO-286-2:H7'],
        },
      }), `sha256:short-${drawingUnit}`);

      expect(importedDimension(result).toleranceProjection).toEqual({
        mode: 'bilateral',
        fitDesignation: 'H7',
        upperDeviation: .021,
        lowerDeviation: -.012,
        unit: 'mm',
        source: 'standard',
        status: 'confirmed',
        featureClass: 'internal',
        standardRef: { id: 'ISO 286-2', edition: '2010' },
        displayPreference: 'both',
        evidenceRefs: ['dxf:vectorai-tolerance'],
      });
    },
  );

  it('round-trips same-sign tolerance deviations through VECTORAI XDATA when native DSTYLE is ineligible', () => {
    const result = importExported(toleranceDrawing({
      projection: {
        mode: 'bilateral',
        fitDesignation: 'u6',
        upperDeviation: .044,
        lowerDeviation: .033,
        unit: 'mm',
        source: 'standard',
        status: 'confirmed',
        featureClass: 'external',
        standardRef: { id: 'GB/T 1800.2', edition: '2020' },
        displayPreference: 'both',
        evidenceRefs: ['standard:u6'],
      },
    }), 'sha256:same-sign');

    expect(importedDimension(result).toleranceProjection).toMatchObject({
      fitDesignation: 'u6',
      upperDeviation: .044,
      lowerDeviation: .033,
      unit: 'mm',
      featureClass: 'external',
      displayPreference: 'both',
    });
  });

  it('validates and rejoins deterministic UTF-8 VECTORAI chunks without truncating the standard reference', () => {
    const id = '国家标准'.repeat(180);
    const edition = '版本'.repeat(140);
    const result = importExported(toleranceDrawing({
      projection: {
        mode: 'bilateral',
        fitDesignation: 'H7',
        upperDeviation: .021,
        lowerDeviation: 0,
        unit: 'mm',
        source: 'standard',
        status: 'confirmed',
        featureClass: 'internal',
        standardRef: { id, edition },
        displayPreference: 'designation',
        evidenceRefs: ['standard:long'],
      },
    }), 'sha256:chunked');

    expect(importedDimension(result).toleranceProjection).toMatchObject({
      fitDesignation: 'H7',
      standardRef: { id, edition },
      displayPreference: 'designation',
    });
  });

  it('safely ignores malformed VECTORAI chunk metadata and reports a stable warning', () => {
    const standardId = '国家标准'.repeat(180);
    const exported = exportDrawingDxf(toleranceDrawing({
      projection: {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: standardId, edition: '2020' }, displayPreference: 'both',
        evidenceRefs: ['standard:u6'],
      },
    }));
    const malformed = exported.replace(/"chunkCount":(\d+)/u, (_match, count: string) => (
      `"chunkCount":${Number(count) + 1}`
    ));
    const result = importDxf({
      bytes: new TextEncoder().encode(malformed),
      source: { digest: 'sha256:malformed-chunks' },
      drawingId: 'drawing:malformed-chunks',
    });

    expect(result.status).toBe('imported');
    expect(importedDimension(result).toleranceProjection).toBeUndefined();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'warning', code: 'DXF_TOLERANCE_XDATA_INVALID',
      message: 'DXF_TOLERANCE_XDATA_CHUNK_COUNT_INVALID',
    }));
  });

  it('rejects tampered chunk byte lengths, oversized strings, and aggregate overflow deterministically', () => {
    const standardId = '国家标准'.repeat(180);
    const chunked = exportDrawingDxf(toleranceDrawing({
      projection: {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: standardId, edition: '2020' }, displayPreference: 'both', evidenceRefs: ['standard:u6'],
      },
    }));
    const short = exportDrawingDxf(toleranceDrawing({
      projection: {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: 'GB/T 1800.2', edition: '2020' }, displayPreference: 'both', evidenceRefs: ['standard:u6'],
      },
    }));
    const cases = [
      {
        code: 'DXF_TOLERANCE_XDATA_BYTE_LENGTH_MISMATCH',
        dxf: chunked.replace(/"byteLength":(\d+)/u, (_match, length: string) => `"byteLength":${Number(length) + 1}`),
      },
      {
        code: 'DXF_TOLERANCE_XDATA_CHUNK_COUNT_INVALID',
        dxf: chunked.replace(/"chunkCount":(\d+)/u, (_match, count: string) => `"chunkCount":"${count}"`),
      },
      {
        code: 'DXF_TOLERANCE_XDATA_PAYLOAD_INVALID',
        dxf: short.replace(/"upperDeviation":0\.044/u, '"upperDeviation":"0.044"'),
      },
      {
        code: 'DXF_TOLERANCE_XDATA_STRING_TOO_LONG',
        dxf: short.replace(/1001\r\nVECTORAI\r\n1000\r\n[^\r\n]+/u, `1001\r\nVECTORAI\r\n1000\r\n${'x'.repeat(255)}`),
      },
      {
        code: 'DXF_TOLERANCE_XDATA_AGGREGATE_TOO_LONG',
        dxf: short.replace(
          /1001\r\nVECTORAI\r\n1000\r\n[^\r\n]+/u,
          `1001\r\nVECTORAI\r\n${Array.from({ length: 65 }, () => `1000\r\n${'x'.repeat(254)}`).join('\r\n')}`,
        ),
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const result = importDxf({
        bytes: new TextEncoder().encode(testCase.dxf),
        source: { digest: `sha256:xdata-limit-${index}` },
        drawingId: `drawing:xdata-limit-${index}`,
      });
      expect(result.status).toBe('imported');
      expect(importedDimension(result).toleranceProjection).toBeUndefined();
      expect(result.diagnostics).toContainEqual(expect.objectContaining({
        severity: 'warning', code: 'DXF_TOLERANCE_XDATA_INVALID', message: testCase.code,
      }));
    }
  });

  it('uses only REGAPP-scoped tolerance data and safely imports legacy dimensions without it', () => {
    const document = toleranceDrawing({
      projection: {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: 'GB/T 1800.2', edition: '2020' }, displayPreference: 'both',
        evidenceRefs: ['standard:u6'],
      },
    });
    const wrongRegapp = exportDrawingDxf(document).replace('1001\r\nVECTORAI\r\n', '1001\r\nOTHERAPP\r\n');
    const result = importDxf({
      bytes: new TextEncoder().encode(wrongRegapp),
      source: { digest: 'sha256:wrong-regapp' },
      drawingId: 'drawing:wrong-regapp',
    });

    expect(result.status).toBe('imported');
    expect(importedDimension(result).toleranceProjection).toBeUndefined();
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'DXF_ENTITY_INVALID' }));
  });

  it.each(['mm', 'cm', 'm', 'in'] as const)(
    'reconstructs native ACAD DSTYLE in the drawing unit when VECTORAI metadata is absent (%s)',
    (drawingUnit) => {
      const result = importExported(toleranceDrawing({
        drawingUnit,
        projection: {
          mode: 'bilateral', upperDeviation: .02, lowerDeviation: -.01,
          unit: 'mm', source: 'manual', status: 'confirmed', displayPreference: 'deviations',
          evidenceRefs: ['manual:tolerance'],
        },
      }), `sha256:native-only-${drawingUnit}`);

      expect(importedDimension(result).toleranceProjection).toEqual({
        mode: 'bilateral',
        upperDeviation: convertLength(.02, 'mm', drawingUnit),
        lowerDeviation: convertLength(-.01, 'mm', drawingUnit),
        unit: drawingUnit, source: 'document', status: 'confirmed', displayPreference: 'deviations',
        evidenceRefs: ['dxf:acad-dstyle'],
      });
    },
  );

  it('reconstructs fit mode and the complete pair designation for a VECTORAI fit member', () => {
    const result = importExported(toleranceDrawing({
      projection: {
        mode: 'fit', fitDesignation: 'H7/g6', upperDeviation: -.006, lowerDeviation: -.017,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef: { id: 'GB/T 1800.2', edition: '2020' }, displayPreference: 'both',
        evidenceRefs: ['standard:H7/g6'],
      },
    }), 'sha256:fit-member');

    expect(importedDimension(result).toleranceProjection).toMatchObject({
      mode: 'fit', fitDesignation: 'H7/g6', featureClass: 'external',
      upperDeviation: -.006, lowerDeviation: -.017, displayPreference: 'both',
    });
  });

  it('writes and imports distinct native diametric definition endpoints according to DXF group semantics', () => {
    const exported = exportDrawingDxf(toleranceDrawing({ dimensionKind: 'diameter' }));
    const dimensionEntity = exported.match(/0\r\nDIMENSION\r\n([\s\S]*?)0\r\n(?:INSERT|ENDSEC)\r\n/u)?.[1] ?? '';
    const group10 = dimensionEntity.match(/(?:^|\r\n)10\r\n([^\r\n]+)/u)?.[1];
    const group15 = dimensionEntity.match(/(?:^|\r\n)15\r\n([^\r\n]+)/u)?.[1];
    expect(group10).toBe('0');
    expect(group15).toBe('13');

    const dimension = importedDimension(importDxf({
      bytes: new TextEncoder().encode(exported),
      source: { digest: 'sha256:diameter-points' },
      drawingId: 'drawing:diameter-points',
    }));
    expect(dimension.definitionPoints[0]).toEqual([0, 0]);
    expect(dimension.definitionPoints[1]).toEqual([13, 0]);
    expect(dimension.definitionPoints[0]).not.toEqual(dimension.definitionPoints[1]);
  });

  it('rejects unterminated sections and invalid supported entities atomically', () => {
    const unterminated = importDxf({
      bytes: new TextEncoder().encode(fixture.replace('0\nENDSEC\n0\nEOF\n', '0\nEOF\n')),
      source: { digest: 'sha256:unterminated' }, drawingId: 'drawing:bad',
    });
    expect(unterminated).toMatchObject({ status: 'rejected' });
    expect(unterminated).not.toHaveProperty('document');
    expect(unterminated.diagnostics).toContainEqual(expect.objectContaining({ code: 'DXF_SECTION_STRUCTURE_INVALID' }));

    const invalidEntity = importDxf({
      bytes: new TextEncoder().encode(fixture.replace('11\n10\n21\n0', '11\nnot-a-number\n21\n0')),
      source: { digest: 'sha256:invalid-entity' }, drawingId: 'drawing:bad',
    });
    expect(invalidEntity).toMatchObject({ status: 'rejected' });
    expect(invalidEntity).not.toHaveProperty('document');
    expect(invalidEntity.diagnostics).toContainEqual(expect.objectContaining({ code: 'DXF_ENTITY_INVALID', severity: 'error' }));
  });
});
