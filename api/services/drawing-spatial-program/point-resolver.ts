// SPDX-License-Identifier: Apache-2.0

import {
  resolveSpatialPoint as resolveSharedSpatialPoint,
  type SpatialPointResolutionContext,
} from '@vectorai/drawing-spatial';

import { SpatialProgramError, type SpatialPointRef } from './types.js';

export type { SpatialPointResolutionContext } from '@vectorai/drawing-spatial';

/** Web compatibility adapter; the coordinate resolver is shared with DSH. */
export function resolveSpatialPoint(
  reference: SpatialPointRef,
  context: SpatialPointResolutionContext,
) {
  return resolveSharedSpatialPoint(
    reference,
    context,
    (code, message) => new SpatialProgramError(code, message),
  );
}
