// SPDX-License-Identifier: Apache-2.0

import type { GeometryNode } from '@vectorai/drawing-core';
import type { OpeningAngleAxis, OpeningAngleFact } from './types';

export function selectAxialEndOpeningAngles(input: {
  facts: OpeningAngleFact[];
  geometry: GeometryNode[];
  axis: OpeningAngleAxis;
}): { selected: OpeningAngleFact[]; suppressionReasons: Record<string, string> } {
  const points = input.geometry.flatMap((node) => node.type === 'line' ? [node.start, node.end]
    : node.type === 'polyline' ? node.vertices.map(({ point }) => point) : []);
  const diagonal = points.length === 0 ? 1 : Math.hypot(
    Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
  );
  const boundaryTolerance = Math.max(diagonal * 0.01, 0.05);
  const axisVector = [input.axis.end[0] - input.axis.start[0], input.axis.end[1] - input.axis.start[1]] as const;
  const axisLength = Math.hypot(...axisVector);
  const axisDirection = axisLength > 0 ? [axisVector[0] / axisLength, axisVector[1] / axisLength] as const : [1, 0] as const;
  const geometryById = new Map(input.geometry.map((node) => [node.id, node]));
  const selected: OpeningAngleFact[] = [];
  const suppressionReasons: Record<string, string> = {};
  for (const fact of input.facts) {
    const atAxialEnd = input.axis.status === 'confirmed' && fact.sourceIds.some((id) => {
      const node = geometryById.get(id);
      if (!node) return false;
      const sourcePoints = node.type === 'line' ? [node.start, node.end]
        : node.type === 'polyline' ? node.vertices.map(({ point }) => point) : [];
      return sourcePoints.some((point) => {
        const z = (point[0] - input.axis.start[0]) * axisDirection[0] + (point[1] - input.axis.start[1]) * axisDirection[1];
        return Math.abs(z) <= boundaryTolerance || Math.abs(z - axisLength) <= boundaryTolerance;
      });
    });
    const orthogonal = Math.abs(fact.value - 90) <= 0.5;
    if (orthogonal || !atAxialEnd) {
      suppressionReasons[fact.key] = orthogonal
        ? '正交开角由轮廓关系直接表达，不重复生成 90° 角度标注'
        : '该局部线段方向不是已确认的轴端角度，不升级为正式角度标注';
    } else selected.push(fact);
  }
  return { selected, suppressionReasons };
}
