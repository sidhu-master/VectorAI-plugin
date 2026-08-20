import {
  applyDrawingPatch,
  compileDrawingCommands,
  randomIdFactory,
  type DrawingCommand,
  type EvidenceId,
  type GeometryId,
  type IdFactory,
} from '../../../src/drawing/index.js';
import { transformGeometryNode } from '../drawing-spatial/geometry-transform.js';
import { roughGeometryBounds } from '../drawing-spatial/geometry-sampling.js';
import {
  resolveSpatialPoint,
  type SpatialPointResolutionContext,
} from './point-resolver.js';
import {
  SpatialProgramError,
  type SpatialEditProgram,
  type SpatialOperationReceipt,
  type SpatialProgramCompilation,
  type SpatialProgramDiagnostic,
} from './types.js';
import {
  compileConnectedTransform,
  type ConnectedTransformCompilation,
} from '../drawing-spatial-actions/connected-transform.js';

export function compileSpatialEditProgram(
  program: SpatialEditProgram,
  context: SpatialProgramCompilerContext,
): SpatialProgramCompilation {
  if (program.baseRevision !== context.revision) {
    throw new SpatialProgramError(
      'SPATIAL_PROGRAM_REVISION_MISMATCH',
      `Program revision ${program.baseRevision} does not match ${context.revision}`,
    );
  }
  const preserved = new Set(program.preserveNodeRefs);
  const conflict = program.operations
    .flatMap(operationTargetIds)
    .find((nodeId) => preserved.has(nodeId));
  if (conflict) {
    throw new SpatialProgramError(
      'SPATIAL_PROGRAM_PRESERVE_CONFLICT',
      `Program both preserves and modifies ${conflict}`,
    );
  }
  const connectedTranslations = planConnectedTranslations(program, context);
  const codeOwnedConnectorIds = new Set([...connectedTranslations.values()].flatMap((plan) => (
    plan.compilation.audit.connectorNodeIds
  )));
  let working = structuredClone(context.document);
  const commands: DrawingCommand[] = [];
  const receipts: SpatialOperationReceipt[] = [];

  for (const [operationIndex, operation] of program.operations.entries()) {
    const resolutionContext = { ...context, document: working };
    let operationCommands: DrawingCommand[];
    let affectedNodeIds: string[];
    let resolvedPoints: SpatialOperationReceipt['resolvedPoints'];
    if (operation.kind === 'set_endpoint' && codeOwnedConnectorIds.has(operation.nodeId)) {
      operationCommands = [];
      affectedNodeIds = [];
      resolvedPoints = [];
    } else if (operation.kind === 'translate' && connectedTranslations.has(operationIndex)) {
      const plan = connectedTranslations.get(operationIndex)!;
      const commandsByNodeId = new Map<string, DrawingCommand>();
      for (const command of plan.compilation.commands) {
        if ('id' in command) commandsByNodeId.set(command.id as string, command);
      }
      operationCommands = plan.orderedAffectedNodeIds.flatMap((nodeId) => {
        const command = commandsByNodeId.get(nodeId);
        return command ? [structuredClone(command)] : [];
      });
      affectedNodeIds = [...plan.orderedAffectedNodeIds];
      resolvedPoints = [
        { role: 'from', point: plan.from },
        { role: 'to', point: plan.to },
      ];
    } else if (operation.kind === 'translate') {
      const { from, to } = resolveTranslationBasis(operation, resolutionContext);
      const offset = [
        to[0] - from[0] + (operation.delta?.[0] ?? 0),
        to[1] - from[1] + (operation.delta?.[1] ?? 0),
      ] as const;
      operationCommands = operation.nodeIds.map<DrawingCommand>((nodeId) => {
        const node = requireGeometry(working, nodeId);
        const transformed = transformGeometryNode(node, { kind: 'translate', offset });
        return {
          type: 'geometry.update',
          id: node.id as GeometryId,
          changes: changedGeometryFields(
            node as unknown as Record<string, unknown>,
            transformed as unknown as Record<string, unknown>,
          ),
        };
      });
      affectedNodeIds = [...operation.nodeIds];
      resolvedPoints = [
        ...(operation.from ? [{ role: 'from', point: from }] : []),
        ...(operation.to ? [{ role: 'to', point: to }] : []),
        ...(operation.delta ? [{ role: 'delta', point: operation.delta }] : []),
      ];
    } else if (operation.kind === 'set_endpoint') {
      const point = resolveSpatialPoint(operation.point, resolutionContext);
      const node = requireGeometry(working, operation.nodeId);
      operationCommands = [{
        type: 'geometry.update',
        id: node.id as GeometryId,
        changes: endpointChanges(node, operation.endpoint, point),
      }];
      affectedNodeIds = [operation.nodeId];
      resolvedPoints = [{ role: operation.endpoint, point }];
    } else if (operation.kind === 'create_path') {
      const points = operation.points.map((point) => resolveSpatialPoint(point, resolutionContext));
      const nodeId = (
        operation.nodeId ?? (context.idFactory ?? randomIdFactory).next('geometry')
      ) as GeometryId;
      const quality = {
        status: (program.confidence ?? 1) < 0.6 ? 'candidate' as const : 'confirmed' as const,
        ...(program.confidence === undefined ? {} : { confidence: program.confidence }),
        evidenceRefs: program.evidenceRefs as EvidenceId[],
      };
      operationCommands = [{
        type: 'geometry.create',
        value: operation.geometry === 'line'
          ? {
              id: nodeId, type: 'line', visible: true, quality,
              start: points[0], end: points[1],
            }
          : {
              id: nodeId, type: 'polyline', visible: true, quality,
              vertices: points.map((point) => ({ point })), closed: operation.closed === true,
            },
      }];
      affectedNodeIds = [nodeId];
      resolvedPoints = points.map((point, index) => ({ role: `point:${index}`, point }));
    } else if (operation.kind === 'delete_nodes') {
      operation.nodeIds.forEach((nodeId) => requireGeometry(working, nodeId));
      operationCommands = operation.nodeIds.map((nodeId) => ({
        type: 'geometry.delete', id: nodeId as GeometryId,
      }));
      affectedNodeIds = [...operation.nodeIds];
      resolvedPoints = [];
    } else {
      const unsupported: never = operation;
      throw new SpatialProgramError(
        'SPATIAL_OPERATION_UNSUPPORTED',
        `Operation ${String(unsupported)} is not implemented`,
      );
    }
    working = applyCommands(working, operationCommands);
    commands.push(...operationCommands);
    receipts.push({
      operationIndex,
      kind: operation.kind,
      affectedNodeIds,
      resolvedPoints,
      commands: structuredClone(operationCommands),
    });
  }

  if (deepEqual(context.document, working)) {
    throw new SpatialProgramError(
      'SPATIAL_PROGRAM_INVALID',
      'Spatial edit program produced no Drawing IR change',
    );
  }

  const diagnostics = evaluatePostconditions(program, context.document, working, context);
  return { commands, receipts, diagnostics, document: working };
}

