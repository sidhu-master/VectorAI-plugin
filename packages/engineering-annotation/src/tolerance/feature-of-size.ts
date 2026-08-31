// SPDX-License-Identifier: Apache-2.0

import type { FeatureOfSizeClass } from './standard-types';

export interface FeatureOfSizeFacts {
  dimensionKind: 'linear' | 'diameter' | 'radius' | 'arc-length' | 'angular';
  semanticRole?: 'bore' | 'shaft';
  opposedSurfaceRole?: 'slot-width' | 'key-thickness' | 'part-thickness';
}

export type FeatureOfSizeClassification =
  | { status: 'resolved'; featureClass: FeatureOfSizeClass }
  | { status: 'unsupported'; code: 'TOLERANCE_FEATURE_UNSUPPORTED' }
  | { status: 'ambiguous'; code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' };

export function classifyFeatureOfSize(facts: FeatureOfSizeFacts): FeatureOfSizeClassification {
  switch (facts.dimensionKind) {
    case 'angular':
    case 'radius':
    case 'arc-length':
      return { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' };
    case 'diameter':
      return classifySemanticRole(facts.semanticRole);
    case 'linear':
      return classifyOpposedSurfaceRole(facts.opposedSurfaceRole);
  }
}

function classifySemanticRole(semanticRole: FeatureOfSizeFacts['semanticRole']): FeatureOfSizeClassification {
  switch (semanticRole) {
    case 'bore':
      return { status: 'resolved', featureClass: 'internal' };
    case 'shaft':
      return { status: 'resolved', featureClass: 'external' };
    default:
      return { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' };
  }
}

function classifyOpposedSurfaceRole(
  opposedSurfaceRole: FeatureOfSizeFacts['opposedSurfaceRole'],
): FeatureOfSizeClassification {
  switch (opposedSurfaceRole) {
    case 'slot-width':
      return { status: 'resolved', featureClass: 'internal' };
    case 'key-thickness':
    case 'part-thickness':
      return { status: 'resolved', featureClass: 'external' };
    default:
      return { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' };
  }
}
