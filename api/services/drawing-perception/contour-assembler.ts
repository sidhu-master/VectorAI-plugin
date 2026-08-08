import type {
  ContourEvidence,
  GeometryObservation,
  GlobalContour,
} from './types.js';

export interface ContourAssemblyResult {
  geometry: GeometryObservation[];
  unresolvedContourIds: string[];
  warnings: string[];
}

export function assembleContours(input: {
  contours: GlobalContour[];
  evidence: ContourEvidence[];
}): ContourAssemblyResult {
  const contours = new Map(input.contours.map((contour) => [contour.id, contour]));
  const evidenceByContour = new Map<string, ContourEvidence[]>();
  const warnings: string[] = [];
  for (const item of input.evidence) {
    if (!item.globalContourId || !contours.has(item.globalContourId)) {
      warnings.push(`轮廓证据 ${item.id} 缺少全局轮廓归属`);
      continue;
    }
    const current = evidenceByContour.get(item.globalContourId) ?? [];
    current.push(item);
    evidenceByContour.set(item.globalContourId, current);
  }

  const geometry: GeometryObservation[] = [];
  const unresolvedContourIds: string[] = [];
  for (const contour of [...input.contours].sort((a, b) => a.id.localeCompare(b.id))) {
    const items = evidenceByContour.get(contour.id) ?? [];
    const measuredParams = assembleParams(contour, items);
    if (!measuredParams) {
      unresolvedContourIds.push(contour.id);
      continue;
    }
    geometry.push({
      id: `global_contour_${contour.id}`,
      viewId: contour.viewId,
      type: contour.geometryFamily,
      imageBounds: [...contour.imageBounds],
      measuredParams,
      confidence: round(Math.min(
        contour.confidence,
        ...(items.length > 0 ? items.map((item) => item.confidence) : [contour.confidence]),
      )),
    });
  }
  return { geometry, unresolvedContourIds, warnings };
}

function assembleParams(
  contour: GlobalContour,
  evidence: ContourEvidence[],
): Record<string, unknown> | null {
  if (contour.geometryFamily === 'circle') {
    const coarse = circleParams(contour.coarseParams);
    if (coarse) return coarse;
    return fitCircle(evidence.flatMap((item) => item.samplePoints));
  }
  return validCoarseParams(contour.geometryFamily, contour.coarseParams)
    ? structuredClone(contour.coarseParams!)
    : null;
}

function circleParams(value: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!value || !point(value.center) || !finite(value.radius) || value.radius <= 0) return null;
  return { center: [...value.center], radius: value.radius };
}

function fitCircle(points: ReadonlyArray<readonly [number, number]>): Record<string, unknown> | null {
  const unique = [...new Map(points.map((item) => [`${item[0]},${item[1]}`, item])).values()];
  if (unique.length < 3) return null;
  let sx = 0; let sy = 0; let sxx = 0; let syy = 0; let sxy = 0;
  let sz = 0; let sxz = 0; let syz = 0;
  for (const [x, y] of unique) {
    const z = -(x * x + y * y);
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    sz += z; sxz += x * z; syz += y * z;
  }
  const solved = solve3x3(
    [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, unique.length]],
    [sxz, syz, sz],
  );
  if (!solved) return null;
  const [d, e, f] = solved;
  const center: [number, number] = [-d / 2, -e / 2];
  const radiusSquared = center[0] ** 2 + center[1] ** 2 - f;
  if (!finite(radiusSquared) || radiusSquared <= 0) return null;
  return {
    center: [round(center[0]), round(center[1])],
    radius: round(Math.sqrt(radiusSquared)),
  };
}

function solve3x3(matrix: number[][], vector: number[]): [number, number, number] | null {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index < 4; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index < 4; index += 1) {
        rows[row][index] -= factor * rows[column][index];
      }
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]];
}

function validCoarseParams(
  type: GlobalContour['geometryFamily'],
  value: Record<string, unknown> | undefined,
): boolean {
  if (!value) return false;
  switch (type) {
    case 'point': return finite(value.x) && finite(value.y);
    case 'line': return point(value.start) && point(value.end);
    case 'ray':
    case 'xline': return point(value.origin) && point(value.direction);
    case 'arc': return point(value.center) && finite(value.radius)
      && finite(value.startAngle) && finite(value.endAngle);
    case 'ellipse': return point(value.center) && point(value.majorAxis) && finite(value.ratio);
    case 'polyline': return pointArray(value.vertices) && typeof value.closed === 'boolean';
    case 'spline': return Number.isInteger(value.degree) && pointArray(value.controlPoints)
      && Array.isArray(value.knots) && value.knots.every(finite)
      && typeof value.closed === 'boolean' && typeof value.periodic === 'boolean';
    case 'circle': return false;
  }
}

function point(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(finite);
}

function pointArray(value: unknown): value is Array<[number, number]> {
  return Array.isArray(value) && value.length > 0 && value.every(point);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
