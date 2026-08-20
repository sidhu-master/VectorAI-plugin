import { describe, expect, it } from 'vitest';

import type { DrawingId, EvidenceId, GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { evaluateAnnotationCoverage } from './coverage.js';
import { measureDeterministicAnnotations } from './measurement.js';
import { planDeterministicAnnotations } from './planner.js';

const quality = {
  status: 'confirmed' as const,
  confidence: 1,
  evidenceRefs: ['fixture:coverage' as EvidenceId],
};

describe('evaluateAnnotationCoverage', () => {
  it('accepts a complete formal plan even when unsupported design intent remains pending', () => {
    const fixture = createFixture();
    const report = evaluateAnnotationCoverage(fixture);

    expect(report.valid).toBe(true);
    expect(report.missingFactKeys).toEqual([]);
    expect(report.duplicateFactKeys).toEqual([]);
    expect(report.invalidAnnotationIds).toEqual([]);
    expect(report.suppressedFactKeys.length).toBeGreaterThan(0);
    expect(report.pendingAnnotations.length).toBeGreaterThan(0);
  });

  it('rejects an omitted fact, duplicate consumption, and a dangling geometry target', () => {
    const fixture = createFixture();
    const omittedPlan = structuredClone(fixture.plan);
    const omitted = omittedPlan.annotations.pop()!;
    const omittedKey = omittedPlan.factKeysByAnnotationId[omitted.id];
    delete omittedPlan.factKeysByAnnotationId[omitted.id];
    omittedPlan.consumedFactKeys = omittedPlan.consumedFactKeys.filter((key) => key !== omittedKey);
    expect(evaluateAnnotationCoverage({ ...fixture, plan: omittedPlan })).toMatchObject({
      valid: false,
      missingFactKeys: [omittedKey],
    });

    const duplicatePlan = structuredClone(fixture.plan);
    duplicatePlan.consumedFactKeys.push(duplicatePlan.consumedFactKeys[0]);
    expect(evaluateAnnotationCoverage({ ...fixture, plan: duplicatePlan })).toMatchObject({
      valid: false,
      duplicateFactKeys: [duplicatePlan.consumedFactKeys[0]],
    });

    const danglingPlan = structuredClone(fixture.plan);
    const dimension = danglingPlan.annotations.find((node) => node.type === 'dimension')!;
    if (dimension.type !== 'dimension') throw new Error('dimension fixture missing');
    dimension.targets[0].geometryId = 'geometry_missing' as GeometryId;
    expect(evaluateAnnotationCoverage({ ...fixture, plan: danglingPlan })).toMatchObject({
      valid: false,
      invalidAnnotationIds: [dimension.id],
    });
  });
});

function createFixture() {
  const geometry = profile();
  const measurements = measureDeterministicAnnotations({ geometry, unit: 'mm' });
  const plan = planDeterministicAnnotations({
    drawingId: 'drawing_coverage' as DrawingId,
    geometry,
    measurements,
  });
  return {
    measurements,
    plan,
    geometryIds: new Set(geometry.map((node) => node.id as string)),
  };
}

function profile(): GeometryNode[] {
  const points: Array<readonly [number, number]> = [
    [0, 10], [20, 10], [20, 15], [50, 15], [50, 8], [100, 8],
    [100, -8], [50, -8], [50, -15], [20, -15], [20, -10], [0, -10], [0, 10],
  ];
  const geometry = points.slice(0, -1).map((start, index): GeometryNode => ({
    id: `coverage_${index}` as GeometryId,
    type: 'line', visible: true, quality,
    start, end: points[index + 1],
  }));
  geometry.push({
    id: 'coverage_small_fillet' as GeometryId,
    type: 'arc', visible: true, quality,
    center: [50, 14], radius: 0.5,
    startAngle: 0, endAngle: 90, counterClockwise: true,
  });
  return geometry;
}
