import { createHash } from 'node:crypto';

import type {
  DimensionCandidate,
  DimensionTarget,
  EntityAnchor,
  IntentObject,
  SpatialIntent,
  Vec2,
} from '../../../src/core/types.js';
import type { DrawingTopology, DrawingTopologyComponent } from './topology.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  DimensionAssociationTarget,
  GeometryObservation,
} from './types.js';

const MAX_OBJECTS_PER_BATCH = 25;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface ViewCoordinateTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export interface ObservationPatchBatch {
  componentId: string;
  intent: SpatialIntent;
  observationIds: string[];
  confidence: number;
  lowConfidenceCount: number;
}

export interface BuildObservationPatchInput {
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  associations: DimensionAssociation[];
  topology: DrawingTopology;
  viewTransforms?: Record<string, ViewCoordinateTransform>;
  annotationTransforms?: Record<string, ViewCoordinateTransform>;
}

interface BatchedObject {
  observationId: string;
  object: IntentObject;
}

const IDENTITY_TRANSFORM: ViewCoordinateTransform = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

export function stableEntityId(observationId: string): string {
  const digest = createHash('sha256').update(observationId).digest('hex');
  return `ent_obs_${digest.slice(0, 20)}`;
}

export function buildObservationPatchBatches(
  input: BuildObservationPatchInput,
): ObservationPatchBatch[] {
  const geometryById = new Map(input.geometry.map((item) => [item.id, item]));
  const components = [...input.topology.components]
    .sort((first, second) => compareComponents(first, second, geometryById));
  const batches: ObservationPatchBatch[] = [];

  for (const component of components) {
    const items = [...component.observationIds]
      .sort((first, second) => first.localeCompare(second))
      .flatMap((id) => {
        const observation = geometryById.get(id);
        if (!observation) return [];
        const transform = transformFor(observation.viewId, input.viewTransforms);
        return [{
          observationId: observation.id,
          object: geometryIntentObject(observation, transform),
        }];
      });
    batches.push(...makeBatches(component.id, items));
  }

  const associationByAnnotationId = new Map(
    input.associations.map((association) => [association.annotationId, association]),
  );
  const annotationViews = [...new Set(input.annotations.map((item) => item.viewId))].sort();
  for (const viewId of annotationViews) {
    const transform = transformFor(
      viewId,
      input.annotationTransforms ?? input.viewTransforms,
    );
    const items = input.annotations
      .filter((annotation) => annotation.viewId === viewId)
      .sort(compareAnnotations)
      .map((annotation): BatchedObject => ({
        observationId: annotation.id,
        object: annotation.kind === 'text'
          ? textIntentObject(annotation, transform)
          : dimensionIntentObject(
            annotation,
            associationByAnnotationId.get(annotation.id),
            transform,
          ),
      }));
    batches.push(...makeBatches(`annotations:${viewId}`, items));
  }

  return batches;
}

function makeBatches(componentId: string, items: BatchedObject[]): ObservationPatchBatch[] {
  const batches: ObservationPatchBatch[] = [];
  for (let offset = 0; offset < items.length; offset += MAX_OBJECTS_PER_BATCH) {
    const chunk = items.slice(offset, offset + MAX_OBJECTS_PER_BATCH);
    const chunkIndex = offset / MAX_OBJECTS_PER_BATCH;
    const confidences = chunk.map((item) => item.object.confidence ?? 1);
    batches.push({
      componentId: chunkIndex === 0 ? componentId : `${componentId}:${chunkIndex + 1}`,
      intent: {
        operation: 'create',
        objects: chunk.map((item) => item.object),
        relations: [],
        description: `Drawing observations for ${componentId}`,
        confidence: Math.min(...confidences),
      },
      observationIds: chunk.map((item) => item.observationId),
      confidence: Math.min(...confidences),
      lowConfidenceCount: confidences.filter(
        (confidence) => confidence < LOW_CONFIDENCE_THRESHOLD,
      ).length,
    });
  }
  return batches;
}

