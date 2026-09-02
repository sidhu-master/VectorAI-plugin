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
import type { OpeningAngleFact, OpeningAngleLayout } from './opening-angle';
import {
  CAD_DIMENSION_TEXT_GAP,
  CAD_DIMENSION_TEXT_HEIGHT,
  diameterLabelWidth,
  findNearestFreeCoordinate,
} from './diameter/layout';

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
    ? avoidOpeningAngleCollisions(
      measureShaftDiameters(input.document),
      openingSelection.selected.flatMap((fact) => {
        const layout = openingLayouts[fact.key];
        return layout === undefined ? [] : [{ fact, layout }];
      }),
      geometry,
    )
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
      ...(annotation.dimensionKind === 'diameter' ? { featureClass: 'external' as const } : {}),
      source: 'geometry',
      status: 'confirmed',
      evidenceIds: annotation.quality.evidenceRefs.map(String),
    })),
    tolerances: [],
    fitAssignments: [],
    geometricTolerances: [],
    surfaceTextures: [],
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

interface OpeningCollisionLayout {
  fact: OpeningAngleFact;
  layout: OpeningAngleLayout;
}

function avoidOpeningAngleCollisions(
  facts: ShaftDiameterFact[],
  openings: OpeningCollisionLayout[],
  geometry: DrawingDocument['geometry'],
): ShaftDiameterFact[] {
  if (facts.length === 0 || openings.length === 0) return facts;
  const geometryPoints = geometry.flatMap(layoutPoints);
  if (geometryPoints.length === 0) return facts;
  const result = structuredClone(facts);
  const axis = diameterAxisDirection(result[0]!);
  const geometryProjections = geometryPoints.map((point) => dot(point, axis));
  const axialMin = Math.min(...geometryProjections);
  const axialMax = Math.max(...geometryProjections);
  const exteriorKeys = new Set(facts.filter((fact) => (
    !isWithinShaftInterval(fact, axis, axialMin, axialMax)
    || openings.some((opening) => diameterIntersectsOpening(fact, opening))
  )).map(({ key }) => key));

  for (const side of ['min', 'max'] as const) {
    const group = result.filter((fact) => exteriorKeys.has(fact.key) && diameterSide(fact, axis, axialMin, axialMax) === side)
      .sort((left, right) => left.diameter - right.diameter || left.key.localeCompare(right.key));
    let cursor = side === 'min' ? axialMin : axialMax;
    let previousWidth = 0;
    group.forEach((fact, index) => {
      const width = diameterLabelWidth(fact.diameter);
      const distance = index === 0
        ? width / 2 + CAD_DIMENSION_TEXT_GAP
        : (previousWidth + width) / 2 + CAD_DIMENSION_TEXT_GAP * 2;
      cursor += side === 'min' ? -distance : distance;
      const direction = side === 'min' ? -1 : 1;
      const maximumDistance = openingSearchDistance(cursor, direction, openings, axis);
      const coordinate = findNearestFreeCoordinate({
        start: cursor,
        direction,
        step: CAD_DIMENSION_TEXT_GAP / 2,
        maximumDistance,
        isBlocked: (candidate) => {
          const probe = structuredClone(fact);
          placeDiameterAtProjection(probe, axis, candidate);
          return openings.some((opening) => diameterIntersectsOpening(probe, opening));
        },
      });
      placeDiameterAtProjection(fact, axis, coordinate);
      cursor = coordinate;
      previousWidth = width;
    });
  }
  return result;
}

function openingSearchDistance(
  start: number,
  direction: -1 | 1,
  openings: OpeningCollisionLayout[],
  axis: Vec2,
): number {
  const projected = openings.flatMap(({ fact, layout }) => {
    const text = `${format(fact.value)}°`;
    const textWidth = [...text].length * CAD_DIMENSION_TEXT_HEIGHT * 0.62 + CAD_DIMENSION_TEXT_GAP * 2;
    const textHeight = CAD_DIMENSION_TEXT_HEIGHT + CAD_DIMENSION_TEXT_GAP * 2;
    const halfTextProjection = Math.abs(axis[0]) * textWidth / 2 + Math.abs(axis[1]) * textHeight / 2;
    return [
      ...layout.definitionPoints.map((point) => dot(point, axis)),
      dot(layout.textPosition, axis) - halfTextProjection,
      dot(layout.textPosition, axis) + halfTextProjection,
    ];
  });
  const farthest = direction === -1 ? Math.min(...projected) : Math.max(...projected);
  return Math.max(0, direction === -1 ? start - farthest : farthest - start)
    + CAD_DIMENSION_TEXT_HEIGHT + CAD_DIMENSION_TEXT_GAP * 2;
}

