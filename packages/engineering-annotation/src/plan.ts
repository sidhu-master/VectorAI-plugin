// SPDX-License-Identifier: Apache-2.0

import {
  type AnnotationId,
  type AnnotationNode,
  type AssociationRelation,
  type DrawingDocument,
  type EvidenceId,
  type GeometryId,
  type GeometryNode,
  type RelationId,
  type Vec2,
} from '@vectorai/drawing-core';
import type { DrawingRef, SpatialEditProgram } from '@vectorai/drawing-edit-protocol';
import { orderDimensionIntents } from './dimension/order';
import { projectEngineeringAnnotations } from './dimension/project';
import type { EngineeringAnnotationDraft } from './dimension/types';
import { layoutOpeningAngles, measureOpeningAngles, selectAxialEndOpeningAngles } from './opening-angle';
import { measureShaftDiameters, type ShaftDiameterFact } from './diameter';
import type { OpeningAngleLayout } from './opening-angle';

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

export type DeterministicAnnotationKind = 'opening-angle' | 'diameter' | 'centerline' | 'radius';

// Single source of truth for the deterministic members of automatic annotation.
// New annotation generators join the default collection by registering here.
export const DEFAULT_AUTOMATIC_ANNOTATION_KINDS = [
  'opening-angle',
  'diameter',
  'centerline',
  'radius',
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
  const requestedKinds = new Set<DeterministicAnnotationKind>(input.annotationKinds ?? ['opening-angle']);
  if (requestedKinds.has('centerline') && measuredOpenings.axis.status === 'confirmed') {
    const length = Math.hypot(
      measuredOpenings.axis.end[0] - measuredOpenings.axis.start[0],
      measuredOpenings.axis.end[1] - measuredOpenings.axis.start[1],
    );
    annotationTemplates.push({
      id: `annotation_centerline_${stableKey(`${measuredOpenings.axis.start.join(':')}:${measuredOpenings.axis.end.join(':')}`)}` as AnnotationId,
      type: 'centerline',
      visible: true,
      quality: { status: 'confirmed', confidence: 1, evidenceRefs: confirmedEvidence(geometry) },
      targets: geometry.map(({ id }) => id),
      start: measuredOpenings.axis.start,
      end: measuredOpenings.axis.end,
      extension: Math.max(length * 0.025, 2),
    });
  }
  if (requestedKinds.has('radius')) {
    for (const arc of representativeRadiusArcs(geometry)) {
      const middleAngle = arcMiddleAngle(arc.startAngle, arc.endAngle, arc.counterClockwise);
      const radial: Vec2 = [Math.cos(middleAngle), Math.sin(middleAngle)];
      const edge: Vec2 = [arc.center[0] + radial[0] * arc.radius, arc.center[1] + radial[1] * arc.radius];
      const textPosition: Vec2 = [
        arc.center[0] + radial[0] * arc.radius * 1.9,
        arc.center[1] + radial[1] * arc.radius * 1.9,
      ];
      const key = `radius:${format(arc.radius)}:${arc.id}`;
      annotationTemplates.push({
        id: `annotation_radius_${stableKey(key)}` as AnnotationId,
        type: 'dimension',
        visible: true,
        quality: {
          status: 'confirmed', confidence: 1,
          evidenceRefs: arc.quality.evidenceRefs.length > 0
            ? [...arc.quality.evidenceRefs]
            : [`evidence:engineering:${stableKey(String(arc.id))}` as EvidenceId],
        },
        dimensionKind: 'radius',
        associationStatus: 'resolved',
        targets: [{ geometryId: arc.id, anchor: { kind: 'curve-parameter', parameter: middleAngle } }],
        computedValue: clean(arc.radius),
        displayText: `R${format(arc.radius)}`,
        unit: input.document.unitSystem.length,
        textPosition,
        definitionPoints: [arc.center, edge, textPosition],
        engineeringIntentId: `intent_radius_${stableKey(key)}`,
      });
      associations.push({
        id: `relation_${stableKey(`${input.document.id}:annotation_radius_${stableKey(key)}`)}` as RelationId,
        type: 'association', plane: 'association', kind: 'annotation-target',
        annotationId: `annotation_radius_${stableKey(key)}` as AnnotationId,
        geometryIds: [arc.id], visible: true,
        quality: { status: 'confirmed', confidence: 1, evidenceRefs: [...arc.quality.evidenceRefs] },
      });
    }
  }
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
  const diameterFacts = (input.annotationKinds ?? ['opening-angle']).includes('diameter')
    ? avoidOpeningAngleCollisions(measureShaftDiameters(input.document), openingLayouts, geometry)
    : [];
  for (const fact of diameterFacts) {
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
  const annotations: AnnotationNode[] = [
    ...projection.annotations,
    ...annotationTemplates.filter((annotation) => annotation.type !== 'dimension'),
  ];
  const existingAnnotations = new Map(input.document.annotations.map((node) => [node.id, node]));
  const existingAssociations = new Map(input.document.relations
    .filter((relation): relation is AssociationRelation => relation.type === 'association')
    .map((relation) => [relation.id, relation]));
  const plannedEngineeringIds = new Set(annotations
    .filter((node) => isManagedEngineeringAnnotation(node, requestedKinds))
    .map(({ id }) => id));
  const createAnnotations: AnnotationNode[] = [];
  const createAssociations: AssociationRelation[] = [];
  const deleteNodeIds = new Set<string>();
  const staleTargetNodeIds = new Set<string>();
  for (const annotation of annotations) {
    const existing = existingAnnotations.get(annotation.id);
    const managed = isManagedEngineeringAnnotation(annotation, requestedKinds);
    if (!existing) createAnnotations.push(annotation);
    else if (managed && !sameEngineeringAnnotation(existing, annotation)) {
      deleteNodeIds.add(existing.id);
      if (existing.type === 'dimension') existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
      createAnnotations.push(annotation);
    }
  }
  for (const existing of input.document.annotations) {
    const legacyPrimitiveDimension = existing.type === 'dimension' && existing.engineeringIntentId?.startsWith('intent_auto_') === true;
    const staleEngineeringDimension = isManagedEngineeringAnnotation(existing, requestedKinds)
      && !plannedEngineeringIds.has(existing.id);
    if (!legacyPrimitiveDimension && !staleEngineeringDimension) continue;
    deleteNodeIds.add(existing.id);
    if (existing.type === 'dimension') existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
    if (existing.type === 'centerline') existing.targets.forEach((geometryId) => staleTargetNodeIds.add(geometryId));
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

interface LayoutBounds { minX: number; minY: number; maxX: number; maxY: number }

function avoidOpeningAngleCollisions(
  facts: ShaftDiameterFact[],
  openingLayouts: Record<string, OpeningAngleLayout>,
  geometry: DrawingDocument['geometry'],
): ShaftDiameterFact[] {
  if (facts.length === 0 || Object.keys(openingLayouts).length === 0) return facts;
  const geometryPoints = geometry.flatMap(layoutPoints);
  if (geometryPoints.length === 0) return facts;
  const geometryBounds = boundsOf(geometryPoints);
  const diagonal = Math.hypot(
    geometryBounds.maxX - geometryBounds.minX,
    geometryBounds.maxY - geometryBounds.minY,
  );
  const clearance = Math.max(diagonal * 0.025, 3);
  const step = Math.max(diagonal * 0.045, 6);
  const center: Vec2 = [
    (geometryBounds.minX + geometryBounds.maxX) / 2,
    (geometryBounds.minY + geometryBounds.maxY) / 2,
  ];
  const occupied = Object.values(openingLayouts).map((layout) => openingBounds(layout, clearance));
  const result: ShaftDiameterFact[] = [];
  for (const original of [...facts].sort((left, right) => (
    left.diameter - right.diameter || left.key.localeCompare(right.key)
  ))) {
    const fact = structuredClone(original);
    const direction = diameterOutwardDirection(fact, center);
    let attempts = 0;
    while (occupied.some((bounds) => intersects(diameterBounds(fact, clearance), bounds)) && attempts < 24) {
      fact.definitionPoints[0] = translate(fact.definitionPoints[0], direction, step);
      fact.definitionPoints[1] = translate(fact.definitionPoints[1], direction, step);
      fact.textPosition = translate(fact.textPosition, direction, step);
      attempts += 1;
    }
    occupied.push(diameterBounds(fact, clearance));
    result.push(fact);
  }
  return result;
}

function openingBounds(layout: OpeningAngleLayout, clearance: number): LayoutBounds {
  const [vertex, , , arcStart, arcEnd] = layout.definitionPoints;
  const points = [arcStart, arcEnd, layout.textPosition];
  const bounds = boundsOf(points);
  return {
    minX: Math.min(bounds.minX, vertex[0]) - clearance,
    minY: bounds.minY - clearance,
    maxX: Math.max(bounds.maxX, vertex[0]) + clearance,
    maxY: bounds.maxY + clearance,
  };
}

function diameterBounds(fact: ShaftDiameterFact, clearance: number): LayoutBounds {
  const bounds = boundsOf([fact.definitionPoints[0], fact.definitionPoints[1], fact.textPosition]);
  return {
    minX: bounds.minX - clearance,
    minY: bounds.minY - clearance,
    maxX: bounds.maxX + clearance * 2.4,
    maxY: bounds.maxY + clearance,
  };
}

function diameterOutwardDirection(fact: ShaftDiameterFact, drawingCenter: Vec2): Vec2 {
  const [first, second, sourceFirst, sourceSecond] = fact.definitionPoints;
  const dimensionCenter: Vec2 = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const sourceCenter: Vec2 = [(sourceFirst[0] + sourceSecond[0]) / 2, (sourceFirst[1] + sourceSecond[1]) / 2];
  const existing = normalize([dimensionCenter[0] - sourceCenter[0], dimensionCenter[1] - sourceCenter[1]]);
  if (existing) return existing;
  const line = normalize([second[0] - first[0], second[1] - first[1]]) ?? [0, 1];
  let direction: Vec2 = [line[1], -line[0]];
  const fromCenter: Vec2 = [sourceCenter[0] - drawingCenter[0], sourceCenter[1] - drawingCenter[1]];
  if (dot(direction, fromCenter) < 0) direction = [-direction[0], -direction[1]];
  if (Math.abs(dot(direction, fromCenter)) <= 1e-6 && direction[0] < 0) direction = [-direction[0], -direction[1]];
  return direction;
}

function layoutPoints(node: DrawingDocument['geometry'][number]): Vec2[] {
  if (node.type === 'point') return [[node.x, node.y]];
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  if (node.type === 'circle' || node.type === 'arc') return [
    [node.center[0] - node.radius, node.center[1] - node.radius],
    [node.center[0] + node.radius, node.center[1] + node.radius],
  ];
  if (node.type === 'ellipse') {
    const radius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  return [];
}

function boundsOf(points: readonly Vec2[]): LayoutBounds {
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function intersects(left: LayoutBounds, right: LayoutBounds): boolean {
  return left.minX <= right.maxX && left.maxX >= right.minX
    && left.minY <= right.maxY && left.maxY >= right.minY;
}

function translate(point: Vec2, direction: Vec2, distance: number): Vec2 {
  return [point[0] + direction[0] * distance, point[1] + direction[1] * distance];
}

function normalize(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector[0], vector[1]);
  return length <= 1e-9 ? null : [vector[0] / length, vector[1] / length];
}

function dot(left: Vec2, right: Vec2): number { return left[0] * right[0] + left[1] * right[1]; }

function sameEngineeringAnnotation(left: AnnotationNode, right: AnnotationNode): boolean {
  if (left.type === 'centerline' && right.type === 'centerline') {
    return JSON.stringify(left.targets.map(String).sort()) === JSON.stringify(right.targets.map(String).sort())
      && JSON.stringify(left.start) === JSON.stringify(right.start)
      && JSON.stringify(left.end) === JSON.stringify(right.end)
      && left.extension === right.extension
      && left.visible === right.visible;
  }
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
    || requestedKinds.has('diameter') && value?.startsWith('intent_diameter_') === true
    || requestedKinds.has('radius') && value?.startsWith('intent_radius_') === true;
}

function isManagedEngineeringAnnotation(
  node: AnnotationNode,
  requestedKinds: ReadonlySet<DeterministicAnnotationKind>,
): boolean {
  if (node.type === 'centerline') return requestedKinds.has('centerline') && String(node.id).startsWith('annotation_centerline_');
  return node.type === 'dimension' && isRequestedEngineeringIntent(node.engineeringIntentId, requestedKinds);
}

function representativeRadiusArcs(geometry: DrawingDocument['geometry']): Extract<GeometryNode, { type: 'arc' }>[] {
  const confirmedLines = geometry.filter((node): node is Extract<GeometryNode, { type: 'line' }> => (
    node.type === 'line' && node.visible && node.quality.status === 'confirmed'
  ));
  const extent = geometryExtent(geometry);
  const positionTolerance = Math.max(extent * 1e-6, Number.EPSILON * 1e6);
  const byRadius = new Map<string, Extract<GeometryNode, { type: 'arc' }>>();
  for (const node of geometry) {
    if (node.type !== 'arc' || !node.visible || node.quality.status !== 'confirmed' || node.radius <= 0
      || !isTangentConnectedFillet(node, confirmedLines, positionTolerance)) continue;
    const key = format(node.radius);
    const previous = byRadius.get(key);
    if (!previous || radiusArcScore(node) > radiusArcScore(previous)
      || radiusArcScore(node) === radiusArcScore(previous) && String(node.id).localeCompare(String(previous.id)) < 0) {
      byRadius.set(key, node);
    }
  }
  return [...byRadius.values()].sort((left, right) => right.radius - left.radius || String(left.id).localeCompare(String(right.id)));
}

function isTangentConnectedFillet(
  arc: Extract<GeometryNode, { type: 'arc' }>,
  lines: readonly Extract<GeometryNode, { type: 'line' }>[],
  positionTolerance: number,
): boolean {
  const endpoints = [arc.startAngle, arc.endAngle].map((angle) => {
    const radians = angle * Math.PI / 180;
    return {
      point: [arc.center[0] + Math.cos(radians) * arc.radius, arc.center[1] + Math.sin(radians) * arc.radius] as Vec2,
      tangent: [-Math.sin(radians), Math.cos(radians)] as Vec2,
    };
  });
  const neighbors = endpoints.map(({ point, tangent }) => lines.filter((line) => (
    (distance(point, line.start) <= positionTolerance || distance(point, line.end) <= positionTolerance)
      && parallel(lineDirection(line), tangent)
  )));
  return neighbors.every((items) => items.length > 0)
    && neighbors.some((items, index) => items.some((line) => !neighbors[1 - index]!.includes(line)));
}

function geometryExtent(geometry: DrawingDocument['geometry']): number {
  const points = geometry.flatMap((node): Vec2[] => {
    if (node.type === 'line') return [node.start, node.end];
    if (node.type === 'arc' || node.type === 'circle') return [
      [node.center[0] - node.radius, node.center[1] - node.radius],
      [node.center[0] + node.radius, node.center[1] + node.radius],
    ];
    return [];
  });
  if (points.length === 0) return 1;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
}

function lineDirection(line: Extract<GeometryNode, { type: 'line' }>): Vec2 {
  const dx = line.end[0] - line.start[0];
  const dy = line.end[1] - line.start[1];
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}

function parallel(left: Vec2, right: Vec2): boolean {
  return Math.abs(left[0] * right[0] + left[1] * right[1]) >= Math.cos(2 * Math.PI / 180);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function radiusArcScore(arc: Extract<GeometryNode, { type: 'arc' }>): number {
  const sweep = normalizedSweep(arc.startAngle, arc.endAngle, arc.counterClockwise);
  return sweep * arc.radius;
}

function arcMiddleAngle(startDegrees: number, endDegrees: number, counterClockwise: boolean): number {
  const sweep = normalizedSweep(startDegrees, endDegrees, counterClockwise);
  const degrees = counterClockwise ? startDegrees + sweep / 2 : startDegrees - sweep / 2;
  return degrees * Math.PI / 180;
}

function normalizedSweep(start: number, end: number, counterClockwise: boolean): number {
  const raw = counterClockwise ? end - start : start - end;
  return ((raw % 360) + 360) % 360 || 360;
}

function confirmedEvidence(geometry: DrawingDocument['geometry']): EvidenceId[] {
  const values = [...new Set(geometry.flatMap(({ quality }) => quality.evidenceRefs))];
  return values.length > 0 ? values : ['evidence:engineering:shaft-axis' as EvidenceId];
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
