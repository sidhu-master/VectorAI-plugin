// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import type { ShaftAxis } from '../partition/types';

export interface ShaftCoordinateFrame {
  origin: Vec2;
  axis: Vec2;
  normal: Vec2;
  toLocal(point: Vec2): [number, number];
  toWorld(z: number, r: number): Vec2;
}

export function createShaftCoordinateFrame(value: ShaftAxis): ShaftCoordinateFrame {
  const axis = normalize(value.direction);
  let normal = normalize(value.normal);
  if (Math.abs(dot(axis, normal)) > 1e-8) normal = [-axis[1], axis[0]];
  if (cross(axis, normal) < 0) normal = [-normal[0], -normal[1]];
  const origin: Vec2 = [...value.origin];
  return {
    origin,
    axis,
    normal,
    toLocal(point) {
      const delta: Vec2 = [point[0] - origin[0], point[1] - origin[1]];
      return [dot(delta, axis), dot(delta, normal)];
    },
    toWorld(z, r) {
      return [origin[0] + axis[0] * z + normal[0] * r, origin[1] + axis[1] * z + normal[1] * r];
    },
  };
}

function normalize(value: Vec2): [number, number] {
  const length = Math.hypot(value[0], value[1]);
  if (!(length > 0)) throw new Error('SHAFT_AXIS_DIRECTION_INVALID');
  return [value[0] / length, value[1] / length];
}
function dot(left: Vec2, right: Vec2): number { return left[0] * right[0] + left[1] * right[1]; }
function cross(left: Vec2, right: Vec2): number { return left[0] * right[1] - left[1] * right[0]; }
