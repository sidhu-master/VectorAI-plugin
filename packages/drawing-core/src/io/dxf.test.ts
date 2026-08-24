// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../document';
import { exportDrawingDxf } from './dxf';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

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
    expect(dxf).toContain('9\r\n$ACADVER\r\n1\r\nAC1015');
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
    expect(dxf).toContain('8\r\nANNOTATIONS');
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
});
