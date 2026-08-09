import { parentPort } from 'node:worker_threads';
import openCvModule from '@techstark/opencv-js';

import type {
  CvPrimitiveFit,
  SourcePixelPoint,
  SourcePixelRect,
} from './types.js';
import type {
  CvWorkerEvidence,
  CvWorkerMessage,
  CvWorkerRequest,
} from './worker-protocol.js';

if (!parentPort) throw new Error('CV_WORKER_PARENT_MISSING');

const cv = await openCvModule;
parentPort.postMessage({ type: 'ready' } satisfies CvWorkerMessage);
parentPort.on('message', (request: CvWorkerRequest) => {
  try {
    const value = request.operation === 'overview'
      ? inspectOverview(request)
      : request.operation === 'extract'
        ? extractEvidence(request)
        : fitPrimitive(request);
    parentPort!.postMessage({
      type: 'response', id: request.id, ok: true, value,
    } satisfies CvWorkerMessage);
  } catch (error) {
    parentPort!.postMessage({
      type: 'response',
      id: request.id,
      ok: false,
      code: errorCode(error),
      message: error instanceof Error ? error.message : String(error),
    } satisfies CvWorkerMessage);
  }
});

function inspectOverview(request: Extract<CvWorkerRequest, { operation: 'overview' }>) {
  return withBinaryContours(request, (contours: any) => {
    let componentCount = 0;
    let minX = request.width;
    let minY = request.height;
    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      try {
        if (Math.abs(cv.contourArea(contour, false)) < 5) continue;
        const rect = cv.boundingRect(contour);
        componentCount += 1;
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      } finally {
        contour.delete();
      }
    }
    return {
      width: request.width,
      height: request.height,
      componentCount,
      ...(componentCount > 0 ? {
        foregroundBounds: {
          x: minX + request.origin[0],
          y: minY + request.origin[1],
          width: maxX - minX,
          height: maxY - minY,
        },
      } : {}),
    };
  });
}

function extractEvidence(
  request: Extract<CvWorkerRequest, { operation: 'extract' }>,
): CvWorkerEvidence[] {
  return withBinaryContours(request, (contours: any) => {
    const ranked: Array<{ evidence: CvWorkerEvidence; score: number }> = [];
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      try {
        const area = Math.abs(cv.contourArea(contour, false));
        const perimeter = cv.arcLength(contour, true);
        if (area < 20 || perimeter <= 0) continue;
        const rect = cv.boundingRect(contour);
        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
        const raw = contour.data32S as Int32Array;
        const samples = boundedSamples(raw, request);
        const touchesRegionEdge = rect.x <= 1 || rect.y <= 1
          || rect.x + rect.width >= request.width - 1
          || rect.y + rect.height >= request.height - 1;
        const kind = circularity >= 0.72 ? 'circle-candidate' : 'contour';
        ranked.push({
          score: Math.max(area, rect.width * rect.height * 0.5),
          evidence: {
          kind,
          bounds: {
            x: rect.x + request.origin[0],
            y: rect.y + request.origin[1],
            width: rect.width,
            height: rect.height,
          },
          confidence: kind === 'circle-candidate'
            ? Math.max(0, Math.min(1, circularity))
            : Math.max(0.35, Math.min(0.95, 0.35 + Math.sqrt(
              area / (request.width * request.height),
            ) * 2)),
          touchesRegionEdge,
          samples,
          },
        });
      } finally {
        contour.delete();
      }
    }
    return ranked
      .sort((left, right) => right.score - left.score)
      .slice(0, request.budget.maxResults)
      .map((item) => item.evidence);
  });
}

