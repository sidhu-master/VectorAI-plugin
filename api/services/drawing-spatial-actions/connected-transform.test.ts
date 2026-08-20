import { describe, expect, it } from 'vitest';

import {
  createEmptyDrawing,
  type GeometryId,
  type Vec2,
} from '../../../src/drawing/index.js';
import {
  compileConnectedTransform,
  findConnectedCarrierCandidates,
} from './connected-transform.js';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

describe('compileConnectedTransform', () => {
  it('summarizes connected closed carriers so the model only has to choose a carrier', () => {
    const document = fixtureAtScale(1);
    document.geometry.push({
      id: 'unconnected_circle' as GeometryId, type: 'circle', center: [100, 100], radius: 5,
      visible: true, quality: confirmed,
    });

    expect(findConnectedCarrierCandidates(document)).toEqual([{
      carrierNodeId: 'carrier', carrierType: 'circle',
      contactedOpenConnectorCount: 2, contactedPortCount: 2,
    }]);
  });

  it('moves a closed carrier while preserving fixed connector anchors and cyclic port order', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push(
      {
        id: 'carrier' as GeometryId, type: 'circle', center: [0, 0], radius: 10,
        visible: true, quality: confirmed,
      },
      {
        id: 'boundary_a' as GeometryId, type: 'line', start: [0, 10], end: [30, 30],
        visible: true, quality: confirmed,
      },
      {
        id: 'boundary_b' as GeometryId, type: 'line', start: [10, 0], end: [30, -20],
        visible: true, quality: confirmed,
      },
      {
        id: 'unrelated' as GeometryId, type: 'line', start: [-50, -50], end: [-40, -40],
        visible: true, quality: confirmed,
      },
    );

    const compiled = compileConnectedTransform({
      document,
      carrierNodeId: 'carrier',
      targetCenter: [-20, 30],
    });

    expect(compiled.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'geometry.update', id: 'carrier', changes: { center: [-20, 30] },
      }),
      expect.objectContaining({
        type: 'geometry.update', id: 'boundary_a',
        changes: { start: expect.any(Array) },
      }),
      expect.objectContaining({
        type: 'geometry.update', id: 'boundary_b',
        changes: { start: expect.any(Array) },
      }),
    ]));
    expect(compiled.audit.connectorNodeIds).toEqual(expect.arrayContaining([
      'boundary_a', 'boundary_b',
    ]));
    expect(compiled.audit.ports).toHaveLength(2);

    const portA = compiled.audit.ports.find((port) => port.connectorNodeId === 'boundary_a')!;
    const portB = compiled.audit.ports.find((port) => port.connectorNodeId === 'boundary_b')!;
    expect(distance(portA.after, [-20, 30])).toBeCloseTo(10, 8);
    expect(distance(portB.after, [-20, 30])).toBeCloseTo(10, 8);
    expect(portA.fixedAnchor).toEqual([30, 30]);
    expect(portB.fixedAnchor).toEqual([30, -20]);
    expect(angleDelta(
      angle([0, 0], portA.before),
      angle([0, 0], portB.before),
    )).toBeCloseTo(angleDelta(
      angle([-20, 30], portA.after),
      angle([-20, 30], portB.after),
    ), 8);
    expect(compiled.commands.some((command) => 'id' in command && command.id === 'unrelated'))
      .toBe(false);
  });

  it('uses drawing-relative contact tolerance and produces the same normalized result after scaling', () => {
    const base = fixtureAtScale(1);
    const scaled = fixtureAtScale(100);

    const first = compileConnectedTransform({
      document: base,
      carrierNodeId: 'carrier',
      targetCenter: [-20, 30],
    });
    const second = compileConnectedTransform({
      document: scaled,
      carrierNodeId: 'carrier',
      targetCenter: [-2_000, 3_000],
    });

    expect(second.audit.rotationDegrees).toBeCloseTo(first.audit.rotationDegrees, 8);
    second.audit.ports.forEach((port, index) => {
      expect(port.after[0] / 100).toBeCloseTo(first.audit.ports[index].after[0], 8);
      expect(port.after[1] / 100).toBeCloseTo(first.audit.ports[index].after[1], 8);
    });
  });

  it('rejects an open carrier instead of guessing a topology-changing edit', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push({
      id: 'open' as GeometryId, type: 'line', start: [0, 0], end: [10, 0],
      visible: true, quality: confirmed,
    });

    expect(() => compileConnectedTransform({
      document, carrierNodeId: 'open', targetCenter: [5, 5],
    })).toThrow('CONNECTED_TRANSFORM_CARRIER_NOT_CLOSED');
  });

  it('rejects a connected move whose requested carrier pose has no material change', () => {
    const document = fixtureAtScale(1);

    expect(() => compileConnectedTransform({
      document,
      carrierNodeId: 'carrier',
      targetCenter: [0, 0],
    })).toThrow('CONNECTED_TRANSFORM_NO_EFFECT');
  });

  it('transports a real two-port circular interface without reversing its boundary roles', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push(
      {
        id: 'carrier' as GeometryId, type: 'circle',
        center: [61.710477, 204.929327], radius: 41.487229,
        visible: true, quality: confirmed,
      },
      {
        id: 'upper_boundary' as GeometryId, type: 'line',
        start: [64.694509, 247.32261], end: [124.143616, 289.214202],
        visible: true, quality: confirmed,
      },
      {
        id: 'lower_boundary' as GeometryId, type: 'line',
        start: [102.064374, 193.174903], end: [118.992472, 204.116046],
        visible: true, quality: confirmed,
      },
      {
        id: 'extent' as GeometryId, type: 'point', x: 500, y: 650,
        visible: false, quality: confirmed,
      },
    );

    const compiled = compileConnectedTransform({
      document,
      carrierNodeId: 'carrier',
      targetCenter: [61.710477, 280],
    });
    const upper = compiled.audit.ports.find((port) => port.connectorNodeId === 'upper_boundary')!;
    const lower = compiled.audit.ports.find((port) => port.connectorNodeId === 'lower_boundary')!;

    expect(upper.after[1]).toBeGreaterThan(lower.after[1]);
    expect(lower.after[1]).toBeLessThan(compiled.audit.targetCenter[1]);
    expect(upper.fixedAnchor).toEqual([124.143616, 289.214202]);
    expect(lower.fixedAnchor).toEqual([118.992472, 204.116046]);
    expect(compiled.audit.orientationMode).toBe('minimum-deformation');
    expect(compiled.audit.rotationDegrees).toBeCloseTo(-52.839662245, 6);
    expect(distance(upper.after, compiled.audit.targetCenter)).toBeCloseTo(41.487229, 6);
    expect(distance(lower.after, compiled.audit.targetCenter)).toBeCloseTo(41.487229, 6);
    expect(upper.after).toEqual([
      expect.closeTo(96.451666, 5), expect.closeTo(302.676859, 5),
    ]);
    expect(lower.after).toEqual([
      expect.closeTo(76.524325, 5), expect.closeTo(241.247709, 5),
    ]);
  });

  it('reports scale-independent structural risks for an explicitly twisted two-port interface', () => {
    const base = realTwoPortFixture(1);
    const scaled = realTwoPortFixture(100);

    const first = compileConnectedTransform({
      document: base,
      carrierNodeId: 'carrier',
      targetCenter: [80, 280],
      rotationDegrees: 90,
    });
    const second = compileConnectedTransform({
      document: scaled,
      carrierNodeId: 'carrier',
      targetCenter: [8_000, 28_000],
      rotationDegrees: 90,
    });

    expect(first.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      'CONNECTED_INTERFACE_AREA_COLLAPSED',
      'CONNECTED_INTERFACE_EXCESSIVE_STRETCH',
      'CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION',
    ]));
    expect(first.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CONNECTED_INTERFACE_AREA_COLLAPSED',
        facts: expect.objectContaining({ areaRetentionRatio: expect.closeTo(0.0167326231, 8) }),
      }),
      expect.objectContaining({
        code: 'CONNECTED_INTERFACE_EXCESSIVE_STRETCH',
        facts: expect.objectContaining({ maximumStretchRatio: expect.closeTo(5.796082906, 8) }),
      }),
      expect.objectContaining({
        code: 'CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION',
        facts: expect.objectContaining({
          selectedRotationDegrees: 90,
          minimumDeformationRotationDegrees: expect.closeTo(-56.038407586, 8),
          deformationCostRatio: expect.closeTo(9.697382341, 8),
        }),
      }),
    ]));
    expect(second.diagnostics.map((item) => item.code).sort())
      .toEqual(first.diagnostics.map((item) => item.code).sort());
    expect(second.audit.interfaceMetrics).toMatchObject({
      areaRetentionRatio: expect.closeTo(first.audit.interfaceMetrics!.areaRetentionRatio, 8),
      maximumStretchRatio: expect.closeTo(first.audit.interfaceMetrics!.maximumStretchRatio, 8),
      deformationCostRatio: expect.closeTo(first.audit.interfaceMetrics!.deformationCostRatio, 8),
    });
  });

  it('reports orientation inversion without changing or rejecting the model candidate', () => {
    const compiled = compileConnectedTransform({
      document: realTwoPortFixture(1),
      carrierNodeId: 'carrier',
      targetCenter: [39.4, 351.3],
      rotationDegrees: 90,
    });

    expect(compiled.commands).toHaveLength(3);
    expect(compiled.diagnostics).toContainEqual(expect.objectContaining({
      code: 'CONNECTED_INTERFACE_ORIENTATION_INVERTED',
      nodeIds: expect.arrayContaining(['carrier', 'upper_boundary', 'lower_boundary']),
    }));
  });
});