function isWithinShaftInterval(
  fact: ShaftDiameterFact,
  axis: Vec2,
  axialMin: number,
  axialMax: number,
): boolean {
  const [first, second] = fact.definitionPoints;
  const coordinate = dot([(first[0] + second[0]) / 2, (first[1] + second[1]) / 2], axis);
  return coordinate >= axialMin && coordinate <= axialMax;
}

function diameterIntersectsOpening(fact: ShaftDiameterFact, opening: OpeningCollisionLayout): boolean {
  const [diameterStart, diameterEnd] = fact.definitionPoints;
  const [vertex, firstExtension, secondExtension, arcStart, arcEnd] = opening.layout.definitionPoints;
  const clearance = CAD_DIMENSION_TEXT_GAP;
  if (segmentDistance(diameterStart, diameterEnd, vertex, firstExtension) <= clearance) return true;
  if (segmentDistance(diameterStart, diameterEnd, vertex, secondExtension) <= clearance) return true;
  if (segmentArcDistance(
    diameterStart,
    diameterEnd,
    vertex,
    arcStart,
    arcEnd,
    opening.fact.value,
  ) <= clearance) return true;
  const text = `${format(opening.fact.value)}°`;
  const textWidth = [...text].length * CAD_DIMENSION_TEXT_HEIGHT * 0.62 + CAD_DIMENSION_TEXT_GAP * 2;
  const textHeight = CAD_DIMENSION_TEXT_HEIGHT + CAD_DIMENSION_TEXT_GAP * 2;
  return segmentIntersectsRectangle(diameterStart, diameterEnd, {
    minX: opening.layout.textPosition[0] - textWidth / 2,
    maxX: opening.layout.textPosition[0] + textWidth / 2,
    minY: opening.layout.textPosition[1] - textHeight / 2,
    maxY: opening.layout.textPosition[1] + textHeight / 2,
  });
}

function diameterAxisDirection(fact: ShaftDiameterFact): Vec2 {
  const [, , sourceFirst, sourceSecond] = fact.definitionPoints;
  const radial = normalize([sourceSecond[0] - sourceFirst[0], sourceSecond[1] - sourceFirst[1]]) ?? [0, 1];
  return [radial[1], -radial[0]];
}

function diameterSide(
  fact: ShaftDiameterFact,
  axis: Vec2,
  axialMin: number,
  axialMax: number,
): 'min' | 'max' {
  const [, , sourceFirst, sourceSecond] = fact.definitionPoints;
  const sourceProjection = dot([
    (sourceFirst[0] + sourceSecond[0]) / 2,
    (sourceFirst[1] + sourceSecond[1]) / 2,
  ], axis);
  return sourceProjection - axialMin <= axialMax - sourceProjection ? 'min' : 'max';
}

