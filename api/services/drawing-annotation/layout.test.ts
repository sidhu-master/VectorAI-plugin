import { describe, expect, it } from 'vitest';

import type { EvidenceId, GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { measureDeterministicAnnotations } from './measurement.js';
import { layoutMeasurementFacts } from './layout.js';
import type { AngleFact, DiameterFact } from './types.js';

const quality = {
  status: 'confirmed' as const,
  confidence: 1,
  evidenceRefs: ['fixture:layout' as EvidenceId],
};

describe('layoutMeasurementFacts', () => {
  it('places axial dimensions in deterministic non-overlapping lanes outside the profile', () => {
    const geometry = steppedProfile();
    const facts = measureDeterministicAnnotations({ geometry, unit: 'mm' }).facts;

    const first = layoutMeasurementFacts({ geometry, facts });
    const second = layoutMeasurementFacts({ geometry, facts });
    const axial = facts.filter((fact) => fact.kind === 'axial-length');
    const diameters = facts.filter((fact) => fact.kind === 'diameter');

    expect(second).toEqual(first);
    expect(axial.every((fact) => first[fact.key]?.textPosition[1] > 15
      || first[fact.key]?.textPosition[1] < -15)).toBe(true);
    expect(new Set(axial.map((fact) => `${first[fact.key]?.side}:${first[fact.key]?.lane}`)).size)
      .toBeGreaterThan(1);
    expect(diameters.every((fact) => (
      first[fact.key]?.textPosition[1] === fact.center[1]
    ))).toBe(true);
    expect(Object.values(first).every((item) => item.definitionPoints.every(
      (point) => Number.isFinite(point[0]) && Number.isFinite(point[1]),
    ))).toBe(true);
  });

  it('lays out paired opening angles as separated circular arcs with labels outside the arcs', () => {
    const geometry = steppedProfile();
    const angles: AngleFact[] = [{
      key: 'opening:left:60',
      kind: 'angle',
      quality: 'confirmed',
      value: 60,
      vertex: [0, 0],
      rays: [[10, 5.773503], [10, -5.773503]],
      sourceIds: ['layout_0' as GeometryId, 'layout_1' as GeometryId],
      evidenceRefs: quality.evidenceRefs,
      method: 'mirrored-line-pair-opening',
      error: 0,
    }, {
      key: 'opening:left:120',
      kind: 'angle',
      quality: 'confirmed',
      value: 120,
      vertex: [0, 0],
      rays: [[5, 8.660254], [5, -8.660254]],
      sourceIds: ['layout_2' as GeometryId, 'layout_3' as GeometryId],
      evidenceRefs: quality.evidenceRefs,
      method: 'mirrored-line-pair-opening',
      error: 0,
    }];

    const result = layoutMeasurementFacts({ geometry, facts: angles });
    const sixty = result['opening:left:60'];
    const oneTwenty = result['opening:left:120'];
    expect(sixty.definitionPoints).toHaveLength(5);
    expect(oneTwenty.definitionPoints).toHaveLength(5);
    expect(sixty.definitionPoints[0]).toEqual([0, 0]);
    const sixtyRadius = distance([0, 0], sixty.definitionPoints[3]);
    const oneTwentyRadius = distance([0, 0], oneTwenty.definitionPoints[3]);
    expect(distance([0, 0], sixty.definitionPoints[4])).toBeCloseTo(sixtyRadius, 6);
    expect(distance([0, 0], oneTwenty.definitionPoints[4])).toBeCloseTo(oneTwentyRadius, 6);
    expect(oneTwentyRadius).toBeGreaterThan(sixtyRadius);
    expect(distance([0, 0], sixty.definitionPoints[1]))
      .toBeGreaterThanOrEqual(distance([0, 0], angles[0].rays[0]));
    expect(distance([0, 0], sixty.definitionPoints[2]))
      .toBeGreaterThanOrEqual(distance([0, 0], angles[0].rays[1]));
    expect(distance([0, 0], sixty.textPosition)).toBeGreaterThan(sixtyRadius);
    expect(distance([0, 0], oneTwenty.textPosition)).toBeGreaterThan(oneTwentyRadius);
    // 文字必须在开口之外：超出两条延长线的端点，且位于角平分线上
    expect(distance([0, 0], sixty.textPosition))
      .toBeGreaterThan(distance([0, 0], sixty.definitionPoints[1]));
    expect(distance([0, 0], sixty.textPosition))
      .toBeGreaterThan(distance([0, 0], sixty.definitionPoints[2]));
    expect(oneTwenty.textPosition[1]).toBeCloseTo(0, 6);
    expect(oneTwenty.textPosition[0]).toBeGreaterThan(0);
  });

  it('places the physically outer (shallower) cone annotation outermost for nested openings', () => {
    const geometry = steppedProfile();
    // 模拟嵌套倒角：60° 锥顶更深（x=30），120° 锥顶更浅（x=17，物理上更靠外侧）
    const angles: AngleFact[] = [{
      key: 'opening:left:60',
      kind: 'angle',
      quality: 'confirmed',
      value: 60,
      vertex: [30, 0],
      rays: [[20, 5], [20, -5]],
      sourceIds: ['layout_0' as GeometryId, 'layout_1' as GeometryId],
      evidenceRefs: quality.evidenceRefs,
      method: 'mirrored-line-pair-opening',
      error: 0,
    }, {
      key: 'opening:left:120',
      kind: 'angle',
      quality: 'confirmed',
      value: 120,
      vertex: [17, 0],
      rays: [[12, 8.660254], [12, -8.660254]],
      sourceIds: ['layout_2' as GeometryId, 'layout_3' as GeometryId],
      evidenceRefs: quality.evidenceRefs,
      method: 'mirrored-line-pair-opening',
      error: 0,
    }];

    const result = layoutMeasurementFacts({ geometry, facts: angles });
    const sixty = result['opening:left:60'];
    const oneTwenty = result['opening:left:120'];
    const sixtyRadius = distance([30, 0], sixty.definitionPoints[3]);
    const oneTwentyRadius = distance([17, 0], oneTwenty.definitionPoints[3]);
    // 空间顺序：更外侧的锥（120°）圆弧更大，文字显示在最外侧
    expect(oneTwentyRadius).toBeGreaterThan(sixtyRadius);
    expect(oneTwenty.textPosition[0]).toBeLessThan(sixty.textPosition[0]);
    // 两者都在角平分线（x 轴）上
    expect(sixty.textPosition[1]).toBeCloseTo(0, 6);
    expect(oneTwenty.textPosition[1]).toBeCloseTo(0, 6);
    // 文字紧贴自己的圆弧
    expect(distance([30, 0], sixty.textPosition) - sixtyRadius).toBeLessThan(2 * 3.654);
    expect(distance([17, 0], oneTwenty.textPosition) - oneTwentyRadius).toBeLessThan(2 * 3.654);
  });

  it('keeps dense diameter labels readable while every label remains on the center axis', () => {
    const geometry = steppedProfile();
    const diameters: DiameterFact[] = [20, 21, 22].map((x, index) => ({
      key: `diameter:dense:${index}`,
      kind: 'diameter',
      quality: 'confirmed',
      value: 20 + index,
      center: [x, 0],
      first: [x, -10 - index],
      second: [x, 10 + index],
      sourceIds: [`layout_${index}` as GeometryId],
      evidenceRefs: quality.evidenceRefs,
      method: 'fixture',
      error: 0,
    }));

    const result = layoutMeasurementFacts({ geometry, facts: diameters });
    const positions = diameters.map((fact) => result[fact.key].textPosition);

    expect(positions.every((point) => point[1] === 0)).toBe(true);
    expect(positions[1][0] - positions[0][0]).toBeGreaterThan(8);
    expect(positions[2][0] - positions[1][0]).toBeGreaterThan(8);
    expect((positions[0][0] + positions[1][0] + positions[2][0]) / 3).toBeCloseTo(21, 6);
  });
});

function distance(first: readonly [number, number], second: readonly [number, number]): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function steppedProfile(): GeometryNode[] {
  const points: Array<readonly [number, number]> = [
    [0, 10], [20, 10], [20, 15], [50, 15], [50, 8], [100, 8],
    [100, -8], [50, -8], [50, -15], [20, -15], [20, -10], [0, -10], [0, 10],
  ];
  return points.slice(0, -1).map((start, index): GeometryNode => ({
    id: `layout_${index}` as GeometryId,
    type: 'line',
    visible: true,
    quality,
    start,
    end: points[index + 1],
  }));
}
