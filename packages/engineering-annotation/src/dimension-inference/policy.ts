// SPDX-License-Identifier: Apache-2.0

import type { AxialInferencePolicy } from './types';

const COMMON_WEIGHTS = {
  'manual-required': 120,
  'document-exact': 100,
  'functional-region': 70,
  'process-envelope': 55,
  'composite-block': 60,
  'overall-root': 90,
  'elementary-span': 20,
} as const;

export const SHAFT_HIERARCHICAL_DIMENSIONING_V1: AxialInferencePolicy = {
  id: 'shaft-hierarchical-dimensioning-v1',
  version: '1',
  weights: COMMON_WEIGHTS,
  ambiguityMargin: 12,
};

export function policyById(id: string = SHAFT_HIERARCHICAL_DIMENSIONING_V1.id): AxialInferencePolicy {
  if (id !== SHAFT_HIERARCHICAL_DIMENSIONING_V1.id) throw new Error(`DIMENSION_POLICY_UNKNOWN:${id}`);
  return SHAFT_HIERARCHICAL_DIMENSIONING_V1;
}
