/**
 * Geometry Validator - 几何验证器
 *
 * 校验编译后的 SpatialModel 几何合法性。
 */

import type { SpatialModel, ValidationResult } from './types';
import { RELATION_MIN_ENTITIES } from './types';

export function validateModel(model: SpatialModel): ValidationResult {
  const errors: string[] = [];

  // 检查协议头
  if (model.protocol !== 'VectorAI-Spatial') {
    errors.push(`协议标识错误: "${model.protocol}"，应为 "VectorAI-Spatial"`);
  }

  if (!model.version) {
    errors.push('缺少版本号');
  }

  if (!model.metadata) {
    errors.push('缺少 metadata');
  }

  // 检查实体
  const entityIds = new Set<string>();
  model.entities.forEach((entity, i) => {
    const prefix = `entities[${i}] (${entity.type})`;

    // 检查 ID 唯一性
    if (entityIds.has(entity.id)) {
      errors.push(`${prefix}: 重复的实体 ID "${entity.id}"`);
    }
    entityIds.add(entity.id);

    // 按类型校验
    switch (entity.type) {
      case 'point':
        if (!isValidNumber(entity.x)) errors.push(`${prefix}: x 坐标无效`);
        if (!isValidNumber(entity.y)) errors.push(`${prefix}: y 坐标无效`);
        break;

      case 'line':
        if (!isValidPoint(entity.start)) errors.push(`${prefix}: start 坐标无效`);
        if (!isValidPoint(entity.end)) errors.push(`${prefix}: end 坐标无效`);
        // 检查 start != end
        if (isValidPoint(entity.start) && isValidPoint(entity.end)) {
          if (entity.start[0] === entity.end[0] && entity.start[1] === entity.end[1]) {
            errors.push(`${prefix}: start 和 end 重合`);
          }
        }
        break;

      case 'circle':
        if (!isValidPoint(entity.center)) errors.push(`${prefix}: center 坐标无效`);
        if (!isValidNumber(entity.radius)) {
          errors.push(`${prefix}: radius 无效`);
        } else if (entity.radius <= 0) {
          errors.push(`${prefix}: radius 必须大于 0，实际 ${entity.radius}`);
        }
        break;

      default:
        errors.push(`${prefix}: 未知实体类型`);
    }
  });

  // 检查关系
  model.relations.forEach((rel, i) => {
    const prefix = `relations[${i}] (${rel.kind})`;

    // 检查关系 ID 唯一性（在关系范围内）
    // 检查实体引用存在
    rel.entities.forEach((entityId, j) => {
      if (!entityIds.has(entityId)) {
        errors.push(`${prefix}: 引用了不存在的实体 ID "${entityId}"`);
      }
    });

    // 检查实体数量
    const minEntities = RELATION_MIN_ENTITIES[rel.kind];
    if (minEntities && rel.entities.length < minEntities) {
      errors.push(`${prefix}: 至少需要 ${minEntities} 个实体，实际 ${rel.entities.length}`);
    }

    // 检查参数合法性
    if (rel.kind === 'distance') {
      if (rel.value === undefined) {
        errors.push(`${prefix}: distance 关系缺少 value`);
      } else if (rel.value < 0) {
        errors.push(`${prefix}: distance 不能为负数，实际 ${rel.value}`);
      }
    }

    if (rel.kind === 'radius') {
      if (rel.value === undefined) {
        errors.push(`${prefix}: radius 关系缺少 value`);
      } else if (rel.value <= 0) {
        errors.push(`${prefix}: radius 必须大于 0，实际 ${rel.value}`);
      }
    }

    if (rel.kind === 'angle') {
      if (rel.value === undefined) {
        errors.push(`${prefix}: angle 关系缺少 value`);
      }
    }

    if (rel.kind === 'equal' && !rel.property) {
      errors.push(`${prefix}: equal 关系缺少 property`);
    }

    if (rel.kind === 'symmetry' && !rel.axis) {
      errors.push(`${prefix}: symmetry 关系缺少 axis`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function isValidNumber(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function isValidPoint(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2) return false;
  return isValidNumber(value[0]) && isValidNumber(value[1]);
}
