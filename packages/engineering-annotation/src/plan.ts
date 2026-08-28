// SPDX-License-Identifier: Apache-2.0

import {
  type AnnotationId,
  type AnnotationNode,
  type AssociationRelation,
  type DrawingDocument,
  type EvidenceId,
  type RelationId,
} from '@vectorai/drawing-core';
import type { DrawingRef, SpatialEditProgram } from '@vectorai/drawing-edit-protocol';
import { orderDimensionIntents } from './dimension/order';
import { projectEngineeringAnnotations } from './dimension/project';
import type { EngineeringAnnotationDraft } from './dimension/types';
import { layoutOpeningAngles, measureOpeningAngles, selectAxialEndOpeningAngles } from './opening-angle';

export interface PendingEngineeringAnnotation {
  nodeId: string;
  reason: 'SOURCE_NOT_CONFIRMED' | 'UNSUPPORTED_GEOMETRY';
}

export interface EngineeringAnnotationPlan {
  annotations: AnnotationNode[];
  associations: AssociationRelation[];
  targetNodeIds: string[];
  pending: PendingEngineeringAnnotation[];
  suppressed: Array<{ nodeId: string; reason: string }>;
  program: SpatialEditProgram | null;
}

export function planEngineeringAnnotations(input: {
  document: DrawingDocument;
  ref: DrawingRef;
  objective: string;
}): EngineeringAnnotationPlan {
  const annotationTemplates: AnnotationNode[] = [];
  const associations: AssociationRelation[] = [];
  const pending: PendingEngineeringAnnotation[] = [];
  const suppressed: Array<{ nodeId: string; reason: string }> = [];
  const geometry = input.document.geometry.filter(({ visible }) => visible);
  for (const node of geometry) {
    if (node.quality.status !== 'confirmed') {
      pending.push({ nodeId: node.id, reason: 'SOURCE_NOT_CONFIRMED' });
    }
  }
  const measuredOpenings = measureOpeningAngles(geometry);
  const openingSelection = selectAxialEndOpeningAngles({
    facts: measuredOpenings.facts,
    geometry,
    axis: measuredOpenings.axis,
  });
  const openingLayouts = layoutOpeningAngles({ geometry, facts: openingSelection.selected });
  for (const fact of openingSelection.selected) {
    const layout = openingLayouts[fact.key];
    if (!layout) continue;
    const annotationId = `annotation_auto_${stableKey(fact.key)}` as AnnotationId;
    const annotation: AnnotationNode = {
      id: annotationId,
      type: 'dimension',
      visible: true,
      quality: {
        status: 'confirmed', confidence: 1,
        evidenceRefs: fact.evidenceRefs.length > 0
          ? [...fact.evidenceRefs]
          : [`evidence:engineering:${stableKey(fact.sourceIds.join(':'))}` as EvidenceId],
      },
      dimensionKind: 'angular',
      associationStatus: 'resolved',
      targets: fact.sourceIds.map((geometryId, index) => ({
        geometryId,
        anchor: { kind: 'nearest' as const, point: fact.rays[index] ?? fact.vertex },
      })),
      computedValue: fact.value,
      displayText: `${format(fact.value)}°`,
      unit: 'deg',
      textPosition: layout.textPosition,
      definitionPoints: [...layout.definitionPoints],
      engineeringIntentId: `intent_opening_${stableKey(fact.key)}`,
    };
    annotationTemplates.push(annotation);
    associations.push({
      id: `relation_${stableKey(`${input.document.id}:${annotationId}`)}` as RelationId,
      type: 'association', plane: 'association', kind: 'annotation-target',
      annotationId,
      geometryIds: [...fact.sourceIds],
      visible: true,
      quality: { status: 'confirmed', confidence: 1, evidenceRefs: [...annotation.quality.evidenceRefs] },
    });
  }
  for (const [key, reason] of Object.entries(openingSelection.suppressionReasons)) {
    suppressed.push({ nodeId: key, reason });
  }
  const dimensionTemplates = annotationTemplates.filter(
    (annotation): annotation is Extract<AnnotationNode, { type: 'dimension' }> => annotation.type === 'dimension',
  );
  const draft: EngineeringAnnotationDraft = {
    version: 1,
    drawingRef: structuredClone(input.ref),
    datums: [],
    intents: dimensionTemplates.map((annotation) => ({
      id: annotation.engineeringIntentId!,
      drawingRef: structuredClone(input.ref),
      kind: annotation.dimensionKind,
      targets: structuredClone(annotation.targets),
      datumIds: [],
      nominalValue: annotation.computedValue ?? annotation.observedValue ?? 0,
      unit: annotation.unit ?? input.document.unitSystem.length,
      functionalRole: 'inspection',
      source: 'geometry',
      status: 'confirmed',
      evidenceIds: annotation.quality.evidenceRefs.map(String),
    })),
    tolerances: [],
    chains: [],
    dependencies: [],
    diagnostics: [],
  };
  const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
  const projection = projectEngineeringAnnotations({
    draft,
    orderedIntentIds: order.orderedIntentIds,
    existingAnnotations: annotationTemplates,
  });
  const annotations: AnnotationNode[] = projection.annotations;
  const existingAnnotations = new Map(input.document.annotations.map((node) => [node.id, node]));
  const existingAssociations = new Map(input.document.relations
    .filter((relation): relation is AssociationRelation => relation.type === 'association')
    .map((relation) => [relation.id, relation]));
  const plannedOpeningIds = new Set(annotations
    .filter((node) => node.type === 'dimension' && node.engineeringIntentId?.startsWith('intent_opening_'))
    .map(({ id }) => id));
  const createAnnotations: AnnotationNode[] = [];
  const createAssociations: AssociationRelation[] = [];
  const deleteNodeIds = new Set<string>();
  const staleTargetNodeIds = new Set<string>();
  for (const annotation of annotations) {
    const existing = existingAnnotations.get(annotation.id);
    const opening = annotation.type === 'dimension' && annotation.engineeringIntentId?.startsWith('intent_opening_');
    if (!existing) createAnnotations.push(annotation);
    else if (opening && !sameOpeningAnnotation(existing, annotation)) {
      deleteNodeIds.add(existing.id);
      if (existing.type === 'dimension') existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
      createAnnotations.push(annotation);
      for (const relation of existingAssociations.values()) {
        if (relation.annotationId === existing.id) deleteNodeIds.add(relation.id);
      }
    }
  }
  for (const existing of input.document.annotations) {
    if (existing.type !== 'dimension') continue;
    const legacyPrimitiveDimension = existing.engineeringIntentId?.startsWith('intent_auto_') === true;
    const staleOpeningDimension = existing.engineeringIntentId?.startsWith('intent_opening_') === true
      && !plannedOpeningIds.has(existing.id);
    if (!legacyPrimitiveDimension && !staleOpeningDimension) continue;
    deleteNodeIds.add(existing.id);
    existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
    for (const relation of existingAssociations.values()) {
      if (relation.annotationId === existing.id) deleteNodeIds.add(relation.id);
    }
  }
  const createAnnotationIds = new Set(createAnnotations.map(({ id }) => id));
  for (const association of associations) {
    const existing = existingAssociations.get(association.id);
    if (createAnnotationIds.has(association.annotationId) || !existing) createAssociations.push(association);
    else if (association.annotationId.startsWith('annotation_auto_')
      && JSON.stringify(existing) !== JSON.stringify(association)) {
      deleteNodeIds.add(existing.id);
      createAssociations.push(association);
    }
  }
  const targetNodeIds = [...new Set([
    ...associations.flatMap(({ geometryIds }) => geometryIds),
    ...staleTargetNodeIds,
  ])].sort();
  const evidenceRefs = [...new Set(targetNodeIds.flatMap((id) => {
    const node = geometry.find((candidate) => candidate.id === id);
    return node?.quality.evidenceRefs ?? [];
  }))];
  if (targetNodeIds.length > 0 && evidenceRefs.length === 0) {
    evidenceRefs.push(`evidence:engineering:${stableKey(targetNodeIds.join(':'))}` as EvidenceId);
  }
  const operations: SpatialEditProgram['operations'] = [];
  if (deleteNodeIds.size > 0) operations.push({ kind: 'delete_nodes', nodeIds: [...deleteNodeIds].sort() });
  if (createAnnotations.length > 0) operations.push({
    kind: 'create_annotation_batch',
    annotations: structuredClone(createAnnotations) as unknown as Array<Record<string, unknown> & { id: string; type: string }>,
    associations: structuredClone(createAssociations) as unknown as Array<Record<string, unknown> & { id: string; type: 'association' }>,
  });
  const program: SpatialEditProgram | null = operations.length === 0 ? null : {
    baseRef: structuredClone(input.ref),
    targetHandle: '__GROUNDING_TARGET__',
    summary: `Create or refresh ${createAnnotations.length} deterministic engineering annotations`,
    objective: input.objective,
    operations,
    preserveScopes: geometry.map(({ id }) => ({ kind: 'node-field' as const, nodeId: id, fields: ['id', 'type'] })),
    postconditions: [],
    evidenceRefs: evidenceRefs as unknown as string[],
  };
  return { annotations, associations, targetNodeIds, pending, suppressed, program };
}

function sameOpeningAnnotation(left: AnnotationNode, right: AnnotationNode): boolean {
  if (left.type !== 'dimension' || right.type !== 'dimension') return false;
  return left.dimensionKind === right.dimensionKind
    && left.computedValue === right.computedValue
    && left.displayText === right.displayText
    && left.unit === right.unit
    && JSON.stringify(left.targets) === JSON.stringify(right.targets)
    && JSON.stringify(left.textPosition) === JSON.stringify(right.textPosition)
    && JSON.stringify(left.definitionPoints) === JSON.stringify(right.definitionPoints);
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clean(value: number): number {
  return Number(value.toFixed(6));
}

function format(value: number): string {
  return clean(value).toString();
}
