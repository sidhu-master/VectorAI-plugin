// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '@vectorai/drawing-core';
import type {
  Diagnostic,
  DrawingTransactionCommand,
  SpatialEditProgram,
} from '@vectorai/drawing-edit-protocol';

import { canonicalSemanticString, canonicalString } from './canonical';
import { compileConnectedTransform } from './connected-transform';
import { applyDrawingTransaction, findDrawingNode } from './document-transaction';
import { invertDrawingTransaction } from './inverse';

export interface EditCorePorts {
  digest(value: string): string;
  id(kind: string): string;
  now(): number;
}

export interface GroundedEditTarget {
  targetHandle: string;
  targetNodeIds: string[];
  interfaces: Array<{
    interfaceId: string;
    nodeId: string;
    endpoint?: 'start' | 'end';
  }>;
  sourceStatus: 'confirmed' | 'candidate' | 'provisional';
}

export interface ActualEffect {
  createdNodeIds: string[];
  updatedNodeIds: string[];
  deletedNodeIds: string[];
  changedFields: Record<string, string[]>;
}

export interface SpatialCompilation {
  forward: DrawingTransactionCommand[];
  inverse: DrawingTransactionCommand[];
  candidate: DrawingDocument;
  actualEffect: ActualEffect;
  diagnostics: Diagnostic[];
  candidateDigest: string;
  effectDigest: string;
  semanticRiskKey: string;
}

export function compileSpatialEditProgram(input: {
  document: DrawingDocument;
  program: SpatialEditProgram;
  grounding: GroundedEditTarget;
  ports: EditCorePorts;
}): SpatialCompilation {
  if (input.program.baseRef.drawingId !== input.document.id) throw new Error('EDIT_DRAWING_MISMATCH');
  if (input.program.targetHandle !== input.grounding.targetHandle) throw new Error('EDIT_GROUNDING_MISMATCH');
  const initial = structuredClone(input.document);
  let working = structuredClone(input.document);
  const forward: DrawingTransactionCommand[] = [];
  const operationDiagnostics: Diagnostic[] = [];
  for (const operation of input.program.operations) {
    const compiled = compileOperation(working, operation, input.grounding, input.ports);
    const commands = compiled.commands;
    operationDiagnostics.push(...compiled.diagnostics);
    if (commands.length > 0) {
      working = applyDrawingTransaction(working, commands, input.ports.now());
      forward.push(...commands);
    }
  }
  if (canonicalSemanticString(initial) === canonicalSemanticString(working)) throw new Error('EDIT_NO_EFFECT');
  assertPreserved(initial, working, input.program.preserveScopes);
  const diagnostics = [
    ...operationDiagnostics,
    ...evaluateProgram(working, input.program, input.grounding),
  ];
  const inverse = invertDrawingTransaction(initial, forward);
  const restored = applyDrawingTransaction(working, inverse, input.ports.now());
  if (canonicalSemanticString(restored) !== canonicalSemanticString(initial)) {
    throw new Error('EDIT_INVERSE_VERIFICATION_FAILED');
  }
  const actualEffect = diffDocuments(initial, working);
  const effectProjection = {
    createdNodeIds: actualEffect.createdNodeIds,
    updatedNodeIds: actualEffect.updatedNodeIds,
    deletedNodeIds: actualEffect.deletedNodeIds,
    changedFields: actualEffect.changedFields,
  };
  const effectDigest = input.ports.digest(canonicalString(effectProjection));
  const candidateDigest = input.ports.digest(canonicalString({
    baseRef: input.program.baseRef,
    resultingSemanticDocument: JSON.parse(canonicalSemanticString(working)),
    effectDigest,
    forward,
    inverse,
    targetScope: [...input.grounding.targetNodeIds].sort(),
    interfaceScopes: [...input.grounding.interfaces]
      .map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
      .sort((left, right) => left.interfaceId.localeCompare(right.interfaceId)),
  }));
  const semanticRiskKey = input.ports.digest(canonicalString({
    baseRef: input.program.baseRef,
    resultingSemanticDigest: input.ports.digest(canonicalSemanticString(working)),
    effectDigest,
    authoritativeObjective: input.program.objective,
  }));
  return { forward, inverse, candidate: working, actualEffect, diagnostics, candidateDigest, effectDigest, semanticRiskKey };
}

