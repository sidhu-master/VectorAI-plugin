import { createHash } from 'node:crypto';

import type {
  AnnotationId,
  DimensionAnnotation,
  DrawingCommand,
  DrawingDocument,
  DrawingId,
  EvidenceId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';

const EPSILON = 1e-6;
const AUTOMATIC_ANNOTATION_PREFIX = 'annotation_auto_';

export interface AutomaticAnnotationStep {
  id: string;
  annotation: DimensionAnnotation;
  commands: Array<Extract<DrawingCommand, { type: 'annotation.create' | 'annotation.delete' }>>;
  label: string;
}

export function buildAutomaticAnnotationSteps(input: {
  drawingId: DrawingId;
  geometry: GeometryNode[];
  existingAnnotationIds: readonly string[];
}): AutomaticAnnotationStep[] {
  const geometry = input.geometry.filter((node) => node.visible && geometryBounds(node));
  const bounds = unionBounds(geometry.flatMap((node) => {
    const value = geometryBounds(node);
    return value ? [value] : [];
  }));
  if (!bounds) return [];

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const diagonal = Math.hypot(width, height);
  if (diagonal <= EPSILON) return [];
  const offset = Math.max(diagonal * 0.045, 8);
  const steps: AutomaticAnnotationStep[] = [];

  if (width > EPSILON) {
    const left = contributor(geometry, 'minX', bounds.minX);
    const right = contributor(geometry, 'maxX', bounds.maxX);
    if (left && right) {
      const sourceStart: Vec2 = [bounds.minX, bounds.maxY];
      const sourceEnd: Vec2 = [bounds.maxX, bounds.maxY];
      const dimensionStart: Vec2 = [bounds.minX, bounds.maxY + offset];
      const dimensionEnd: Vec2 = [bounds.maxX, bounds.maxY + offset];
      steps.push(step(input.drawingId, 'overall-width', {
        dimensionKind: 'linear',
        targets: [
          { geometryId: left.id, anchor: { kind: 'nearest', point: sourceStart } },
          { geometryId: right.id, anchor: { kind: 'nearest', point: sourceEnd } },
        ],
        computedValue: width,
        displayText: formatNumber(width),
        textPosition: [(bounds.minX + bounds.maxX) / 2, bounds.maxY + offset * 1.18],
        definitionPoints: [sourceStart, sourceEnd, dimensionStart, dimensionEnd],
        sources: [left, right],
      }));
    }
  }

  if (height > EPSILON) {
    const bottom = contributor(geometry, 'minY', bounds.minY);
    const top = contributor(geometry, 'maxY', bounds.maxY);
    if (bottom && top) {
      const sourceStart: Vec2 = [bounds.maxX, bounds.minY];
      const sourceEnd: Vec2 = [bounds.maxX, bounds.maxY];
      const dimensionStart: Vec2 = [bounds.maxX + offset, bounds.minY];
      const dimensionEnd: Vec2 = [bounds.maxX + offset, bounds.maxY];
      steps.push(step(input.drawingId, 'overall-height', {
        dimensionKind: 'linear',
        targets: [
          { geometryId: bottom.id, anchor: { kind: 'nearest', point: sourceStart } },
          { geometryId: top.id, anchor: { kind: 'nearest', point: sourceEnd } },
        ],
        computedValue: height,
        displayText: formatNumber(height),
        textPosition: [bounds.maxX + offset * 1.28, (bounds.minY + bounds.maxY) / 2],
        definitionPoints: [sourceStart, sourceEnd, dimensionStart, dimensionEnd],
        sources: [bottom, top],
      }));
    }
  }

  for (const node of geometry) {
    steps.push(...featureAnnotationSteps({
      drawingId: input.drawingId,
      node,
      offset,
    }));
  }

  const existing = new Set(input.existingAnnotationIds);
  return steps.filter((item) => !existing.has(item.annotation.id));
}

/** 圆/弧/椭圆等单图元的确定性特征标注步骤（整图与按分区标注共用） */
export function featureAnnotationSteps(input: {
  drawingId: DrawingId;
  node: GeometryNode;
  offset: number;
  /** 稳定 ID 的键前缀（如 partition:<id>:），用于按分区生成时避免 ID 冲突 */
  keyPrefix?: string;
  /** 标注文本前缀（如分区名） */
  labelPrefix?: string;
}): AutomaticAnnotationStep[] {
  const { drawingId, node, offset } = input;
  const keyPrefix = input.keyPrefix ?? '';
  const labelPrefix = input.labelPrefix ?? '';
  const steps: AutomaticAnnotationStep[] = [];
  if (node.type === 'circle' && node.radius > EPSILON) {
    const axis = normalize([1, 1]);
    const start = add(node.center, scale(axis, -node.radius));
    const end = add(node.center, scale(axis, node.radius));
    const normal: Vec2 = [-axis[1], axis[0]];
    steps.push(step(drawingId, `${keyPrefix}${node.id}:diameter`, {
      dimensionKind: 'diameter',
      targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
      computedValue: node.radius * 2,
      displayText: `${labelPrefix}Ø${formatNumber(node.radius * 2)}`,
      textPosition: add(node.center, scale(normal, Math.max(offset * 0.32, node.radius * 0.18))),
      definitionPoints: [start, end],
      sources: [node],
    }));
    return steps;
  }
  if (node.type === 'arc' && node.radius > EPSILON) {
    const angle = midSweepAngle(node.startAngle, node.endAngle, node.counterClockwise);
    const axis: Vec2 = [Math.cos(angle), Math.sin(angle)];
    const edge = add(node.center, scale(axis, node.radius));
    const leaderEnd = add(node.center, scale(axis, node.radius + offset * 0.7));
    steps.push(step(drawingId, `${keyPrefix}${node.id}:radius`, {
      dimensionKind: 'radius',
      targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
      computedValue: node.radius,
      displayText: `${labelPrefix}R${formatNumber(node.radius)}`,
      textPosition: add(leaderEnd, scale(axis, offset * 0.18)),
      definitionPoints: [node.center, edge, leaderEnd],
      sources: [node],
    }));
    return steps;
  }
  if (node.type === 'ellipse') {
    const majorRadius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (majorRadius <= EPSILON || node.ratio <= EPSILON) return steps;
    const majorAxis = normalize(node.majorAxis);
    const minorAxis: Vec2 = [-majorAxis[1], majorAxis[0]];
    const minorRadius = majorRadius * node.ratio;
    steps.push(step(drawingId, `${keyPrefix}${node.id}:major-axis`, {
      dimensionKind: 'aligned',
      targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
      computedValue: majorRadius * 2,
      displayText: `${labelPrefix}${formatNumber(majorRadius * 2)}`,
      textPosition: add(node.center, scale(minorAxis, offset * 0.32)),
      definitionPoints: [
        add(node.center, scale(majorAxis, -majorRadius)),
        add(node.center, scale(majorAxis, majorRadius)),
      ],
      sources: [node],
    }));
    steps.push(step(drawingId, `${keyPrefix}${node.id}:minor-axis`, {
      dimensionKind: 'aligned',
      targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
      computedValue: minorRadius * 2,
      displayText: `${labelPrefix}${formatNumber(minorRadius * 2)}`,
      textPosition: add(node.center, scale(majorAxis, offset * 0.32)),
      definitionPoints: [
        add(node.center, scale(minorAxis, -minorRadius)),
        add(node.center, scale(minorAxis, minorRadius)),
      ],
      sources: [node],
    }));
  }
  return steps;
}

export function withoutAutomaticAnnotations(document: DrawingDocument): DrawingDocument {
  const annotations = document.annotations.filter((node) => (
    !node.id.startsWith(AUTOMATIC_ANNOTATION_PREFIX)
  ));
  return annotations.length === document.annotations.length
    ? document
    : { ...document, annotations };
}

/** 移除已提交的自动标注（重跑时清理不再生成的过期标注） */
export function removalStep(annotation: DimensionAnnotation): AutomaticAnnotationStep {
  return {
    id: `auto-annotation-remove:${annotation.id}`,
    annotation,
    commands: [{ type: 'annotation.delete', id: annotation.id }],
    label: `移除过期标注 ${annotation.displayText ?? annotation.id}`,
  };
}

export function isAutomaticAnnotationId(id: string): boolean {
  return id.startsWith(AUTOMATIC_ANNOTATION_PREFIX);
}

export function step(
  drawingId: DrawingId,
  key: string,
  input: Pick<DimensionAnnotation,
    'dimensionKind' | 'targets' | 'computedValue' | 'displayText' | 'textPosition' | 'definitionPoints'>
    & { sources: GeometryNode[]; unit?: 'mm' | 'deg' },
): AutomaticAnnotationStep {
  const annotation: DimensionAnnotation = {
    id: stableAnnotationId(drawingId, key) as AnnotationId,
    type: 'dimension',
    visible: true,
    quality: derivedQuality(input.sources),
    dimensionKind: input.dimensionKind,
    associationStatus: 'resolved',
    targets: input.targets,
    computedValue: round(input.computedValue ?? 0),
    displayText: input.displayText,
    unit: input.unit ?? 'mm',
    textPosition: roundPoint(input.textPosition),
    definitionPoints: input.definitionPoints.map(roundPoint),
  };
  return {
    id: `auto-annotation:${key}`,
    annotation,
    commands: [{ type: 'annotation.create', value: annotation }],
    label: annotation.displayText ?? '自动标注',
  };
}

export function contributor(
  geometry: GeometryNode[],
  edge: 'minX' | 'minY' | 'maxX' | 'maxY',
  value: number,
): GeometryNode | undefined {
  return geometry.find((node) => {
    const bounds = geometryBounds(node);
    return bounds && Math.abs(bounds[edge] - value) <= EPSILON;
  });
}

function derivedQuality(sources: GeometryNode[]): DimensionAnnotation['quality'] {
  const confidence = Math.min(...sources.map((node) => node.quality.confidence ?? 1));
  const evidenceRefs = [...new Set(sources.flatMap((node) => node.quality.evidenceRefs))] as EvidenceId[];
  return {
    status: sources.some((node) => node.quality.status === 'candidate') ? 'candidate' : 'confirmed',
    confidence: round(confidence),
    evidenceRefs,
  };
}

function stableAnnotationId(drawingId: DrawingId, key: string): string {
  return `${AUTOMATIC_ANNOTATION_PREFIX}${createHash('sha256')
    .update(`${drawingId}\0${key}`)
    .digest('hex')
    .slice(0, 20)}`;
}

function midSweepAngle(startDegrees: number, endDegrees: number, counterClockwise: boolean): number {
  const full = Math.PI * 2;
  const start = startDegrees * Math.PI / 180;
  const end = endDegrees * Math.PI / 180;
  const sweep = counterClockwise
    ? positiveModulo(end - start, full)
    : -positiveModulo(start - end, full);
  return start + sweep / 2;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector[0], vector[1]);
  return length <= EPSILON ? [1, 0] : [vector[0] / length, vector[1] / length];
}

function add(left: Vec2, right: Vec2): Vec2 {
  return [left[0] + right[0], left[1] + right[1]];
}

function scale(vector: Vec2, factor: number): Vec2 {
  return [vector[0] * factor, vector[1] * factor];
}

function roundPoint(point: Vec2): Vec2 {
  return [round(point[0]), round(point[1])];
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
