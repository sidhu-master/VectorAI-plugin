// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, DimensionAnnotation, ToleranceProjection } from '@vectorai/drawing-core';
import {
  projectEngineeringAnnotations,
  type EngineeringAnnotationDraft,
} from '@vectorai/engineering-annotation';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';

type Plan = NonNullable<DimensionPlanSessionSnapshot['draft'] | DimensionPlanSessionSnapshot['confirmed']>;

export function projectDimensionToleranceByIntentId(
  plan: Plan | undefined,
): ReadonlyMap<string, ToleranceProjection> {
  if (plan === undefined) return new Map();
  const projected = projectEngineeringAnnotations({
    draft: plan as unknown as EngineeringAnnotationDraft,
    orderedIntentIds: plan.intents.map(({ id }) => id),
    existingAnnotations: [],
  }).annotations;
  return new Map(projected.flatMap(({ engineeringIntentId, toleranceProjection }) => (
    engineeringIntentId === undefined || toleranceProjection === undefined
      ? []
      : [[engineeringIntentId, toleranceProjection] as const]
  )));
}

/**
 * Reuses the engineering-domain projector, then merges only portable tolerance
 * metadata onto dimensions that already exist in the drawing presentation.
 * Geometry, ids, layout and visibility remain owned by the drawing snapshot.
 */
export function projectPersistedDimensionTolerances(
  annotations: readonly AnnotationNode[],
  plan: Plan | undefined,
): AnnotationNode[] {
  if (plan === undefined) return [...annotations];
  const planIntentIds = new Set(plan.intents.map(({ id }) => id));
  const dimensions = annotations.filter((node): node is DimensionAnnotation => (
    node.type === 'dimension' && node.engineeringIntentId !== undefined
  ));
  const existingIntentIds = new Set(dimensions.map(({ engineeringIntentId }) => engineeringIntentId!));
  const projected = projectEngineeringAnnotations({
    draft: plan as unknown as EngineeringAnnotationDraft,
    orderedIntentIds: plan.intents.map(({ id }) => id).filter((id) => existingIntentIds.has(id)),
    existingAnnotations: [...annotations],
  }).annotations;
  const toleranceByIntentId = new Map(projected.map(({ engineeringIntentId, toleranceProjection }) => (
    [engineeringIntentId!, toleranceProjection] as const
  )));
  return annotations.map((node) => {
    if (node.type !== 'dimension' || node.engineeringIntentId === undefined) return node;
    if (!planIntentIds.has(node.engineeringIntentId)) return node;
    const toleranceProjection = toleranceByIntentId.get(node.engineeringIntentId);
    const next = { ...node };
    delete next.toleranceProjection;
    return toleranceProjection === undefined ? next : { ...next, toleranceProjection };
  });
}