function compileOperation(
  document: DrawingDocument,
  operation: SpatialEditProgram['operations'][number],
  grounding: GroundedEditTarget,
  ports: EditCorePorts,
): { commands: DrawingTransactionCommand[]; diagnostics: Diagnostic[] } {
  if (operation.kind === 'rigid_transform') {
    const transform = normalizedTransform(operation);
    return {
      commands: grounding.targetNodeIds.map((id) => transformNodeCommand(document, id, transform)),
      diagnostics: [],
    };
  }
  if (operation.kind === 'connected_transform') {
    const target = grounding.targetNodeIds.length === 1
      ? findDrawingNode(document, grounding.targetNodeIds[0]!)
      : null;
    if (
      target?.plane === 'geometry'
      && (target.node.type === 'circle' || target.node.type === 'ellipse')
    ) {
      const translation = finitePoint(operation.translation, 'EDIT_TRANSFORM_INVALID');
      const candidate = operation as typeof operation & {
        rotationRadians?: number;
        pivot?: Vec2;
      };
      const compiled = compileConnectedTransform({
        document,
        carrierNodeId: String(target.node.id),
        targetCenter: [
          target.node.center[0] + translation[0],
          target.node.center[1] + translation[1],
        ],
        ...(candidate.rotationRadians === undefined
          ? {}
          : { rotationDegrees: degrees(candidate.rotationRadians) }),
      });
      const allowed = new Set(operation.interfaceIds);
      const grounded = new Set(grounding.interfaces.map(({ interfaceId }) => interfaceId));
      for (const port of compiled.audit.ports) {
        const interfaceId = `${port.connectorNodeId}:${port.endpointRole}`;
        if (!allowed.has(interfaceId) || !grounded.has(interfaceId)) {
          throw new Error('EDIT_INTERFACE_SCOPE_MISMATCH');
        }
      }
      return { commands: dedupeUpdates(compiled.commands), diagnostics: compiled.diagnostics };
    }
    if (operation.rotationRadians === undefined || operation.pivot === undefined) {
      throw new Error('EDIT_CONNECTED_STRATEGY_UNAVAILABLE');
    }
    const transform = normalizedTransform({
      translation: operation.translation,
      rotationRadians: operation.rotationRadians,
      pivot: operation.pivot,
    });
    const allowed = new Set(operation.interfaceIds);
    const commands = grounding.targetNodeIds.map((id) => transformNodeCommand(document, id, transform));
    for (const port of grounding.interfaces) {
      if (!allowed.has(port.interfaceId)) throw new Error('EDIT_INTERFACE_SCOPE_MISMATCH');
      if (!port.endpoint) throw new Error('EDIT_INTERFACE_ENDPOINT_REQUIRED');
      const located = findDrawingNode(document, port.nodeId);
      if (!located || located.plane !== 'geometry' || located.node.type !== 'line') {
        throw new Error('EDIT_INTERFACE_UNRESOLVED');
      }
      const point = located.node[port.endpoint];
      commands.push({
        type: 'node.update',
        id: port.nodeId,
        changes: { [port.endpoint]: transformPoint(point, transform) },
        expected: { [port.endpoint]: structuredClone(point) },
      });
    }
    return { commands: dedupeUpdates(commands), diagnostics: [] };
  }
  if (operation.kind === 'set_endpoint') {
    const located = findDrawingNode(document, operation.nodeId);
    if (!located || located.plane !== 'geometry' || located.node.type !== 'line') {
      throw new Error('EDIT_ENDPOINT_UNRESOLVED');
    }
    return { commands: [{
      type: 'node.update', id: operation.nodeId,
      changes: { [operation.endpoint]: structuredClone(operation.point) },
      expected: { [operation.endpoint]: structuredClone(located.node[operation.endpoint]) },
    }], diagnostics: [] };
  }
  if (operation.kind === 'create_path') {
    const id = operation.nodeId || inputId(ports, 'geometry');
    return { commands: [{
      type: 'node.create', plane: 'geometry',
      node: {
        id,
        type: 'polyline',
        vertices: operation.points.map((point) => ({ point: structuredClone(point) })),
        closed: operation.closed,
        visible: true,
        quality: { status: grounding.sourceStatus === 'confirmed' ? 'confirmed' : 'candidate', evidenceRefs: [] },
      },
    }], diagnostics: [] };
  }
  if (operation.kind === 'create_annotation_batch') {
    return { commands: [
      ...operation.annotations.map((node): DrawingTransactionCommand => ({
        type: 'node.create', plane: 'annotation', node: structuredClone(node),
      })),
      ...operation.associations.map((node): DrawingTransactionCommand => ({
        type: 'node.create', plane: 'relation', node: structuredClone(node),
      })),
    ], diagnostics: [] };
  }
  return { commands: operation.nodeIds.map((id) => {
    if (!findDrawingNode(document, id)) throw new Error('EDIT_NODE_NOT_FOUND');
    return { type: 'node.delete' as const, id };
  }), diagnostics: [] };
}

function finitePoint(value: readonly unknown[], code: string): Vec2 {
  const point: Vec2 = [Number(value[0]), Number(value[1])];
  if (!point.every(Number.isFinite)) throw new Error(code);
  return point;
}