function geometryIntentObject(
  observation: GeometryObservation,
  transform: ViewCoordinateTransform,
): IntentObject {
  return {
    id: stableEntityId(observation.id),
    type: observation.type,
    params: transformGeometryParams(observation, transform),
    confidence: observation.confidence,
  };
}

function textIntentObject(
  annotation: AnnotationObservation,
  transform: ViewCoordinateTransform,
): IntentObject {
  const boundsCenter = center(annotation.imageBounds);
  return {
    id: stableEntityId(annotation.id),
    type: 'text',
    params: {
      content: annotation.rawText,
      position: transformPoint(boundsCenter, transform),
      height: round(Math.max(Math.abs(annotation.imageBounds[3] * transform.scaleY), 0.001)),
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'baseline',
    },
    confidence: annotation.confidence,
  };
}

function dimensionIntentObject(
  annotation: AnnotationObservation,
  association: DimensionAssociation | undefined,
  transform: ViewCoordinateTransform,
): IntentObject {
  const status = association?.status ?? 'conflict';
  const targets = association?.targets.map((target) => dimensionTarget(target, transform)) ?? [];
  const candidates = association?.candidates?.map((candidate): DimensionCandidate => ({
    targets: candidate.targets.map((target) => dimensionTarget(target, transform)),
    score: candidate.score,
    reasons: [...candidate.reasons],
  }));
  const unit = isDimensionUnit(annotation.unit) ? annotation.unit : undefined;
  const textPosition = transformPoint(center(annotation.imageBounds), transform);
  const definitionPoints = annotation.arrowheads.length > 0
    ? annotation.arrowheads.map((point) => transformPoint(point, transform))
    : [textPosition];

  return {
    id: stableEntityId(annotation.id),
    type: 'dimension',
    params: {
      dimensionKind: annotation.kind,
      associationStatus: status,
      targets,
      ...(candidates ? { candidates } : {}),
      ...(annotation.value === undefined ? {} : { observedValue: annotation.value }),
      displayText: annotation.rawText,
      ...(unit ? { unit } : {}),
      ...(annotation.tolerance ? { tolerance: structuredClone(annotation.tolerance) } : {}),
      textPosition,
      definitionPoints,
    },
    confidence: annotation.confidence,
  };
}

function dimensionTarget(
  target: DimensionAssociationTarget,
  transform: ViewCoordinateTransform,
): DimensionTarget {
  return {
    entityId: stableEntityId(target.geometryObservationId),
    anchor: transformAnchor(target.anchor, transform),
  };
}

function transformAnchor(
  anchor: EntityAnchor,
  transform: ViewCoordinateTransform,
): EntityAnchor {
  if (anchor.kind !== 'nearest') return structuredClone(anchor);
  return { kind: 'nearest', point: transformPoint(anchor.point, transform) };
}

function transformGeometryParams(
  observation: GeometryObservation,
  transform: ViewCoordinateTransform,
): Record<string, unknown> {
  const params = structuredClone(observation.measuredParams);
  switch (observation.type) {
    case 'point':
      if (isNumber(params.x) && isNumber(params.y)) {
        const point = transformPoint([params.x, params.y], transform);
        return { ...params, x: point[0], y: point[1] };
      }
      return params;
    case 'line':
      return transformPointFields(params, ['start', 'end'], transform);
    case 'ray':
    case 'xline':
      return {
        ...transformPointFields(params, ['origin'], transform),
        ...(isPoint(params.direction)
          ? { direction: transformDirection(params.direction, transform) }
          : {}),
      };
    case 'circle':
    case 'arc':
      return {
        ...transformPointFields(params, ['center'], transform),
        ...(isNumber(params.radius)
          ? { radius: params.radius * averageScale(transform) }
          : {}),
      };
    case 'ellipse':
      return {
        ...transformPointFields(params, ['center'], transform),
        ...(isPoint(params.majorAxis)
          ? { majorAxis: transformVector(params.majorAxis, transform) }
          : {}),
      };
    case 'polyline':
      return {
        ...params,
        ...(Array.isArray(params.vertices)
          ? { vertices: params.vertices.map((vertex) => transformVertex(vertex, transform)) }
          : {}),
      };
    case 'spline':
      return {
        ...params,
        ...(Array.isArray(params.controlPoints)
          ? { controlPoints: params.controlPoints.map((point) => isPoint(point)
            ? transformPoint(point, transform)
            : point) }
          : {}),
      };
    default:
      return params;
  }
}

