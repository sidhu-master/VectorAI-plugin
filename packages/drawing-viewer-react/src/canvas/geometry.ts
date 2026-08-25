// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '@vectorai/drawing-core';
import { splineBounds } from '@vectorai/drawing-core';
import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type DrawingRenderable = GeometryNode | AnnotationNode;

const MIN_SCALE = 0.01;
const MAX_SCALE = 1_000;

export function worldToScreen(point: Vec2, viewport: DrawingWorkspaceViewport): Vec2 {
  return [
    viewport.x + point[0] * viewport.scale,
    viewport.y - point[1] * viewport.scale,
  ];
}

export function screenToWorld(point: Vec2, viewport: DrawingWorkspaceViewport): Vec2 {
  return [
    (point[0] - viewport.x) / viewport.scale,
    (viewport.y - point[1]) / viewport.scale,
  ];
}

export function zoomViewportAt(
  viewport: DrawingWorkspaceViewport,
  screenPoint: Vec2,
  factor: number,
): DrawingWorkspaceViewport {
  const anchor = screenToWorld(screenPoint, viewport);
  const scale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
  return {
    ...viewport,
    scale,
    x: screenPoint[0] - anchor[0] * scale,
    y: screenPoint[1] + anchor[1] * scale,
  };
}

export function fitViewportToDrawing(
  document: DrawingDocument,
  size: { width: number; height: number },
  padding = 1.2,
): DrawingWorkspaceViewport {
  const bounds = drawingBounds(document) ?? { minX: -50, minY: -50, maxX: 50, maxY: 50 };
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const safePadding = Number.isFinite(padding) && padding > 0 ? padding : 1.2;
  const scale = clamp(Math.min(
    Math.max(size.width, 1) / (boundsWidth * safePadding),
    Math.max(size.height, 1) / (boundsHeight * safePadding),
  ), MIN_SCALE, MAX_SCALE);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    x: size.width / 2 - centerX * scale,
    y: size.height / 2 + centerY * scale,
    scale,
    width: size.width,
    height: size.height,
  };
}

export function drawingBounds(document: DrawingDocument): Bounds2D | null {
  const bounds = [...document.geometry, ...document.annotations]
    .filter((node) => node.visible)
    .map(nodeBounds)
    .filter((value): value is Bounds2D => value !== null);
  return unionBounds(bounds);
}

export function nodesInWorldBox(document: DrawingDocument, box: Bounds2D): string[] {
  return [...document.geometry, ...document.annotations]
    .filter((node) => node.visible)
    .filter((node) => {
      const bounds = nodeBounds(node);
      return bounds !== null && boundsIntersect(bounds, box);
    })
    .map((node) => node.id);
}

export function nodeBounds(node: DrawingRenderable): Bounds2D | null {
  switch (node.type) {
    case 'point': return boundsFromPoints([[node.x, node.y]]);
    case 'line': return boundsFromPoints([node.start, node.end]);
    case 'ray':
    case 'xline': return null;
    case 'circle': return finiteCircleBounds(node.center, node.radius);
    case 'arc': return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
    case 'ellipse': return ellipseBounds(node);
    case 'polyline': return boundsFromPoints(node.vertices.map((vertex) => vertex.point));
    case 'spline': return splineBounds(node);
    case 'text': return textBounds(node);
    case 'dimension': return boundsFromPoints([...node.definitionPoints, node.textPosition]);
    case 'leader': return boundsFromPoints(node.points);
    case 'centerline': return extendedLineBounds(node.start, node.end, node.extension);
    case 'section-hatch': return boundsFromPoints(node.segments.flatMap(({ start, end }) => [start, end]));
  }
}

export function worldBoundsForViewport(viewport: DrawingWorkspaceViewport): Bounds2D {
  const first = screenToWorld([0, 0], viewport);
  const second = screenToWorld([viewport.width, viewport.height], viewport);
  return normalizeBounds(first, second);
}

function finiteCircleBounds(center: Vec2, radius: number): Bounds2D | null {
  if (!finitePoint(center) || !Number.isFinite(radius) || radius < 0) return null;
  return {
    minX: center[0] - radius,
    minY: center[1] - radius,
    maxX: center[0] + radius,
    maxY: center[1] + radius,
  };
}

