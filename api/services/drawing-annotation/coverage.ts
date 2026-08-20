import type { AnnotationNode } from '../../../src/drawing/index.js';
import type { MeasurementResult } from './types.js';
import type { AnnotationPlan, PendingAnnotation } from './planner.js';

export interface AnnotationCoverageReport {
  valid: boolean;
  expectedFactKeys: string[];
  consumedFactKeys: string[];
  missingFactKeys: string[];
  duplicateFactKeys: string[];
  suppressedFactKeys: string[];
  invalidSuppressedFactKeys: string[];
  invalidAnnotationIds: string[];
  pendingAnnotations: PendingAnnotation[];
  conflicts: PendingAnnotation[];
}

export function evaluateAnnotationCoverage(input: {
  measurements: MeasurementResult;
  plan: AnnotationPlan;
  geometryIds: Set<string>;
}): AnnotationCoverageReport {
  const expectedFactKeys = uniqueSorted(input.measurements.facts.map((fact) => fact.key));
  const expected = new Set(expectedFactKeys);
  const consumedFactKeys = uniqueSorted(input.plan.consumedFactKeys);
  const consumed = new Set(consumedFactKeys);
  const suppressedFactKeys = uniqueSorted(input.plan.suppressedFactKeys);
  const suppressed = new Set(suppressedFactKeys);
  const invalidSuppressedFactKeys = suppressedFactKeys.filter((key) => (
    !expected.has(key)
    || consumed.has(key)
    || !input.plan.suppressionReasons[key]?.trim()
  ));
  const missingFactKeys = expectedFactKeys.filter((key) => !consumed.has(key) && !suppressed.has(key));
  const duplicateFactKeys = duplicates([
    ...input.plan.consumedFactKeys,
    ...duplicates(Object.values(input.plan.factKeysByAnnotationId)),
  ]).filter((key) => expected.has(key));
  const invalidAnnotationIds = new Set<string>();
  const annotationIdCounts = counts(input.plan.annotations.map((annotation) => annotation.id));
  const annotationIds = new Set<string>(input.plan.annotations.map((annotation) => annotation.id));

  for (const annotation of input.plan.annotations) {
    if ((annotationIdCounts.get(annotation.id) ?? 0) > 1) invalidAnnotationIds.add(annotation.id);
    const factKey = input.plan.factKeysByAnnotationId[annotation.id];
    if (!factKey || !expected.has(factKey) || !consumed.has(factKey)) {
      invalidAnnotationIds.add(annotation.id);
    }
    if (annotationGeometryIds(annotation).some((id) => !input.geometryIds.has(id))) {
      invalidAnnotationIds.add(annotation.id);
    }
  }
  for (const [annotationId, factKey] of Object.entries(input.plan.factKeysByAnnotationId)) {
    if (!annotationIds.has(annotationId) || !expected.has(factKey)) invalidAnnotationIds.add(annotationId);
  }

  const report: AnnotationCoverageReport = {
    valid: false,
    expectedFactKeys,
    consumedFactKeys,
    missingFactKeys,
    duplicateFactKeys,
    suppressedFactKeys,
    invalidSuppressedFactKeys,
    invalidAnnotationIds: [...invalidAnnotationIds].sort((left, right) => left.localeCompare(right)),
    pendingAnnotations: structuredClone(input.plan.pendingAnnotations),
    conflicts: structuredClone(input.plan.conflicts),
  };
  report.valid = report.missingFactKeys.length === 0
    && report.duplicateFactKeys.length === 0
    && report.invalidSuppressedFactKeys.length === 0
    && report.invalidAnnotationIds.length === 0
    && input.plan.annotations.length === Object.keys(input.plan.factKeysByAnnotationId).length
    && input.plan.annotations.length === input.plan.consumedFactKeys.length;
  return report;
}

function annotationGeometryIds(annotation: AnnotationNode): string[] {
  if (annotation.type === 'text' || annotation.type === 'section-hatch') return [];
  if (annotation.type === 'leader') return [annotation.target.geometryId];
  if (annotation.type === 'centerline') return annotation.targets;
  return annotation.targets.map((target) => target.geometryId);
}

function duplicates(values: string[]): string[] {
  return [...counts(values).entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right));
}

function counts(values: string[]): Map<string, number> {
  const result = new Map<string, number>();
  values.forEach((value) => result.set(value, (result.get(value) ?? 0) + 1));
  return result;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
