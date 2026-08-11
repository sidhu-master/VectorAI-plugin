import type { DrawingAgentProgressEvent } from '../../../src/contracts/drawing-agent.js';
import {
  replayDrawingCommits,
  type DrawingCommit,
  type DrawingDocument,
  type GeometryNode,
  type Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingAgentAuditEvent } from '../drawing-agent/audit-types.js';
import { comparePreservedNodes } from '../drawing-edit/preserve-report.js';

export interface SemanticEditAnchorExpectation {
  nodeIds: readonly string[];
  point: Vec2;
  tolerance: number;
}

export interface SemanticEditBenchmarkInput {
  initialDocument: DrawingDocument;
  finalDocument: DrawingDocument;
  commits: DrawingCommit[];
  oldTargetNodeIds: readonly string[];
  editedNodeIds: readonly string[];
  preservedNodeIds: readonly string[];
  anchors: readonly SemanticEditAnchorExpectation[];
  auditEvents: readonly DrawingAgentAuditEvent[];
  progressEvents: readonly DrawingAgentProgressEvent[];
  visibleSilenceBudgetMs?: number;
}

export interface SemanticEditBenchmarkReport {
  passed: boolean;
  oldTargetRemoved: boolean;
  newTargetsPresent: boolean;
  anchorsConnected: boolean;
  disconnectedAnchors: SemanticEditAnchorExpectation[];
  preservedNodesChanged: string[];
  previewVerifiedBeforeCommit: boolean;
  replayExact: boolean;
  maxVisibleSilenceMs: number;
  visibleSilenceBudgetMs: number;
  visibleFeedbackWithinTarget: boolean;
}

/**
 * Release gate for semantic Drawing IR edits. Every value is derived from
 * canonical documents, immutable commits, or ordered runtime events.
 */
export function evaluateSemanticEditBenchmark(
  input: SemanticEditBenchmarkInput,
): SemanticEditBenchmarkReport {
  const visibleSilenceBudgetMs = input.visibleSilenceBudgetMs ?? 30_000;
  const finalNodes = allNodes(input.finalDocument);
  const oldTargetRemoved = input.oldTargetNodeIds.every((id) => !finalNodes.has(id));
  const newTargetsPresent = input.editedNodeIds.length > 0
    && input.editedNodeIds.every((id) => finalNodes.has(id));
  const disconnectedAnchors = input.anchors.filter((anchor) => {
    const nodes = input.finalDocument.geometry.filter((item) => anchor.nodeIds.includes(item.id));
    return nodes.length === 0
      || nodes.every((node) => distanceToGeometry(anchor.point, node) > anchor.tolerance);
  }).map((anchor) => structuredClone(anchor));
  const preserve = comparePreservedNodes(
    input.initialDocument,
    input.finalDocument,
    input.preservedNodeIds,
  );
  const preservedNodesChanged = [...new Set([
    ...preserve.changedNodeIds,
    ...preserve.missingNodeIds,
  ])].sort();
  const replayed = replayDrawingCommits(input.initialDocument, [...input.commits]);
  const replayExact = replayed.success && deepEqual(replayed.document, input.finalDocument);
  const previewVerifiedBeforeCommit = hasVerifiedPreviewBeforeEveryCommit(input.auditEvents);
  const maxVisibleSilenceMs = maximumEventGap(input.progressEvents);
  const visibleFeedbackWithinTarget = maxVisibleSilenceMs <= visibleSilenceBudgetMs;
  const anchorsConnected = disconnectedAnchors.length === 0;

  return {
    passed: oldTargetRemoved
      && newTargetsPresent
      && anchorsConnected
      && preservedNodesChanged.length === 0
      && previewVerifiedBeforeCommit
      && replayExact,
    oldTargetRemoved,
    newTargetsPresent,
    anchorsConnected,
    disconnectedAnchors,
    preservedNodesChanged,
    previewVerifiedBeforeCommit,
    replayExact,
    maxVisibleSilenceMs,
    visibleSilenceBudgetMs,
    visibleFeedbackWithinTarget,
  };
}

function allNodes(document: DrawingDocument): Map<string, unknown> {
  return new Map([
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => [node.id as string, node]));
}

function hasVerifiedPreviewBeforeEveryCommit(
  events: readonly DrawingAgentAuditEvent[],
): boolean {
  const commitIndices = events.flatMap((event, index) => (
    event.type === 'commit' && successfulCommitReceipt(event.payload.receipt) ? [index] : []
  ));
  if (commitIndices.length === 0) return false;
  let previousCommit = -1;
  for (const commitIndex of commitIndices) {
    const previewIndex = events.findIndex((event, index) => (
      index > previousCommit && index < commitIndex && event.type === 'preview'
    ));
    const verificationIndex = events.findIndex((event, index) => (
      index > previewIndex
      && index < commitIndex
      && event.type === 'verification'
      && event.payload.phase === 'preview'
      && event.payload.satisfied === true
    ));
    if (previewIndex < 0 || verificationIndex < 0) return false;
    previousCommit = commitIndex;
  }
  return true;
}

function successfulCommitReceipt(value: unknown): boolean {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && ['succeeded', 'already_satisfied'].includes(
      String((value as Record<string, unknown>).status),
    );
}

