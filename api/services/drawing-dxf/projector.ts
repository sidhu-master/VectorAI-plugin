import { createHash } from 'node:crypto';

import type {
  AnnotationId,
  AnnotationNode,
  EvidenceId,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { projectHatchPattern } from './hatch.js';
import type { DxfBlockRecord, DxfEntityRecord, DxfManifest, DxfPair } from './types.js';

interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface DxfProjectionDiagnostic {
  code:
    | 'DXF_ENTITY_UNSUPPORTED'
    | 'DXF_ENTITY_INVALID'
    | 'DXF_BLOCK_NOT_FOUND'
    | 'DXF_BLOCK_CYCLE'
    | 'DXF_INSERT_DEPTH_EXCEEDED'
    | 'DXF_EXPANSION_LIMIT_EXCEEDED'
    | 'DXF_NON_SIMILAR_ARC_UNSUPPORTED';
  message: string;
  entityType?: string;
  handle?: string;
  insertPath?: string[];
}

export interface DxfProjection {
  geometry: GeometryNode[];
  annotations: AnnotationNode[];
  diagnostics: DxfProjectionDiagnostic[];
  summary: {
    sourceEntityCount: number;
    projectedGeometryCount: number;
    projectedAnnotationCount: number;
    expandedInsertCount: number;
    unsupportedEntityCount: number;
  };
}

export function projectDxfToDrawing(
  manifest: DxfManifest,
  options: { sourceId: string; maxInsertDepth?: number; maxExpandedNodes?: number },
): DxfProjection {
  const geometry: GeometryNode[] = [];
  const annotations: AnnotationNode[] = [];
  const diagnostics: DxfProjectionDiagnostic[] = [];
  const blocks = new Map(manifest.blocks.map((block) => [block.name, block]));
  const state = {
    expandedInsertCount: 0,
    unsupportedEntityCount: 0,
    stopped: false,
  };
  const maxInsertDepth = options.maxInsertDepth ?? 24;
  const maxExpandedNodes = options.maxExpandedNodes ?? 100_000;

  const emit = (
    entities: DxfEntityRecord[],
    transform: Matrix2D,
    insertPath: string[],
    blockStack: string[],
  ): void => {
    if (state.stopped) return;
    for (let index = 0; index < entities.length; index += 1) {
      if (geometry.length + annotations.length >= maxExpandedNodes) {
        diagnostics.push({
          code: 'DXF_EXPANSION_LIMIT_EXCEEDED',
          message: `展开节点超过上限 ${maxExpandedNodes}`,
          insertPath,
        });
        state.stopped = true;
        return;
      }
      const entity = entities[index];
      if (!entity) continue;
      if (entity.type === 'INSERT') {
        const blockName = value(entity.pairs, 2)?.trim() ?? '';
        const block = blocks.get(blockName);
        if (!block) {
          diagnostics.push(diagnostic('DXF_BLOCK_NOT_FOUND', entity, insertPath, `找不到块 ${blockName}`));
          continue;
        }
        if (blockStack.includes(blockName)) {
          diagnostics.push(diagnostic('DXF_BLOCK_CYCLE', entity, insertPath, `块引用形成递归环 ${blockName}`));
          continue;
        }
        if (blockStack.length >= maxInsertDepth) {
          diagnostics.push(diagnostic(
            'DXF_INSERT_DEPTH_EXCEEDED', entity, insertPath,
            `块展开深度超过上限 ${maxInsertDepth}`,
          ));
          continue;
        }
        const rows = Math.max(1, integerValue(entity.pairs, 71, 1));
        const columns = Math.max(1, integerValue(entity.pairs, 70, 1));
        const rowSpacing = numberValue(entity.pairs, 45, 0);
        const columnSpacing = numberValue(entity.pairs, 44, 0);
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            state.expandedInsertCount += 1;
            const pathPart = entityKey(entity, index)
              + (rows > 1 || columns > 1 ? `[${row},${column}]` : '');
            const local = insertMatrix(entity, block, [column * columnSpacing, row * rowSpacing]);
            emit(
              block.entities,
              multiply(transform, local),
              [...insertPath, pathPart],
              [...blockStack, blockName],
            );
          }
        }
        continue;
      }
      if (entity.type === 'VERTEX' || entity.type === 'SEQEND') continue;

      const evidence = evidenceRef(options.sourceId, entity, index, insertPath);
      const idSeed = `${options.sourceId}:${insertPath.join('/')}:${entityKey(entity, index)}`;
      if (entity.type === 'POLYLINE') {
        const vertices: DxfEntityRecord[] = [];
        let cursor = index + 1;
        while (cursor < entities.length && entities[cursor]?.type === 'VERTEX') {
          vertices.push(entities[cursor] as DxfEntityRecord);
          cursor += 1;
        }
        if (entities[cursor]?.type === 'SEQEND') index = cursor;
        const node = polylineFromVertices(entity, vertices, transform, idSeed, evidence);
        if (node) geometry.push(node);
        else diagnostics.push(diagnostic('DXF_ENTITY_INVALID', entity, insertPath, 'POLYLINE 顶点无效'));
        continue;
      }

      const converted = convertEntity(entity, transform, idSeed, evidence);
      if (converted.kind === 'geometry') geometry.push(converted.node);
      else if (converted.kind === 'annotation') annotations.push(converted.node);
      else if (converted.kind === 'unsupported') {
        state.unsupportedEntityCount += 1;
        diagnostics.push(diagnostic(
          converted.code ?? 'DXF_ENTITY_UNSUPPORTED', entity, insertPath, converted.message,
        ));
      } else {
        diagnostics.push(diagnostic('DXF_ENTITY_INVALID', entity, insertPath, converted.message));
      }
    }
  };

  emit(manifest.entities, identity(), [], []);
  return {
    geometry,
    annotations,
    diagnostics,
    summary: {
      sourceEntityCount: manifest.entities.length,
      projectedGeometryCount: geometry.length,
      projectedAnnotationCount: annotations.length,
      expandedInsertCount: state.expandedInsertCount,
      unsupportedEntityCount: state.unsupportedEntityCount,
    },
  };
}