function withBinaryContours<T>(
  request: Extract<CvWorkerRequest, { operation: 'overview' | 'extract' }>,
  consume: (contours: any) => T,
): T {
  assertPixelBudget(request);
  const source = cv.matFromArray(
    request.height,
    request.width,
    cv.CV_8UC4,
    new Uint8Array(request.rgba),
  );
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_NONE);
    return consume(contours);
  } finally {
    source.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function boundedSamples(
  raw: Int32Array,
  request: Extract<CvWorkerRequest, { operation: 'overview' | 'extract' }>,
) {
  const pointCount = raw.length / 2;
  const limit = Math.min(pointCount, request.budget.maxSamplesPerResult);
  const step = Math.max(1, Math.floor(pointCount / Math.max(1, limit)));
  const samples: Array<readonly [number, number]> = [];
  for (let point = 0; point < pointCount && samples.length < limit; point += step) {
    samples.push([
      raw[point * 2] + request.origin[0],
      raw[point * 2 + 1] + request.origin[1],
    ]);
  }
  return samples;
}

function assertPixelBudget(
  request: Extract<CvWorkerRequest, { operation: 'overview' | 'extract' }>,
): void {
  if (request.width * request.height > request.budget.maxPixels) {
    throw Object.assign(new Error('CV_BUDGET_EXCEEDED'), { code: 'CV_BUDGET_EXCEEDED' });
  }
}

function fitPrimitive(
  request: Extract<CvWorkerRequest, { operation: 'fit' }>,
): CvPrimitiveFit {
  const values = new Float64Array(request.samples);
  if (values.length < 2 || values.length % 2 !== 0
    || values.length / 2 > request.budget.maxSamplesPerResult) {
    throw codedError('CV_SAMPLES_INVALID');
  }
  const points: SourcePixelPoint[] = [];
  for (let index = 0; index < values.length; index += 2) {
    if (!Number.isFinite(values[index]) || !Number.isFinite(values[index + 1])) {
      throw codedError('CV_SAMPLES_INVALID');
    }
    points.push([values[index], values[index + 1]]);
  }

  const fitted = request.primitiveType === 'point'
    ? fitPoint(points)
    : request.primitiveType === 'circle' || request.primitiveType === 'arc'
      ? fitCircular(points, request.primitiveType)
      : request.primitiveType === 'ellipse'
        ? fitEllipse(points)
        : request.primitiveType === 'polyline'
          ? fitPolyline(points)
          : request.primitiveType === 'spline'
            ? fitSpline(points)
            : fitLinear(points, request.primitiveType);
  const sorted = [...fitted.errors].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const outlierThreshold = Math.max(1, p50 * 3);
  return {
    primitiveType: request.primitiveType,
    parameters: fitted.parameters,
    bounds: boundsOf(points),
    sampleCount: points.length,
    fitErrorP50: p50,
    fitErrorP95: p95,
    fitErrorMax: sorted.at(-1) ?? 0,
    outlierRatio: fitted.errors.filter((error) => error > outlierThreshold).length / points.length,
  };
}

function fitPoint(points: SourcePixelPoint[]) {
  const center = meanPoint(points);
  return {
    parameters: { x: center[0], y: center[1] },
    errors: points.map((point) => distance(point, center)),
  };
}

function fitLinear(
  points: SourcePixelPoint[],
  primitiveType: 'line' | 'ray' | 'xline',
) {
  if (points.length < 2) throw codedError('CV_FIT_REQUIRES_MORE_SAMPLES');
  const origin = meanPoint(points);
  const direction = principalDirection(points, origin);
  const projections = points.map((point) => dot(subtract(point, origin), direction));
  const start = add(origin, scale(direction, Math.min(...projections)));
  const end = add(origin, scale(direction, Math.max(...projections)));
  const parameters = primitiveType === 'line'
    ? { start, end }
    : { origin: primitiveType === 'ray' ? start : origin, direction };
  return {
    parameters,
    errors: points.map((point) => Math.abs(cross(subtract(point, origin), direction))),
  };
}

function fitCircular(points: SourcePixelPoint[], primitiveType: 'circle' | 'arc') {
  if (points.length < 3) throw codedError('CV_FIT_REQUIRES_MORE_SAMPLES');
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const vector = [0, 0, 0];
  for (const [x, y] of points) {
    const row = [x, y, 1];
    const target = -(x * x + y * y);
    for (let r = 0; r < 3; r += 1) {
      vector[r] += row[r] * target;
      for (let c = 0; c < 3; c += 1) matrix[r][c] += row[r] * row[c];
    }
  }
  const [a, b, c] = solve3x3(matrix, vector);
  const center: SourcePixelPoint = [-a / 2, -b / 2];
  const radiusSquared = center[0] ** 2 + center[1] ** 2 - c;
  if (!(radiusSquared > 0)) throw codedError('CV_FIT_DEGENERATE');
  const radius = Math.sqrt(radiusSquared);
  const errors = points.map((point) => Math.abs(distance(point, center) - radius));
  if (primitiveType === 'circle') return { parameters: { center, radius }, errors };

  const angles = points.map((point) => normalizeAngle(Math.atan2(
    point[1] - center[1], point[0] - center[0],
  ))).sort((left, right) => left - right);
  let largestGap = -1;
  let gapIndex = 0;
  for (let index = 0; index < angles.length; index += 1) {
    const next = index === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[index + 1];
    const gap = next - angles[index];
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = index;
    }
  }
  return {
    parameters: {
      center,
      radius,
      startAngle: angles[(gapIndex + 1) % angles.length],
      endAngle: angles[gapIndex],
      counterClockwise: true,
    },
    errors,
  };
}

