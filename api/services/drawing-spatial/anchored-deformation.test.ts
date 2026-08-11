import { describe, expect, it } from 'vitest';

import type { GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { applyAnchoredDeformation } from './anchored-deformation.js';

describe('applyAnchoredDeformation', () => {
  it('keeps every attachment anchor fixed while moving the free arm between them', () => {
    const arm: GeometryNode = {
      id: 'arm_between_anchors' as GeometryId,
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
      arm,
      { kind: 'rotate', center: [0, 0], angleDegrees: 90 },
      { anchors: [[0, 0], [10, 0]], targetGeometry: [arm], tolerance: 0.01 },
    );

    expect(deformed.type).toBe('polyline');
    if (deformed.type !== 'polyline') return;
    expect(deformed.vertices[0].point).toEqual([0, 0]);
    expect(deformed.vertices.at(-1)?.point).toEqual([10, 0]);
    expect(deformed.vertices[1].point).not.toEqual([5, 0]);
  });
});