type Conversion =
  | { kind: 'geometry'; node: GeometryNode }
  | { kind: 'annotation'; node: AnnotationNode }
  | { kind: 'unsupported'; message: string; code?: DxfProjectionDiagnostic['code'] }
  | { kind: 'invalid'; message: string };

function convertEntity(
  entity: DxfEntityRecord,
  matrix: Matrix2D,
  idSeed: string,
  evidence: EvidenceId,
): Conversion {
  const quality = { status: 'confirmed' as const, confidence: 1, evidenceRefs: [evidence] };
  const id = stableId('geometry', idSeed) as GeometryId;
  switch (entity.type) {
    case 'POINT': {
      const point = sourcePoint(entity.pairs, 10, 20);
      if (!point) return invalid('POINT 缺少坐标');
      const transformed = apply(matrix, point);
      return { kind: 'geometry', node: {
        id, type: 'point', visible: true, quality, x: transformed[0], y: transformed[1],
      } };
    }
    case 'LINE': {
      const start = sourcePoint(entity.pairs, 10, 20);
      const end = sourcePoint(entity.pairs, 11, 21);
      if (!start || !end) return invalid('LINE 缺少端点');
      const transformedStart = apply(matrix, start);
      const transformedEnd = apply(matrix, end);
      if (distance(transformedStart, transformedEnd) <= 1e-10) return invalid('LINE 退化为零长度');
      return { kind: 'geometry', node: {
        id, type: 'line', visible: true, quality,
        start: transformedStart, end: transformedEnd,
      } };
    }
    case 'CIRCLE': {
      const center = sourcePoint(entity.pairs, 10, 20);
      const radius = numberValue(entity.pairs, 40, Number.NaN);
      if (!center || !(radius > 0)) return invalid('CIRCLE 参数无效');
      const transformedCenter = apply(matrix, center);
      const axes = transformedAxes(matrix, radius);
      if (near(axes.xLength, axes.yLength)) {
        return { kind: 'geometry', node: {
          id, type: 'circle', visible: true, quality,
          center: transformedCenter, radius: clean((axes.xLength + axes.yLength) / 2),
        } };
      }
      const major = axes.xLength >= axes.yLength ? axes.x : axes.y;
      const majorLength = Math.max(axes.xLength, axes.yLength);
      const minorLength = Math.min(axes.xLength, axes.yLength);
      return { kind: 'geometry', node: {
        id, type: 'ellipse', visible: true, quality,
        center: transformedCenter, majorAxis: major, ratio: clean(minorLength / majorLength),
      } };
    }
    case 'ARC': {
      const center = sourcePoint(entity.pairs, 10, 20);
      const radius = numberValue(entity.pairs, 40, Number.NaN);
      const start = numberValue(entity.pairs, 50, Number.NaN);
      const end = numberValue(entity.pairs, 51, Number.NaN);
      if (!center || !(radius > 0) || !Number.isFinite(start) || !Number.isFinite(end)) {
        return invalid('ARC 参数无效');
      }
      if (!isSimilarity(matrix)) {
        return {
          kind: 'unsupported', code: 'DXF_NON_SIMILAR_ARC_UNSUPPORTED',
          message: '非等比 INSERT 中的 ARC 暂不投影，原始记录已保留',
        };
      }
      const transformedCenter = apply(matrix, center);
      const startPoint = apply(matrix, pointAt(center, radius, start));
      const endPoint = apply(matrix, pointAt(center, radius, end));
      const scale = Math.hypot(matrix.a, matrix.b);
      return { kind: 'geometry', node: {
        id, type: 'arc', visible: true, quality,
        center: transformedCenter,
        radius: clean(radius * scale),
        startAngle: angleDegrees(transformedCenter, startPoint),
        endAngle: angleDegrees(transformedCenter, endPoint),
        counterClockwise: determinant(matrix) >= 0,
      } };
    }
    case 'ELLIPSE': {
      const center = sourcePoint(entity.pairs, 10, 20);
      const major = sourcePoint(entity.pairs, 11, 21);
      const ratio = numberValue(entity.pairs, 40, Number.NaN);
      if (!center || !major || !(ratio > 0 && ratio <= 1) || !isSimilarity(matrix)) {
        return invalid('ELLIPSE 参数或变换无效');
      }
      return { kind: 'geometry', node: {
        id, type: 'ellipse', visible: true, quality,
        center: apply(matrix, center),
        majorAxis: applyVector(matrix, major),
        ratio,
        ...(hasCode(entity.pairs, 41) ? { startParam: numberValue(entity.pairs, 41, 0) } : {}),
        ...(hasCode(entity.pairs, 42) ? { endParam: numberValue(entity.pairs, 42, Math.PI * 2) } : {}),
      } };
    }
    case 'LWPOLYLINE': {
      const vertices = lwPolylineVertices(entity.pairs).map((vertex) => ({
        point: apply(matrix, vertex.point),
        ...(vertex.bulge === undefined
          ? {}
          : { bulge: determinant(matrix) < 0 ? -vertex.bulge : vertex.bulge }),
      }));
      const closed = (integerValue(entity.pairs, 70, 0) & 1) === 1;
      if (vertices.length < (closed ? 3 : 2)) return invalid('LWPOLYLINE 顶点不足');
      return { kind: 'geometry', node: {
        id, type: 'polyline', visible: true, quality, vertices, closed,
      } };
    }
    case 'SPLINE': {
      const degree = integerValue(entity.pairs, 71, 3);
      const controlPoints = repeatedPoints(entity.pairs, 10, 20).map((point) => apply(matrix, point));
      const knots = values(entity.pairs, 40).map(toNumber).filter(Number.isFinite);
      const weights = values(entity.pairs, 41).map(toNumber).filter(Number.isFinite);
      const flags = integerValue(entity.pairs, 70, 0);
      if (controlPoints.length <= degree || knots.length !== controlPoints.length + degree + 1) {
        return invalid('SPLINE 控制点或 knot 数量无效');
      }
      return { kind: 'geometry', node: {
        id, type: 'spline', visible: true, quality,
        degree, controlPoints, knots,
        ...(weights.length === controlPoints.length ? { weights } : {}),
        closed: (flags & 1) === 1,
        periodic: (flags & 2) === 2,
      } };
    }
    case 'HATCH': {
      const hatch = projectHatchPattern(entity.pairs);
      if (!hatch) {
        return {
          kind: 'unsupported',
          message: 'HATCH 不是可投影的连续线型填充，原始记录已保留',
        };
      }
      const segments = hatch.segments.flatMap(({ start, end }) => {
        const transformedStart = apply(matrix, start);
        const transformedEnd = apply(matrix, end);
        return distance(transformedStart, transformedEnd) > 1e-10
          ? [{ start: transformedStart, end: transformedEnd }]
          : [];
      });
      const first = segments[0];
      if (!first) return invalid('HATCH 投影后没有有效剖面线');
      return { kind: 'annotation', node: {
        id: stableId('annotation', idSeed) as AnnotationId,
        type: 'section-hatch',
        visible: true,
        quality,
        pattern: hatch.pattern,
        angle: angleDegrees(first.start, first.end),
        spacing: clean(hatch.spacing * averageScale(matrix)),
        segments,
      } };
    }
    case 'TEXT':
    case 'MTEXT':
      return textAnnotation(entity, matrix, idSeed, evidence);
    case 'DIMENSION':
      return dimensionAnnotation(entity, matrix, idSeed, evidence);
    case 'VIEWPORT':
      return { kind: 'unsupported', message: 'VIEWPORT 不属于模型几何' };
    default:
      return { kind: 'unsupported', message: `${entity.type} 尚未投影，原始记录已保留` };
  }
}

