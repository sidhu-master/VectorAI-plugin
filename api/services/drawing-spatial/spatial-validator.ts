import type {
  SemanticRegion,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import {
  validateDrawingDocument,
  type DrawingDocument,
  type GeometryNode,
  type Vec2,
} from '../../../src/drawing/index.js';
import {
  comparePreservedNodeHashes,
  drawingNodeContentHash,
} from '../drawing-edit/preserve-report.js';
import { roughGeometryBounds, sampleGeometryRanges } from './geometry-sampling.js';
import type { CompiledSpatialEditCandidate } from './spatial-edit-compiler.js';

export interface SpatialValidationIssue {
  code: string;
  message: string;
  nodeIds: string[];
}

export interface SpatialValidationReport {
  valid: boolean;
  issues: SpatialValidationIssue[];
  unexpectedDanglingEndpoints: Vec2[];
}

export function validateSpatialEditPreview(input: {
  before: DrawingDocument;
  after: DrawingDocument;
  region: SemanticRegion;
  selection: SpatialSelection;
  candidate: CompiledSpatialEditCandidate;
  tolerance: number;
}): SpatialValidationReport {
  const issues: SpatialValidationIssue[] = [];
  if (input.region.revision !== input.selection.revision
    || input.candidate.baseRevision !== input.selection.revision) {
    issues.push(issue('SPATIAL_EDIT_STALE', '区域、选择和候选版本不一致'));
  }
  const preserved = comparePreservedNodeHashes(input.after, input.candidate.preserveNodeHashes);
  if (!preserved.satisfied) issues.push(issue(
    'PROTECTED_NODE_CHANGED',
    '区域外或受保护节点发生变化',
    [...preserved.changedNodeIds, ...preserved.missingNodeIds],
  ));
  for (const [id, expected] of Object.entries(input.candidate.protectedFragmentHashes)) {
    const node = input.after.geometry.find((item) => item.id === id);
    if (!node || drawingNodeContentHash(node) !== expected) {
      issues.push(issue('PROTECTED_FRAGMENT_CHANGED', '拆分后的保护片段发生变化', [id]));
    }
  }
  issues.push(...validateLineage(input.before, input.after, input.candidate));
  const documentReport = validateDrawingDocument(input.after);
  documentReport.issues.filter((item) => item.severity === 'error').forEach((item) => {
    issues.push(issue(item.code, item.message, item.nodeIds));
  });
  for (const node of input.after.geometry) {
    if (!finiteGeometry(node)) issues.push(issue('NON_FINITE_GEOMETRY', '图元包含非有限坐标', [node.id]));
    if (zeroLengthGeometry(node, input.tolerance)) {
      issues.push(issue('ZERO_LENGTH_GEOMETRY', '图元长度或半径低于容差', [node.id]));
    }
  }
  for (const id of input.candidate.targetNodeIds) {
    const node = input.after.geometry.find((item) => item.id === id);
    const bounds = node && roughGeometryBounds(node);
    if (bounds && !boundsInside(bounds, input.candidate.authorizedBounds, input.tolerance)) {
      issues.push(issue('TARGET_OUTSIDE_AUTHORIZED_BOUNDS', '目标图元越出授权范围', [id]));
    }
  }
  issues.push(...validateBoundaryAnchors(input));
  const unexpectedDanglingEndpoints = danglingEndpoints(
    input.after.geometry.filter((node) => input.candidate.targetNodeIds.includes(node.id)),
    input.tolerance,
  );
  if (input.candidate.strategy === 'geometric-edit'
    && input.selection.boundaryAnchors.length > 0
    && unexpectedDanglingEndpoints.length > 0) {
    issues.push(issue(
      'UNEXPECTED_DANGLING_ENDPOINT',
      '目标轮廓存在未连接端点',
      input.candidate.targetNodeIds,
    ));
  }
  return { valid: issues.length === 0, issues, unexpectedDanglingEndpoints };
}

function validateLineage(
  before: DrawingDocument,
  after: DrawingDocument,
  candidate: CompiledSpatialEditCandidate,
): SpatialValidationIssue[] {
  const bySource = new Map<string, typeof candidate.lineage>();
  for (const entry of candidate.lineage) {
    bySource.set(entry.sourceNodeId, [...(bySource.get(entry.sourceNodeId) ?? []), entry]);
  }
  const issues: SpatialValidationIssue[] = [];
  for (const [sourceId, entries] of bySource) {
    const source = before.geometry.find((node) => node.id === sourceId);
    const domainEnd = source?.type === 'polyline'
      ? source.closed ? source.vertices.length : source.vertices.length - 1
      : source ? 1 : Number.NaN;
    const ordered = [...entries].sort((left, right) => left.sourceRange[0] - right.sourceRange[0]);
    const complete = Number.isFinite(domainEnd)
      && Math.abs(ordered[0]?.sourceRange[0] ?? Number.NaN) <= 1e-9
      && Math.abs((ordered.at(-1)?.sourceRange[1] ?? Number.NaN) - domainEnd) <= 1e-9
      && ordered.every((entry, index) => (
        entry.sourceRange[1] > entry.sourceRange[0]
        && (index === 0 || Math.abs(ordered[index - 1].sourceRange[1] - entry.sourceRange[0]) <= 1e-9)
        && after.geometry.some((node) => node.id === entry.fragmentId)
      ));
    if (!complete) issues.push(issue('LINEAGE_COVERAGE_INCOMPLETE', '拆分 lineage 未完整覆盖原图元', [sourceId]));
  }
  return issues;
}

function validateBoundaryAnchors(input: {
  after: DrawingDocument;
  selection: SpatialSelection;
  candidate: CompiledSpatialEditCandidate;
  tolerance: number;
}): SpatialValidationIssue[] {
  if (input.selection.boundaryAnchors.length === 0) return [];
  const targets = input.after.geometry.filter((node) => input.candidate.targetNodeIds.includes(node.id));
  const protectedIds = input.candidate.lineage
    .filter((entry) => entry.role === 'protected')
    .map((entry) => entry.fragmentId);
  const protectedNodes = input.after.geometry.filter((node) => protectedIds.includes(node.id));
  return input.selection.boundaryAnchors.flatMap((anchor): SpatialValidationIssue[] => {
    const targetConnected = targets.some((node) => distanceToGeometry(anchor.point, node) <= input.tolerance);
    const protectedConnected = protectedNodes.some((node) => (
      distanceToGeometry(anchor.point, node) <= input.tolerance
    ));
    return targetConnected && protectedConnected
      ? []
      : [issue('BOUNDARY_ANCHOR_DISCONNECTED', '编辑后未保持目标与保护片段连接', [
          ...input.candidate.targetNodeIds,
          ...protectedIds,
        ])];
  });
}

function danglingEndpoints(nodes: GeometryNode[], tolerance: number): Vec2[] {
  const endpoints = nodes.flatMap(geometryEndpoints);
  const consumed = new Set<number>();
  const dangling: Vec2[] = [];
  endpoints.forEach((point, index) => {
    if (consumed.has(index)) return;
    const cluster = endpoints.map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate }) => distance(point, candidate) <= tolerance);
    cluster.forEach(({ candidateIndex }) => consumed.add(candidateIndex));
    if (cluster.length === 1) dangling.push(point);
  });
  return dangling;
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

