// SPDX-License-Identifier: Apache-2.0

import type { HatchBoundaryEdge, ParametricHatch, Vec2 } from '@vectorai/drawing-core';

export interface RigidTransform2D { translation: Vec2; rotationRadians: number; pivot: Vec2 }

export function transformParametricHatch(hatch: ParametricHatch, transform: RigidTransform2D): ParametricHatch {
  const vector = (point: Vec2): Vec2 => rotate(point, transform.rotationRadians);
  const point = (value: Vec2): Vec2 => {
    const relative: Vec2 = [value[0] - transform.pivot[0], value[1] - transform.pivot[1]];
    const rotated = vector(relative);
    return [rotated[0] + transform.pivot[0] + transform.translation[0], rotated[1] + transform.pivot[1] + transform.translation[1]];
  };
  const edge = (value: HatchBoundaryEdge): HatchBoundaryEdge => {
    if (value.type === 'line') return { ...value, start: point(value.start), end: point(value.end) };
    if (value.type === 'arc') return {
      ...value, center: point(value.center), startAngle: value.startAngle + radiansToDegrees(transform.rotationRadians),
      endAngle: value.endAngle + radiansToDegrees(transform.rotationRadians),
    };
    if (value.type === 'ellipse') return { ...value, center: point(value.center), majorAxis: vector(value.majorAxis) };
    return { ...value, controlPoints: value.controlPoints.map(point), fitPoints: value.fitPoints?.map(point) };
  };
  return {
    ...hatch,
    boundaryPaths: hatch.boundaryPaths.map((path) => ({ ...path, edges: path.edges.map(edge) })),
    patternLines: hatch.patternLines.map((line) => ({
      ...line, angle: line.angle + radiansToDegrees(transform.rotationRadians),
      base: point(line.base), offset: vector(line.offset),
    })),
    patternAngle: hatch.patternAngle + radiansToDegrees(transform.rotationRadians),
  };
}

function rotate([x, y]: Vec2, radians: number): Vec2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function radiansToDegrees(value: number): number { return value * 180 / Math.PI; }