function transformPointFields(
  params: Record<string, unknown>,
  fields: string[],
  transform: ViewCoordinateTransform,
): Record<string, unknown> {
  const transformed = { ...params };
  for (const field of fields) {
    if (isPoint(params[field])) transformed[field] = transformPoint(params[field], transform);
  }
  return transformed;
}

function transformVertex(vertex: unknown, transform: ViewCoordinateTransform): unknown {
  if (isPoint(vertex)) return transformPoint(vertex, transform);
  if (!vertex || typeof vertex !== 'object') return vertex;
  const record = vertex as Record<string, unknown>;
  return isPoint(record.point)
    ? { ...record, point: transformPoint(record.point, transform) }
    : record;
}

function transformPoint(point: Vec2, transform: ViewCoordinateTransform): Vec2 {
  return [
    round(point[0] * transform.scaleX + transform.offsetX),
    round(point[1] * transform.scaleY + transform.offsetY),
  ];
}

function transformVector(vector: Vec2, transform: ViewCoordinateTransform): Vec2 {
  return [vector[0] * transform.scaleX, vector[1] * transform.scaleY];
}

function transformDirection(direction: Vec2, transform: ViewCoordinateTransform): Vec2 {
  const vector = transformVector(direction, transform);
  const length = Math.hypot(vector[0], vector[1]);
  return length === 0 ? direction : [vector[0] / length, vector[1] / length];
}

function compareComponents(
  first: DrawingTopologyComponent,
  second: DrawingTopologyComponent,
  geometryById: Map<string, GeometryObservation>,
): number {
  if (first.closed !== second.closed) return first.closed ? -1 : 1;
  const areaDifference = componentArea(second, geometryById) - componentArea(first, geometryById);
  return areaDifference || first.id.localeCompare(second.id);
}

function componentArea(
  component: DrawingTopologyComponent,
  geometryById: Map<string, GeometryObservation>,
): number {
  const bounds = component.observationIds
    .map((id) => geometryById.get(id)?.imageBounds)
    .filter((value): value is [number, number, number, number] => value !== undefined);
  if (bounds.length === 0) return 0;
  const minX = Math.min(...bounds.map((item) => item[0]));
  const minY = Math.min(...bounds.map((item) => item[1]));
  const maxX = Math.max(...bounds.map((item) => item[0] + item[2]));
  const maxY = Math.max(...bounds.map((item) => item[1] + item[3]));
  return (maxX - minX) * (maxY - minY);
}

function compareAnnotations(first: AnnotationObservation, second: AnnotationObservation): number {
  const kindOrder = Number(first.kind !== 'text') - Number(second.kind !== 'text');
  return kindOrder || first.id.localeCompare(second.id);
}

function transformFor(
  viewId: string,
  transforms: Record<string, ViewCoordinateTransform> | undefined,
): ViewCoordinateTransform {
  return transforms?.[viewId] ?? IDENTITY_TRANSFORM;
}

function center(bounds: [number, number, number, number]): Vec2 {
  return [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
}

function averageScale(transform: ViewCoordinateTransform): number {
  return (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;
}

function isDimensionUnit(value: string | undefined): value is 'mm' | 'cm' | 'm' | 'deg' {
  return value === 'mm' || value === 'cm' || value === 'm' || value === 'deg';
}

function isPoint(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length >= 2
    && isNumber(value[0]) && isNumber(value[1]);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
