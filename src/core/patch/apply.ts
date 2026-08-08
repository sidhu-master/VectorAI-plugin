import { cloneModel } from '../model';
import type { GeometryEntity, SpatialModel, SpatialRelation } from '../types';
import { validateModel } from '../validator';
import type { PatchError, SpatialOperation, SpatialPatch } from './types';
import { validatePatch } from './validate';

export type PatchApplyResult =
  | {
      success: true;
      model: SpatialModel;
      inversePatch: SpatialPatch;
    }
  | {
      success: false;
      model: SpatialModel;
      errors: PatchError[];
    };

export function applyPatch(model: SpatialModel, patch: SpatialPatch): PatchApplyResult {
  const patchValidation = validatePatch(patch, model);
  if (!patchValidation.valid) {
    return { success: false, model, errors: patchValidation.errors };
  }

  const working = cloneModel(model);
  const inverseOperations: SpatialOperation[] = [];

  for (const operation of patch.operations) {
    switch (operation.type) {
      case 'entity.add':
        working.entities.push(clone(operation.entity));
        inverseOperations.push({ type: 'entity.delete', entityId: operation.entity.id });
        break;

      case 'entity.update': {
        const index = working.entities.findIndex((entity) => entity.id === operation.entityId);
        const current = working.entities[index];
        const previous = pickFields(current, Object.keys(operation.changes));
        working.entities[index] = { ...current, ...clone(operation.changes) } as GeometryEntity;
        inverseOperations.push({
          type: 'entity.update',
          entityId: operation.entityId,
          changes: previous,
        });
        break;
      }

      case 'entity.delete': {
        const index = working.entities.findIndex((entity) => entity.id === operation.entityId);
        const [deleted] = working.entities.splice(index, 1);
        const attached = working.relations.filter((relation) => relation.entities.includes(operation.entityId));
        working.relations = working.relations.filter((relation) => !relation.entities.includes(operation.entityId));
        for (const relation of attached) {
          inverseOperations.push({ type: 'relation.add', relation: clone(relation) });
        }
        inverseOperations.push({ type: 'entity.add', entity: clone(deleted) });
        break;
      }

      case 'relation.add':
        working.relations.push(clone(operation.relation));
        inverseOperations.push({ type: 'relation.delete', relationId: operation.relation.id });
        break;

      case 'relation.update': {
        const index = working.relations.findIndex((relation) => relation.id === operation.relationId);
        const current = working.relations[index];
        const previous = pickRelationFields(current, Object.keys(operation.changes));
        working.relations[index] = { ...current, ...clone(operation.changes) };
        inverseOperations.push({
          type: 'relation.update',
          relationId: operation.relationId,
          changes: previous,
        });
        break;
      }

      case 'relation.delete': {
        const index = working.relations.findIndex((relation) => relation.id === operation.relationId);
        const [deleted] = working.relations.splice(index, 1);
        inverseOperations.push({ type: 'relation.add', relation: clone(deleted) });
        break;
      }
    }
  }

  const modelValidation = validateModel(working);
  if (!modelValidation.valid) {
    return {
      success: false,
      model,
      errors: modelValidation.errors.map((message) => ({
        operationIndex: patch.operations.length - 1,
        code: 'MODEL_INVALID',
        message,
      })),
    };
  }

  return {
    success: true,
    model: working,
    inversePatch: { operations: inverseOperations.reverse() },
  };
}

function pickFields(entity: GeometryEntity, keys: string[]): Record<string, unknown> {
  const source = entity as unknown as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, clone(source[key])])) as Record<string, unknown>;
}

function pickRelationFields(
  relation: SpatialRelation,
  keys: string[],
): Record<string, unknown> {
  const source = relation as unknown as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, clone(source[key])])) as Record<string, unknown>;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
