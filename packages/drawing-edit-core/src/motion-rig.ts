// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';

import { applyDrawingTransaction, findDrawingNode } from './document-transaction';

export interface MotionRigConnectorBinding {
  nodeId: string;
  movingEndpoint: 'start' | 'end' | 'first' | 'last';
  fixedPoint: Vec2;
}

export interface MotionRigDefinition {
  controlBodyNodeIds: string[];
  connectors: MotionRigConnectorBinding[];
  anchor: Vec2;
  handle: Vec2;
  keepAnchorFixed: true;
  keepControlBodyRigid: true;
  preserveConnectivity: true;
  allowControlRotation: false;
}

export interface MotionRigSolveResult {
  commands: DrawingTransactionCommand[];
  candidate: DrawingDocument;
}

type Carrier = Extract<GeometryNode, { type: 'circle' | 'ellipse' }>;

interface ContactCandidate {
  node: GeometryNode;
  movingEndpoint: MotionRigConnectorBinding['movingEndpoint'];
  movingPoint: Vec2;
  fixedPoint: Vec2;
}

export function resolveTranslationMotionRig(
  document: DrawingDocument,
  selectedNodeIds: readonly string[],
): MotionRigDefinition {
  const selected = [...new Set(selectedNodeIds)];
  if (selected.length === 0) throw new Error('MOTION_RIG_SELECTION_REQUIRED');
  const visibleGeometry = new Map(document.geometry
    .filter(({ visible }) => visible)
    .map((node) => [String(node.id), node]));
  if (selected.some((id) => !visibleGeometry.has(id))) throw new Error('MOTION_RIG_SELECTION_INVALID');

  const tolerance = drawingTolerance(document);
  const candidates = selected.flatMap((id) => {
    const node = visibleGeometry.get(id);
    if (!node || (node.type !== 'circle' && node.type !== 'ellipse')) return [];
    const contacts = connectorContacts(document, node, tolerance);
    return contacts.length === 0 ? [] : [{ carrier: node, contacts }];
  }).sort((left, right) => (
    right.contacts.length - left.contacts.length
    || String(left.carrier.id).localeCompare(String(right.carrier.id))
  ));
  if (candidates.length === 0) throw new Error('MOTION_RIG_INVALID');
  if (candidates[1]?.contacts.length === candidates[0]!.contacts.length) {
    throw new Error('MOTION_RIG_AMBIGUOUS');
  }

  const { carrier, contacts } = candidates[0]!;
  const unsupported = contacts.find(({ node }) => node.type === 'arc');
  if (unsupported) throw new Error('MOTION_RIG_GEOMETRY_UNSUPPORTED');
  const connectorIds = new Set(contacts.map(({ node }) => String(node.id)));
  const controlBodyNodeIds = selected.filter((id) => !connectorIds.has(id)).sort();
  if (!controlBodyNodeIds.includes(String(carrier.id))) controlBodyNodeIds.push(String(carrier.id));
  controlBodyNodeIds.sort();

  const connectors = contacts.map(({ node, movingEndpoint, fixedPoint }): MotionRigConnectorBinding => ({
    nodeId: String(node.id), movingEndpoint, fixedPoint: cleanPoint(fixedPoint),
  })).sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const anchor = cleanPoint([
    connectors.reduce((sum, connector) => sum + connector.fixedPoint[0], 0) / connectors.length,
    connectors.reduce((sum, connector) => sum + connector.fixedPoint[1], 0) / connectors.length,
  ]);
  return {
    controlBodyNodeIds,
    connectors,
    anchor,
    handle: cleanPoint(carrier.center),
    keepAnchorFixed: true,
    keepControlBodyRigid: true,
    preserveConnectivity: true,
    allowControlRotation: false,
  };
}

