import type { RevisionId } from '../../../src/drawing/index.js';
import {
  SpatialProgramError,
  type SpatialEditProgram,
  type SpatialPointRef,
} from './types.js';

const MAX_OPERATIONS = 64;
const MAX_TARGETS = 32;
const MAX_REFS_PER_FIELD = 128;
const MAX_POINT_REFS_PER_FIELD = 256;
const MAX_POSTCONDITIONS = 64;

export function parseSpatialEditProgram(value: unknown): SpatialEditProgram {
  if (!isRecord(value)
    || typeof value.baseRevision !== 'string'
    || typeof value.summary !== 'string'
    || typeof value.intent !== 'string'
    || !Array.isArray(value.targets)
    || !Array.isArray(value.operations)) {
    throw invalid('Spatial edit program is missing required fields');
  }
  if (value.targets.length === 0 || value.operations.length === 0) {
    throw invalid('Spatial edit program requires at least one target and operation');
  }
  if (value.targets.length > MAX_TARGETS) {
    throw invalid(`Spatial edit program exceeds ${MAX_TARGETS} targets`);
  }
  if (value.operations.length > MAX_OPERATIONS) {
    throw invalid(`Spatial edit program exceeds ${MAX_OPERATIONS} operations`);
  }
  if (Array.isArray(value.postconditions) && value.postconditions.length > MAX_POSTCONDITIONS) {
    throw invalid(`Spatial edit program exceeds ${MAX_POSTCONDITIONS} postconditions`);
  }
  return {
    baseRevision: value.baseRevision as RevisionId,
    ...(typeof value.replacesPreviewHandle === 'string'
      ? { replacesPreviewHandle: value.replacesPreviewHandle }
      : {}),
    summary: value.summary,
    intent: value.intent,
    targets: value.targets.map((target, index) => parseTarget(target, `targets[${index}]`)),
    operations: value.operations.map((operation, index) => (
      parseOperation(operation, `operations[${index}]`)
    )),
    preserveNodeRefs: optionalStringArray(value.preserveNodeRefs, 'preserveNodeRefs'),
    postconditions: Array.isArray(value.postconditions)
      ? value.postconditions.map((condition, index) => (
        parsePostcondition(condition, `postconditions[${index}]`)
      ))
      : [],
    evidenceRefs: optionalStringArray(value.evidenceRefs, 'evidenceRefs'),
    ...(typeof value.confidence === 'number' ? { confidence: value.confidence } : {}),
  };
}

function parseTarget(value: unknown, path: string): SpatialEditProgram['targets'][number] {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.description !== 'string') {
    throw invalid(`${path} must contain id and description`);
  }
  return {
    id: value.id,
    description: value.description,
    nodeRefs: requiredStringArray(value.nodeRefs, `${path}.nodeRefs`, MAX_REFS_PER_FIELD),
    ...(value.visualAnchors === undefined ? {} : {
      visualAnchors: pointArray(value.visualAnchors, `${path}.visualAnchors`, MAX_POINT_REFS_PER_FIELD),
    }),
    ...(value.interfaceRefs === undefined ? {} : {
      interfaceRefs: pointArray(value.interfaceRefs, `${path}.interfaceRefs`, MAX_POINT_REFS_PER_FIELD),
    }),
  };
}

function parseOperation(value: unknown, path: string): SpatialEditProgram['operations'][number] {
  if (!isRecord(value)) throw invalid(`${path} must be an operation`);
  switch (value.kind) {
    case 'translate': {
      const hasFrom = value.from !== undefined;
      const hasTo = value.to !== undefined;
      const delta = value.delta === undefined
        ? undefined
        : parseTranslationDelta(value.delta, `${path}.delta`);
      if (hasFrom !== hasTo || (!hasFrom && delta === undefined)) {
        throw invalid(`${path}.translate requires either delta or both from and to`);
      }
      return {
        kind: 'translate',
        nodeIds: nonEmptyStringArray(value.nodeIds, `${path}.nodeIds`, MAX_REFS_PER_FIELD),
        ...(hasFrom ? {
          from: parsePointRef(value.from, `${path}.from`),
          to: parsePointRef(value.to, `${path}.to`),
        } : {}),
        ...(delta === undefined ? {} : { delta }),
      };
    }
    case 'set_endpoint':
      if (typeof value.nodeId !== 'string'
        || (value.endpoint !== 'start' && value.endpoint !== 'end')) {
        throw invalid(`${path} requires a nodeId and start/end endpoint`);
      }
      return {
        kind: 'set_endpoint', nodeId: value.nodeId, endpoint: value.endpoint,
        point: parsePointRef(value.point, `${path}.point`),
      };
    case 'create_path': {
      if (value.geometry !== 'line' && value.geometry !== 'polyline') {
        throw invalid(`${path}.geometry must be line or polyline`);
      }
      const points = pointArray(value.points, `${path}.points`, MAX_POINT_REFS_PER_FIELD);
      if (points.length < 2 || (value.geometry === 'line' && points.length !== 2)) {
        throw invalid(`${path}.points has the wrong size for ${value.geometry}`);
      }
      if (value.nodeId !== undefined && typeof value.nodeId !== 'string') {
        throw invalid(`${path}.nodeId must be a string`);
      }
      const nodeId = typeof value.nodeId === 'string' ? value.nodeId : undefined;
      return {
        kind: 'create_path', geometry: value.geometry, points,
        ...(nodeId === undefined ? {} : { nodeId }),
        ...(value.geometry === 'polyline' ? { closed: value.closed === true } : {}),
      };
    }
    case 'delete_nodes':
      return {
        kind: 'delete_nodes',
        nodeIds: nonEmptyStringArray(value.nodeIds, `${path}.nodeIds`, MAX_REFS_PER_FIELD),
      };
    default:
      throw invalid(`${path} is not a supported operation`);
  }
}

