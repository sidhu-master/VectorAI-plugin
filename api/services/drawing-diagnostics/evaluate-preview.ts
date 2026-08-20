import {
  validateDrawingDocument,
  type DrawingDocument,
  type GeometryNode,
  type Vec2,
} from '../../../src/drawing/index.js';
import { roughGeometryBounds, sampleGeometryRanges } from '../drawing-spatial/geometry-sampling.js';
import type {
  DrawingDiagnostic,
  DrawingDiagnosticReport,
  EvaluateDrawingPreviewInput,
} from './types.js';

export function evaluateDrawingPreview(
  input: EvaluateDrawingPreviewInput,
): DrawingDiagnosticReport {
  const diagnostics: DrawingDiagnostic[] = [];
  const changedNodeIds = changedNodes(input.before, input.after);
  const declaredNodeIds = new Set<string>(input.transaction.commands.flatMap((command): string[] => {
    if (command.type === 'history.revert') return [];
    if ('value' in command) return command.value.id ? [command.value.id] : [];
    return [command.id];
  }));
  const undeclaredNodeIds = changedNodeIds.filter((id) => !declaredNodeIds.has(id));
  if (undeclaredNodeIds.length > 0) {
    diagnostics.push(diagnostic(
      'UNDECLARED_NODE_CHANGE',
      'warning',
      '候选文档包含事务命令未声明的节点变化',
      undeclaredNodeIds,
    ));
  }
  const connectionTolerance = relativeConnectionTolerance(
    input.after.geometry,
    input.tolerance,
  );
  const beforeDangling = danglingEndpoints(input.before.geometry, connectionTolerance);
  const afterDangling = danglingEndpoints(input.after.geometry, connectionTolerance);
  const unexpectedDanglingEndpoints = afterDangling.filter((point) => (
    !nearAny(point, beforeDangling, connectionTolerance)
  ));
  if (unexpectedDanglingEndpoints.length > 0) {
    diagnostics.push(diagnostic(
      'NEW_DANGLING_ENDPOINT',
      'warning',
      '候选修改产生了新的未连接端点',
      geometryIdsNear(input.after.geometry, unexpectedDanglingEndpoints, connectionTolerance),
      {
        points: structuredClone(unexpectedDanglingEndpoints),
        tolerance: connectionTolerance,
      },
    ));
  }
  const brokenConnections = brokenExistingConnections(
    input.before.geometry,
    input.after.geometry,
    changedNodeIds,
    connectionTolerance,
  );
  for (const connection of brokenConnections) {
    diagnostics.push(diagnostic(
      'BROKEN_EXISTING_CONNECTION',
      'warning',
      '候选修改破坏了原有图元接触关系',
      connection.nodeIds,
      { point: structuredClone(connection.point), tolerance: connectionTolerance },
    ));
  }
  diagnostics.push(...geometryLengthDistortionDiagnostics(
    input.before.geometry,
    input.after.geometry,
    changedNodeIds,
    connectionTolerance,
  ));

  for (const annotation of changedById(input.before.annotations, input.after.annotations)) {
    diagnostics.push(diagnostic(
      annotation.after ? 'ANNOTATION_CHANGED' : 'ANNOTATION_REMOVED',
      'warning',
      annotation.after ? '关联标注内容或布局发生变化' : '候选修改移除了标注',
      [annotation.id],
    ));
  }

  for (const relation of input.after.relations) {
    if (relation.plane !== 'constraint'
      || (relation.status !== 'violated' && relation.status !== 'unsolved')) continue;
    const previous = input.before.relations.find((item) => item.id === relation.id);
    if (previous && sameValue(previous, relation)) continue;
    diagnostics.push(diagnostic(
      relation.status === 'violated' ? 'CONSTRAINT_VIOLATED' : 'CONSTRAINT_UNSOLVED',
      'warning',
      relation.status === 'violated' ? '候选修改使约束处于违反状态' : '候选修改使约束无法求解',
      [relation.id, ...relation.geometryIds],
    ));
  }

  for (const command of input.transaction.commands) {
    if (command.type !== 'relation.delete' && command.type !== 'relation.update') continue;
    const existing = input.before.relations.find((relation) => relation.id === command.id);
    if (!existing || existing.plane !== 'constraint') continue;
    if (command.type === 'relation.update'
      && Object.keys(command.changes).every((field) => field === 'status')) continue;
    const action = command.type === 'relation.delete' ? 'constraint.delete' : 'constraint.update';
    diagnostics.push({
      code: 'CONSTRAINT_PERMISSION_REQUIRED',
      severity: 'decision_required',
      message: '候选修改会删除或改变已有约束的含义',
      nodeIds: [existing.id],
      action,
    });
  }

  const confidence = input.transaction.metadata?.confidence;
  if (confidence !== undefined && confidence < 0.6) {
    diagnostics.push(diagnostic(
      'LOW_CONFIDENCE_CANDIDATE',
      'candidate',
      '模型将此候选标记为低置信度',
      changedNodeIds,
      { confidence },
    ));
  }

  const report = validateDrawingDocument(input.after);
  return {
    hardValid: report.valid,
    diagnostics: dedupeDiagnostics(diagnostics),
    changedNodeIds,
    unexpectedDanglingEndpoints,
  };
}