function distanceToGeometry(point: Vec2, node: GeometryNode): number {
  const bounds = roughGeometryBounds(node) ?? {
    minX: point[0] - 1, minY: point[1] - 1,
    maxX: point[0] + 1, maxY: point[1] + 1,
  };
  const samples = sampleGeometryRanges(node, { curveSamples: 128, localBounds: bounds })
    .flatMap((range) => range.samples);
  if (samples.length === 0) return Number.POSITIVE_INFINITY;
  if (samples.length === 1) return distance(point, samples[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < samples.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, samples[index - 1], samples[index]));
  }
  return best;
}

function finiteGeometry(node: GeometryNode): boolean {
  return allNumbers(node).every(Number.isFinite);
}

function allNumbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(allNumbers);
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(allNumbers);
}

function zeroLengthGeometry(node: GeometryNode, tolerance: number): boolean {
  switch (node.type) {
    case 'point': return false;
    case 'line': return distance(node.start, node.end) <= tolerance;
    case 'ray':
    case 'xline': return Math.hypot(...node.direction) <= tolerance;
    case 'circle':
    case 'arc': return node.radius <= tolerance;
    case 'ellipse': return Math.hypot(...node.majorAxis) <= tolerance || node.ratio <= 0;
    case 'polyline': return node.vertices.length < (node.closed ? 3 : 2)
      || node.vertices.slice(1).some((vertex, index) => (
        distance(node.vertices[index].point, vertex.point) <= tolerance
      ));
    case 'spline': return node.controlPoints.length < 2;
  }
}

function boundsInside(
  inner: { minX: number; minY: number; maxX: number; maxY: number },
  outer: { minX: number; minY: number; maxX: number; maxY: number },
  tolerance: number,
): boolean {
  return inner.minX >= outer.minX - tolerance && inner.minY >= outer.minY - tolerance
    && inner.maxX <= outer.maxX + tolerance && inner.maxY <= outer.maxY + tolerance;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx ** 2 + dy ** 2;
  if (lengthSquared === 0) return distance(point, start);
  const parameter = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return distance(point, [start[0] + dx * parameter, start[1] + dy * parameter]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function issue(code: string, message: string, nodeIds: string[] = []): SpatialValidationIssue {
  return { code, message, nodeIds: [...new Set(nodeIds)] };
}
