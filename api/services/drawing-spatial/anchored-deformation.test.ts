import { describe, expect, it } from 'vitest';

import type { GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { applyAnchoredDeformation } from './anchored-deformation.js';

describe('applyAnchoredDeformation', () => {
  it('keeps every attachment anchor fixed while moving a connector between them', () => {
    const connector: GeometryNode = {
      id: 'connector_between_anchors' as GeometryId,
      type: 'polyline',
      vertices: [
        { point: [0, 0] },
        { point: [5, 0] },
        { point: [10, 0] },
      ],
      closed: false,
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    };

    const deformed = applyAnchoredDeformation(
      connector,
      { kind: 'rotate', center: [0, 0], angleDegrees: 90 },
      { anchors: [[0, 0], [10, 0]], targetGeometry: [connector], tolerance: 0.01 },
    );

    expect(deformed.type).toBe('polyline');
    if (deformed.type !== 'polyline') return;
    expect(deformed.vertices[0].point).toEqual([0, 0]);
    expect(deformed.vertices.at(-1)?.point).toEqual([10, 0]);
    expect(deformed.vertices[1].point).not.toEqual([5, 0]);
  });

  it('moves a free connector endpoint with its terminal arc while keeping the interface fixed', () => {
    const connector: GeometryNode = {
      id: 'connector_edge' as GeometryId,
      type: 'line', start: [0, 0], end: [10, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    };
    const terminal: GeometryNode = {
      id: 'terminal_arc' as GeometryId,
      type: 'arc', center: [0, -5], radius: 5,
      startAngle: 90, endAngle: 270, counterClockwise: true, visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    };
    const context = {
      anchors: [[10, 0] as [number, number]],
      targetGeometry: [connector, terminal],
      tolerance: 0.01,
    };
    const transform = { kind: 'rotate' as const, center: [10, 0] as [number, number], angleDegrees: 90 };

    const movedConnector = applyAnchoredDeformation(connector, transform, context);
    const movedTerminal = applyAnchoredDeformation(terminal, transform, context);

    expect(movedConnector.type).toBe('line');
    expect(movedTerminal.type).toBe('arc');
    if (movedConnector.type !== 'line' || movedTerminal.type !== 'arc') return;
    expect(movedConnector.end).toEqual([10, 0]);
    expect(movedConnector.start[0]).toBeCloseTo(10, 8);
    expect(movedConnector.start[1]).toBeCloseTo(-10, 8);
    const terminalStart = [
      movedTerminal.center[0] + movedTerminal.radius * Math.cos(movedTerminal.startAngle * Math.PI / 180),
      movedTerminal.center[1] + movedTerminal.radius * Math.sin(movedTerminal.startAngle * Math.PI / 180),
    ];
    expect(movedConnector.start[0]).toBeCloseTo(terminalStart[0], 8);
    expect(movedConnector.start[1]).toBeCloseTo(terminalStart[1], 8);
  });
});
