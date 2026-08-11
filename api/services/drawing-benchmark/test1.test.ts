import { describe, expect, it } from 'vitest';

import type { DrawingDocument, GeometryNode } from '../../../src/drawing/index.js';
import { scoreDrawingBenchmark } from './score.js';

const TEST1_TOLERANCE = {
  sourcePixelDistance: 1,
  angleDegrees: 0.5,
  edgeF1: 0.995,
};

describe('drawing golden benchmark', () => {
  it('passes an exact semantic drawing', () => {
    const golden = drawingWith([
      arc('test1_mouth', [40, 50], 20, 200, 340),
      circle('test1_nose', [40, 35], 5),
    ]);

    const report = scoreDrawingBenchmark(golden, golden, TEST1_TOLERANCE);

    expect(report).toMatchObject({
      passed: true,
      entity: {
        precision: 1,
        recall: 1,
        typeMismatches: [],
        parameterMismatches: [],
      },
      topology: { passed: true, missing: [], extra: [] },
      associations: { passed: true, missing: [], extra: [] },
    });
  });

  it('rejects an arc replaced by a circle with the same stable id', () => {
    const golden = drawingWith([arc('test1_mouth', [40, 50], 20, 200, 340)]);
    const actual = drawingWith([circle('test1_mouth', [40, 50], 20)]);

    const report = scoreDrawingBenchmark(actual, golden, TEST1_TOLERANCE);

    expect(report.passed).toBe(false);
    expect(report.entity.typeMismatches).toEqual([{
      expectedId: 'test1_mouth',
      actualId: 'test1_mouth',
      expectedType: 'arc',
      actualType: 'circle',
    }]);
  });

  it('requires exact entity precision and recall', () => {
    const golden = drawingWith([
      arc('test1_mouth', [40, 50], 20, 200, 340),
      circle('test1_nose', [40, 35], 5),
    ]);
    const actual = drawingWith([
      arc('test1_mouth', [40, 50], 20, 200, 340),
      circle('unexpected', [90, 90], 3),
    ]);

    const report = scoreDrawingBenchmark(actual, golden, TEST1_TOLERANCE);

    expect(report.passed).toBe(false);
    expect(report.entity.precision).toBe(0.5);
    expect(report.entity.recall).toBe(0.5);
    expect(report.entity.missingIds).toEqual(['test1_nose']);
    expect(report.entity.extraIds).toEqual(['unexpected']);
  });

  it('rejects same-type parameters outside source pixel tolerance', () => {
    const golden = drawingWith([circle('test1_nose', [40, 35], 5)]);
    const actual = drawingWith([circle('test1_nose', [42, 35], 5)]);

    const report = scoreDrawingBenchmark(actual, golden, TEST1_TOLERANCE);

    expect(report.passed).toBe(false);
    expect(report.entity.parameterMismatches).toEqual([{
      expectedId: 'test1_nose',
      actualId: 'test1_nose',
      maxPixelError: 2,
    }]);
  });
});

function drawingWith(geometry: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_test1' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'source_test1',
      kind: 'source',
      transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry,
    annotations: [],
    relations: [],
    features: [],
  };
}

function circle(
  id: string,
  center: readonly [number, number],
  radius: number,
): Extract<GeometryNode, { type: 'circle' }> {
  return {
    id: id as Extract<GeometryNode, { type: 'circle' }>['id'],
    type: 'circle',
    center,
    radius,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  };
}

function arc(
  id: string,
  center: readonly [number, number],
  radius: number,
  startAngle: number,
  endAngle: number,
): Extract<GeometryNode, { type: 'arc' }> {
  return {
    id: id as Extract<GeometryNode, { type: 'arc' }>['id'],
    type: 'arc',
    center,
    radius,
    startAngle,
    endAngle,
    counterClockwise: true,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  };
}