function textAnnotation(
  entity: DxfEntityRecord,
  matrix: Matrix2D,
  idSeed: string,
  evidence: EvidenceId,
): Conversion {
  const position = sourcePoint(entity.pairs, 10, 20);
  const content = entity.pairs
    .filter((pair) => pair.code === 1 || pair.code === 3)
    .map((pair) => pair.value)
    .join('');
  const height = numberValue(entity.pairs, 40, 1) * averageScale(matrix);
  if (!position || !content.trim() || !(height > 0)) return invalid(`${entity.type} 参数无效`);
  const alignmentCode = integerValue(entity.pairs, 72, 0);
  return { kind: 'annotation', node: {
    id: stableId('annotation', idSeed) as AnnotationId,
    type: 'text', visible: true,
    quality: { status: 'confirmed', confidence: 1, evidenceRefs: [evidence] },
    content: plainDxfText(content),
    position: apply(matrix, position),
    height: clean(height),
    rotation: clean(numberValue(entity.pairs, 50, 0) + matrixRotation(matrix)),
    alignment: alignmentCode === 1 || alignmentCode === 4 ? 'center'
      : alignmentCode === 2 || alignmentCode === 5 ? 'right' : 'left',
    verticalAlignment: 'baseline',
  } };
}

function dimensionAnnotation(
  entity: DxfEntityRecord,
  matrix: Matrix2D,
  idSeed: string,
  evidence: EvidenceId,
): Conversion {
  const sourceText = sourcePoint(entity.pairs, 11, 21)
    ?? sourcePoint(entity.pairs, 10, 20);
  if (!sourceText) return invalid('DIMENSION 缺少文字位置');
  const rawKind = integerValue(entity.pairs, 70, 0) & 7;
  const kind = rawKind === 1 ? 'aligned'
    : rawKind === 2 || rawKind === 5 ? 'angular'
      : rawKind === 3 ? 'diameter'
        : rawKind === 4 ? 'radius'
          : rawKind === 6 ? 'ordinate' : 'linear';
  const sourceStart = sourcePoint(entity.pairs, 13, 23);
  const sourceEnd = sourcePoint(entity.pairs, 14, 24);
  const dimensionLine = sourcePoint(entity.pairs, 10, 20);
  let computedValue: number | undefined;
  let definitionPoints: Vec2[];
  if ((kind === 'linear' || kind === 'aligned') && sourceStart && sourceEnd && dimensionLine) {
    const start = apply(matrix, sourceStart);
    const end = apply(matrix, sourceEnd);
    const linePoint = apply(matrix, dimensionLine);
    const sourceAngle = kind === 'aligned'
      ? Math.atan2(sourceEnd[1] - sourceStart[1], sourceEnd[0] - sourceStart[0])
      : numberValue(entity.pairs, 50, 0) * Math.PI / 180;
    const transformedDirection = applyVector(matrix, [Math.cos(sourceAngle), Math.sin(sourceAngle)]);
    const directionLength = Math.hypot(...transformedDirection);
    const direction: Vec2 = directionLength > 0
      ? [transformedDirection[0] / directionLength, transformedDirection[1] / directionLength]
      : [1, 0];
    const normal: Vec2 = [-direction[1], direction[0]];
    const measureStart = moveAlong(start, normal, dot(subtract(linePoint, start), normal));
    const measureEnd = moveAlong(end, normal, dot(subtract(linePoint, end), normal));
    computedValue = clean(Math.abs(dot(subtract(end, start), direction)));
    definitionPoints = [start, end, measureStart, measureEnd];
  } else {
    const pointCodes: Array<[number, number]> = kind === 'radius' || kind === 'diameter'
      ? [[15, 25], [10, 20], [16, 26]]
      : [[13, 23], [14, 24], [10, 20], [15, 25], [16, 26]];
    definitionPoints = pointCodes
      .map(([x, y]) => sourcePoint(entity.pairs, x, y))
      .filter((point): point is Vec2 => Boolean(point))
      .map((point) => apply(matrix, point));
    if ((kind === 'radius' || kind === 'diameter') && definitionPoints.length >= 2) {
      const measured = distance(definitionPoints[0] as Vec2, definitionPoints[1] as Vec2);
      computedValue = clean(kind === 'diameter' ? measured * 2 : measured);
    }
  }
  const observed = numberValue(entity.pairs, 42, Number.NaN);
  const rawDisplay = value(entity.pairs, 1);
  const nominal = computedValue === undefined ? '' : formatDimension(computedValue);
  const display = plainDxfText(rawDisplay || '<>', nominal);
  return { kind: 'annotation', node: {
    id: stableId('annotation', idSeed) as AnnotationId,
    type: 'dimension', visible: true,
    quality: { status: 'candidate', confidence: 0.75, evidenceRefs: [evidence] },
    dimensionKind: kind,
    associationStatus: 'conflict',
    targets: [],
    ...(Number.isFinite(observed) && observed >= 0 ? { observedValue: clean(observed) } : {}),
    ...(computedValue === undefined ? {} : { computedValue }),
    ...(display ? { displayText: display } : {}),
    unit: 'mm',
    textPosition: apply(matrix, sourceText),
    definitionPoints,
  } };
}

