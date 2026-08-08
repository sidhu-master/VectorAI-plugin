import { describe, expect, it } from 'vitest';

import { migrateModelToCurrent } from '../migrate';
import { createEmptyModel } from '../model';
import type { GeometryEntity, SpatialModel } from '../types';

const entities: GeometryEntity[] = [
  { id: 'point', type: 'point', visible: true, x: 1, y: 2, confidence: 0.91 },
  { id: 'line', type: 'line', visible: true, start: [0, 0], end: [10, 0] },
  { id: 'ray', type: 'ray', visible: true, origin: [0, 0], direction: [1, 0] },
  { id: 'xline', type: 'xline', visible: true, origin: [0, 0], direction: [0, 1] },
  { id: 'circle', type: 'circle', visible: true, center: [5, 5], radius: 2 },
  {
    id: 'arc', type: 'arc', visible: true, center: [5, 5], radius: 2,
    startAngle: 0, endAngle: 90, counterClockwise: true,
  },
  {
    id: 'ellipse', type: 'ellipse', visible: true, center: [5, 5], majorAxis: [4, 0],
    ratio: 0.5, startParam: 0, endParam: 180,
  },
  {
    id: 'polyline', type: 'polyline', visible: true, closed: false,
    vertices: [{ point: [0, 0] }, { point: [4, 0], bulge: 0.2 }],
  },
  {
    id: 'spline', type: 'spline', visible: true, degree: 2,
    controlPoints: [[0, 0], [2, 3], [4, 0]], knots: [0, 0, 0, 1, 1, 1],
    weights: [1, 0.8, 1], closed: false, periodic: false,
  },
  {
    id: 'text', type: 'text', visible: true, content: '孔径\nØ10', position: [0, 0],
    height: 2.5, rotation: 0, alignment: 'center', verticalAlignment: 'middle', maxWidth: 20,
  },
  {
    id: 'dimension', type: 'dimension', visible: true, dimensionKind: 'linear',
    associationStatus: 'resolved',
    targets: [
      { entityId: 'line', anchor: { kind: 'start' } },
      { entityId: 'line', anchor: { kind: 'end' } },
    ],
    candidates: [{
      targets: [{ entityId: 'line', anchor: { kind: 'nearest', point: [5, 0] } }],
      score: 0.4,
      reasons: ['候选参考'],
    }],
    observedValue: 10,
    computedValue: 10,
    unit: 'mm',
    tolerance: { upper: 0.1, lower: -0.1 },
    textPosition: [5, 2],
    definitionPoints: [[0, 0], [10, 0]],
  },
];

describe('Spatial Protocol v0.2 migration', () => {
  it('defines every explicit 2D CAD entity discriminant', () => {
    expect(entities.map((entity) => entity.type)).toEqual([
      'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse',
      'polyline', 'spline', 'text', 'dimension',
    ]);
  });

  it('creates new models at protocol version 0.2', () => {
    expect(createEmptyModel().version).toBe('0.2');
  });

  it('migrates v0.1 point, line, and circle data without creating commits', () => {
    const legacy: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: 1 },
      entities: [
        { id: 'p1', type: 'point', visible: true, x: 1, y: 2, confidence: 0.55 },
        { id: 'l1', type: 'line', visible: true, start: [0, 0], end: [10, 0] },
        { id: 'c1', type: 'circle', visible: true, center: [5, 5], radius: 2 },
      ],
      relations: [],
    };
    const snapshot = structuredClone(legacy);

    const migrated = migrateModelToCurrent(legacy);

    expect(migrated.version).toBe('0.2');
    expect(migrated.entities).toEqual(legacy.entities);
    expect(migrated.entities[0].confidence).toBe(0.55);
    expect(migrated).not.toBe(legacy);
    expect(migrated.entities).not.toBe(legacy.entities);
    expect(legacy).toEqual(snapshot);
    expect(migrated).not.toHaveProperty('commits');
  });

  it('returns an isolated current-version copy and rejects unknown versions', () => {
    const current: SpatialModel = {
      ...createEmptyModel(),
      entities,
    };

    const migrated = migrateModelToCurrent(current);
    expect(migrated).toEqual(current);
    expect(migrated).not.toBe(current);
    expect(() => migrateModelToCurrent({ ...current, version: '9.9' })).toThrow(/9\.9/);
  });
});
