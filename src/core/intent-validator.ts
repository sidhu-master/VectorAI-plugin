/**
 * Intent Validator - 意图验证器
 *
 * 在 Compiler 前拦截意图层面的错误。
 * 检查 AI 输出是否像一个合理的空间意图请求。
 */

import type {
  EntityType,
  IntentObject,
  IntentRelation,
  RelationKind,
  SpatialIntent,
  ValidationResult,
} from './types';
import { RELATION_MIN_ENTITIES } from './types';

const VALID_ENTITY_TYPES: EntityType[] = ['point', 'line', 'circle'];

// 各实体类型所需的关键参数
const REQUIRED_PARAMS: Partial<Record<EntityType, string[]>> = {
  point: ['x', 'y'],
  line: ['start', 'end'],
  circle: ['center', 'radius'],
};

const VALID_RELATION_KINDS: RelationKind[] = [
  'coincident', 'horizontal', 'vertical', 'parallel', 'perpendicular',
  'tangent', 'distance', 'radius', 'angle', 'equal', 'symmetry',
];

export function validateIntent(intent: SpatialIntent): ValidationResult {
  const errors: string[] = [];

  if (!intent || !Array.isArray(intent.objects) || intent.objects.length === 0) {
    return { valid: false, errors: ['Spatial Intent 缺少 objects 数组或为空'] };
  }

  // 验证每个 IntentObject
  intent.objects.forEach((obj, i) => {
    const objErrors = validateIntentObject(obj, i);
    errors.push(...objErrors);
  });

  // 验证关系
  if (intent.relations) {
    intent.relations.forEach((rel, i) => {
      const relErrors = validateIntentRelation(rel, i);
      errors.push(...relErrors);
    });
  }

  // 验证置信度
  if (intent.confidence !== undefined) {
    if (typeof intent.confidence !== 'number' || intent.confidence < 0 || intent.confidence > 1) {
      errors.push('confidence 必须是 0-1 之间的数字');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateIntentObject(obj: IntentObject, index: number): string[] {
  const errors: string[] = [];
  const prefix = `objects[${index}]`;

  // 检查 type
  if (!obj.type || !VALID_ENTITY_TYPES.includes(obj.type)) {
    errors.push(`${prefix}: 未知实体类型 "${obj.type}"，支持的类型: ${VALID_ENTITY_TYPES.join(', ')}`);
    return errors;
  }

  // 检查 params 存在
  if (!obj.params || typeof obj.params !== 'object') {
    errors.push(`${prefix}: 缺少 params 对象`);
    return errors;
  }

  // 检查必需参数是否存在
  const required = REQUIRED_PARAMS[obj.type] ?? [];
  for (const key of required) {
    if (!(key in obj.params)) {
      errors.push(`${prefix} (${obj.type}): 缺少关键参数 "${key}"`);
    }
  }

  // 检查参数值是否为明显非法类型（如字符串 "large"）
  if (obj.type === 'circle' && 'radius' in obj.params) {
    const r = obj.params.radius;
    if (typeof r === 'string') {
      errors.push(`${prefix} (circle): radius 值 "${r}" 是字符串，应为数字（意图错误）`);
    }
  }

  return errors;
}

function validateIntentRelation(rel: IntentRelation, index: number): string[] {
  const errors: string[] = [];
  const prefix = `relations[${index}]`;

  // 检查 kind
  if (!rel.kind || !VALID_RELATION_KINDS.includes(rel.kind)) {
    errors.push(`${prefix}: 未知关系类型 "${rel.kind}"`);
    return errors;
  }

  // 检查 entities 数组
  if (!Array.isArray(rel.entities) || rel.entities.length === 0) {
    errors.push(`${prefix}: entities 数组为空`);
    return errors;
  }

  // 检查 entities 数量
  const minEntities = RELATION_MIN_ENTITIES[rel.kind];
  if (rel.entities.length < minEntities) {
    errors.push(`${prefix} (${rel.kind}): 至少需要 ${minEntities} 个实体，实际 ${rel.entities.length}`);
  }

  return errors;
}
