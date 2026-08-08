import { createHash } from 'node:crypto';
import type {
  AnnotationNode,
  DimensionAnnotation,
  DrawingAssertion,
  DrawingCommand,
  DimensionCandidate,
  DimensionTarget,
  EntityAnchor,
  EvidenceId,
  GeometryId,
  GeometryNode,
  PerceptionPreviewNode,
  TextAnnotation,
  Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingTopology, DrawingTopologyComponent } from './topology.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  DimensionAssociationTarget,
  GeometryObservation,
} from './types.js';

const MAX_COMMANDS_PER_BATCH = 25;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface ViewCoordinateTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export interface DrawingCommandBatch {
  componentId: string;
  commands: DrawingCommand[];
  postconditions: DrawingAssertion[];
  observationIds: string[];
  evidenceRefs: EvidenceId[];
  confidence: number;
  lowConfidenceCount: number;
}

export interface BuildObservationCommandResult {
  batches: DrawingCommandBatch[];
  warnings: string[];
}

export interface BuildObservationCommandInput {
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  associations: DimensionAssociation[];
  topology: DrawingTopology;
  viewTransforms?: Record<string, ViewCoordinateTransform>;
  annotationTransforms?: Record<string, ViewCoordinateTransform>;
}

export interface BuildObservationPreviewInput {
  geometry?: GeometryObservation[];
  annotations?: AnnotationObservation[];
  associations?: DimensionAssociation[];
  viewTransforms?: Record<string, ViewCoordinateTransform>;
  annotationTransforms?: Record<string, ViewCoordinateTransform>;
}

export interface BuildObservationPreviewResult {
  nodes: PerceptionPreviewNode[];
  warnings: string[];
}

interface ResolvedCommand {
  observationId: string;
  evidenceRefs: EvidenceId[];
  confidence: number;
  command: DrawingCommand;
  nodeId: string;
}

const IDENTITY_TRANSFORM: ViewCoordinateTransform = {
  scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
};

export function stableDrawingNodeId(sourceId: string, observationId: string): string {
  const digest = createHash('sha256').update(`${sourceId}:${observationId}`).digest('hex');
  return `node_obs_${digest.slice(0, 20)}`;
}

export function buildObservationCommandBatches(
  input: BuildObservationCommandInput,
): BuildObservationCommandResult {
  const geometryById = new Map(input.geometry.map((item) => [item.id, item]));
  const warnings: string[] = [];
  const batches: DrawingCommandBatch[] = [];
  const components = [...input.topology.components]
    .sort((first, second) => compareComponents(first, second, geometryById));

  for (const component of components) {
    const resolved = component.observationIds
      .slice().sort()
      .flatMap((id): ResolvedCommand[] => {
        const observation = geometryById.get(id);
        if (!observation) return [];
        const item = geometryCommand(
          observation,
          transformFor(observation.viewId, input.viewTransforms),
        );
        if (!item) {
          warnings.push(`观察 ${observation.id} 缺少 ${observation.type} 必需参数，已跳过`);
          return [];
        }
        return [item];
      });
    batches.push(...makeBatches(component.id, resolved));
  }

  const associationByAnnotationId = new Map(
    input.associations.map((association) => [association.annotationId, association]),
  );
  const annotationViews = [...new Set(input.annotations.map((item) => item.viewId))].sort();
  for (const viewId of annotationViews) {
    const transform = transformFor(viewId, input.annotationTransforms ?? input.viewTransforms);
    const resolved = input.annotations
      .filter((annotation) => annotation.viewId === viewId)
      .sort(compareAnnotations)
      .map((annotation) => annotationCommand(
        annotation,
        associationByAnnotationId.get(annotation.id),
        transform,
      ));
    batches.push(...makeBatches(`annotations:${viewId}`, resolved));
  }
  return { batches, warnings };
}

