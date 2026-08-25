// SPDX-License-Identifier: Apache-2.0

import type { SplineGeometry, Vec2 } from '../document';

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SplineSampleOptions {
  maxError: number;
  maxDepth?: number;
}

type HomogeneousPoint = [number, number, number];

export function evaluateSpline(node: SplineGeometry, parameter: number): Vec2 {
  validateSpline(node);
  if (!Number.isFinite(parameter)) throw new TypeError('SPLINE_PARAMETER_INVALID');
  return project(evaluateHomogeneous(node, Math.min(1, Math.max(0, parameter))));
}

function evaluateHomogeneous(node: SplineGeometry, normalized: number): HomogeneousPoint {
  const pointCount = node.controlPoints.length;
  const lastControlIndex = pointCount - 1;
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[lastControlIndex + 1];
  const knotParameter = normalized === 1
    ? domainEnd
    : domainStart + normalized * (domainEnd - domainStart);
  const span = normalized === 1
    ? lastControlIndex
    : findSpan(node.knots, node.degree, lastControlIndex, knotParameter);
  const weights = node.weights ?? Array.from({ length: pointCount }, () => 1);
  const work: HomogeneousPoint[] = [];
  for (let index = 0; index <= node.degree; index += 1) {
    const sourceIndex = span - node.degree + index;
    const weight = weights[sourceIndex];
    const point = node.controlPoints[sourceIndex];
    work.push([point[0] * weight, point[1] * weight, weight]);
  }
  for (let level = 1; level <= node.degree; level += 1) {
    for (let index = node.degree; index >= level; index -= 1) {
      const knotIndex = span - node.degree + index;
      const denominator = node.knots[knotIndex + node.degree - level + 1]
        - node.knots[knotIndex];
      const alpha = denominator === 0
        ? 0
        : (knotParameter - node.knots[knotIndex]) / denominator;
      work[index] = mixHomogeneous(work[index - 1], work[index], alpha);
    }
  }
  return work[node.degree];
}

export function sampleSpline(
  node: SplineGeometry,
  { maxError, maxDepth = 12 }: SplineSampleOptions,
): Vec2[] {
  if (!(Number.isFinite(maxError) && maxError > 0)) {
    throw new TypeError('SPLINE_MAX_ERROR_INVALID');
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 24) {
    throw new TypeError('SPLINE_MAX_DEPTH_INVALID');
  }
  validateSpline(node);
  const first = project(evaluateHomogeneous(node, 0));
  const output: Vec2[] = [first];
  const spans = normalizedKnotSpans(node);
  for (let index = 1; index < spans.length; index += 1) {
    const controls = extractBezierControls(node, spans[index - 1]!, spans[index]!);
    subdivideBezier(controls, 0, maxDepth, maxError, output);
  }
  if (node.closed && !samePoint(output[0], output.at(-1)!)) output.push(output[0]);
  return output;
}

function normalizedKnotSpans(node: SplineGeometry): number[] {
  const start = node.knots[node.degree]!;
  const end = node.knots[node.controlPoints.length]!;
  return node.knots.slice(node.degree, node.controlPoints.length + 1)
    .map((value) => (value - start) / (end - start))
    .filter((value, index, values) => index === 0 || value > values[index - 1]!);
}

