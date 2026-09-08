// SPDX-License-Identifier: Apache-2.0

import { projectDimensionPicture, type DimensionAnnotation } from '@vectorai/drawing-core';
import type { EngineeringCadScene, CadTextBounds } from '@vectorai/drawing-cad';

/** The same cached graphics as the native DXF dimension, including drag previews. */
export function canvasDimensionPicture(node: DimensionAnnotation, scene: EngineeringCadScene) {
  const base = scene.document.annotations.find((value) => value.id === node.id);
  const original = scene.dimensionPresentation[node.id];
  const dx = base?.type === 'dimension' ? node.textPosition[0] - base.textPosition[0] : 0;
  const dy = base?.type === 'dimension' ? node.textPosition[1] - base.textPosition[1] : 0;
  const movedBounds = original?.textBounds && {
    minX: original.textBounds.minX + dx, maxX: original.textBounds.maxX + dx,
    minY: original.textBounds.minY + dy, maxY: original.textBounds.maxY + dy,
  };
  const presentation = { ...original, ...(movedBounds ? { textBounds: movedBounds } : {}) };
  const obstacles = Object.entries(scene.dimensionPresentation).flatMap(([id, value]) => {
    const bounds = id === node.id ? movedBounds : value.textBounds;
    return bounds ? [bounds] : [];
  });
  return projectDimensionPicture(node, scene.profile, scene.document.unitSystem.length, presentation, obstacles);
}

export function cadSceneBounds(scene: EngineeringCadScene): CadTextBounds | undefined {
  const boxes = [
    ...scene.dimensionPlacements.flatMap((value) => [value.textBounds, ...(value.arc ? [{
      minX: value.arc.center[0] - value.arc.radius, maxX: value.arc.center[0] + value.arc.radius,
      minY: value.arc.center[1] - value.arc.radius, maxY: value.arc.center[1] + value.arc.radius,
    }] : [])]),
    ...scene.symbolPlacements.map(({ box }) => box),
  ];
  if (!boxes.length) return undefined;
  return {
    minX: Math.min(...boxes.map(({ minX }) => minX)), minY: Math.min(...boxes.map(({ minY }) => minY)),
    maxX: Math.max(...boxes.map(({ maxX }) => maxX)), maxY: Math.max(...boxes.map(({ maxY }) => maxY)),
  };
}