function changedNodes(before: DrawingDocument, after: DrawingDocument): string[] {
  const beforeNodes = nodeMap(before);
  const afterNodes = nodeMap(after);
  return [...new Set([...beforeNodes.keys(), ...afterNodes.keys()])]
    .filter((id) => !sameValue(beforeNodes.get(id), afterNodes.get(id)))
    .sort();
}

function nodeMap(document: DrawingDocument): Map<string, unknown> {
  return new Map([
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => [node.id, node]));
}

function changedById<T extends { id: string }>(
  before: T[],
  after: T[],
): Array<{ id: string; before?: T; after?: T }> {
  const beforeById = new Map(before.map((node) => [node.id, node]));
  const afterById = new Map(after.map((node) => [node.id, node]));
  return [...new Set([...beforeById.keys(), ...afterById.keys()])]
    .filter((id) => !sameValue(beforeById.get(id), afterById.get(id)))
    .sort()
    .map((id) => ({ id, before: beforeById.get(id), after: afterById.get(id) }));
}

function danglingEndpoints(nodes: GeometryNode[], tolerance: number): Vec2[] {
  const endpoints = nodes.flatMap((node) => (
    geometryEndpoints(node).map((point) => ({ nodeId: node.id, point }))
  ));
  const sampledCurves = new Map(nodes.map((node) => [node.id, geometrySamples(node)]));
  return endpoints.filter(({ nodeId, point }, index) => {
    if (endpoints.some((candidate, candidateIndex) => (
      candidateIndex !== index && distance(point, candidate.point) <= tolerance
    ))) return false;
    return !nodes.some((node) => (
      node.id !== nodeId
      && pointToPolylineDistance(point, sampledCurves.get(node.id) ?? []) <= tolerance
    ));
  }).map(({ point }) => point);
}

function brokenExistingConnections(
  before: GeometryNode[],
  after: GeometryNode[],
  changedNodeIds: string[],
  tolerance: number,
): Array<{ nodeIds: string[]; point: Vec2 }> {
  const changed = new Set(changedNodeIds);
  const afterById = new Map(after.map((node) => [node.id, node]));
  const beforeSamples = new Map(before.map((node) => [node.id, geometrySamples(node)]));
  const afterSamples = new Map(after.map((node) => [node.id, geometrySamples(node)]));
  const broken: Array<{ nodeIds: string[]; point: Vec2 }> = [];
  for (const endpointNode of before) {
    for (const point of geometryEndpoints(endpointNode)) {
      for (const contactedCurve of before) {
        if (contactedCurve.id === endpointNode.id) continue;
        if (pointToPolylineDistance(point, beforeSamples.get(contactedCurve.id) ?? []) > tolerance) {
          continue;
        }
        if (!changed.has(endpointNode.id) && !changed.has(contactedCurve.id)) continue;
        const endpointAfter = afterById.get(endpointNode.id);
        const curveAfter = afterById.get(contactedCurve.id);
        if (!endpointAfter || !curveAfter) continue;
        const remainsConnected = geometryEndpoints(endpointAfter).some((afterPoint) => (
          pointToPolylineDistance(afterPoint, afterSamples.get(curveAfter.id) ?? []) <= tolerance
        ));
        if (!remainsConnected) {
          broken.push({
            nodeIds: [endpointNode.id, contactedCurve.id].sort(),
            point,
          });
        }
      }
    }
  }
  return broken.filter((item, index, values) => values.findIndex((candidate) => (
    candidate.nodeIds.join('\u0000') === item.nodeIds.join('\u0000')
  )) === index);
}

