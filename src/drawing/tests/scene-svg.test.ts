import { describe, expect, it } from 'vitest';

import type { GeometryNode } from '../index';
import { compileDrawingNode, scenePathData } from '../scene';

describe('scenePathData', () => {
  it('serializes a full analytic circle as two SVG arc segments', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const node: GeometryNode = {
      id: 'circle' as never,
      type: 'circle',
      visible: true,
      quality,
      center: [20, 20],
      radius: 10,
    };
    const [primitive] = compileDrawingNode(node);
    if (primitive.kind !== 'path') throw new Error('expected path');

    expect(scenePathData(primitive.commands)).toBe(
      'M 30 20 A 10 10 0 0 1 10 20 A 10 10 0 0 1 30 20',
    );
  });

  it('serializes quadratic spline commands without sampling them again', () => {
    expect(scenePathData([
      { op: 'M', point: [0, 0] },
      { op: 'Q', control: [5, 10], end: [10, 0] },
    ])).toBe('M 0 0 Q 5 10 10 0');
  });
});
