// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import { createHash } from 'node:crypto';

/**
 * Identity of the partition-relevant drawing state. Annotation, feature and
 * relation edits intentionally do not participate, so annotation-only drawing
 * revisions cannot invalidate a confirmed shaft partition.
 */
export function partitionGeometryFingerprint(document: DrawingDocument): string {
  const payload = JSON.stringify({
    unitSystem: document.unitSystem,
    coordinateFrames: document.coordinateFrames,
    geometry: document.geometry,
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}