function polylineFromVertices(
  entity: DxfEntityRecord,
  vertices: DxfEntityRecord[],
  matrix: Matrix2D,
  idSeed: string,
  evidence: EvidenceId,
): GeometryNode | null {
  const converted = vertices.flatMap((vertex) => {
    const point = sourcePoint(vertex.pairs, 10, 20);
    if (!point) return [];
    const bulge = hasCode(vertex.pairs, 42) ? numberValue(vertex.pairs, 42, 0) : undefined;
    return [{
      point: apply(matrix, point),
      ...(bulge === undefined ? {} : { bulge: determinant(matrix) < 0 ? -bulge : bulge }),
    }];
  });
  const closed = (integerValue(entity.pairs, 70, 0) & 1) === 1;
  if (converted.length < (closed ? 3 : 2)) return null;
  return {
    id: stableId('geometry', idSeed) as GeometryId,
    type: 'polyline', visible: true,
    quality: { status: 'confirmed', confidence: 1, evidenceRefs: [evidence] },
    vertices: converted, closed,
  };
}

function insertMatrix(entity: DxfEntityRecord, block: DxfBlockRecord, offset: Vec2): Matrix2D {
  const insertion = sourcePoint(entity.pairs, 10, 20) ?? [0, 0];
  const base = sourcePoint(block.headerPairs, 10, 20) ?? [0, 0];
  const sx = numberValue(entity.pairs, 41, 1);
  const sy = numberValue(entity.pairs, 42, 1);
  const radians = numberValue(entity.pairs, 50, 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = cosine * sx;
  const b = sine * sx;
  const c = -sine * sy;
  const d = cosine * sy;
  const px = insertion[0] + offset[0];
  const py = insertion[1] + offset[1];
  return {
    a, b, c, d,
    e: px - a * base[0] - c * base[1],
    f: py - b * base[0] - d * base[1],
  };
}

function identity(): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function multiply(parent: Matrix2D, local: Matrix2D): Matrix2D {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    e: parent.a * local.e + parent.c * local.f + parent.e,
    f: parent.b * local.e + parent.d * local.f + parent.f,
  };
}