function fixtureAtScale(scale: number) {
  const document = createEmptyDrawing({ now: () => 1 });
  const point = (value: Vec2): Vec2 => [value[0] * scale, value[1] * scale];
  document.geometry.push(
    {
      id: 'carrier' as GeometryId, type: 'circle', center: point([0, 0]), radius: 10 * scale,
      visible: true, quality: confirmed,
    },
    {
      id: 'boundary_a' as GeometryId, type: 'line',
      start: point([0, 10.001]), end: point([30, 30]), visible: true, quality: confirmed,
    },
    {
      id: 'boundary_b' as GeometryId, type: 'line',
      start: point([10.001, 0]), end: point([30, -20]), visible: true, quality: confirmed,
    },
  );
  return document;
}

function realTwoPortFixture(scale: number) {
  const document = createEmptyDrawing({ now: () => 1 });
  const point = (value: Vec2): Vec2 => [value[0] * scale, value[1] * scale];
  document.geometry.push(
    {
      id: 'carrier' as GeometryId, type: 'circle',
      center: point([61.710477, 204.929327]), radius: 41.487229 * scale,
      visible: true, quality: confirmed,
    },
    {
      id: 'upper_boundary' as GeometryId, type: 'line',
      start: point([64.694509, 247.32261]), end: point([124.143616, 289.214202]),
      visible: true, quality: confirmed,
    },
    {
      id: 'lower_boundary' as GeometryId, type: 'line',
      start: point([102.064374, 193.174903]), end: point([118.992472, 204.116046]),
      visible: true, quality: confirmed,
    },
    {
      id: 'extent' as GeometryId, type: 'point', x: 500 * scale, y: 650 * scale,
      visible: false, quality: confirmed,
    },
  );
  return document;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function angle(center: Vec2, point: Vec2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function angleDelta(first: number, second: number): number {
  let value = second - first;
  while (value <= -Math.PI) value += Math.PI * 2;
  while (value > Math.PI) value -= Math.PI * 2;
  return value;
}
