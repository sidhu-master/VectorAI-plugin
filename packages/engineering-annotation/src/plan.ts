// SPDX-License-Identifier: Apache-2.0

import {
  sampleSpline,
  type AnnotationId,
  type AnnotationNode,
  type AssociationRelation,
  type DrawingDocument,
  type EvidenceId,
  type GeometryNode,
  type RelationId,
  type Vec2,
} from '@vectorai/drawing-core';
import type { DrawingRef, SpatialEditProgram } from '@vectorai/drawing-edit-protocol';
import { orderDimensionIntents } from './dimension/order';
import { projectEngineeringAnnotations } from './dimension/project';
import type { EngineeringAnnotationDraft } from './dimension/types';

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
  const drawingBounds = boundsOf(geometry);
  const diagonal = drawingBounds
    ? Math.hypot(drawingBounds.maxX - drawingBounds.minX, drawingBounds.maxY - drawingBounds.minY)
    : 1;
  const offset = Math.max(diagonal * 0.04, 2);

  for (const node of geometry) {
    if (node.quality.status !== 'confirmed') {
      pending.push({ nodeId: node.id, reason: 'SOURCE_NOT_CONFIRMED' });
      continue;
    }
    const annotation = annotationFor(node, input.document.unitSystem.length, offset);
    if (!annotation) {
      suppressed.push({ nodeId: node.id, reason: 'No deterministic engineering dimension rule applies.' });
      continue;
    }
    annotationTemplates.push(annotation);
    associations.push({
      id: `relation_${stableKey(`${input.document.id}:${annotation.id}`)}` as RelationId,
      type: 'association', plane: 'association', kind: 'annotation-target',
      annotationId: annotation.id,
      geometryIds: [node.id],
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
  const targetNodeIds = [...new Set(associations.flatMap(({ geometryIds }) => geometryIds))].sort();
  const evidenceRefs = [...new Set(targetNodeIds.flatMap((id) => {
    const node = geometry.find((candidate) => candidate.id === id);
    return node?.quality.evidenceRefs ?? [];
  }))];
  if (targetNodeIds.length > 0 && evidenceRefs.length === 0) {
    evidenceRefs.push(`evidence:engineering:${stableKey(targetNodeIds.join(':'))}` as EvidenceId);
  }
  const program: SpatialEditProgram | null = annotations.length === 0 ? null : {
    baseRef: structuredClone(input.ref),
    targetHandle: '__GROUNDING_TARGET__',
    summary: `Create ${annotations.length} deterministic engineering annotations`,
    objective: input.objective,
    operations: [{
      kind: 'create_annotation_batch',
      annotations: structuredClone(annotations) as unknown as Array<Record<string, unknown> & { id: string; type: string }>,
      associations: structuredClone(associations) as unknown as Array<Record<string, unknown> & { id: string; type: 'association' }>,
    }],
    preserveScopes: geometry.map(({ id }) => ({ kind: 'node-field' as const, nodeId: id, fields: ['id', 'type'] })),
    postconditions: [],
    evidenceRefs: evidenceRefs as unknown as string[],
  };
  return { annotations, associations, targetNodeIds, pending, suppressed, program };
}

function annotationFor(
  node: GeometryNode,
  unit: 'mm' | 'cm' | 'm',
  offset: number,
): AnnotationNode | null {
  const evidenceRefs = node.quality.evidenceRefs.length > 0
    ? [...node.quality.evidenceRefs]
    : [`evidence:engineering:${node.id}` as EvidenceId];
  const base = {
    id: `annotation_auto_${stableKey(String(node.id))}` as AnnotationId,
    type: 'dimension' as const,
    visible: true,
    quality: { status: 'confirmed' as const, confidence: 1, evidenceRefs },
    associationStatus: 'resolved' as const,
    targets: [{ geometryId: node.id, anchor: { kind: 'center' as const } }],
    unit,
    engineeringIntentId: `intent_auto_${stableKey(String(node.id))}`,
  };
  if (node.type === 'circle') {
    const first: Vec2 = [node.center[0] - node.radius, node.center[1]];
    const second: Vec2 = [node.center[0] + node.radius, node.center[1]];
    return {
      ...base, dimensionKind: 'diameter', computedValue: clean(node.radius * 2),
      displayText: `Ø${format(node.radius * 2)}`,
      textPosition: [node.center[0], node.center[1] + node.radius + offset],
      definitionPoints: [first, second],
    };
  }
  if (node.type === 'arc') {
    const middle = (node.startAngle + node.endAngle) / 2 * Math.PI / 180;
    const edge: Vec2 = [node.center[0] + Math.cos(middle) * node.radius, node.center[1] + Math.sin(middle) * node.radius];
    return {
      ...base, dimensionKind: 'radius', computedValue: clean(node.radius),
      displayText: `R${format(node.radius)}`,
      textPosition: [edge[0] + Math.cos(middle) * offset, edge[1] + Math.sin(middle) * offset],
      definitionPoints: [node.center, edge],
    };
  }
  if (node.type === 'ellipse') {
    const radius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (radius <= 0) return null;
    const axis: Vec2 = [node.majorAxis[0] / radius, node.majorAxis[1] / radius];
    return {
      ...base, dimensionKind: 'aligned', computedValue: clean(radius * 2),
      displayText: format(radius * 2),
      textPosition: [node.center[0] - axis[1] * offset, node.center[1] + axis[0] * offset],
      definitionPoints: [
        [node.center[0] - axis[0] * radius, node.center[1] - axis[1] * radius],
        [node.center[0] + axis[0] * radius, node.center[1] + axis[1] * radius],
      ],
    };
  }
  return null;
}

function boundsOf(nodes: GeometryNode[]) {
  const points = nodes.flatMap(pointsOf);
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function pointsOf(node: GeometryNode): Vec2[] {
  if (node.type === 'point') return [[node.x, node.y]];
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'ray' || node.type === 'xline') return [node.origin];
  if (node.type === 'circle' || node.type === 'arc') return [
    [node.center[0] - node.radius, node.center[1] - node.radius],
    [node.center[0] + node.radius, node.center[1] + node.radius],
  ];
  if (node.type === 'ellipse') {
    const radius = Math.hypot(...node.majorAxis);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  return sampleSpline(node, { maxError: 0.02, maxDepth: 14 });
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