function fitEllipse(points: SourcePixelPoint[]) {
  if (points.length < 5) throw codedError('CV_FIT_REQUIRES_MORE_SAMPLES');
  const center = meanPoint(points);
  const direction = principalDirection(points, center);
  const minorDirection: SourcePixelPoint = [-direction[1], direction[0]];
  const majorRadius = Math.sqrt(2 * mean(points.map((point) => (
    dot(subtract(point, center), direction) ** 2
  ))));
  const minorRadius = Math.sqrt(2 * mean(points.map((point) => (
    dot(subtract(point, center), minorDirection) ** 2
  ))));
  if (!(majorRadius > 0) || !(minorRadius > 0)) throw codedError('CV_FIT_DEGENERATE');
  const majorAxis = scale(direction, majorRadius);
  const ratio = Math.min(majorRadius, minorRadius) / Math.max(majorRadius, minorRadius);
  const scaleError = Math.max(majorRadius, minorRadius);
  return {
    parameters: { center, majorAxis, ratio },
    errors: points.map((point) => {
      const delta = subtract(point, center);
      const normalized = Math.sqrt(
        (dot(delta, direction) / majorRadius) ** 2
        + (dot(delta, minorDirection) / minorRadius) ** 2,
      );
      return Math.abs(normalized - 1) * scaleError;
    }),
  };
}

function fitPolyline(points: SourcePixelPoint[]) {
  if (points.length < 2) throw codedError('CV_FIT_REQUIRES_MORE_SAMPLES');
  const diagonal = Math.hypot(boundsOf(points).width, boundsOf(points).height);
  const closed = distance(points[0], points.at(-1)!) <= Math.max(1, diagonal * 0.02);
  const limit = Math.min(64, points.length);
  const vertices = Array.from({ length: limit }, (_, index) => {
    const sourceIndex = closed
      ? Math.floor(index * points.length / limit)
      : Math.round(index * (points.length - 1) / Math.max(1, limit - 1));
    return points[sourceIndex];
  });
  const fittedLine = closed ? [...vertices, vertices[0]] : vertices;
  return {
    parameters: { vertices: vertices.map((point) => ({ point })), closed },
    errors: points.map((point) => nearestPolylineDistance(point, fittedLine)),
  };
}

function fitSpline(points: SourcePixelPoint[]) {
  if (points.length < 2) throw codedError('CV_FIT_REQUIRES_MORE_SAMPLES');
  const limit = Math.min(16, points.length);
  const controlPoints = Array.from({ length: limit }, (_, index) => (
    points[Math.round(index * (points.length - 1) / Math.max(1, limit - 1))]
  ));
  const degree = Math.min(3, controlPoints.length - 1);
  const knotCount = controlPoints.length + degree + 1;
  const knots = Array.from({ length: knotCount }, (_, index) => index);
  return {
    parameters: {
      degree,
      controlPoints,
      knots,
      closed: distance(points[0], points.at(-1)!) <= 1,
      periodic: false,
    },
    errors: points.map((point) => nearestPolylineDistance(point, controlPoints)),
  };
}

function principalDirection(points: SourcePixelPoint[], center: SourcePixelPoint): SourcePixelPoint {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const [x, y] = subtract(point, center);
    xx += x * x;
    xy += x * y;
    yy += y * y;
  }
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  return [Math.cos(angle), Math.sin(angle)];
}

function solve3x3(matrix: number[][], vector: number[]): number[] {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-12) throw codedError('CV_FIT_DEGENERATE');
    for (let item = column; item < 4; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item < 4; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }
  return augmented.map((row) => row[3]);
}

function boundsOf(points: SourcePixelPoint[]): SourcePixelRect {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

function meanPoint(points: SourcePixelPoint[]): SourcePixelPoint {
  return [mean(points.map((point) => point[0])), mean(points.map((point) => point[1]))];
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
}

function add(a: SourcePixelPoint, b: SourcePixelPoint): SourcePixelPoint {
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract(a: SourcePixelPoint, b: SourcePixelPoint): SourcePixelPoint {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale(point: SourcePixelPoint, factor: number): SourcePixelPoint {
  return [point[0] * factor, point[1] * factor];
}

function dot(a: SourcePixelPoint, b: SourcePixelPoint): number {
  return a[0] * b[0] + a[1] * b[1];
}

function cross(a: SourcePixelPoint, b: SourcePixelPoint): number {
  return a[0] * b[1] - a[1] * b[0];
}

function distance(a: SourcePixelPoint, b: SourcePixelPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function normalizeAngle(angle: number): number {
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

function nearestPolylineDistance(point: SourcePixelPoint, line: SourcePixelPoint[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const delta = subtract(line[index], start);
    const lengthSquared = dot(delta, delta);
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, dot(subtract(point, start), delta) / lengthSquared));
    nearest = Math.min(nearest, distance(point, add(start, scale(delta, t))));
  }
  return Number.isFinite(nearest) ? nearest : 0;
}

function codedError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'CV_WORKER_FAILED';
}
