// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId, type GeometryNode, type Vec2 } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { buildShaftContourTopology } from './contour-topology';
import { resolveShaftAxis } from './axis';

describe('shaft contour topology', () => {
  it.each([0, Math.PI / 2, Math.PI * 0.31])('keeps stations invariant after rotation and scale (%s)', (angle) => {
    const base = steppedGeometry();
    const transform = ([x, y]: Vec2): Vec2 => [
      (x * Math.cos(angle) - y * Math.sin(angle)) * 10 + 73,
      (x * Math.sin(angle) + y * Math.cos(angle)) * 10 - 19,
    ];
    const document = drawing(base.map((node) => transformNode(node, transform)));
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [] })!;
    const topology = buildShaftContourTopology(document, axis);

    expect(topology.stations.map(({ z }) => z / 10)).toEqual([
      expect.closeTo(0, 5), expect.closeTo(10, 5), expect.closeTo(25, 5), expect.closeTo(40, 5),
    ]);
    expect(topology.positiveProfile.map(({ radius }) => radius / 10)).toEqual([
      expect.closeTo(5, 5), expect.closeTo(8, 5), expect.closeTo(4, 5),
    ]);
  });

  it('excludes annotation, hatch, centerline and construction geometry from the contour', () => {
    const polluted = [...steppedGeometry(),
      line('annotation', [-30, 30], [70, 30], 'DIMENSION', '7标注层'),
      line('hatch', [-20, -20], [60, 20], 'HATCH', '5剖面线层'),
      line('center', [-10, 0], [50, 0], 'LINE', '3中心线层'),
      line('construction', [17, -40], [17, 40], 'LINE', 'construction'),
    ];
    const document = drawing(polluted);
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [] })!;
    const topology = buildShaftContourTopology(document, axis);

    expect(topology.stations.map(({ z }) => Math.round(z))).toEqual([0, 10, 25, 40]);
    expect(topology.evidenceIds.some((id) => /annotation|hatch|center|construction/u.test(id))).toBe(false);
  });

  it('does not turn sampled fillet points into dimension shoulders', () => {
    const document = drawing([
      line('top-left', [0, 5], [8, 5]),
      arc('top-fillet', [8, 7], 2, 270, 360),
      line('top-right', [10, 7], [20, 7]),
      line('bottom-left', [0, -5], [8, -5]),
      arc('bottom-fillet', [8, -7], 2, 0, 90),
      line('bottom-right', [10, -7], [20, -7]),
      line('end-left', [0, -5], [0, 5]),
      line('end-right', [20, -7], [20, 7]),
    ]);
    const axis = resolveShaftAxis(document, { orientation: 'auto', regions: [] })!;
    const topology = buildShaftContourTopology(document, axis);

    expect(topology.transitions.filter(({ kind }) => kind === 'shoulder')).toEqual([
      expect.objectContaining({ z: 10 }),
    ]);
    expect(topology.stations.map(({ z }) => z)).toEqual([0, 10, 20]);
    expect(topology.transitions.filter(({ kind }) => kind === 'fillet-or-groove'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ z: 8 }),
      ]));
  });
});

function steppedGeometry(): GeometryNode[] {
  return [
    line('top-left', [0, 5], [10, 5]), line('top-mid', [10, 8], [25, 8]), line('top-right', [25, 4], [40, 4]),
    line('bottom-left', [0, -5], [10, -5]), line('bottom-mid', [10, -8], [25, -8]), line('bottom-right', [25, -4], [40, -4]),
    line('end-left', [0, -5], [0, 5]), line('step-a-top', [10, 5], [10, 8]), line('step-a-bottom', [10, -5], [10, -8]),
    line('step-b-top', [25, 8], [25, 4]), line('step-b-bottom', [25, -8], [25, -4]), line('end-right', [40, -4], [40, 4]),
  ];
}

function drawing(geometry: GeometryNode[]) {
  const document = createEmptyDrawing({ idFactory: { next: () => 'shaft' }, now: () => 1 });
  document.geometry = geometry;
  return document;
}

function line(id: string, start: Vec2, end: Vec2, objectType = 'LINE', layer = '1轮廓实线层'): GeometryNode {
  return {
    id: id as GeometryId, type: 'line', start, end, visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    sourceRef: { sourceId: 'source', objectId: id, objectType, layer },
  };
}

function arc(
  id: string,
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
): GeometryNode {
  return {
    id: id as GeometryId,
    type: 'arc',
    center,
    radius,
    startAngle,
    endAngle,
    counterClockwise: true,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    sourceRef: { sourceId: 'source', objectId: id, objectType: 'ARC', layer: '1轮廓实线层' },
  };
}

function transformNode(node: GeometryNode, transform: (point: Vec2) => Vec2): GeometryNode {
  if (node.type !== 'line') return node;
  return { ...node, start: transform(node.start), end: transform(node.end) };
}
