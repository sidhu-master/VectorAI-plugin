// SPDX-License-Identifier: Apache-2.0

import type { HatchBoundaryEdge, Vec2 } from '@vectorai/drawing-core';

const TAU = Math.PI * 2;

export function flattenHatchEdge(edge: HatchBoundaryEdge, tolerance: number): Vec2[] {
  if (edge.type === 'line') return [edge.start, edge.end];
  if (edge.type === 'arc') {
    const orientation = edge.counterClockwise ? 1 : -1;
    return sampleAngularCurve(
      degrees(edge.startAngle), degrees(edge.endAngle),
      Math.abs(edge.radius), tolerance,
      (angle) => [
        edge.center[0] + Math.cos(angle) * edge.radius,
        edge.center[1] + Math.sin(angle) * edge.radius * orientation,
      ],
    );
  }
  if (edge.type === 'ellipse') {
    const majorLength = Math.hypot(...edge.majorAxis);
    const minorLength = majorLength * edge.axisRatio;
    const orientation = edge.counterClockwise ? 1 : -1;
    const ux = majorLength > 0 ? edge.majorAxis[0] / majorLength : 1;
    const uy = majorLength > 0 ? edge.majorAxis[1] / majorLength : 0;
    return sampleAngularCurve(
      edge.startParameter, edge.endParameter,
      Math.max(majorLength, minorLength), tolerance,
      (parameter) => [
        edge.center[0] + ux * majorLength * Math.cos(parameter) - uy * minorLength * Math.sin(parameter) * orientation,
        edge.center[1] + uy * majorLength * Math.cos(parameter) + ux * minorLength * Math.sin(parameter) * orientation,
      ],
    );
  }
  return flattenSpline(edge, tolerance);
}

function sampleAngularCurve(
  start: number,
  end: number,
  radius: number,
  tolerance: number,
  pointAt: (parameter: number) => Vec2,
): Vec2[] {
  const rawSweep = end - start;
  const sweep = ((rawSweep % TAU) + TAU) % TAU || TAU;
  const safeRadius = Math.max(radius, tolerance);
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / safeRadius)));
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(maxStep, Math.PI / 90)));
  return Array.from({ length: count + 1 }, (_, index) => pointAt(start + sweep * index / count));
}

function flattenSpline(edge: Extract<HatchBoundaryEdge, { type: 'spline' }>, tolerance: number): Vec2[] {
  const domainStart = edge.knots[edge.degree] ?? 0;
  const domainEnd = edge.knots[edge.controlPoints.length] ?? 1;
  const first = splinePoint(edge, domainStart);
  const last = splinePoint(edge, domainEnd);
  const output: Vec2[] = [first];
  subdivideSpline(edge, domainStart, domainEnd, first, last, tolerance, 0, output);
  return output;
}

function subdivideSpline(
  edge: Extract<HatchBoundaryEdge, { type: 'spline' }>,
  start: number,
  end: number,
  a: Vec2,
  b: Vec2,
  tolerance: number,
  depth: number,
  output: Vec2[],
): void {
  const middleParameter = (start + end) / 2;
  const middle = splinePoint(edge, middleParameter);
  const chordMiddle: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (depth >= 16 || Math.hypot(middle[0] - chordMiddle[0], middle[1] - chordMiddle[1]) <= tolerance) {
    output.push(b);
    return;
  }
  subdivideSpline(edge, start, middleParameter, a, middle, tolerance, depth + 1, output);
  subdivideSpline(edge, middleParameter, end, middle, b, tolerance, depth + 1, output);
}

function splinePoint(edge: Extract<HatchBoundaryEdge, { type: 'spline' }>, parameter: number): Vec2 {
  const degree = edge.degree;
  const count = edge.controlPoints.length;
  const basis = Array.from({ length: count }, (_, index) => basisValue(index, degree, parameter, edge.knots, parameter === edge.knots[count]));
  let x = 0;
  let y = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    const weight = edge.weights?.[index] ?? 1;
    const weightedBasis = (basis[index] ?? 0) * weight;
    x += (edge.controlPoints[index]?.[0] ?? 0) * weightedBasis;
    y += (edge.controlPoints[index]?.[1] ?? 0) * weightedBasis;
    denominator += weightedBasis;
  }
  return denominator === 0 ? edge.controlPoints[0] ?? [0, 0] : [x / denominator, y / denominator];
}

function basisValue(index: number, degree: number, parameter: number, knots: number[], atEnd: boolean): number {
  if (degree === 0) {
    if (atEnd && parameter === knots[index + 1] && parameter === knots[knots.length - 1]) return 1;
    return knots[index]! <= parameter && parameter < knots[index + 1]! ? 1 : 0;
  }
  const leftDenominator = knots[index + degree]! - knots[index]!;
  const rightDenominator = knots[index + degree + 1]! - knots[index + 1]!;
  const left = leftDenominator === 0 ? 0 : (parameter - knots[index]!) / leftDenominator
    * basisValue(index, degree - 1, parameter, knots, atEnd);
  const right = rightDenominator === 0 ? 0 : (knots[index + degree + 1]! - parameter) / rightDenominator
    * basisValue(index + 1, degree - 1, parameter, knots, atEnd);
  return left + right;
}

function degrees(value: number): number {
  return value * Math.PI / 180;
}
