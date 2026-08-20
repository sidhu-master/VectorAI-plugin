import { describe, expect, it } from 'vitest';

import type { AnnotationNode } from '@/drawing';
import { applyDimensionTextDrag } from './annotation-text-utils';

const common = {
  visible: true,
  quality: { status: 'confirmed' as const, evidenceRefs: [] },
};

function linearDimension(): Extract<AnnotationNode, { type: 'dimension' }> {
  return {
    ...common,
    id: 'dim_linear' as never,
    type: 'dimension',
    dimensionKind: 'linear',
    associationStatus: 'resolved',
    targets: [],
    definitionPoints: [[0, 0], [20, 0], [0, 4], [20, 4]],
    textPosition: [10, 5],
    displayText: '20',
  };
}

describe('applyDimensionTextDrag', () => {
  it('keeps extension line origins fixed and moves the measure line through the text (linear)', () => {
    const next = applyDimensionTextDrag(linearDimension(), [10, 12]);

    expect(next.textPosition).toEqual([10, 12]);
    // 延长线起点（几何上的定义点）不动
    expect(next.definitionPoints[0]).toEqual([0, 0]);
    expect(next.definitionPoints[1]).toEqual([20, 0]);
    // 标注线平行移动到 y=12，箭头随之更新
    expect(next.definitionPoints[2]).toEqual([0, 12]);
    expect(next.definitionPoints[3]).toEqual([20, 12]);
  });

  it('only slides the text when moving along the measure line direction', () => {
    const node = { ...linearDimension(), textPosition: [10, 4] as [number, number] };
    const next = applyDimensionTextDrag(node, [14, 4]);

    expect(next.textPosition).toEqual([14, 4]);
    // 沿标注线方向移动不影响标注线位置
    expect(next.definitionPoints.slice(2)).toEqual([[0, 4], [20, 4]]);
  });

  it('moves the leader end with the text while keeping center and edge fixed (radius)', () => {
    const node: Extract<AnnotationNode, { type: 'dimension' }> = {
      ...common,
      id: 'dim_radius' as never,
      type: 'dimension',
      dimensionKind: 'radius',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0]],
      textPosition: [12, 2],
      displayText: 'R10',
    };
    const next = applyDimensionTextDrag(node, [15, 6]);

    expect(next.definitionPoints[0]).toEqual([0, 0]);
    expect(next.definitionPoints[1]).toEqual([10, 0]);
    expect(next.definitionPoints[2]).toEqual([15, 6]);
  });

  it('keeps diameter definition points anchored and only moves the text', () => {
    const node: Extract<AnnotationNode, { type: 'dimension' }> = {
      ...common,
      id: 'dim_diameter' as never,
      type: 'dimension',
      dimensionKind: 'diameter',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0]],
      textPosition: [5, 2],
      displayText: 'Ø10',
    };
    const next = applyDimensionTextDrag(node, [8, 6]);

    expect(next.textPosition).toEqual([8, 6]);
    expect(next.definitionPoints).toEqual([[0, 0], [10, 0]]);
  });

  it('rescales the angular arc to the text distance and extends its extension lines', () => {
    const node: Extract<AnnotationNode, { type: 'dimension' }> = {
      ...common,
      id: 'dim_angle' as never,
      type: 'dimension',
      dimensionKind: 'angular',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0], [0, 10], [5, 0], [0, 5]],
      textPosition: [4, 4],
      displayText: '90°',
    };
    const next = applyDimensionTextDrag(node, [8, 8]);

    expect(next.definitionPoints[0]).toEqual([0, 0]);
    // 文字到顶点距离 √128，圆弧端点沿原射线缩放到同一半径
    const expected = Math.hypot(8, 8);
    expect(Math.hypot(next.definitionPoints[3][0], next.definitionPoints[3][1])).toBeCloseTo(expected, 6);
    expect(Math.hypot(next.definitionPoints[4][0], next.definitionPoints[4][1])).toBeCloseTo(expected, 6);
    // 端点保持在原射线方向上
    expect(next.definitionPoints[3][1]).toBeCloseTo(0, 6);
    expect(next.definitionPoints[4][0]).toBeCloseTo(0, 6);
    // 延长线沿原射线伸长到不小于圆弧半径
    expect(Math.hypot(next.definitionPoints[1][0], next.definitionPoints[1][1])).toBeCloseTo(expected, 6);
    expect(Math.hypot(next.definitionPoints[2][0], next.definitionPoints[2][1])).toBeCloseTo(expected, 6);
    expect(next.definitionPoints[1][1]).toBeCloseTo(0, 6);
    expect(next.definitionPoints[2][0]).toBeCloseTo(0, 6);
  });

  it('keeps angular extension lines unchanged when the text moves inside them', () => {
    const node: Extract<AnnotationNode, { type: 'dimension' }> = {
      ...common,
      id: 'dim_angle_inward' as never,
      type: 'dimension',
      dimensionKind: 'angular',
      associationStatus: 'resolved',
      targets: [],
      definitionPoints: [[0, 0], [10, 0], [0, 10], [5, 0], [0, 5]],
      textPosition: [4, 4],
      displayText: '90°',
    };
    const next = applyDimensionTextDrag(node, [2, 2]);

    // 文字半径 √8 < 延长线长度 10：延长线不缩短
    expect(next.definitionPoints[1]).toEqual([10, 0]);
    expect(next.definitionPoints[2]).toEqual([0, 10]);
  });
});
