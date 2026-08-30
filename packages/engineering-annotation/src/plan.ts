// SPDX-License-Identifier: Apache-2.0

import {
  type AnnotationId,
  type AnnotationNode,
  type AssociationRelation,
  type DrawingDocument,
  type EvidenceId,
  type GeometryId,
  type RelationId,
} from '@vectorai/drawing-core';
import type { DrawingRef, SpatialEditProgram } from '@vectorai/drawing-edit-protocol';
import { orderDimensionIntents } from './dimension/order';
import { projectEngineeringAnnotations } from './dimension/project';
import type { EngineeringAnnotationDraft } from './dimension/types';
import { layoutOpeningAngles, measureOpeningAngles, selectAxialEndOpeningAngles } from './opening-angle';
import { measureShaftDiameters } from './diameter';

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

export type DeterministicAnnotationKind = 'opening-angle' | 'diameter';

// Single source of truth for the deterministic members of automatic annotation.
// New annotation generators join the default collection by registering here.
export const DEFAULT_AUTOMATIC_ANNOTATION_KINDS = [
  'opening-angle',
  'diameter',
] as const satisfies readonly DeterministicAnnotationKind[];

export function planEngineeringAnnotations(input: {
  document: DrawingDocument;
  ref: DrawingRef;
  objective: string;
  annotationKinds?: readonly DeterministicAnnotationKind[];
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
  const openingSelection = (input.annotationKinds ?? ['opening-angle']).includes('opening-angle')
    ? selectAxialEndOpeningAngles({ facts: measuredOpenings.facts, geometry, axis: measuredOpenings.axis })
    : { selected: [], suppressionReasons: {} };
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
  for (const fact of (input.annotationKinds ?? ['opening-angle']).includes('diameter') ? measureShaftDiameters(input.document) : []) {
    const annotationId = `annotation_diameter_${stableKey(fact.key)}` as AnnotationId;
    const factEvidenceRefs = fact.sourceIds.flatMap((geometryId) => (
      geometry.find(({ id }) => id === geometryId)?.quality.evidenceRefs ?? []
    ));
    const annotation: AnnotationNode = {
      id: annotationId,
      type: 'dimension',
      visible: true,
      quality: {
        status: 'confirmed', confidence: 1,
        evidenceRefs: factEvidenceRefs.length > 0
          ? [...new Set(factEvidenceRefs)]
          : [`evidence:engineering:${stableKey(fact.sourceIds.join(':'))}` as EvidenceId],
      },
      dimensionKind: 'diameter',
      associationStatus: 'resolved',
      targets: fact.sourceIds.map((geometryId) => ({
        geometryId: geometryId as GeometryId,
        anchor: { kind: 'nearest' as const, point: fact.definitionPoints[0] },
      })),
      computedValue: fact.diameter,
      displayText: `⌀${format(fact.diameter)}`,
      unit: input.document.unitSystem.length,
      textPosition: fact.textPosition,
      definitionPoints: [...fact.definitionPoints],
      engineeringIntentId: `intent_diameter_${stableKey(fact.key)}`,
    };
    annotationTemplates.push(annotation);
    associations.push({
      id: `relation_${stableKey(`${input.document.id}:${annotationId}`)}` as RelationId,
      type: 'association', plane: 'association', kind: 'annotation-target',
      annotationId,
      geometryIds: fact.sourceIds.map((id) => id as GeometryId),
      visible: true,
      quality: { status: 'confirmed', confidence: 1, evidenceRefs: [...annotation.quality.evidenceRefs] },
    });
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
    geometricTolerances: [],
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
  const requestedKinds = new Set<DeterministicAnnotationKind>(input.annotationKinds ?? ['opening-angle']);
  const plannedEngineeringIds = new Set(annotations
    .filter((node) => node.type === 'dimension' && isRequestedEngineeringIntent(node.engineeringIntentId, requestedKinds))
    .map(({ id }) => id));
  const createAnnotations: AnnotationNode[] = [];
  const createAssociations: AssociationRelation[] = [];
  const deleteNodeIds = new Set<string>();
  const staleTargetNodeIds = new Set<string>();
  for (const annotation of annotations) {
    const existing = existingAnnotations.get(annotation.id);
    const managed = annotation.type === 'dimension' && isRequestedEngineeringIntent(annotation.engineeringIntentId, requestedKinds);
    if (!existing) createAnnotations.push(annotation);
    else if (managed && !sameEngineeringAnnotation(existing, annotation)) {
      deleteNodeIds.add(existing.id);
      if (existing.type === 'dimension') existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
      createAnnotations.push(annotation);
    }
  }
  for (const existing of input.document.annotations) {
    if (existing.type !== 'dimension') continue;
    const legacyPrimitiveDimension = existing.engineeringIntentId?.startsWith('intent_auto_') === true;
    const staleEngineeringDimension = isRequestedEngineeringIntent(existing.engineeringIntentId, requestedKinds)
      && !plannedEngineeringIds.has(existing.id);
    if (!legacyPrimitiveDimension && !staleEngineeringDimension) continue;
    deleteNodeIds.add(existing.id);
    existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
  }
  const createAnnotationIds = new Set(createAnnotations.map(({ id }) => id));
  for (const association of associations) {
    const existing = existingAssociations.get(association.id);
    if (createAnnotationIds.has(association.annotationId) || !existing) createAssociations.push(association);
    else if (association.annotationId.startsWith('annotation_auto_')
      && !sameEngineeringAssociation(existing, association)) {
      const annotation = annotations.find(({ id }) => id === association.annotationId);
      if (annotation && !createAnnotationIds.has(annotation.id)) {
        deleteNodeIds.add(annotation.id);
        createAnnotations.push(annotation);
        createAnnotationIds.add(annotation.id);
      }
      deleteNodeIds.add(existing.id);
      createAssociations.push(association);
    }
  }
  const targetNodeIds = [...new Set([
    ...associations.flatMap(({ geometryIds }) => geometryIds),
    ...staleTargetNodeIds,
    ...deleteNodeIds,
  ])].sort();
  const evidenceRefs = [...new Set(targetNodeIds.flatMap((id) => {
    const node = geometry.find((candidate) => candidate.id === id);
    return node?.quality.evidenceRefs ?? [];
  }))];
  if (targetNodeIds.length > 0 && evidenceRefs.length === 0) {
    evidenceRefs.push(`evidence:engineering:${stableKey(targetNodeIds.join(':'))}` as EvidenceId);
  }
  const operations: SpatialEditProgram['operations'] = [];
  if (deleteNodeIds.size > 0) {
    // Deleting an annotation implicitly removes its association relations. Delete
    // those relations explicitly first so the transaction inverse can restore the
    // complete graph instead of recreating only the annotation node.
    const dependentRelationIds = input.document.relations
      .filter((relation) => relation.type === 'association' && deleteNodeIds.has(String(relation.annotationId)))
      .map(({ id }) => String(id))
      .sort();
    operations.push({
      kind: 'delete_nodes',
      nodeIds: [...dependentRelationIds, ...[...deleteNodeIds].filter((id) => !dependentRelationIds.includes(id)).sort()],
    });
  }
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

function sameEngineeringAnnotation(left: AnnotationNode, right: AnnotationNode): boolean {
  if (left.type !== 'dimension' || right.type !== 'dimension') return false;
  return left.dimensionKind === right.dimensionKind
    && left.computedValue === right.computedValue
    && left.displayText === right.displayText
    && left.unit === right.unit
    && JSON.stringify(left.targets) === JSON.stringify(right.targets)
    && JSON.stringify(left.textPosition) === JSON.stringify(right.textPosition)
    && JSON.stringify(left.definitionPoints) === JSON.stringify(right.definitionPoints);
}

function sameEngineeringAssociation(left: AssociationRelation, right: AssociationRelation): boolean {
  return left.annotationId === right.annotationId
    && left.kind === right.kind
    && left.visible === right.visible
    && left.quality.status === right.quality.status
    && left.quality.confidence === right.quality.confidence
    && JSON.stringify([...left.geometryIds].map(String).sort()) === JSON.stringify([...right.geometryIds].map(String).sort())
    && JSON.stringify([...left.quality.evidenceRefs].map(String).sort())
      === JSON.stringify([...right.quality.evidenceRefs].map(String).sort());
}

function isRequestedEngineeringIntent(
  value: string | undefined,
  requestedKinds: ReadonlySet<DeterministicAnnotationKind>,
): boolean {
  return requestedKinds.has('opening-angle') && value?.startsWith('intent_opening_') === true
    || requestedKinds.has('diameter') && value?.startsWith('intent_diameter_') === true;
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