function geometryLengthDistortionDiagnostics(
  before: GeometryNode[],
  after: GeometryNode[],
  changedNodeIds: string[],
  tolerance: number,
): DrawingDiagnostic[] {
  const beforeById = new Map<string, GeometryNode>(before.map((node) => [node.id, node]));
  const afterById = new Map<string, GeometryNode>(after.map((node) => [node.id, node]));
  const drawingDiagonal = geometryDrawingDiagonal(after);
  const minimumReferenceLength = Math.max(tolerance, drawingDiagonal * 0.001);
  return changedNodeIds.flatMap((nodeId): DrawingDiagnostic[] => {
    const beforeNode = beforeById.get(nodeId);
    const afterNode = afterById.get(nodeId);
    if (!beforeNode || !afterNode) return [];
    const beforeLength = geometryPathLength(beforeNode);
    const afterLength = geometryPathLength(afterNode);
    if (beforeLength < minimumReferenceLength || afterLength < minimumReferenceLength) return [];
    const lengthRatio = afterLength / beforeLength;
    const scaleFactor = Math.max(lengthRatio, 1 / lengthRatio);
    const normalizedLengthChange = Math.abs(afterLength - beforeLength)
      / Math.max(drawingDiagonal, minimumReferenceLength);
    if (scaleFactor < 3 || normalizedLengthChange < 0.02) return [];
    return [{
      code: 'GEOMETRY_LENGTH_DISTORTION',
      severity: 'warning',
      message: '候选使图元路径长度发生显著变化，需要模型根据目标与视觉结果复核',
      nodeIds: [nodeId],
      facts: {
        beforeLength: metric(beforeLength),
        afterLength: metric(afterLength),
        lengthRatio: metric(lengthRatio),
        scaleFactor: metric(scaleFactor),
        drawingDiagonal: metric(drawingDiagonal),
        normalizedLengthChange: metric(normalizedLengthChange),
      },
    }];
  });
}

function geometrySamples(node: GeometryNode): Vec2[] {
  const bounds = roughGeometryBounds(node) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return sampleGeometryRanges(node, { curveSamples: 192, localBounds: bounds })
    .flatMap((range, index) => index === 0 ? range.samples : range.samples.slice(1));
}

function geometryPathLength(node: GeometryNode): number {
  const samples = geometrySamples(node);
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += distance(samples[index - 1], samples[index]);
  }
  return length;
}

function pointToPolylineDistance(point: Vec2, samples: Vec2[]): number {
  if (samples.length === 0) return Number.POSITIVE_INFINITY;
  if (samples.length === 1) return distance(point, samples[0]);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < samples.length; index += 1) {
    nearest = Math.min(nearest, pointToSegmentDistance(point, samples[index - 1], samples[index]));
  }
  return nearest;
}

function pointToSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const parameter = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return distance(point, [start[0] + dx * parameter, start[1] + dy * parameter]);
}

function relativeConnectionTolerance(nodes: GeometryNode[], minimum: number): number {
  const diagonal = geometryDrawingDiagonal(nodes);
  return Math.max(minimum, diagonal * 0.002);
}

function geometryDrawingDiagonal(nodes: GeometryNode[]): number {
  const bounds = nodes.flatMap((node) => roughGeometryBounds(node) ?? []);
  if (bounds.length === 0) return 0;
  const minX = Math.min(...bounds.map((item) => item.minX));
  const minY = Math.min(...bounds.map((item) => item.minY));
  const maxX = Math.max(...bounds.map((item) => item.maxX));
  const maxY = Math.max(...bounds.map((item) => item.maxY));
  return Math.hypot(maxX - minX, maxY - minY);
}

function geometryEndpoints(node: GeometryNode): Vec2[] {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'ray':
    case 'xline': return [node.origin];
    case 'circle': return [];
    case 'arc': return sampledEndpoints(node);
    case 'ellipse': return node.startParam === undefined && node.endParam === undefined
      ? []
      : sampledEndpoints(node);
    case 'polyline': return node.closed || node.vertices.length === 0
      ? []
      : [node.vertices[0].point, node.vertices.at(-1)!.point];
    case 'spline': return node.closed || node.controlPoints.length === 0
      ? []
      : [node.controlPoints[0], node.controlPoints.at(-1)!];
  }
}

function sampledEndpoints(node: GeometryNode): Vec2[] {
  const bounds = roughGeometryBounds(node) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const ranges = sampleGeometryRanges(node, { curveSamples: 64, localBounds: bounds });
  return ranges.length === 0 ? [] : [ranges[0].start, ranges.at(-1)!.end];
}

function geometryIdsNear(
  nodes: GeometryNode[],
  points: Vec2[],
  tolerance: number,
): string[] {
  return nodes.filter((node) => geometryEndpoints(node).some((endpoint) => (
    nearAny(endpoint, points, tolerance)
  ))).map((node) => node.id).sort();
}

function nearAny(point: Vec2, candidates: Vec2[], tolerance: number): boolean {
  return candidates.some((candidate) => distance(point, candidate) <= tolerance);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function metric(value: number): number {
  return Number(value.toFixed(6));
}

function diagnostic(
  code: string,
  severity: DrawingDiagnostic['severity'],
  message: string,
  nodeIds: string[],
  facts?: Record<string, unknown>,
): DrawingDiagnostic {
  return {
    code,
    severity,
    message,
    nodeIds: [...new Set(nodeIds)],
    ...(facts === undefined ? {} : { facts }),
  };
}

function dedupeDiagnostics(diagnostics: DrawingDiagnostic[]): DrawingDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((item) => {
    const key = `${item.code}\u0000${item.nodeIds.join('\u0000')}\u0000${item.action ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
