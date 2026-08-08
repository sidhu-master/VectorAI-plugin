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

    if (entity.confidence !== undefined
      && (!isValidNumber(entity.confidence) || entity.confidence < 0 || entity.confidence > 1)) {
      errors.push(`${prefix}: confidence 必须在 0-1 范围内`);
    }

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

      case 'ray':
      case 'xline':
        if (!isValidPoint(entity.origin)) errors.push(`${prefix}: origin 坐标无效`);
        if (!isUnitVector(entity.direction)) errors.push(`${prefix}: direction 必须是归一化非零向量`);
        break;

      case 'circle':
        if (!isValidPoint(entity.center)) errors.push(`${prefix}: center 坐标无效`);
        if (!isValidNumber(entity.radius)) {
          errors.push(`${prefix}: radius 无效`);
        } else if (entity.radius <= 0) {
          errors.push(`${prefix}: radius 必须大于 0，实际 ${entity.radius}`);
        }
        break;


      case 'arc':
        if (!isValidPoint(entity.center)) errors.push(`${prefix}: center 坐标无效`);
        if (!isValidNumber(entity.radius) || entity.radius <= 0) {
          errors.push(`${prefix}: radius 必须大于 0`);
        }
        if (!isNormalizedAngle(entity.startAngle)) errors.push(`${prefix}: startAngle 无效`);
        if (!isNormalizedAngle(entity.endAngle)) errors.push(`${prefix}: endAngle 无效`);
        if (typeof entity.counterClockwise !== 'boolean') {
          errors.push(`${prefix}: counterClockwise 必须是布尔值`);
        }
        break;

      case 'ellipse': {
        if (!isValidPoint(entity.center)) errors.push(`${prefix}: center 坐标无效`);
        const majorLength = isValidPoint(entity.majorAxis)
          ? Math.hypot(entity.majorAxis[0], entity.majorAxis[1])
          : 0;
        if (majorLength <= 0) errors.push(`${prefix}: majorAxis 必须是非零二维向量`);
        if (!isValidNumber(entity.ratio) || entity.ratio <= 0 || entity.ratio > 1) {
          errors.push(`${prefix}: ratio 必须在 (0, 1] 范围内`);
        }
        if ((entity.startParam === undefined) !== (entity.endParam === undefined)) {
          errors.push(`${prefix}: startParam 和 endParam 必须同时提供`);
        }
        if (entity.startParam !== undefined && !isNormalizedAngle(entity.startParam)) {
          errors.push(`${prefix}: startParam 无效`);
        }
        if (entity.endParam !== undefined && !isNormalizedAngle(entity.endParam)) {
          errors.push(`${prefix}: endParam 无效`);
        }
        break;
      }

      case 'polyline': {
        const minimum = entity.closed ? 3 : 2;
        if (typeof entity.closed !== 'boolean') errors.push(`${prefix}: closed 必须是布尔值`);
        if (!Array.isArray(entity.vertices) || entity.vertices.length < minimum) {
          errors.push(`${prefix}: vertices 至少需要 ${minimum} 个顶点`);
        } else {
          entity.vertices.forEach((vertex, vertexIndex) => {
            if (!isValidPoint(vertex.point)) {
              errors.push(`${prefix}: vertices[${vertexIndex}].point 无效`);
            }
            if (vertex.bulge !== undefined && !isValidNumber(vertex.bulge)) {
              errors.push(`${prefix}: vertices[${vertexIndex}].bulge 无效`);
            }
          });
        }
        break;
      }

      case 'spline':
        validateSpline(entity, prefix, errors);
        break;

      case 'text':
        if (!entity.content) errors.push(`${prefix}: content 不能为空`);
        if (!isValidPoint(entity.position)) errors.push(`${prefix}: position 无效`);
        if (!isValidNumber(entity.height) || entity.height <= 0) errors.push(`${prefix}: height 必须大于 0`);
        if (!isNormalizedAngle(entity.rotation)) errors.push(`${prefix}: rotation 无效`);
        if (entity.maxWidth !== undefined && (!isValidNumber(entity.maxWidth) || entity.maxWidth <= 0)) {
          errors.push(`${prefix}: maxWidth 必须大于 0`);
        }
        break;

      case 'dimension':
        validateDimensionShape(entity, prefix, errors);
        break;

      default:
        errors.push(`${prefix}: 未知实体类型`);
    }
  });

  model.entities.forEach((entity, index) => {
    if (entity.type !== 'dimension') return;
    const prefix = `entities[${index}] (dimension)`;
    for (const target of entity.targets) {
      if (!entityIds.has(target.entityId)) {
        errors.push(`${prefix}: target 引用了不存在的实体 ID "${target.entityId}"`);
      }
    }
    for (const candidate of entity.candidates ?? []) {
      for (const target of candidate.targets) {
        if (!entityIds.has(target.entityId)) {
          errors.push(`${prefix}: candidate 引用了不存在的实体 ID "${target.entityId}"`);
        }
      }
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

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function isValidPoint(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  return isValidNumber(value[0]) && isValidNumber(value[1]);
}

function isUnitVector(value: unknown): value is [number, number] {
  return isValidPoint(value) && Math.abs(Math.hypot(value[0], value[1]) - 1) < 1e-9;
}

function isNormalizedAngle(value: unknown): value is number {
  return isValidNumber(value) && value >= 0 && value < 360;
}

function validateSpline(
  entity: Extract<SpatialModel['entities'][number], { type: 'spline' }>,
  prefix: string,
  errors: string[],
): void {
  if (!Number.isInteger(entity.degree) || entity.degree < 1) {
    errors.push(`${prefix}: degree 必须是大于等于 1 的整数`);
  }
  if (!Array.isArray(entity.controlPoints) || !entity.controlPoints.every(isValidPoint)
    || entity.controlPoints.length < entity.degree + 1) {
    errors.push(`${prefix}: controlPoints 与 degree 不匹配`);
  }
  if (!Array.isArray(entity.knots)
    || !entity.knots.every(isValidNumber)
    || entity.knots.length !== entity.controlPoints.length + entity.degree + 1
    || !entity.knots.every((value, index) => index === 0 || value >= entity.knots[index - 1])) {
    errors.push(`${prefix}: knots 无效或非单调`);
  }
  if (entity.weights !== undefined && (entity.weights.length !== entity.controlPoints.length
    || !entity.weights.every((weight) => isValidNumber(weight) && weight > 0))) {
    errors.push(`${prefix}: weights 必须与控制点等长且全部大于 0`);
  }
  if (typeof entity.closed !== 'boolean') errors.push(`${prefix}: closed 必须是布尔值`);
  if (typeof entity.periodic !== 'boolean') errors.push(`${prefix}: periodic 必须是布尔值`);
  if (entity.periodic && !entity.closed) errors.push(`${prefix}: periodic 样条必须同时 closed`);
}

function validateDimensionShape(
  entity: Extract<SpatialModel['entities'][number], { type: 'dimension' }>,
  prefix: string,
  errors: string[],
): void {
  const minimumTargets = ['radius', 'diameter', 'arc-length'].includes(entity.dimensionKind) ? 1 : 2;
  if (entity.associationStatus === 'resolved' && entity.targets.length < minimumTargets) {
    errors.push(`${prefix}: resolved ${entity.dimensionKind} 至少需要 ${minimumTargets} 个 targets`);
  }
  if (entity.associationStatus === 'ambiguous' && (entity.candidates?.length ?? 0) < 2) {
    errors.push(`${prefix}: ambiguous dimension 至少需要两个 candidates`);
  }
  if (!isValidPoint(entity.textPosition)) errors.push(`${prefix}: textPosition 无效`);
  if (!Array.isArray(entity.definitionPoints) || !entity.definitionPoints.every(isValidPoint)) {
    errors.push(`${prefix}: definitionPoints 无效`);
  }
  entity.targets.forEach((target, index) => {
    if (!target || typeof target.entityId !== 'string' || !isValidAnchor(target.anchor)) {
      errors.push(`${prefix}: targets[${index}] anchor 无效`);
    }
  });
}

function isValidAnchor(anchor: unknown): boolean {
  if (!anchor || typeof anchor !== 'object') return false;
  const value = anchor as Record<string, unknown>;
  if (['start', 'end', 'center'].includes(value.kind as string)) return true;
  if (value.kind === 'vertex') return Number.isInteger(value.index) && (value.index as number) >= 0;
  if (value.kind === 'curve-parameter') return isValidNumber(value.parameter);
  if (value.kind === 'nearest') return isValidPoint(value.point);
  return false;
}
