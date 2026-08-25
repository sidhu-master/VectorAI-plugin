// SPDX-License-Identifier: Apache-2.0

import type { AnnotationId, SectionHatchAnnotation, Vec2 } from '@vectorai/drawing-core';

import {
  coordinates,
  number,
  sourceRef,
  value,
  type DxfEntityContext,
  type DxfEntityRecord,
} from './entities';

export function projectHatch(
  record: DxfEntityRecord,
  context: DxfEntityContext,
): SectionHatchAnnotation {
  const points = hatchBoundaryPoints(record);
  const segments = points.length < 2 ? [] : points.map((start, index) => ({
    start,
    end: points[(index + 1) % points.length],
  }));
  return {
    id: context.nodeId(record, 'annotation') as AnnotationId,
    type: 'section-hatch',
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    sourceRef: sourceRef(record, context.sourceId),
    pattern: value(record, 2) ?? 'SOLID',
    angle: number(record, 52, 0),
    spacing: Math.abs(number(record, 41, 1)),
    segments,
  };
}

function hatchBoundaryPoints(record: DxfEntityRecord): Vec2[] {
  const points = coordinates(record);
  if (points.length <= 1) return points;
  const first = points[0];
  const rest = points.slice(1);
  // DXF HATCH commonly starts with an elevation/base point before its boundary.
  // Keep it only when removing it would leave fewer than two usable boundary points.
  return rest.length >= 2 && first[0] === 0 && first[1] === 0 ? rest : points;
}