export function solveTranslationMotionRig(
  document: DrawingDocument,
  rig: MotionRigDefinition,
  delta: Vec2,
): MotionRigSolveResult {
  if (!finitePoint(delta)) throw new Error('MOTION_RIG_DELTA_INVALID');
  const commands: DrawingTransactionCommand[] = [];
  const connectorIds = new Set(rig.connectors.map(({ nodeId }) => nodeId));
  for (const id of rig.controlBodyNodeIds) {
    if (connectorIds.has(id)) throw new Error('MOTION_RIG_ROLE_CONFLICT');
    const located = findDrawingNode(document, id);
    if (!located || located.plane !== 'geometry') throw new Error('MOTION_RIG_CONTROL_NODE_MISSING');
    const translated = translatedFields(located.node as GeometryNode, delta);
    commands.push({ type: 'node.update', id, changes: translated.after, expected: translated.before });
  }
  for (const binding of rig.connectors) {
    const located = findDrawingNode(document, binding.nodeId);
    if (!located || located.plane !== 'geometry') throw new Error('MOTION_RIG_CONNECTOR_MISSING');
    commands.push(deformConnector(located.node as GeometryNode, binding, delta));
  }
  if (commands.length === 0) throw new Error('MOTION_RIG_NO_EFFECT');
  const candidate = applyDrawingTransaction(document, commands, document.metadata.updatedAt);
  for (const binding of rig.connectors) {
    const node = candidate.geometry.find(({ id }) => String(id) === binding.nodeId);
    if (!node || distance(fixedEndpoint(node, binding.movingEndpoint), binding.fixedPoint) > 1e-8) {
      throw new Error('MOTION_RIG_ANCHOR_CHANGED');
    }
  }
  return { commands, candidate };
}

function connectorContacts(document: DrawingDocument, carrier: Carrier, tolerance: number): ContactCandidate[] {
  return document.geometry.flatMap((node): ContactCandidate[] => {
    if (node.id === carrier.id || !node.visible) return [];
    const endpoints = connectorEndpoints(node);
    if (!endpoints) return [];
    const startContact = onCarrier(carrier, endpoints.start, tolerance);
    const endContact = onCarrier(carrier, endpoints.end, tolerance);
    if (startContact === endContact) return [];
    return [startContact
      ? { node, movingEndpoint: endpoints.startRole, movingPoint: endpoints.start, fixedPoint: endpoints.end }
      : { node, movingEndpoint: endpoints.endRole, movingPoint: endpoints.end, fixedPoint: endpoints.start }];
  });
}

function connectorEndpoints(node: GeometryNode): {
  start: Vec2;
  end: Vec2;
  startRole: MotionRigConnectorBinding['movingEndpoint'];
  endRole: MotionRigConnectorBinding['movingEndpoint'];
} | null {
  if (node.type === 'line') return { start: node.start, end: node.end, startRole: 'start', endRole: 'end' };
  if (node.type === 'polyline' && !node.closed && node.vertices.length >= 2) return {
    start: node.vertices[0]!.point,
    end: node.vertices[node.vertices.length - 1]!.point,
    startRole: 'first', endRole: 'last',
  };
  if (node.type === 'spline' && !node.closed && node.controlPoints.length >= 2) return {
    start: node.controlPoints[0]!,
    end: node.controlPoints[node.controlPoints.length - 1]!,
    startRole: 'first', endRole: 'last',
  };
  if (node.type === 'arc') return {
    start: arcPoint(node, node.startAngle), end: arcPoint(node, node.endAngle),
    startRole: 'start', endRole: 'end',
  };
  return null;
}

function deformConnector(
  node: GeometryNode,
  binding: MotionRigConnectorBinding,
  delta: Vec2,
): DrawingTransactionCommand {
  if (node.type === 'line' && (binding.movingEndpoint === 'start' || binding.movingEndpoint === 'end')) {
    const before = node[binding.movingEndpoint];
    return {
      type: 'node.update', id: String(node.id),
      changes: { [binding.movingEndpoint]: add(before, delta) },
      expected: { [binding.movingEndpoint]: structuredClone(before) },
    };
  }
  if (node.type === 'polyline' && (binding.movingEndpoint === 'first' || binding.movingEndpoint === 'last')) {
    const before = structuredClone(node.vertices);
    const points = before.map(({ point }) => point);
    const moved = deformPointChain(points, binding.movingEndpoint, delta);
    return {
      type: 'node.update', id: String(node.id),
      changes: { vertices: before.map((vertex, index) => ({ ...vertex, point: moved[index]! })) },
      expected: { vertices: structuredClone(node.vertices) },
    };
  }
  if (node.type === 'spline' && (binding.movingEndpoint === 'first' || binding.movingEndpoint === 'last')) {
    return {
      type: 'node.update', id: String(node.id),
      changes: { controlPoints: deformPointChain(node.controlPoints, binding.movingEndpoint, delta) },
      expected: { controlPoints: structuredClone(node.controlPoints) },
    };
  }
  throw new Error('MOTION_RIG_GEOMETRY_UNSUPPORTED');
}