function normalizedTransform(input: {
  translation: readonly unknown[];
  rotationRadians: number;
  pivot: readonly unknown[];
}): { translation: Vec2; rotationRadians: number; pivot: Vec2 } {
  const translation: Vec2 = [Number(input.translation[0]), Number(input.translation[1])];
  const pivot: Vec2 = [Number(input.pivot[0]), Number(input.pivot[1])];
  if (![...translation, ...pivot, input.rotationRadians].every(Number.isFinite)) {
    throw new Error('EDIT_TRANSFORM_INVALID');
  }
  return { translation, rotationRadians: input.rotationRadians, pivot };
}

function inputId(ports: EditCorePorts, kind: string): string {
  const id = ports.id(kind);
  if (!id) throw new Error('EDIT_ID_UNAVAILABLE');
  return id;
}

function transformNodeCommand(
  document: DrawingDocument,
  id: string,
  transform: { translation: Vec2; rotationRadians: number; pivot: Vec2 },
): DrawingTransactionCommand {
  const located = findDrawingNode(document, id);
  if (!located) throw new Error('EDIT_TARGET_UNRESOLVED');
  const before = located.node;
  const changes = located.plane === 'geometry'
    ? transformedGeometryFields(before as GeometryNode, transform)
    : located.plane === 'annotation'
      ? transformedAnnotationFields(before as AnnotationNode, transform)
      : null;
  if (!changes) throw new Error('EDIT_TARGET_NOT_TRANSFORMABLE');
  return {
    type: 'node.update', id,
    changes: changes.after as never,
    expected: changes.before as never,
  };
}

function transformedGeometryFields(
  node: GeometryNode,
  transform: { translation: Vec2; rotationRadians: number; pivot: Vec2 },
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  if (node.type === 'point') return pair({ x: node.x, y: node.y }, (() => {
    const [x, y] = transformPoint([node.x, node.y], transform); return { x, y };
  })());
  if (node.type === 'line') return pair({ start: node.start, end: node.end }, { start: transformPoint(node.start, transform), end: transformPoint(node.end, transform) });
  if (node.type === 'ray' || node.type === 'xline') return pair({ origin: node.origin, direction: node.direction }, { origin: transformPoint(node.origin, transform), direction: rotate(node.direction, transform.rotationRadians) });
  if (node.type === 'circle') return pair({ center: node.center }, { center: transformPoint(node.center, transform) });
  if (node.type === 'arc') return pair(
    { center: node.center, startAngle: node.startAngle, endAngle: node.endAngle },
    { center: transformPoint(node.center, transform), startAngle: node.startAngle + degrees(transform.rotationRadians), endAngle: node.endAngle + degrees(transform.rotationRadians) },
  );
  if (node.type === 'ellipse') return pair({ center: node.center, majorAxis: node.majorAxis }, { center: transformPoint(node.center, transform), majorAxis: rotate(node.majorAxis, transform.rotationRadians) });
  if (node.type === 'polyline') return pair({ vertices: node.vertices }, { vertices: node.vertices.map((vertex) => ({ ...vertex, point: transformPoint(vertex.point, transform) })) });
  return pair({ controlPoints: node.controlPoints }, { controlPoints: node.controlPoints.map((point) => transformPoint(point, transform)) });
}

function transformedAnnotationFields(
  node: AnnotationNode,
  transform: { translation: Vec2; rotationRadians: number; pivot: Vec2 },
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  if (node.type === 'text') return pair({ position: node.position, rotation: node.rotation }, { position: transformPoint(node.position, transform), rotation: node.rotation + transform.rotationRadians });
  if (node.type === 'dimension') return pair({ textPosition: node.textPosition, definitionPoints: node.definitionPoints }, { textPosition: transformPoint(node.textPosition, transform), definitionPoints: node.definitionPoints.map((point) => transformPoint(point, transform)) });
  if (node.type === 'leader') return pair({ points: node.points }, { points: node.points.map((point) => transformPoint(point, transform)) });
  if (node.type === 'centerline') return pair({ start: node.start, end: node.end }, { start: transformPoint(node.start, transform), end: transformPoint(node.end, transform) });
  return pair({ segments: node.segments }, { segments: node.segments.map((segment) => ({ start: transformPoint(segment.start, transform), end: transformPoint(segment.end, transform) })) });
}

function pair(before: Record<string, unknown>, after: Record<string, unknown>) {
  return { before: structuredClone(before), after };
}

function transformPoint(point: Vec2, transform: { translation: Vec2; rotationRadians: number; pivot: Vec2 }): Vec2 {
  const relative: Vec2 = [point[0] - transform.pivot[0], point[1] - transform.pivot[1]];
  const rotated = rotate(relative, transform.rotationRadians);
  return cleanPoint([
    rotated[0] + transform.pivot[0] + transform.translation[0],
    rotated[1] + transform.pivot[1] + transform.translation[1],
  ]);
}