function parseTranslationDelta(value: unknown, path: string): readonly [number, number] {
  if (Array.isArray(value)) return vec2(value, path);
  if (isRecord(value)) {
    return [finiteNumber(value.x, `${path}.x`), finiteNumber(value.y, `${path}.y`)];
  }
  throw invalid(`${path} must be [x, y] or {x, y}`);
}

function parsePostcondition(
  value: unknown,
  path: string,
): SpatialEditProgram['postconditions'][number] {
  if (!isRecord(value)) throw invalid(`${path} must be a postcondition`);
  switch (value.kind) {
    case 'anchor_at':
      return {
        kind: 'anchor_at',
        anchor: parsePointRef(value.anchor, `${path}.anchor`),
        point: parsePointRef(value.point, `${path}.point`),
        ...parseTolerance(value.toleranceRatio, path),
      };
    case 'anchors_coincident':
      return {
        kind: 'anchors_coincident',
        first: parsePointRef(value.first, `${path}.first`),
        second: parsePointRef(value.second, `${path}.second`),
        ...parseTolerance(value.toleranceRatio, path),
      };
    case 'nodes_unchanged':
      return { kind: 'nodes_unchanged', nodeIds: nonEmptyStringArray(value.nodeIds, `${path}.nodeIds`) };
    case 'path_closed':
      if (typeof value.nodeId !== 'string') throw invalid(`${path}.nodeId is required`);
      return { kind: 'path_closed', nodeId: value.nodeId };
    default:
      throw invalid(`${path} is not a supported postcondition`);
  }
}

function parsePointRef(value: unknown, path: string): SpatialPointRef {
  if (!isRecord(value)) throw invalid(`${path} must be a spatial point reference`);
  if (value.kind === 'observation') {
    const normalized = vec2(value.normalized, `${path}.normalized`);
    if (normalized.some((coordinate) => coordinate < 0 || coordinate > 1)) {
      throw invalid(`${path}.normalized must stay within [0, 1]`);
    }
    if (typeof value.observationId !== 'string' || value.observationId.length === 0) {
      throw invalid(`${path}.observationId is required`);
    }
    return { kind: 'observation', observationId: value.observationId, normalized };
  }
  if (value.kind === 'world') {
    if (typeof value.frameId !== 'string' || value.frameId.length === 0) {
      throw invalid(`${path}.frameId is required`);
    }
    return { kind: 'world', frameId: value.frameId, point: vec2(value.point, `${path}.point`) };
  }
  if (value.kind === 'node_anchor') {
    if (typeof value.nodeId !== 'string'
      || !['center', 'start', 'end', 'vertex'].includes(String(value.anchor))) {
      throw invalid(`${path} contains an invalid node anchor`);
    }
    const index = value.index === undefined ? undefined : finiteNumber(value.index, `${path}.index`);
    if (index !== undefined && (!Number.isInteger(index) || index < 0)) {
      throw invalid(`${path}.index must be a non-negative integer`);
    }
    return {
      kind: 'node_anchor', nodeId: value.nodeId,
      anchor: value.anchor as Extract<SpatialPointRef, { kind: 'node_anchor' }>['anchor'],
      ...(index === undefined ? {} : { index }),
    };
  }
  throw invalid(`${path}.kind is unsupported`);
}

function pointArray(value: unknown, path: string, maxItems: number): SpatialPointRef[] {
  if (!Array.isArray(value)) throw invalid(`${path} must be an array`);
  if (value.length > maxItems) throw invalid(`${path} exceeds ${maxItems} references`);
  return value.map((item, index) => parsePointRef(item, `${path}[${index}]`));
}

function optionalStringArray(value: unknown, path: string): string[] {
  return value === undefined ? [] : requiredStringArray(value, path, MAX_REFS_PER_FIELD);
}

function requiredStringArray(value: unknown, path: string, maxItems = MAX_REFS_PER_FIELD): string[] {
  if (!Array.isArray(value)
    || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw invalid(`${path} must contain strings`);
  }
  if (value.length > maxItems) throw invalid(`${path} exceeds ${maxItems} references`);
  return [...new Set(value as string[])];
}

function nonEmptyStringArray(value: unknown, path: string, maxItems = MAX_REFS_PER_FIELD): string[] {
  const result = requiredStringArray(value, path, maxItems);
  if (result.length === 0) throw invalid(`${path} must not be empty`);
  return result;
}

function parseTolerance(
  value: unknown,
  path: string,
): { toleranceRatio?: number } {
  if (value === undefined) return {};
  const toleranceRatio = finiteNumber(value, `${path}.toleranceRatio`);
  if (toleranceRatio <= 0 || toleranceRatio > 0.1) {
    throw invalid(`${path}.toleranceRatio must be within (0, 0.1]`);
  }
  return { toleranceRatio };
}

function vec2(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw invalid(`${path} must be a 2D point`);
  return [finiteNumber(value[0], `${path}[0]`), finiteNumber(value[1], `${path}[1]`)];
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(`${path} must be finite`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message: string): SpatialProgramError {
  return new SpatialProgramError('SPATIAL_PROGRAM_INVALID', message);
}