function arcBounds(
  center: Vec2,
  radius: number,
  start: number,
  end: number,
  counterClockwise: boolean,
): Bounds2D | null {
  if (finiteCircleBounds(center, radius) === null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  const candidates = [start, end, ...[0, 90, 180, 270].filter((angle) => (
    angleOnArc(angle, start, end, counterClockwise)
  ))];
  return boundsFromPoints(candidates.map((angle): Vec2 => {
    const radians = angle * Math.PI / 180;
    return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
  }));
}

function ellipseBounds(node: Extract<GeometryNode, { type: 'ellipse' }>): Bounds2D | null {
  if (!finitePoint(node.center) || !finitePoint(node.majorAxis)
    || !Number.isFinite(node.ratio) || node.ratio <= 0) return null;
  const [axisX, axisY] = node.majorAxis;
  const majorRadius = Math.hypot(axisX, axisY);
  if (majorRadius === 0) return null;
  const minorRadius = majorRadius * node.ratio;
  const minorX = -axisY / majorRadius * minorRadius;
  const minorY = axisX / majorRadius * minorRadius;
  const extentX = Math.hypot(axisX, minorX);
  const extentY = Math.hypot(axisY, minorY);
  return {
    minX: node.center[0] - extentX,
    minY: node.center[1] - extentY,
    maxX: node.center[0] + extentX,
    maxY: node.center[1] + extentY,
  };
}

function textBounds(node: Extract<AnnotationNode, { type: 'text' }>): Bounds2D | null {
  if (!finitePoint(node.position) || !Number.isFinite(node.height) || !Number.isFinite(node.rotation)) {
    return null;
  }
  const width = node.maxWidth ?? node.content.length * node.height * 0.6;
  const left = node.alignment === 'center' ? -width / 2 : node.alignment === 'right' ? -width : 0;
  const bottom = node.verticalAlignment === 'top'
    ? -node.height
    : node.verticalAlignment === 'middle' ? -node.height / 2 : node.verticalAlignment === 'baseline' ? -node.height : 0;
  const radians = node.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return boundsFromPoints([
    [left, bottom], [left + width, bottom],
    [left + width, bottom + node.height], [left, bottom + node.height],
  ].map(([x, y]): Vec2 => [
    node.position[0] + x * cos - y * sin,
    node.position[1] + x * sin + y * cos,
  ]));
}

function extendedLineBounds(start: Vec2, end: Vec2, extension: number): Bounds2D | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return boundsFromPoints([start]);
  return boundsFromPoints([
    [start[0] - dx / length * extension, start[1] - dy / length * extension],
    [end[0] + dx / length * extension, end[1] + dy / length * extension],
  ]);
}

function boundsFromPoints(points: readonly Vec2[]): Bounds2D | null {
  if (points.length === 0 || points.some((point) => !finitePoint(point))) return null;
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function unionBounds(bounds: Bounds2D[]): Bounds2D | null {
  if (bounds.length === 0) return null;
  return bounds.reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY),
  }));
}

function normalizeBounds(first: Vec2, second: Vec2): Bounds2D {
  return {
    minX: Math.min(first[0], second[0]),
    minY: Math.min(first[1], second[1]),
    maxX: Math.max(first[0], second[0]),
    maxY: Math.max(first[1], second[1]),
  };
}

function boundsIntersect(first: Bounds2D, second: Bounds2D): boolean {
  return first.minX <= second.maxX && first.maxX >= second.minX
    && first.minY <= second.maxY && first.maxY >= second.minY;
}

function angleOnArc(angle: number, start: number, end: number, counterClockwise: boolean): boolean {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  if (counterClockwise) {
    return modulo(normalizedAngle - normalizedStart, 360) <= modulo(normalizedEnd - normalizedStart, 360);
  }
  return modulo(normalizedStart - normalizedAngle, 360) <= modulo(normalizedStart - normalizedEnd, 360);
}

function normalizeAngle(value: number): number {
  return modulo(value, 360);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
