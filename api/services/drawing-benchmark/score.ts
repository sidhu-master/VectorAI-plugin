import type {
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
} from '../../../src/drawing/index.js';
import type {
  DrawingBenchmarkReport,
  DrawingBenchmarkTolerance,
  DrawingEntityParameterMismatch,
  DrawingEntityTypeMismatch,
} from './types.js';

export function scoreDrawingBenchmark(
  actual: DrawingDocument,
  golden: DrawingDocument,
  tolerance: DrawingBenchmarkTolerance,
): DrawingBenchmarkReport {
  const actualById = new Map(actual.geometry.map((node) => [node.id as string, node]));
  const goldenById = new Map(golden.geometry.map((node) => [node.id as string, node]));
  const missingIds = [...goldenById.keys()].filter((id) => !actualById.has(id)).sort();
  const extraIds = [...actualById.keys()].filter((id) => !goldenById.has(id)).sort();
  const typeMismatches: DrawingEntityTypeMismatch[] = [];
  const parameterMismatches: DrawingEntityParameterMismatch[] = [];

  for (const [id, expected] of goldenById) {
    const observed = actualById.get(id);
    if (!observed) continue;
    if (observed.type !== expected.type) {
      typeMismatches.push({
        expectedId: id,
        actualId: id,
        expectedType: expected.type,
        actualType: observed.type,
      });
      continue;
    }
    const parameterError = maximumParameterError(observed, expected, tolerance);
    if (parameterError > tolerance.sourcePixelDistance) {
      parameterMismatches.push({
        expectedId: id,
        actualId: id,
        maxPixelError: parameterError,
      });
    }
  }

  const topology = compareRelations(actual.relations, golden.relations, 'topology');
  const associations = compareRelations(actual.relations, golden.relations, 'association');
  const precision = ratio(golden.geometry.length - missingIds.length, actual.geometry.length);
  const recall = ratio(golden.geometry.length - missingIds.length, golden.geometry.length);
  const exact = missingIds.length === 0
    && extraIds.length === 0
    && typeMismatches.length === 0
    && parameterMismatches.length === 0
    && topology.passed
    && associations.passed;
  const edgeF1 = exact ? 1 : 0;

  return {
    passed: exact && edgeF1 >= tolerance.edgeF1,
    entity: {
      precision,
      recall,
      missingIds,
      extraIds,
      typeMismatches,
      parameterMismatches,
    },
    topology,
    associations,
    residual: { edgeF1, unresolvedRegionCount: exact ? 0 : 1 },
  };
}

function maximumParameterError(
  actual: GeometryNode,
  expected: GeometryNode,
  tolerance: DrawingBenchmarkTolerance,
): number {
  const actualNumbers = numericLeaves(actual);
  const expectedNumbers = numericLeaves(expected);
  let maximum = 0;
  for (const [path, expectedValue] of expectedNumbers) {
    const actualValue = actualNumbers.get(path);
    if (actualValue === undefined) return Number.POSITIVE_INFINITY;
    const delta = Math.abs(actualValue - expectedValue);
    const normalized = path.toLowerCase().includes('angle')
      ? delta * tolerance.sourcePixelDistance / tolerance.angleDegrees
      : delta;
    maximum = Math.max(maximum, normalized);
  }
  return maximum;
}

function numericLeaves(value: unknown, path = ''): Map<string, number> {
  const output = new Map<string, number>();
  visitNumericLeaves(value, path, output);
  return output;
}

function visitNumericLeaves(value: unknown, path: string, output: Map<string, number>): void {
  if (typeof value === 'number') {
    output.set(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitNumericLeaves(item, `${path}[${index}]`, output));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'quality') continue;
    visitNumericLeaves(child, path ? `${path}.${key}` : key, output);
  }
}

function compareRelations(
  actual: DrawingRelation[],
  golden: DrawingRelation[],
  plane: DrawingRelation['plane'],
): { passed: boolean; missing: string[]; extra: string[] } {
  const actualIds = new Set(actual.filter((item) => item.plane === plane).map((item) => item.id as string));
  const goldenIds = new Set(golden.filter((item) => item.plane === plane).map((item) => item.id as string));
  const missing = [...goldenIds].filter((id) => !actualIds.has(id)).sort();
  const extra = [...actualIds].filter((id) => !goldenIds.has(id)).sort();
  return { passed: missing.length === 0 && extra.length === 0, missing, extra };
}

function ratio(matched: number, total: number): number {
  if (total === 0) return matched === 0 ? 1 : 0;
  return matched / total;
}