function placeDiameterAtProjection(fact: ShaftDiameterFact, axis: Vec2, coordinate: number): void {
  const current = dot(fact.textPosition, axis);
  const delta = coordinate - current;
  fact.definitionPoints[0] = translate(fact.definitionPoints[0], axis, delta);
  fact.definitionPoints[1] = translate(fact.definitionPoints[1], axis, delta);
  fact.textPosition = translate(fact.textPosition, axis, delta);
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

interface LayoutBounds { minX: number; minY: number; maxX: number; maxY: number }

function boundsOf(points: readonly Vec2[]): LayoutBounds {
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function segmentIntersectsRectangle(start: Vec2, end: Vec2, bounds: LayoutBounds): boolean {
  if (pointInBounds(start, bounds) || pointInBounds(end, bounds)) return true;
  const topLeft: Vec2 = [bounds.minX, bounds.maxY];
  const topRight: Vec2 = [bounds.maxX, bounds.maxY];
  const bottomLeft: Vec2 = [bounds.minX, bounds.minY];
  const bottomRight: Vec2 = [bounds.maxX, bounds.minY];
  return segmentDistance(start, end, topLeft, topRight) <= 1e-9
    || segmentDistance(start, end, topRight, bottomRight) <= 1e-9
    || segmentDistance(start, end, bottomRight, bottomLeft) <= 1e-9
    || segmentDistance(start, end, bottomLeft, topLeft) <= 1e-9;
}

function pointInBounds(point: Vec2, bounds: LayoutBounds): boolean {
  return point[0] >= bounds.minX && point[0] <= bounds.maxX
    && point[1] >= bounds.minY && point[1] <= bounds.maxY;
}

function segmentDistance(firstStart: Vec2, firstEnd: Vec2, secondStart: Vec2, secondEnd: Vec2): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
  return Math.min(
    pointSegmentDistance(firstStart, secondStart, secondEnd),
    pointSegmentDistance(firstEnd, secondStart, secondEnd),
    pointSegmentDistance(secondStart, firstStart, firstEnd),
    pointSegmentDistance(secondEnd, firstStart, firstEnd),
  );
}

function segmentsIntersect(firstStart: Vec2, firstEnd: Vec2, secondStart: Vec2, secondEnd: Vec2): boolean {
  const firstA = cross(firstStart, firstEnd, secondStart);
  const firstB = cross(firstStart, firstEnd, secondEnd);
  const secondA = cross(secondStart, secondEnd, firstStart);
  const secondB = cross(secondStart, secondEnd, firstEnd);
  const epsilon = 1e-9;
  if (firstA * firstB < -epsilon && secondA * secondB < -epsilon) return true;
  return Math.abs(firstA) <= epsilon && pointOnSegment(secondStart, firstStart, firstEnd, epsilon)
    || Math.abs(firstB) <= epsilon && pointOnSegment(secondEnd, firstStart, firstEnd, epsilon)
    || Math.abs(secondA) <= epsilon && pointOnSegment(firstStart, secondStart, secondEnd, epsilon)
    || Math.abs(secondB) <= epsilon && pointOnSegment(firstEnd, secondStart, secondEnd, epsilon);
}

function pointOnSegment(point: Vec2, start: Vec2, end: Vec2, epsilon: number): boolean {
  return point[0] >= Math.min(start[0], end[0]) - epsilon
    && point[0] <= Math.max(start[0], end[0]) + epsilon
    && point[1] >= Math.min(start[1], end[1]) - epsilon
    && point[1] <= Math.max(start[1], end[1]) + epsilon;
}

function pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const delta: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const lengthSquared = dot(delta, delta);
  if (lengthSquared <= 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const projection = Math.max(0, Math.min(1, dot([point[0] - start[0], point[1] - start[1]], delta) / lengthSquared));
  return Math.hypot(point[0] - start[0] - delta[0] * projection, point[1] - start[1] - delta[1] * projection);
}

function segmentArcDistance(
  segmentStart: Vec2,
  segmentEnd: Vec2,
  center: Vec2,
  arcStart: Vec2,
  arcEnd: Vec2,
  valueDegrees: number,
): number {
  const radius = (distanceBetween(center, arcStart) + distanceBetween(center, arcEnd)) / 2;
  const startAngle = Math.atan2(arcStart[1] - center[1], arcStart[0] - center[0]);
  const endAngle = Math.atan2(arcEnd[1] - center[1], arcEnd[0] - center[0]);
  const sweep = angularSweepForValue(startAngle, endAngle, valueDegrees);
  if (segmentCircleIntersectsArc(segmentStart, segmentEnd, center, radius, startAngle, sweep)) return 0;
  let minimum = Math.min(
    pointSegmentDistance(arcStart, segmentStart, segmentEnd),
    pointSegmentDistance(arcEnd, segmentStart, segmentEnd),
  );
  const closest = closestPointOnSegment(center, segmentStart, segmentEnd);
  if (angleWithinSweep(Math.atan2(closest[1] - center[1], closest[0] - center[0]), startAngle, sweep)) {
    minimum = Math.min(minimum, Math.abs(distanceBetween(center, closest) - radius));
  }
  return minimum;
}

function segmentCircleIntersectsArc(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
  startAngle: number,
  sweep: number,
): boolean {
  const direction: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const offset: Vec2 = [start[0] - center[0], start[1] - center[1]];
  const a = dot(direction, direction);
  if (a <= 1e-18) return false;
  const b = 2 * dot(offset, direction);
  const c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].some((parameter) => {
    if (parameter < 0 || parameter > 1) return false;
    const point: Vec2 = [start[0] + direction[0] * parameter, start[1] + direction[1] * parameter];
    return angleWithinSweep(Math.atan2(point[1] - center[1], point[0] - center[0]), startAngle, sweep);
  });
}

function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const delta: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const lengthSquared = dot(delta, delta);
  if (lengthSquared <= 1e-18) return [...start];
  const projection = Math.max(0, Math.min(1, dot([point[0] - start[0], point[1] - start[1]], delta) / lengthSquared));
  return [start[0] + delta[0] * projection, start[1] + delta[1] * projection];
}

function angularSweepForValue(start: number, end: number, valueDegrees: number): number {
  const counterClockwise = modulo(end - start, Math.PI * 2);
  const clockwise = counterClockwise - Math.PI * 2;
  const target = Math.abs(valueDegrees) * Math.PI / 180;
  return Math.abs(Math.abs(counterClockwise) - target) <= Math.abs(Math.abs(clockwise) - target)
    ? counterClockwise : clockwise;
}

function angleWithinSweep(angle: number, start: number, sweep: number): boolean {
  const relative = sweep >= 0 ? modulo(angle - start, Math.PI * 2) : modulo(start - angle, Math.PI * 2);
  return relative <= Math.abs(sweep) + 1e-9;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function distanceBetween(first: Vec2, second: Vec2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function cross(start: Vec2, end: Vec2, point: Vec2): number {
  return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]);
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
