// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation, Vec2 } from '@vectorai/drawing-core';

export function projectAnnotationDrag(
  annotation: DimensionAnnotation,
  start: Vec2,
  current: Vec2,
): DimensionAnnotation {
  if (annotation.dimensionKind === 'diameter' && annotation.definitionPoints.length >= 2) {
    return projectDiameterDrag(annotation, start, current);
  }
  if (annotation.dimensionKind === 'angular' && annotation.definitionPoints.length >= 5) {
    return projectAngularDrag(annotation, start, current);
  }
  return structuredClone(annotation);
}

function projectDiameterDrag(
  annotation: DimensionAnnotation,
  start: Vec2,
  current: Vec2,
): DimensionAnnotation {
  const [first, second] = annotation.definitionPoints;
  const radial = normalize([second[0] - first[0], second[1] - first[1]]) ?? [0, 1];
  const axis: Vec2 = [-radial[1], radial[0]];
  const pointerDelta: Vec2 = [current[0] - start[0], current[1] - start[1]];
  const translation = scale(axis, dot(pointerDelta, axis));
  const projected = structuredClone(annotation);
  projected.definitionPoints[0] = translate(first, translation);
  projected.definitionPoints[1] = translate(second, translation);
  projected.textPosition = translate(annotation.textPosition, translation);
  return projected;
}

function projectAngularDrag(
  annotation: DimensionAnnotation,
  start: Vec2,
  current: Vec2,
): DimensionAnnotation {
  const [vertex] = annotation.definitionPoints;
  const bisector = normalize([
    annotation.textPosition[0] - vertex[0],
    annotation.textPosition[1] - vertex[1],
  ]) ?? [1, 0];
  const pointerDelta: Vec2 = [current[0] - start[0], current[1] - start[1]];
  const movablePoints = [...annotation.definitionPoints.slice(1), annotation.textPosition];
  const minimumRadius = Math.min(...movablePoints.map((point) => distance(vertex, point)));
  const radialDelta = Math.max(dot(pointerDelta, bisector), 1e-3 - minimumRadius);
  const projected = structuredClone(annotation);
  projected.definitionPoints = annotation.definitionPoints.map((point, index) => (
    index === 0 ? [...point] as Vec2 : moveRadially(vertex, point, radialDelta)
  ));
  projected.textPosition = moveRadially(vertex, annotation.textPosition, radialDelta);
  return projected;
}

function moveRadially(center: Vec2, point: Vec2, distanceDelta: number): Vec2 {
  const direction = normalize([point[0] - center[0], point[1] - center[1]]) ?? [1, 0];
  return translate(point, scale(direction, distanceDelta));
}

function normalize(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector[0], vector[1]);
  return length <= 1e-12 ? null : [vector[0] / length, vector[1] / length];
}

function translate(point: Vec2, delta: Vec2): Vec2 {
  return [point[0] + delta[0], point[1] + delta[1]];
}

function scale(vector: Vec2, factor: number): Vec2 {
  return [vector[0] * factor, vector[1] * factor];
}

function dot(first: Vec2, second: Vec2): number {
  return first[0] * second[0] + first[1] * second[1];
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}