export function splineBounds(node: SplineGeometry): Bounds2D {
  validateSpline(node);
  const controlMinX = Math.min(...node.controlPoints.map(([x]) => x));
  const controlMaxX = Math.max(...node.controlPoints.map(([x]) => x));
  const controlMinY = Math.min(...node.controlPoints.map(([, y]) => y));
  const controlMaxY = Math.max(...node.controlPoints.map(([, y]) => y));
  const span = Math.max(controlMaxX - controlMinX, controlMaxY - controlMinY, 1);
  const points = sampleSpline(node, { maxError: Math.max(span * 1e-6, 1e-8), maxDepth: 18 });
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function validateSpline(node: SplineGeometry): void {
  if (!Number.isInteger(node.degree) || node.degree < 1) {
    throw new TypeError('SPLINE_DEGREE_INVALID');
  }
  if (node.controlPoints.length <= node.degree) {
    throw new TypeError('SPLINE_CONTROL_POINT_COUNT_INVALID');
  }
  if (node.controlPoints.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new TypeError('SPLINE_CONTROL_POINT_INVALID');
  }
  const expectedKnots = node.controlPoints.length + node.degree + 1;
  if (node.knots.length !== expectedKnots) {
    throw new TypeError('SPLINE_KNOT_COUNT_INVALID');
  }
  if (node.knots.some((value, index) => (
    !Number.isFinite(value) || (index > 0 && value < node.knots[index - 1])
  ))) {
    throw new TypeError('SPLINE_KNOT_SEQUENCE_INVALID');
  }
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[node.controlPoints.length];
  if (!(domainEnd > domainStart)) throw new TypeError('SPLINE_KNOT_DOMAIN_INVALID');
  if (node.weights !== undefined && (
    node.weights.length !== node.controlPoints.length
    || node.weights.some((weight) => !Number.isFinite(weight) || weight <= 0)
  )) {
    throw new TypeError('SPLINE_WEIGHTS_INVALID');
  }
}

function findSpan(knots: readonly number[], degree: number, lastControlIndex: number, value: number): number {
  let low = degree;
  let high = lastControlIndex + 1;
  let middle = Math.floor((low + high) / 2);
  while (value < knots[middle] || value >= knots[middle + 1]) {
    if (value < knots[middle]) high = middle;
    else low = middle;
    middle = Math.floor((low + high) / 2);
  }
  return middle;
}

function mixHomogeneous(first: HomogeneousPoint, second: HomogeneousPoint, alpha: number): HomogeneousPoint {
  return [
    first[0] * (1 - alpha) + second[0] * alpha,
    first[1] * (1 - alpha) + second[1] * alpha,
    first[2] * (1 - alpha) + second[2] * alpha,
  ];
}

function subdivideBezier(
  controls: HomogeneousPoint[],
  depth: number,
  maxDepth: number,
  maxError: number,
  output: Vec2[],
): void {
  const points = controls.map(project);
  const start = points[0]!;
  const end = points.at(-1)!;
  const flatness = Math.max(0, ...points.slice(1, -1).map((point) => pointSegmentDistance(point, start, end)));
  if (depth >= maxDepth || flatness <= maxError) {
    output.push(end);
    return;
  }
  const [left, right] = splitBezier(controls);
  subdivideBezier(left, depth + 1, maxDepth, maxError, output);
  subdivideBezier(right, depth + 1, maxDepth, maxError, output);
}

function extractBezierControls(node: SplineGeometry, start: number, end: number): HomogeneousPoint[] {
  const degree = node.degree;
  if (degree === 1) return [evaluateHomogeneous(node, start), evaluateHomogeneous(node, end)];
  const samples = Array.from({ length: degree + 1 }, (_, row) => {
    const local = row / degree;
    return evaluateHomogeneous(node, start + (end - start) * local);
  });
  const matrix = Array.from({ length: degree + 1 }, (_, row) => {
    const parameter = row / degree;
    return Array.from({ length: degree + 1 }, (_, column) => bernstein(degree, column, parameter));
  });
  return solve(matrix, samples);
}

function solve(matrix: number[][], values: HomogeneousPoint[]): HomogeneousPoint[] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...values[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    if (Math.abs(divisor) <= 1e-14) throw new TypeError('SPLINE_BEZIER_EXTRACTION_FAILED');
    for (let index = column; index < size + 3; index += 1) augmented[column]![index] = augmented[column]![index]! / divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index < size + 3; index += 1) augmented[row]![index] = augmented[row]![index]! - factor * augmented[column]![index]!;
    }
  }
  return augmented.map((row) => [row[size]!, row[size + 1]!, row[size + 2]!]);
}

function splitBezier(controls: HomogeneousPoint[]): [HomogeneousPoint[], HomogeneousPoint[]] {
  const levels: HomogeneousPoint[][] = [controls.map((point) => [...point])];
  while (levels.at(-1)!.length > 1) {
    const previous = levels.at(-1)!;
    levels.push(previous.slice(1).map((point, index) => mixHomogeneous(previous[index]!, point, 0.5)));
  }
  return [levels.map((level) => level[0]!), levels.map((level) => level.at(-1)!).reverse()];
}

function project(point: HomogeneousPoint): Vec2 {
  if (!(Math.abs(point[2]) > Number.EPSILON)) throw new TypeError('SPLINE_WEIGHT_SUM_INVALID');
  return [point[0] / point[2], point[1] / point[2]];
}

function bernstein(degree: number, index: number, parameter: number): number {
  return binomial(degree, index) * parameter ** index * (1 - parameter) ** (degree - index);
}

function binomial(n: number, k: number): number {
  let result = 1;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
  return result;
}

function pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const projection = Math.min(1, Math.max(0, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return Math.hypot(
    point[0] - (start[0] + projection * dx),
    point[1] - (start[1] + projection * dy),
  );
}

function samePoint(first: Vec2, second: Vec2): boolean {
  return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
}
