// SPDX-License-Identifier: Apache-2.0

import type { GeometricToleranceIntent } from './types';

export function effectiveGeometricToleranceValue(intent: GeometricToleranceIntent): number | undefined {
  return intent.override?.value ?? intent.computed.value;
}

export function clearGeometricToleranceOverride(intent: GeometricToleranceIntent): GeometricToleranceIntent {
  const next = structuredClone(intent);
  delete next.override;
  return next;
}