function rotate(vector: Vec2, radians: number): Vec2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return cleanPoint([vector[0] * cosine - vector[1] * sine, vector[0] * sine + vector[1] * cosine]);
}

function cleanPoint(point: Vec2): Vec2 {
  return [clean(point[0]), clean(point[1])];
}

function clean(value: number): number {
  const result = Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12));
  return Object.is(result, -0) ? 0 : result;
}

function degrees(radians: number): number {
  return radians * 180 / Math.PI;
}

function dedupeUpdates(commands: DrawingTransactionCommand[]): DrawingTransactionCommand[] {
  const merged: DrawingTransactionCommand[] = [];
  const indexes = new Map<string, number>();
  for (const command of commands) {
    const id = 'id' in command ? command.id : command.node.id;
    const index = indexes.get(id);
    if (index === undefined) {
      indexes.set(id, merged.length);
      merged.push(structuredClone(command));
      continue;
    }
    const current = merged[index];
    if (current?.type !== 'node.update' || command.type !== 'node.update') {
      throw new Error('EDIT_OVERLAPPING_TRANSFORM_SCOPE');
    }
    const overlap = Object.keys(command.changes).some((field) => field in current.changes);
    if (overlap) throw new Error('EDIT_OVERLAPPING_TRANSFORM_SCOPE');
    merged[index] = {
      ...current,
      changes: { ...current.changes, ...structuredClone(command.changes) },
      expected: { ...current.expected, ...structuredClone(command.expected) },
    };
  }
  return merged;
}

function assertPreserved(
  before: DrawingDocument,
  after: DrawingDocument,
  scopes: SpatialEditProgram['preserveScopes'],
): void {
  for (const scope of scopes) {
    if (scope.kind !== 'node-field') continue;
    const beforeNode = findDrawingNode(before, scope.nodeId)?.node as unknown as Record<string, unknown> | undefined;
    const afterNode = findDrawingNode(after, scope.nodeId)?.node as unknown as Record<string, unknown> | undefined;
    if (!beforeNode || !afterNode) throw new Error('EDIT_PRESERVE_SCOPE_CHANGED');
    for (const field of scope.fields) {
      if (canonicalString(beforeNode[field]) !== canonicalString(afterNode[field])) {
        throw new Error('EDIT_PRESERVE_SCOPE_CHANGED');
      }
    }
  }
}

function evaluateProgram(
  document: DrawingDocument,
  program: SpatialEditProgram,
  grounding: GroundedEditTarget,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (grounding.sourceStatus !== 'confirmed') diagnostics.push({
    code: grounding.sourceStatus === 'provisional' ? 'SOURCE_PROVISIONAL' : 'SOURCE_CANDIDATE',
    severity: 'warning',
    message: 'The edit target is not backed by confirmed source geometry.',
  });
  for (const postcondition of program.postconditions) {
    if (postcondition.kind !== 'within_bounds') continue;
    const outside = document.geometry.some((node) => nodePoints(node).some(([x, y]) => (
      x < postcondition.bounds.minX || x > postcondition.bounds.maxX
      || y < postcondition.bounds.minY || y > postcondition.bounds.maxY
    )));
    if (outside) diagnostics.push({
      code: 'POSTCONDITION_OUT_OF_BOUNDS', severity: 'error', hard: true,
      message: 'Edited geometry exceeds the declared drawing bounds.',
    });
  }
  return diagnostics;
}

function nodePoints(node: GeometryNode): Vec2[] {
  if (node.type === 'point') return [[node.x, node.y]];
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'ray' || node.type === 'xline') return [node.origin];
  if (node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse') return [node.center];
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  return node.controlPoints;
}

function diffDocuments(before: DrawingDocument, after: DrawingDocument): ActualEffect {
  const beforeNodes = allNodes(before);
  const afterNodes = allNodes(after);
  const createdNodeIds = [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)).sort();
  const deletedNodeIds = [...beforeNodes.keys()].filter((id) => !afterNodes.has(id)).sort();
  const changedFields: Record<string, string[]> = {};
  const updatedNodeIds = [...beforeNodes.keys()].filter((id) => {
    const next = afterNodes.get(id);
    if (!next || canonicalString(beforeNodes.get(id)) === canonicalString(next)) return false;
    const previous = beforeNodes.get(id) as Record<string, unknown>;
    changedFields[id] = [...new Set([...Object.keys(previous), ...Object.keys(next)])]
      .filter((key) => canonicalString(previous[key]) !== canonicalString(next[key]))
      .sort();
    return true;
  }).sort();
  return { createdNodeIds, updatedNodeIds, deletedNodeIds, changedFields };
}

function allNodes(document: DrawingDocument): Map<string, Record<string, unknown>> {
  return new Map([
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => [node.id, node as unknown as Record<string, unknown>]));
}