export interface SpatialProgramCompilerContext extends SpatialPointResolutionContext {
  idFactory?: IdFactory;
}

interface ConnectedTranslationPlan {
  compilation: ConnectedTransformCompilation;
  orderedAffectedNodeIds: string[];
  from: readonly [number, number];
  to: readonly [number, number];
}

function planConnectedTranslations(
  program: SpatialEditProgram,
  context: SpatialProgramCompilerContext,
): Map<number, ConnectedTranslationPlan> {
  const plans = new Map<number, ConnectedTranslationPlan>();
  for (const [operationIndex, operation] of program.operations.entries()) {
    if (operation.kind !== 'translate') continue;
    const carriers = operation.nodeIds.flatMap((nodeId) => {
      const node = context.document.geometry.find((item) => item.id === nodeId);
      return node?.type === 'circle' || node?.type === 'ellipse' ? [node] : [];
    });
    if (carriers.length !== 1) continue;
    const carrier = carriers[0];
    const { from, to } = resolveTranslationBasis(operation, context);
    const targetCenter = [
      carrier.center[0] + to[0] - from[0] + (operation.delta?.[0] ?? 0),
      carrier.center[1] + to[1] - from[1] + (operation.delta?.[1] ?? 0),
    ] as const;
    let compilation: ConnectedTransformCompilation;
    try {
      compilation = compileConnectedTransform({
        document: context.document,
        carrierNodeId: carrier.id,
        targetCenter,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CONNECTED_TRANSFORM_NO_EFFECT') continue;
      throw error;
    }
    if (compilation.audit.connectorNodeIds.length === 0) continue;
    const connectedScope = new Set([
      compilation.audit.carrierNodeId,
      ...compilation.audit.connectorNodeIds,
    ]);
    const unrelatedNodeIds = operation.nodeIds.filter((nodeId) => !connectedScope.has(nodeId));
    if (unrelatedNodeIds.length > 0) {
      throw new SpatialProgramError(
        'SPATIAL_PROGRAM_INVALID',
        `Connected carrier translation mixes unrelated nodes: ${unrelatedNodeIds.join(', ')}`,
      );
    }
    if (hasCompleteExplicitInterfacePlan({
      program,
      compilation,
      carrier,
      targetCenter,
      context,
    })) continue;
    const connectorIds = new Set(compilation.audit.connectorNodeIds);
    const explicitlyOrderedConnectors = program.operations.flatMap((candidate) => {
      if (candidate.kind === 'set_endpoint' && connectorIds.has(candidate.nodeId)) {
        return [candidate.nodeId];
      }
      if (candidate.kind === 'translate') {
        return candidate.nodeIds.filter((nodeId) => connectorIds.has(nodeId));
      }
      return [];
    });
    plans.set(operationIndex, {
      compilation,
      orderedAffectedNodeIds: [...new Set([
        compilation.audit.carrierNodeId,
        ...explicitlyOrderedConnectors,
        ...compilation.audit.connectorNodeIds,
      ])],
      from,
      to,
    });
  }
  return plans;
}

function resolveTranslationBasis(
  operation: Extract<SpatialEditProgram['operations'][number], { kind: 'translate' }>,
  context: SpatialPointResolutionContext,
): { from: readonly [number, number]; to: readonly [number, number] } {
  if (operation.from && operation.to) {
    return {
      from: resolveSpatialPoint(operation.from, context),
      to: resolveSpatialPoint(operation.to, context),
    };
  }
  return { from: [0, 0], to: [0, 0] };
}

function hasCompleteExplicitInterfacePlan(input: {
  program: SpatialEditProgram;
  compilation: ConnectedTransformCompilation;
  carrier: Extract<SpatialProgramCompilerContext['document']['geometry'][number], {
    type: 'circle' | 'ellipse';
  }>;
  targetCenter: readonly [number, number];
  context: SpatialProgramCompilerContext;
}): boolean {
  const tolerance = drawingScale(input.context.document) * 0.002;
  return input.compilation.audit.ports.every((port) => {
    const operation = input.program.operations.find((candidate) => (
      candidate.kind === 'set_endpoint'
      && candidate.nodeId === port.connectorNodeId
      && candidate.endpoint === port.endpointRole
    ));
    if (!operation || operation.kind !== 'set_endpoint') return false;
    const point = resolveSpatialPoint(operation.point, input.context);
    return carrierBoundaryError(input.carrier, input.targetCenter, point) <= tolerance;
  });
}

function carrierBoundaryError(
  carrier: Extract<SpatialProgramCompilerContext['document']['geometry'][number], {
    type: 'circle' | 'ellipse';
  }>,
  center: readonly [number, number],
  point: readonly [number, number],
): number {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  if (carrier.type === 'circle') return Math.abs(Math.hypot(dx, dy) - carrier.radius);
  const majorRadius = Math.hypot(carrier.majorAxis[0], carrier.majorAxis[1]);
  const minorRadius = majorRadius * carrier.ratio;
  if (majorRadius === 0 || minorRadius === 0) return Number.POSITIVE_INFINITY;
  const cosine = carrier.majorAxis[0] / majorRadius;
  const sine = carrier.majorAxis[1] / majorRadius;
  const localX = dx * cosine + dy * sine;
  const localY = -dx * sine + dy * cosine;
  const normalizedRadius = Math.hypot(localX / majorRadius, localY / minorRadius);
  return Math.abs(normalizedRadius - 1) * Math.min(majorRadius, minorRadius);
}

function evaluatePostconditions(
  program: SpatialEditProgram,
  before: SpatialPointResolutionContext['document'],
  after: SpatialPointResolutionContext['document'],
  context: SpatialPointResolutionContext,
): SpatialProgramDiagnostic[] {
  const scale = drawingScale(after);
  const resolutionContext = { ...context, document: after };
  return program.postconditions.map((condition) => {
    if (condition.kind === 'anchor_at' || condition.kind === 'anchors_coincident') {
      const firstRef = condition.kind === 'anchor_at' ? condition.anchor : condition.first;
      const secondRef = condition.kind === 'anchor_at' ? condition.point : condition.second;
      const first = resolveSpatialPoint(firstRef, resolutionContext);
      const second = resolveSpatialPoint(secondRef, resolutionContext);
      const measured = Math.hypot(first[0] - second[0], first[1] - second[1]);
      const tolerance = scale * (condition.toleranceRatio ?? 0.001);
      return {
        kind: condition.kind,
        status: measured <= tolerance ? 'passed' : 'failed',
        message: measured <= tolerance ? 'Anchors coincide' : 'Anchors do not coincide',
        measured,
        tolerance,
      };
    }
    if (condition.kind === 'nodes_unchanged') {
      const changed = condition.nodeIds.filter((nodeId) => (
        !deepEqual(readNode(before, nodeId), readNode(after, nodeId))
      ));
      return {
        kind: condition.kind,
        status: changed.length === 0 ? 'passed' : 'failed',
        message: changed.length === 0 ? 'Declared nodes are unchanged' : 'Declared nodes changed',
        nodeIds: changed,
      };
    }
    const node = after.geometry.find((item) => item.id === condition.nodeId);
    const closed = Boolean(node && (
      node.type === 'circle'
      || node.type === 'ellipse' && node.startParam === undefined && node.endParam === undefined
      || node.type === 'polyline' && node.closed
      || node.type === 'spline' && node.closed
    ));
    return {
      kind: condition.kind,
      status: closed ? 'passed' : 'failed',
      message: closed ? 'Path is closed' : 'Path is not closed',
      nodeIds: [condition.nodeId],
    };
  });
}

function drawingScale(document: SpatialPointResolutionContext['document']): number {
  const bounds = document.geometry
    .map(roughGeometryBounds)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (bounds.length === 0) return 1;
  const minX = Math.min(...bounds.map((item) => item.minX));
  const minY = Math.min(...bounds.map((item) => item.minY));
  const maxX = Math.max(...bounds.map((item) => item.maxX));
  const maxY = Math.max(...bounds.map((item) => item.maxY));
  return Math.max(1, Math.hypot(maxX - minX, maxY - minY));
}

function readNode(
  document: SpatialPointResolutionContext['document'],
  nodeId: string,
): unknown {
  return document.geometry.find((node) => node.id === nodeId)
    ?? document.annotations.find((node) => node.id === nodeId)
    ?? document.relations.find((node) => node.id === nodeId)
    ?? document.features.find((node) => node.id === nodeId)
    ?? null;
}

function operationTargetIds(operation: SpatialEditProgram['operations'][number]): string[] {
  switch (operation.kind) {
    case 'translate':
    case 'delete_nodes':
      return operation.nodeIds;
    case 'set_endpoint':
      return [operation.nodeId];
    case 'create_path':
      return operation.nodeId ? [operation.nodeId] : [];
  }
}

function requireGeometry(
  document: SpatialPointResolutionContext['document'],
  nodeId: string,
) {
  const node = document.geometry.find((item) => item.id === nodeId);
  if (!node) {
    throw new SpatialProgramError(
      'SPATIAL_REFERENCE_UNRESOLVED',
      `Geometry ${nodeId} does not exist`,
    );
  }
  return node;
}

function endpointChanges(
  node: ReturnType<typeof requireGeometry>,
  endpoint: 'start' | 'end',
  point: readonly [number, number],
): Record<string, unknown> {
  switch (node.type) {
    case 'line':
      return { [endpoint]: [...point] };
    case 'polyline': {
      if (node.closed || node.vertices.length < 2) return unsupportedEndpoint(node.id);
      const vertices = structuredClone(node.vertices);
      const index = endpoint === 'start' ? 0 : vertices.length - 1;
      vertices[index].point = [...point];
      return { vertices };
    }
    case 'spline': {
      if (node.closed || node.periodic || node.controlPoints.length < 2) {
        return unsupportedEndpoint(node.id);
      }
      const controlPoints = structuredClone(node.controlPoints);
      controlPoints[endpoint === 'start' ? 0 : controlPoints.length - 1] = [...point];
      return { controlPoints };
    }
    case 'arc': {
      const angle = clean(Math.atan2(point[1] - node.center[1], point[0] - node.center[0]) * 180 / Math.PI);
      return { [endpoint === 'start' ? 'startAngle' : 'endAngle']: angle };
    }
    default:
      return unsupportedEndpoint(node.id);
  }
}

function unsupportedEndpoint(nodeId: string): never {
  throw new SpatialProgramError(
    'SPATIAL_OPERATION_UNSUPPORTED',
    `Geometry ${nodeId} has no editable open endpoint`,
  );
}

function clean(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
}

function applyCommands(
  document: SpatialPointResolutionContext['document'],
  commands: DrawingCommand[],
): SpatialPointResolutionContext['document'] {
  const compilation = compileDrawingCommands(document, commands);
  if ('errors' in compilation) {
    throw new SpatialProgramError(
      'SPATIAL_OPERATION_UNSUPPORTED',
      compilation.errors[0]?.message ?? 'Drawing command compilation failed',
    );
  }
  const applied = applyDrawingPatch(document, compilation.patch);
  if ('errors' in applied) {
    throw new SpatialProgramError(
      'SPATIAL_OPERATION_UNSUPPORTED',
      applied.errors[0]?.message ?? 'Drawing patch application failed',
    );
  }
  return applied.document;
}

function changedGeometryFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (key === 'id' || key === 'type' || deepEqual(value, before[key])) continue;
    changes[key] = structuredClone(value);
  }
  return changes;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