function deformPointChain(
  input: readonly Vec2[],
  movingEndpoint: 'first' | 'last',
  delta: Vec2,
): Vec2[] {
  const points = movingEndpoint === 'last' ? [...input] : [...input].reverse();
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1]! + distance(points[index - 1]!, points[index]!));
  }
  const total = cumulative[cumulative.length - 1]!;
  if (!(total > 1e-12)) throw new Error('MOTION_RIG_CONNECTOR_DEGENERATE');
  const deformed = points.map((point, index) => add(point, scale(delta, cumulative[index]! / total)));
  return movingEndpoint === 'last' ? deformed : deformed.reverse();
}

function translatedFields(node: GeometryNode, delta: Vec2): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  if (node.type === 'point') return {
    before: { x: node.x, y: node.y }, after: { x: clean(node.x + delta[0]), y: clean(node.y + delta[1]) },
  };
  if (node.type === 'line') return pair('start', node.start, 'end', node.end, delta);
  if (node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse') return {
    before: { center: structuredClone(node.center) }, after: { center: add(node.center, delta) },
  };
  if (node.type === 'polyline') return {
    before: { vertices: structuredClone(node.vertices) },
    after: { vertices: node.vertices.map((vertex) => ({ ...structuredClone(vertex), point: add(vertex.point, delta) })) },
  };
  if (node.type === 'spline') return {
    before: { controlPoints: structuredClone(node.controlPoints) },
    after: { controlPoints: node.controlPoints.map((point) => add(point, delta)) },
  };
  if (node.type === 'ray' || node.type === 'xline') return {
    before: { origin: structuredClone(node.origin) }, after: { origin: add(node.origin, delta) },
  };
  throw new Error('MOTION_RIG_GEOMETRY_UNSUPPORTED');
}

function pair(firstKey: 'start', first: Vec2, secondKey: 'end', second: Vec2, delta: Vec2) {
  return {
    before: { [firstKey]: structuredClone(first), [secondKey]: structuredClone(second) },
    after: { [firstKey]: add(first, delta), [secondKey]: add(second, delta) },
  };
}

function fixedEndpoint(node: GeometryNode, moving: MotionRigConnectorBinding['movingEndpoint']): Vec2 {
  if (node.type === 'line') return moving === 'start' ? node.end : node.start;
  if (node.type === 'polyline') return moving === 'first'
    ? node.vertices[node.vertices.length - 1]!.point : node.vertices[0]!.point;
  if (node.type === 'spline') return moving === 'first'
    ? node.controlPoints[node.controlPoints.length - 1]! : node.controlPoints[0]!;
  throw new Error('MOTION_RIG_GEOMETRY_UNSUPPORTED');
}

function onCarrier(carrier: Carrier, point: Vec2, tolerance: number): boolean {
  if (carrier.type === 'circle') return Math.abs(distance(carrier.center, point) - carrier.radius) <= tolerance;
  const majorLength = Math.hypot(...carrier.majorAxis);
  if (!(majorLength > 1e-12) || !(carrier.ratio > 0)) return false;
  const ux = carrier.majorAxis[0] / majorLength;
  const uy = carrier.majorAxis[1] / majorLength;
  const dx = point[0] - carrier.center[0];
  const dy = point[1] - carrier.center[1];
  const normalized = Math.hypot((dx * ux + dy * uy) / majorLength, (-dx * uy + dy * ux) / (majorLength * carrier.ratio));
  return Math.abs(normalized - 1) * majorLength <= tolerance;
}

function drawingTolerance(document: DrawingDocument): number {
  const points = document.geometry.flatMap((node) => geometryPoints(node));
  if (points.length === 0) return 1e-6;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.max(Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1e-5, 1e-6);
}

function geometryPoints(node: GeometryNode): Vec2[] {
  if (node.type === 'point') return [[node.x, node.y]];
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'ray' || node.type === 'xline') return [node.origin];
  if (node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse') return [node.center];
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  return [...node.controlPoints];
}

function arcPoint(node: Extract<GeometryNode, { type: 'arc' }>, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return cleanPoint([node.center[0] + Math.cos(radians) * node.radius, node.center[1] + Math.sin(radians) * node.radius]);
}

function add(point: Vec2, delta: Vec2): Vec2 {
  return cleanPoint([point[0] + delta[0], point[1] + delta[1]]);
}

function scale(point: Vec2, factor: number): Vec2 {
  return [point[0] * factor, point[1] * factor];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function cleanPoint(point: Vec2): Vec2 {
  return [clean(point[0]), clean(point[1])];
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}
