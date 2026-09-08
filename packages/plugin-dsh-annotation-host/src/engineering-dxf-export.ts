// SPDX-License-Identifier: Apache-2.0

import { exportDrawingDxf, type DrawingDocument } from '@vectorai/drawing-core';
import { projectEngineeringCadDrawing, type EngineeringDxfExportOptions } from '@vectorai/drawing-cad';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';

import { normalizeCadDxf } from './cad-dxf-normalizer';

export { projectEngineeringCadDrawing } from '@vectorai/drawing-cad';
export type { EngineeringCadScene, EngineeringDxfExportOptions, EngineeringDxfProfile } from '@vectorai/drawing-cad';

/** Compose the canonical drawing and the currently visible engineering plan. */
export function exportEngineeringDrawingDxf(
  document: DrawingDocument,
  plan: DimensionPlanSessionSnapshot,
  options: EngineeringDxfExportOptions = {},
): string {
  const scene = projectEngineeringCadDrawing(document, plan, { ...options, purpose: 'export' });
  return normalizeCadDxf(exportDrawingDxf(scene.document, scene));
}