function apply(matrix: Matrix2D, point: Vec2): Vec2 {
  return [
    clean(matrix.a * point[0] + matrix.c * point[1] + matrix.e),
    clean(matrix.b * point[0] + matrix.d * point[1] + matrix.f),
  ];
}

function applyVector(matrix: Matrix2D, vector: Vec2): Vec2 {
  return [
    clean(matrix.a * vector[0] + matrix.c * vector[1]),
    clean(matrix.b * vector[0] + matrix.d * vector[1]),
  ];
}

function transformedAxes(matrix: Matrix2D, radius: number) {
  const x = applyVector(matrix, [radius, 0]);
  const y = applyVector(matrix, [0, radius]);
  return { x, y, xLength: Math.hypot(...x), yLength: Math.hypot(...y) };
}

function isSimilarity(matrix: Matrix2D): boolean {
  const xLength = Math.hypot(matrix.a, matrix.b);
  const yLength = Math.hypot(matrix.c, matrix.d);
  const dot = matrix.a * matrix.c + matrix.b * matrix.d;
  return near(xLength, yLength) && Math.abs(dot) <= 1e-8 * Math.max(1, xLength * yLength);
}

function determinant(matrix: Matrix2D): number {
  return matrix.a * matrix.d - matrix.b * matrix.c;
}

