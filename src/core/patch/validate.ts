import type { SpatialModel } from '../types';
import type {
  EntityPatch,
  PatchError,
  PatchValidationResult,
  RelationPatch,
  SpatialPatch,
} from './types';

const IMMUTABLE_FIELDS = new Set(['id', 'type']);

export function validatePatch(
  patch: SpatialPatch,
  model: SpatialModel,
): PatchValidationResult {
  const errors: PatchError[] = [];
  const entityIds = new Set(model.entities.map((entity) => entity.id));
  const relationIds = new Set(model.relations.map((relation) => relation.id));

  if (!patch || !Array.isArray(patch.operations)) {
    return {
      valid: false,
      errors: [{ operationIndex: -1, code: 'INVALID_PATCH', message: 'SpatialPatch 缺少 operations 数组' }],
    };
  }

  patch.operations.forEach((operation, operationIndex) => {
    switch (operation.type) {
      case 'entity.add':
        if (entityIds.has(operation.entity.id)) {
          errors.push(error(operationIndex, 'ENTITY_ALREADY_EXISTS', `entity.add 的实体 "${operation.entity.id}" 已存在`));
        } else {
          entityIds.add(operation.entity.id);
        }
        break;

      case 'entity.update':
        if (!entityIds.has(operation.entityId)) {
          errors.push(error(operationIndex, 'ENTITY_NOT_FOUND', `entity.update 引用了不存在的实体 "${operation.entityId}"`));
        }
        validateChanges(operation.changes, operationIndex, 'ENTITY', errors);
        break;

      case 'entity.delete':
        if (!entityIds.delete(operation.entityId)) {
          errors.push(error(operationIndex, 'ENTITY_NOT_FOUND', `entity.delete 引用了不存在的实体 "${operation.entityId}"`));
        }
        break;

      case 'relation.add':
        if (relationIds.has(operation.relation.id)) {
          errors.push(error(operationIndex, 'RELATION_ALREADY_EXISTS', `relation.add 的关系 "${operation.relation.id}" 已存在`));
        } else {
          relationIds.add(operation.relation.id);
        }
        for (const entityId of operation.relation.entities) {
          if (!entityIds.has(entityId)) {
            errors.push(error(operationIndex, 'ENTITY_NOT_FOUND', `relation.add 引用了不存在的实体 "${entityId}"`));
          }
        }
        break;

      case 'relation.update':
        if (!relationIds.has(operation.relationId)) {
          errors.push(error(operationIndex, 'RELATION_NOT_FOUND', `relation.update 引用了不存在的关系 "${operation.relationId}"`));
        }
        validateChanges(operation.changes, operationIndex, 'RELATION', errors);
        break;

      case 'relation.delete':
        if (!relationIds.delete(operation.relationId)) {
          errors.push(error(operationIndex, 'RELATION_NOT_FOUND', `relation.delete 引用了不存在的关系 "${operation.relationId}"`));
        }
        break;

      default:
        errors.push(error(operationIndex, 'UNKNOWN_OPERATION', '未知的 SpatialPatch 操作'));
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateChanges(
  changes: EntityPatch | RelationPatch,
  operationIndex: number,
  target: 'ENTITY' | 'RELATION',
  errors: PatchError[],
): void {
  for (const [key, value] of Object.entries(changes)) {
    if (IMMUTABLE_FIELDS.has(key)) {
      errors.push(error(operationIndex, `IMMUTABLE_${target}_FIELD`, `${key} 不能通过局部更新修改`));
    }
    if (!hasFiniteNumbers(value)) {
      errors.push(error(operationIndex, 'INVALID_NUMBER', `${key} 包含非有限数字`));
    }
  }
}

function hasFiniteNumbers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasFiniteNumbers);
  return true;
}

function error(operationIndex: number, code: string, message: string): PatchError {
  return { operationIndex, code, message };
}
