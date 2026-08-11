import { describe, expect, it } from 'vitest';

import type { GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { validateGenerativeGeometry } from './generative-validator.js';

const face: GeometryNode = {
  id: 'face' as GeometryId, type: 'circle', center: [50, 50], radius: 20,
  visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
};

describe('validateGenerativeGeometry', () => {
  it('accepts an in-region hair contour that touches protected geometry only at a declared seam', () => {
    const hair: GeometryNode = {
      id: 'hair' as GeometryId, type: 'polyline', closed: false,
      vertices: [
        { point: [30, 75] }, { point: [40, 85] }, { point: [60, 85] },
        { point: [70, 75] }, { point: [50, 70] },
      ],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    };

    expect(validateGenerativeGeometry({
      geometry: [hair], protectedGeometry: [face],
      contours: [[[10, 25], [90, 25], [90, 95], [10, 95]]], holes: [],
      boundaryAnchors: [{ id: 'hairline', point: [50, 70] }], tolerance: 1,
    })).toMatchObject({ valid: true, issues: [], connectedAnchorIds: ['hairline'] });
  });

  it('rejects protected crossings, escaped geometry and missing seam anchors deterministically', () => {
    const crossing: GeometryNode = {
      id: 'crossing' as GeometryId, type: 'line', start: [25, 50], end: [75, 50],
      visible: true, quality: { status: 'candidate', evidenceRefs: [] },
    };
    const escaped: GeometryNode = {
      id: 'escaped' as GeometryId, type: 'line', start: [20, 90], end: [120, 90],
      visible: true, quality: { status: 'candidate', evidenceRefs: [] },
    };

    const report = validateGenerativeGeometry({
      geometry: [crossing, escaped], protectedGeometry: [face],
      contours: [[[0, 0], [100, 0], [100, 100], [0, 100]]], holes: [],
      boundaryAnchors: [{ id: 'required_seam', point: [50, 70] }], tolerance: 0.5,
    });

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'GENERATED_PROTECTED_COLLISION',
      'GENERATED_OUTSIDE_REGION',
      'GENERATED_SEAM_DISCONNECTED',
    ]));
  });
});