export function buildObservationPreviewNodes(
  input: BuildObservationPreviewInput,
): BuildObservationPreviewResult {
  const warnings: string[] = [];
  const geometry = (input.geometry ?? []).flatMap((observation): PerceptionPreviewNode[] => {
    const item = geometryCommand(
      observation,
      transformFor(observation.viewId, input.viewTransforms),
    );
    if (!item || item.command.type !== 'geometry.create') {
      warnings.push(`观察 ${observation.id} 缺少 ${observation.type} 必需参数，已跳过预览`);
      return [];
    }
    return [candidateNode(item.command.value as GeometryNode)];
  });
  const associationByAnnotationId = new Map(
    (input.associations ?? []).map((association) => [association.annotationId, association]),
  );
  const annotations = (input.annotations ?? []).map((observation): PerceptionPreviewNode => {
    const item = annotationCommand(
      observation,
      associationByAnnotationId.get(observation.id),
      transformFor(observation.viewId, input.annotationTransforms ?? input.viewTransforms),
    );
    if (item.command.type !== 'annotation.create') throw new Error('annotation preview command mismatch');
    return candidateNode(item.command.value as AnnotationNode);
  });
  return { nodes: [...geometry, ...annotations], warnings };
}

function candidateNode<T extends PerceptionPreviewNode>(node: T): T {
  return {
    ...structuredClone(node),
    quality: { ...structuredClone(node.quality), status: 'candidate' },
  };
}

function makeBatches(componentId: string, items: ResolvedCommand[]): DrawingCommandBatch[] {
  const batches: DrawingCommandBatch[] = [];
  for (let offset = 0; offset < items.length; offset += MAX_COMMANDS_PER_BATCH) {
    const chunk = items.slice(offset, offset + MAX_COMMANDS_PER_BATCH);
    const index = offset / MAX_COMMANDS_PER_BATCH;
    batches.push({
      componentId: index === 0 ? componentId : `${componentId}:${index + 1}`,
      commands: chunk.map((item) => item.command),
      postconditions: [
        ...chunk.map((item): DrawingAssertion => ({ type: 'node.exists', nodeId: item.nodeId })),
        { type: 'document.valid' },
      ],
      observationIds: chunk.map((item) => item.observationId),
      evidenceRefs: [...new Set(chunk.flatMap((item) => item.evidenceRefs))],
      confidence: Math.min(...chunk.map((item) => item.confidence)),
      lowConfidenceCount: chunk.filter((item) => item.confidence < LOW_CONFIDENCE_THRESHOLD).length,
    });
  }
  return batches;
}

function geometryCommand(
  observation: GeometryObservation,
  transform: ViewCoordinateTransform,
): ResolvedCommand | null {
  const sourceId = observation.sourceId ?? `source_${observation.viewId}`;
  const nodeId = stableDrawingNodeId(sourceId, observation.id);
  const params = transformGeometryParams(observation, transform);
  const value = geometryValue(observation.type, params, nodeId, quality(observation));
  if (!value) return null;
  return {
    observationId: observation.id,
    evidenceRefs: evidence(observation),
    confidence: observation.confidence,
    nodeId,
    command: { type: 'geometry.create', value },
  };
}

