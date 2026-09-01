// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { classifyFeatureOfSize } from './feature-of-size';

describe('feature-of-size classification', () => {
  it('classifies supported internal/external facts and rejects non-size dimensions', () => {
    expect(classifyFeatureOfSize({ dimensionKind: 'diameter', semanticRole: 'bore' }))
      .toEqual({ status: 'resolved', featureClass: 'internal' });
    expect(classifyFeatureOfSize({ dimensionKind: 'diameter', semanticRole: 'shaft' }))
      .toEqual({ status: 'resolved', featureClass: 'external' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear', opposedSurfaceRole: 'slot-width' }))
      .toEqual({ status: 'resolved', featureClass: 'internal' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear', opposedSurfaceRole: 'key-thickness' }))
      .toEqual({ status: 'resolved', featureClass: 'external' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear', opposedSurfaceRole: 'part-thickness' }))
      .toEqual({ status: 'resolved', featureClass: 'external' });
    expect(classifyFeatureOfSize({ dimensionKind: 'angular' }))
      .toEqual({ status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' });
    expect(classifyFeatureOfSize({ dimensionKind: 'radius' }))
      .toEqual({ status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' });
    expect(classifyFeatureOfSize({ dimensionKind: 'arc-length' }))
      .toEqual({ status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' });
    expect(classifyFeatureOfSize({ dimensionKind: 'linear' }))
      .toEqual({ status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' });
    expect(classifyFeatureOfSize({ dimensionKind: 'aligned' }))
      .toEqual({ status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' });
    expect(classifyFeatureOfSize({ dimensionKind: 'ordinate' }))
      .toEqual({ status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' });
  });
});
