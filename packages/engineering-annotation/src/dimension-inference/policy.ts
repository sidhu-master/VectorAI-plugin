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
  'ordinary-residual': 15,
  'terminal-residual': 5,
} as const;

export const SHAFT_HIERARCHICAL_DIMENSIONING_V1: AxialInferencePolicy = {
  id: 'shaft-hierarchical-dimensioning-v1',
  version: '1',
  weights: COMMON_WEIGHTS,
  ambiguityMargin: 12,
  preferTerminalRootClosure: false,
};

export const SHAFT_REFERENCE_TERMINAL_CLOSURE_V1: AxialInferencePolicy = {
  id: 'shaft-reference-terminal-closure-v1',
  version: '1',
  weights: COMMON_WEIGHTS,
  ambiguityMargin: 0,
  preferTerminalRootClosure: true,
};

export function policyById(id: AxialInferencePolicy['id']): AxialInferencePolicy {
  return id === SHAFT_REFERENCE_TERMINAL_CLOSURE_V1.id
    ? SHAFT_REFERENCE_TERMINAL_CLOSURE_V1
    : SHAFT_HIERARCHICAL_DIMENSIONING_V1;
}