function annotationCommand(
  observation: AnnotationObservation,
  association: DimensionAssociation | undefined,
  transform: ViewCoordinateTransform,
): ResolvedCommand {
  const sourceId = observation.sourceId ?? `source_${observation.viewId}`;
  const nodeId = stableDrawingNodeId(sourceId, observation.id);
  const q = quality(observation);
  const textPosition = transformPoint(center(observation.imageBounds), transform);
  let value: TextAnnotation | DimensionAnnotation;
  if (observation.kind === 'text') {
    value = {
      id: nodeId as AnnotationNode['id'], type: 'text', visible: true, quality: q,
      content: observation.rawText || ' ', position: textPosition,
      height: round(Math.max(Math.abs(observation.imageBounds[3] * transform.scaleY), 0.001)),
      rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
    };
  } else {
    const status = association?.status ?? 'conflict';
    const targets = association?.targets.map((target) => dimensionTarget(target, sourceId, transform)) ?? [];
    const candidates = association?.candidates?.map((candidate): DimensionCandidate => ({
      targets: candidate.targets.map((target) => dimensionTarget(target, sourceId, transform)),
      score: candidate.score, reasons: [...candidate.reasons],
    }));
    value = {
      id: nodeId as AnnotationNode['id'], type: 'dimension', visible: true, quality: q,
      dimensionKind: observation.kind, associationStatus: status, targets,
      ...(candidates ? { candidates } : {}),
      ...(observation.value === undefined ? {} : { observedValue: observation.value }),
      displayText: observation.rawText,
      ...(isDimensionUnit(observation.unit) ? { unit: observation.unit } : {}),
      ...(observation.tolerance ? { tolerance: structuredClone(observation.tolerance) } : {}),
      textPosition,
      definitionPoints: observation.arrowheads.length > 0
        ? observation.arrowheads.map((point) => transformPoint(point, transform))
        : [textPosition],
    };
  }
  return {
    observationId: observation.id, evidenceRefs: evidence(observation),
    confidence: observation.confidence, nodeId,
    command: { type: 'annotation.create', value },
  };
}

function geometryValue(
  type: GeometryObservation['type'],
  params: Record<string, unknown>,
  nodeId: string,
  nodeQuality: GeometryNode['quality'],
): GeometryNode | null {
  const common = { id: nodeId as GeometryId, visible: true, quality: nodeQuality };
  switch (type) {
    case 'point': return finite(params.x) && finite(params.y)
      ? { ...common, type, x: params.x, y: params.y } : null;
    case 'line': return isPoint(params.start) && isPoint(params.end)
      ? { ...common, type, start: params.start, end: params.end } : null;
    case 'ray':
    case 'xline': return isPoint(params.origin) && isPoint(params.direction)
      ? { ...common, type, origin: params.origin, direction: params.direction } : null;
    case 'circle': return isPoint(params.center) && positive(params.radius)
      ? { ...common, type, center: params.center, radius: params.radius } : null;
    case 'arc': return isPoint(params.center) && positive(params.radius)
      && finite(params.startAngle) && finite(params.endAngle) && typeof params.counterClockwise === 'boolean'
      ? { ...common, type, center: params.center, radius: params.radius,
        startAngle: params.startAngle, endAngle: params.endAngle,
        counterClockwise: params.counterClockwise } : null;
    case 'ellipse': return isPoint(params.center) && isPoint(params.majorAxis) && positive(params.ratio)
      ? { ...common, type, center: params.center, majorAxis: params.majorAxis, ratio: params.ratio,
        ...(finite(params.startParam) ? { startParam: params.startParam } : {}),
        ...(finite(params.endParam) ? { endParam: params.endParam } : {}) } : null;
    case 'polyline': {
      const vertices = Array.isArray(params.vertices)
        ? params.vertices.map(polylineVertex).filter((item) => item !== null) : [];
      return vertices.length >= 2 && typeof params.closed === 'boolean'
        ? { ...common, type, vertices, closed: params.closed } : null;
    }
    case 'spline': return Number.isInteger(params.degree) && (params.degree as number) > 0
      && isPointArray(params.controlPoints) && numberArray(params.knots)
      && typeof params.closed === 'boolean' && typeof params.periodic === 'boolean'
      ? { ...common, type, degree: params.degree as number,
        controlPoints: params.controlPoints, knots: params.knots,
        ...(numberArray(params.weights) ? { weights: params.weights } : {}),
        closed: params.closed, periodic: params.periodic } : null;
  }
}

function quality(observation: { confidence: number; evidenceRefs?: string[] }): GeometryNode['quality'] {
  return {
    status: observation.confidence < LOW_CONFIDENCE_THRESHOLD ? 'candidate' : 'confirmed',
    confidence: observation.confidence,
    evidenceRefs: evidence(observation),
  };
}

function evidence(observation: { evidenceRefs?: string[] }): EvidenceId[] {
  return (observation.evidenceRefs ?? []).map((id) => id as EvidenceId);
}