function maximumEventGap(events: readonly DrawingAgentProgressEvent[]): number {
  if (events.length < 2) return 0;
  const timestamps = events.map((event) => event.timestamp).sort((left, right) => left - right);
  let maximum = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    maximum = Math.max(maximum, timestamps[index] - timestamps[index - 1]);
  }
  return maximum;
}

function distanceToGeometry(point: Vec2, node: GeometryNode): number {
  switch (node.type) {
    case 'point': return Math.hypot(point[0] - node.x, point[1] - node.y);
    case 'line': return distanceToSegment(point, node.start, node.end);
    case 'ray': return distanceToRay(point, node.origin, node.direction);
    case 'xline': return distanceToInfiniteLine(point, node.origin, node.direction);
    case 'circle': return Math.abs(distance(point, node.center) - node.radius);
    case 'arc': return distanceToArc(point, node);
    case 'ellipse': return distanceToSampledEllipse(point, node);
    case 'polyline': {
      const points = node.vertices.map((vertex) => vertex.point);
      const pairs = consecutivePairs(points, node.closed);
      return pairs.length === 0
        ? points.reduce((best, candidate) => Math.min(best, distance(point, candidate)), Infinity)
        : pairs.reduce((best, [start, end]) => Math.min(best, distanceToSegment(point, start, end)), Infinity);
    }
    case 'spline': {
      const pairs = consecutivePairs(node.controlPoints, node.closed);
      return pairs.length === 0
        ? node.controlPoints.reduce((best, candidate) => Math.min(best, distance(point, candidate)), Infinity)
        : pairs.reduce((best, [start, end]) => Math.min(best, distanceToSegment(point, start, end)), Infinity);
    }
  }
}

function distanceToArc(
  point: Vec2,
  node: Extract<GeometryNode, { type: 'arc' }>,
): number {
  const angle = normalizeDegrees(Math.atan2(
    point[1] - node.center[1],
    point[0] - node.center[0],
  ) * 180 / Math.PI);
  if (angleInSweep(angle, node.startAngle, node.endAngle, node.counterClockwise)) {
    return Math.abs(distance(point, node.center) - node.radius);
  }
  return Math.min(
    distance(point, polar(node.center, node.radius, node.startAngle)),
    distance(point, polar(node.center, node.radius, node.endAngle)),
  );
}

function distanceToSampledEllipse(
  point: Vec2,
  node: Extract<GeometryNode, { type: 'ellipse' }>,
): number {
  const majorRadius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
  const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]);
  let best = Infinity;
  for (let index = 0; index < 128; index += 1) {
    const angle = index * Math.PI * 2 / 128;
    const localX = majorRadius * Math.cos(angle);
    const localY = majorRadius * node.ratio * Math.sin(angle);
    const candidate: Vec2 = [
      node.center[0] + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      node.center[1] + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    ];
    best = Math.min(best, distance(point, candidate));
  }
  return best;
}

function consecutivePairs(points: readonly Vec2[], closed: boolean): [Vec2, Vec2][] {
  const pairs: [Vec2, Vec2][] = [];
  for (let index = 1; index < points.length; index += 1) {
    pairs.push([points[index - 1], points[index]]);
  }
  if (closed && points.length > 1) pairs.push([points[points.length - 1], points[0]]);
  return pairs;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return distance(point, [start[0] + t * dx, start[1] + t * dy]);
}

function distanceToRay(point: Vec2, origin: Vec2, direction: Vec2): number {
  const lengthSquared = direction[0] ** 2 + direction[1] ** 2;
  if (lengthSquared === 0) return distance(point, origin);
  const t = Math.max(0, (
    (point[0] - origin[0]) * direction[0]
    + (point[1] - origin[1]) * direction[1]
  ) / lengthSquared);
  return distance(point, [origin[0] + t * direction[0], origin[1] + t * direction[1]]);
}

function distanceToInfiniteLine(point: Vec2, origin: Vec2, direction: Vec2): number {
  const lengthSquared = direction[0] ** 2 + direction[1] ** 2;
  if (lengthSquared === 0) return distance(point, origin);
  const t = (
    (point[0] - origin[0]) * direction[0]
    + (point[1] - origin[1]) * direction[1]
  ) / lengthSquared;
  return distance(point, [origin[0] + t * direction[0], origin[1] + t * direction[1]]);
}

function angleInSweep(angle: number, start: number, end: number, counterClockwise: boolean): boolean {
  const normalizedStart = normalizeDegrees(start);
  const normalizedEnd = normalizeDegrees(end);
  return counterClockwise
    ? normalizeDegrees(angle - normalizedStart) <= normalizeDegrees(normalizedEnd - normalizedStart)
    : normalizeDegrees(normalizedStart - angle) <= normalizeDegrees(normalizedStart - normalizedEnd);
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function polar(center: Vec2, radius: number, angleDegrees: number): Vec2 {
  const radians = angleDegrees * Math.PI / 180;
  return [
    center[0] + radius * Math.cos(radians),
    center[1] + radius * Math.sin(radians),
  ];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return keys.length === Object.keys(rightRecord).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && deepEqual(leftRecord[key], rightRecord[key]));
}
