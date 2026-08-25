// SPDX-License-Identifier: Apache-2.0

import type { DrawingSourceRef } from '@vectorai/drawing-workspace';

export type RasterDrawingSourceRef = Extract<DrawingSourceRef, { width: number; height: number }>;

export function isRasterDrawingSource(source: DrawingSourceRef): source is RasterDrawingSourceRef {
  return 'width' in source && 'height' in source;
}
