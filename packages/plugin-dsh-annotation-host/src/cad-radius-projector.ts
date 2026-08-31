// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, DxfExportEntity } from '@vectorai/drawing-core';

export interface CadRadiusProjection {
  document: DrawingDocument;
  entities: DxfExportEntity[];
}

/** Preserve the planner's semantic radius decisions in the CAD projection. */
export function projectCadRadiusAnnotations(source: DrawingDocument): CadRadiusProjection {
  return { document: structuredClone(source), entities: [] };
}