function matrixRotation(matrix: Matrix2D): number {
  return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
}

function averageScale(matrix: Matrix2D): number {
  return (Math.hypot(matrix.a, matrix.b) + Math.hypot(matrix.c, matrix.d)) / 2;
}

function sourcePoint(pairs: DxfPair[], xCode: number, yCode: number): Vec2 | undefined {
  const x = numberValue(pairs, xCode, Number.NaN);
  const y = numberValue(pairs, yCode, Number.NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

function repeatedPoints(pairs: DxfPair[], xCode: number, yCode: number): Vec2[] {
  const xs = values(pairs, xCode).map(toNumber);
  const ys = values(pairs, yCode).map(toNumber);
  return xs.slice(0, Math.min(xs.length, ys.length)).flatMap((x, index) => {
    const y = ys[index];
    return Number.isFinite(x) && Number.isFinite(y) ? [[x, y] as Vec2] : [];
  });
}

function lwPolylineVertices(pairs: DxfPair[]): Array<{ point: Vec2; bulge?: number }> {
  const result: Array<{ point: Vec2; bulge?: number }> = [];
  let current: { x: number; y?: number; bulge?: number } | undefined;
  const flush = () => {
    if (current && current.y !== undefined) {
      result.push({
        point: [current.x, current.y],
        ...(current.bulge === undefined ? {} : { bulge: current.bulge }),
      });
    }
  };
  for (const pair of pairs) {
    if (pair.code === 10) {
      flush();
      current = { x: toNumber(pair.value) };
    } else if (pair.code === 20 && current) current.y = toNumber(pair.value);
    else if (pair.code === 42 && current) current.bulge = toNumber(pair.value);
  }
  flush();
  return result.filter((vertex) => vertex.point.every(Number.isFinite));
}

function evidenceRef(
  sourceId: string,
  entity: DxfEntityRecord,
  index: number,
  insertPath: string[],
): EvidenceId {
  const suffix = insertPath.length > 0 ? `:insert:${insertPath.join('/')}` : '';
  return `dxf:${sourceId}:entity:${entityKey(entity, index)}${suffix}` as EvidenceId;
}

function entityKey(entity: DxfEntityRecord, index: number): string {
  return entity.handle || `${entity.type}_${index}`;
}

function stableId(plane: 'geometry' | 'annotation', seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 24);
  return `${plane === 'geometry' ? 'geo' : 'ann'}_dxf_${digest}`;
}

function diagnostic(
  code: DxfProjectionDiagnostic['code'],
  entity: DxfEntityRecord,
  insertPath: string[],
  message: string,
): DxfProjectionDiagnostic {
  return {
    code, message, entityType: entity.type,
    ...(entity.handle ? { handle: entity.handle } : {}),
    ...(insertPath.length > 0 ? { insertPath } : {}),
  };
}

function invalid(message: string): Conversion {
  return { kind: 'invalid', message };
}

function pointAt(center: Vec2, radius: number, angle: number): Vec2 {
  const radians = angle * Math.PI / 180;
  return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
}

function angleDegrees(center: Vec2, point: Vec2): number {
  const angle = Math.atan2(point[1] - center[1], point[0] - center[0]) * 180 / Math.PI;
  return clean(angle < 0 ? angle + 360 : angle);
}

function value(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}

function values(pairs: DxfPair[], code: number): string[] {
  return pairs.filter((pair) => pair.code === code).map((pair) => pair.value);
}

function hasCode(pairs: DxfPair[], code: number): boolean {
  return pairs.some((pair) => pair.code === code);
}

function numberValue(pairs: DxfPair[], code: number, fallback: number): number {
  const found = value(pairs, code);
  if (found === undefined) return fallback;
  const parsed = toNumber(found);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(pairs: DxfPair[], code: number, fallback: number): number {
  return Math.trunc(numberValue(pairs, code, fallback));
}

function toNumber(input: string): number {
  return Number.parseFloat(input.trim());
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function near(first: number, second: number): boolean {
  return Math.abs(first - second) <= 1e-8 * Math.max(1, Math.abs(first), Math.abs(second));
}

function clean(input: number): number {
  if (Math.abs(input) < 1e-12) return 0;
  const nearest = Math.round(input);
  return Math.abs(input - nearest) < 1e-12 ? nearest : input;
}

function subtract(first: Vec2, second: Vec2): Vec2 {
  return [first[0] - second[0], first[1] - second[1]];
}

function dot(first: Vec2, second: Vec2): number {
  return first[0] * second[0] + first[1] * second[1];
}

function moveAlong(point: Vec2, direction: Vec2, amount: number): Vec2 {
  return [clean(point[0] + direction[0] * amount), clean(point[1] + direction[1] * amount)];
}

function formatDimension(input: number): string {
  return String(Math.round(input * 100) / 100);
}

function plainDxfText(input: string, nominal = ''): string {
  return input
    .replace(/<>/g, nominal)
    .replace(/%%C/gi, '⌀')
    .replace(/%%P/gi, '±')
    .replace(/%%D/gi, '°')
    .replace(/\\P/gi, '\n')
    .replace(/\\S([^;^]*)\^([^;]*);/g, (_match, upper: string, lower: string) => (
      ` ${upper.trim()}/${lower.trim()}`
    ))
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
