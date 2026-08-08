import { beforeEach, describe, expect, it } from 'vitest';

import { compileIntent, resetIdCounter } from '../compiler';
import { computeDimensionValue, refreshDimensions } from '../dimensions';
import { createEmptyModel } from '../model';
import type { DimensionEntity, DimensionKind, SpatialModel } from '../types';
import { validateModel } from '../validator';

describe('text and associative dimensions', () => {
  beforeEach(() => resetIdCounter());

  it('compiles single-line/multiline text and an associative dimension', () => {
    const { model, errors } = compileIntent({
      objects: [
        {
          type: 'text', params: {
            content: 'Ø10', position: [1, 2], height: 2.5, rotation: -90,
            alignment: 'center', verticalAlignment: 'middle',
          },
        },
        {
          type: 'text', params: {
            content: '技术要求\n去毛刺', position: [5, 6], height: 3, maxWidth: 40,
          },
        },
        {
          type: 'dimension', params: {
            dimensionKind: 'linear', associationStatus: 'resolved',
            targets: [
              { entityId: 'line_1', anchor: { kind: 'start' } },
              { entityId: 'line_1', anchor: { kind: 'end' } },
            ],
            observedValue: 10, unit: 'mm', tolerance: { upper: 0.1, lower: -0.1 },
            textPosition: [5, 2], definitionPoints: [[0, 0], [10, 0]],
          },
        },
      ],
    });

    expect(errors).toEqual([]);
    expect(model.entities[0]).toMatchObject({
      type: 'text', content: 'Ø10', rotation: 270,
      alignment: 'center', verticalAlignment: 'middle',
    });
    expect(model.entities[1]).toMatchObject({
      type: 'text', content: '技术要求\n去毛刺', maxWidth: 40,
      rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
    });
    expect(model.entities[2]).toMatchObject({
      type: 'dimension', dimensionKind: 'linear', associationStatus: 'resolved',
      observedValue: 10,
    });
  });

  it('computes all seven dimension kinds from explicit geometry targets', () => {
    const model = measurementModel();
    const kinds: Array<[DimensionKind, string[], number]> = [
      ['linear', ['line'], 5],
      ['aligned', ['line'], 5],
      ['angular', ['line', 'vertical'], 90],
      ['radius', ['circle'], 10],
      ['diameter', ['circle'], 20],
      ['ordinate', ['line'], 5],
      ['arc-length', ['arc'], Math.PI * 5],
    ];

    for (const [kind, targetIds, expected] of kinds) {
      const dimension = dimensionFor(kind, targetIds);
      expect(computeDimensionValue(model, dimension)).toBeCloseTo(expected, 8);
    }
  });

  it('validates resolved anchors, dangling references, and ambiguous candidates', () => {
    const model = measurementModel();
    model.entities.push(dimensionFor('linear', ['missing']));
    model.entities.push({
      ...dimensionFor('linear', []),
      id: 'ambiguous',
      associationStatus: 'ambiguous',
      candidates: [{ targets: [], score: 0.4, reasons: ['只有一个候选'] }],
    });

    const validation = validateModel(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('missing');
    expect(validation.errors.join(' ')).toContain('candidates');
  });

  it('marks observed/computed mismatches as conflict and honors tolerance', () => {
    const model = measurementModel();
    model.entities.push({ ...dimensionFor('linear', ['line']), observedValue: 6 });
    model.entities.push({
      ...dimensionFor('linear', ['line']), id: 'within_tolerance', observedValue: 5.1,
      tolerance: { upper: 0.2, lower: -0.2 },
    });

    const refreshed = refreshDimensions(model);
    const conflict = refreshed.entities.find((entity) => entity.id === 'dim') as DimensionEntity;
    const tolerated = refreshed.entities.find((entity) => entity.id === 'within_tolerance') as DimensionEntity;
    expect(conflict).toMatchObject({ computedValue: 5, associationStatus: 'conflict' });
    expect(tolerated).toMatchObject({ computedValue: 5, associationStatus: 'resolved' });
    expect(model.entities.find((entity) => entity.id === 'dim')).not.toHaveProperty('computedValue');
  });

  it('refreshes computed values after geometry edits without mutating geometry', () => {
    const model = measurementModel();
    model.entities.push(dimensionFor('linear', ['line']));
    const line = model.entities.find((entity) => entity.id === 'line');
    if (!line || line.type !== 'line') throw new Error('expected line');
    line.end = [0, 12];

    const refreshed = refreshDimensions(model);
    const dimension = refreshed.entities.find((entity) => entity.id === 'dim') as DimensionEntity;
    const refreshedLine = refreshed.entities.find((entity) => entity.id === 'line');
    expect(dimension.computedValue).toBe(12);
    expect(refreshedLine).toEqual(line);
    expect(refreshedLine).not.toBe(line);
  });
});

function measurementModel(): SpatialModel {
  const model = createEmptyModel();
  model.entities.push(
    { id: 'line', type: 'line', visible: true, start: [0, 0], end: [5, 0] },
    { id: 'vertical', type: 'line', visible: true, start: [0, 0], end: [0, 5] },
    { id: 'circle', type: 'circle', visible: true, center: [0, 0], radius: 10 },
    {
      id: 'arc', type: 'arc', visible: true, center: [0, 0], radius: 10,
      startAngle: 0, endAngle: 90, counterClockwise: true,
    },
  );
  return model;
}

function dimensionFor(kind: DimensionKind, entityIds: string[]): DimensionEntity {
  const targets = kind === 'angular'
    ? entityIds.map((entityId) => ({ entityId, anchor: { kind: 'start' as const } }))
    : kind === 'radius' || kind === 'diameter' || kind === 'arc-length'
      ? entityIds.map((entityId) => ({ entityId, anchor: { kind: 'center' as const } }))
      : entityIds.flatMap((entityId) => [
          { entityId, anchor: { kind: 'start' as const } },
          { entityId, anchor: { kind: 'end' as const } },
        ]);
  return {
    id: 'dim', type: 'dimension', visible: true, dimensionKind: kind,
    associationStatus: 'resolved', targets, textPosition: [0, 0],
    definitionPoints: [[0, 0], [3, 4]],
  };
}
