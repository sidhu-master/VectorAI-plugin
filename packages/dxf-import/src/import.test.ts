// SPDX-License-Identifier: Apache-2.0

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
