import { randomIdFactory, type IdFactory } from '../document/create';
import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '../document/types';
import type { DrawingPatchOperation } from '../patch/types';
import { inspectNode, queryDrawing } from '../query/query';
import { validateDrawingDocument } from '../validation/document';
import type {
  DrawingAssertion,
  DrawingCommand,
  DrawingCommandCompilation,
  DrawingCommandError,
} from './types';

type Plane = 'geometry' | 'annotation' | 'relation' | 'feature';

const PLANE_FOR_PREFIX: Record<Exclude<DrawingCommand['type'], 'history.revert'>, Plane> = {
  'geometry.create': 'geometry',
  'geometry.update': 'geometry',
  'geometry.delete': 'geometry',
  'annotation.create': 'annotation',
  'annotation.update': 'annotation',
  'annotation.delete': 'annotation',
  'relation.create': 'relation',
  'relation.update': 'relation',
  'relation.delete': 'relation',
  'feature.create': 'feature',
  'feature.update': 'feature',
  'feature.delete': 'feature',
};

export function compileDrawingCommands(
  document: DrawingDocument,
  commands: DrawingCommand[],
  idFactory: IdFactory = randomIdFactory,
): DrawingCommandCompilation {
  const known = collectKnownIds(document);
  const operations: DrawingPatchOperation[] = [];
  const preconditions: DrawingAssertion[] = [];

  for (const [commandIndex, command] of commands.entries()) {
    if (command.type === 'history.revert') {
      return failure(commandIndex, 'REPOSITORY_COMMAND_REQUIRED', '历史撤销命令必须由仓库解析');
    }

    const plane = PLANE_FOR_PREFIX[command.type];
    if ('value' in command) {
      const value = structuredClone(command.value) as Record<string, unknown>;
      const id = typeof value.id === 'string' ? value.id : idFactory.next(plane);
      if (hasAnyId(known, id)) {
        return failure(commandIndex, 'DUPLICATE_NODE_ID', `节点 ID ${id} 已存在`);
      }
      value.id = id;
      known[plane].add(id);
      operations.push(createOperation(plane, value));
      continue;
    }

    const id = command.id;
    if (!known[plane].has(id)) {
      return failure(commandIndex, 'NODE_NOT_FOUND', `${plane} 节点 ${id} 不存在`);
    }

    if (!('changes' in command)) {
      known[plane].delete(id);
      operations.push({ type: command.type, id } as DrawingPatchOperation);
      continue;
    }

    if ('type' in command.changes) {
      return failure(commandIndex, 'TYPE_CHANGE_REQUIRES_REPLACE', '改变节点类型必须使用删除后新建');
    }
    const immutable = Object.keys(command.changes).find((key) => key === 'id' || key === 'plane');
    if (immutable) {
      return failure(commandIndex, 'IMMUTABLE_FIELD', `字段 ${immutable} 不可修改`);
    }
    for (const [path, value] of Object.entries(command.expected ?? {})) {
      preconditions.push({ type: 'property.equals', nodeId: id, path, value: clone(value) });
    }
    operations.push({
      type: command.type,
      id,
      changes: clone(command.changes),
    } as DrawingPatchOperation);
  }

  return { success: true, patch: { operations }, preconditions };
}

export function evaluateAssertion(
  document: DrawingDocument,
  assertion: DrawingAssertion,
): boolean {
  switch (assertion.type) {
    case 'node.exists':
      return inspectNode(document, assertion.nodeId) !== null;
    case 'node.absent':
      return inspectNode(document, assertion.nodeId) === null;
    case 'property.equals': {
      const inspected = inspectNode(document, assertion.nodeId);
      if (!inspected) return false;
      return deepEqual(readPath(inspected.node, assertion.path), assertion.value);
    }
    case 'document.valid':
      return validateDrawingDocument(document).valid;
    case 'selection.count':
      return queryDrawing(document, assertion.selector).items.length === assertion.equals;
  }
}

function collectKnownIds(document: DrawingDocument): Record<Plane, Set<string>> {
  return {
    geometry: new Set(document.geometry.map((node) => node.id)),
    annotation: new Set(document.annotations.map((node) => node.id)),
    relation: new Set(document.relations.map((node) => node.id)),
    feature: new Set(document.features.map((node) => node.id)),
  };
}

function hasAnyId(known: Record<Plane, Set<string>>, id: string): boolean {
  return Object.values(known).some((ids) => ids.has(id));
}

function createOperation(plane: Plane, value: Record<string, unknown>): DrawingPatchOperation {
  switch (plane) {
    case 'geometry': return { type: 'geometry.add', value: value as unknown as GeometryNode };
    case 'annotation': return { type: 'annotation.add', value: value as unknown as AnnotationNode };
    case 'relation': return { type: 'relation.add', value: value as unknown as DrawingRelation };
    case 'feature': return { type: 'feature.add', value: value as unknown as SemanticFeature };
  }
}

function failure(
  commandIndex: number,
  code: string,
  message: string,
): DrawingCommandCompilation {
  const error: DrawingCommandError = { commandIndex, code, message };
  return { success: false, patch: { operations: [] }, errors: [error] };
}

function readPath(value: unknown, path: string): unknown {
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  return segments.reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && deepEqual(leftRecord[key], rightRecord[key]));
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