function dimensionTarget(
  target: DimensionAssociationTarget,
  sourceId: string,
  transform: ViewCoordinateTransform,
): DimensionTarget {
  return {
    geometryId: stableDrawingNodeId(sourceId, target.geometryObservationId) as GeometryId,
    anchor: transformAnchor(target.anchor, transform),
  };
}

function transformAnchor(anchor: EntityAnchor, transform: ViewCoordinateTransform): EntityAnchor {
  return anchor.kind === 'nearest'
    ? { kind: 'nearest', point: transformPoint(anchor.point, transform) }
    : structuredClone(anchor);
}

function transformGeometryParams(
  observation: GeometryObservation,
  transform: ViewCoordinateTransform,
): Record<string, unknown> {
  const params = structuredClone(observation.measuredParams);
  switch (observation.type) {
    case 'point': {
      if (!finite(params.x) || !finite(params.y)) return params;
      const [x, y] = transformPoint([params.x, params.y], transform);
      return { ...params, x, y };
    }
    case 'line': return transformPointFields(params, ['start', 'end'], transform);
    case 'ray':
    case 'xline': return {
      ...transformPointFields(params, ['origin'], transform),
      ...(isPoint(params.direction) ? { direction: transformDirection(params.direction, transform) } : {}),
    };
    case 'circle':
    case 'arc': return {
      ...transformPointFields(params, ['center'], transform),
      ...(finite(params.radius) ? { radius: params.radius * averageScale(transform) } : {}),
    };
    case 'ellipse': return {
      ...transformPointFields(params, ['center'], transform),
      ...(isPoint(params.majorAxis) ? { majorAxis: transformVector(params.majorAxis, transform) } : {}),
    };
    case 'polyline': return {
      ...params,
      ...(Array.isArray(params.vertices)
        ? { vertices: params.vertices.map((vertex) => transformVertex(vertex, transform)) } : {}),
    };
    case 'spline': return {
      ...params,
      ...(isPointArray(params.controlPoints)
        ? { controlPoints: params.controlPoints.map((point) => transformPoint(point, transform)) } : {}),
    };
  }
}

function transformPointFields(
  params: Record<string, unknown>, fields: string[], transform: ViewCoordinateTransform,
): Record<string, unknown> {
  const result = { ...params };
  for (const field of fields) if (isPoint(params[field])) result[field] = transformPoint(params[field], transform);
  return result;
}

function transformVertex(vertex: unknown, transform: ViewCoordinateTransform): unknown {
  if (isPoint(vertex)) return { point: transformPoint(vertex, transform) };
  if (!vertex || typeof vertex !== 'object') return vertex;
  const record = vertex as Record<string, unknown>;
  return isPoint(record.point) ? { ...record, point: transformPoint(record.point, transform) } : record;
}

function polylineVertex(value: unknown): { point: Vec2; bulge?: number } | null {
  if (isPoint(value)) return { point: value };
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isPoint(record.point)) return null;
  return { point: record.point, ...(finite(record.bulge) ? { bulge: record.bulge } : {}) };
}

function compareComponents(
  first: DrawingTopologyComponent,
  second: DrawingTopologyComponent,
  geometryById: Map<string, GeometryObservation>,
): number {
  if (first.closed !== second.closed) return first.closed ? -1 : 1;
  return componentArea(second, geometryById) - componentArea(first, geometryById)
    || first.id.localeCompare(second.id);
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
  return Number(first.kind !== 'text') - Number(second.kind !== 'text')
    || first.id.localeCompare(second.id);
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

function averageScale(transform: ViewCoordinateTransform): number {
  return (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;
}

function isDimensionUnit(value: string | undefined): value is 'mm' | 'cm' | 'm' | 'deg' {
  return value === 'mm' || value === 'cm' || value === 'm' || value === 'deg';
}

function isPoint(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
}

function isPointArray(value: unknown): value is Vec2[] {
  return Array.isArray(value) && value.every(isPoint);
}

function numberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(finite);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function round(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
