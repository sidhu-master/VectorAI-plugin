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

const VALID_ENTITY_TYPES: EntityType[] = [
  'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
  'text', 'dimension',
];

// 各实体类型所需的关键参数
const REQUIRED_PARAMS: Partial<Record<EntityType, string[]>> = {
  point: ['x', 'y'],
  line: ['start', 'end'],
  circle: ['center', 'radius'],
  polyline: ['vertices'],
  spline: ['degree', 'controlPoints', 'knots'],
  text: ['content', 'position', 'height'],
  dimension: ['dimensionKind', 'associationStatus', 'targets', 'textPosition', 'definitionPoints'],
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

  validateRequiredParams(obj, prefix, errors);

  // 检查参数值是否为明显非法类型（如字符串 "large"）
  if (obj.type === 'circle' && 'radius' in obj.params) {
    const r = obj.params.radius;
    if (typeof r === 'string') {
      errors.push(`${prefix} (circle): radius 值 "${r}" 是字符串，应为数字（意图错误）`);
    }
  }

  if (obj.type === 'ray' || obj.type === 'xline') {
    const direction = getParam(obj.params, ['direction', 'dir']);
    if (!isNonZeroVector(direction)) {
      errors.push(`${prefix} (${obj.type}): direction 必须是非零二维向量`);
    }
  }

  if (obj.type === 'arc') {
    const radius = getParam(obj.params, ['radius', 'r', 'diameter']);
    if (!isPositiveNumber(radius)) {
      errors.push(`${prefix} (arc): radius 或 diameter 必须大于 0`);
    }
  }

  if (obj.type === 'ellipse') {
    if (!isNonZeroVector(getParam(obj.params, ['majorAxis', 'major']))) {
      errors.push(`${prefix} (ellipse): majorAxis 必须是非零二维向量`);
    }
    const ratio = getParam(obj.params, ['ratio']);
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
      errors.push(`${prefix} (ellipse): ratio 必须在 (0, 1] 范围内`);
    }
    const hasStart = hasParam(obj.params, ['startParam', 'start']);
    const hasEnd = hasParam(obj.params, ['endParam', 'end']);
    if (hasStart !== hasEnd) {
      errors.push(`${prefix} (ellipse): startParam 和 endParam 必须同时提供`);
    }
  }

  if (obj.type === 'polyline') validatePolylineParams(obj.params, prefix, errors);
  if (obj.type === 'spline') validateSplineParams(obj.params, prefix, errors);
  if (obj.type === 'text') {
    if (typeof obj.params.content !== 'string' || !obj.params.content) {
      errors.push(`${prefix} (text): content 必须是非空字符串`);
    }
    if (!isVector(obj.params.position)) errors.push(`${prefix} (text): position 无效`);
    if (!isPositiveNumber(obj.params.height)) errors.push(`${prefix} (text): height 必须大于 0`);
    if (obj.params.maxWidth !== undefined && !isPositiveNumber(obj.params.maxWidth)) {
      errors.push(`${prefix} (text): maxWidth 必须大于 0`);
    }
  }
  if (obj.type === 'dimension') {
    if (!Array.isArray(obj.params.targets)) errors.push(`${prefix} (dimension): targets 必须是数组`);
    if (!isVector(obj.params.textPosition)) errors.push(`${prefix} (dimension): textPosition 无效`);
    if (!Array.isArray(obj.params.definitionPoints)
      || !obj.params.definitionPoints.every(isVector)) {
      errors.push(`${prefix} (dimension): definitionPoints 无效`);
    }
  }

  if (obj.confidence !== undefined
    && (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1)) {
    errors.push(`${prefix}: confidence 必须是 0-1 之间的数字`);
  }

  return errors;
}

function validatePolylineParams(
  params: Record<string, unknown>,
  prefix: string,
  errors: string[],
): void {
  const vertices = params.vertices;
  const closed = params.closed ?? false;
  if (typeof closed !== 'boolean') errors.push(`${prefix} (polyline): closed 必须是布尔值`);
  if (!Array.isArray(vertices)) return;
  const minimum = closed === true ? 3 : 2;
  if (vertices.length < minimum) {
    errors.push(`${prefix} (polyline): ${closed === true ? '闭合' : '开放'}折线至少需要 ${minimum} 个顶点`);
  }
  vertices.forEach((vertex, index) => {
    const point = Array.isArray(vertex)
      ? vertex
      : vertex && typeof vertex === 'object'
        ? (vertex as Record<string, unknown>).point
        : undefined;
    if (!isVector(point)) errors.push(`${prefix} (polyline): vertices[${index}].point 无效`);
    if (vertex && typeof vertex === 'object' && !Array.isArray(vertex)) {
      const bulge = (vertex as Record<string, unknown>).bulge;
      if (bulge !== undefined && (typeof bulge !== 'number' || !Number.isFinite(bulge))) {
        errors.push(`${prefix} (polyline): vertices[${index}].bulge 必须是有限数字`);
      }
    }
  });
}

function validateSplineParams(
  params: Record<string, unknown>,
  prefix: string,
  errors: string[],
): void {
  const degree = params.degree;
  const controlPoints = params.controlPoints;
  const knots = params.knots;
  const weights = params.weights;
  const closed = params.closed ?? false;
  const periodic = params.periodic ?? false;

  if (!Number.isInteger(degree) || (degree as number) < 1) {
    errors.push(`${prefix} (spline): degree 必须是大于等于 1 的整数`);
  }
  if (!Array.isArray(controlPoints) || !controlPoints.every(isVector)) {
    errors.push(`${prefix} (spline): controlPoints 必须是二维点数组`);
  }
  if (Array.isArray(controlPoints) && Number.isInteger(degree)
    && controlPoints.length < (degree as number) + 1) {
    errors.push(`${prefix} (spline): controlPoints 数量必须大于 degree`);
  }
  if (!Array.isArray(knots) || !knots.every(isFiniteNumber)) {
    errors.push(`${prefix} (spline): knots 必须是有限数字数组`);
  } else {
    if (!isNonDecreasing(knots as number[])) {
      errors.push(`${prefix} (spline): knots 必须单调不减`);
    }
    if (Array.isArray(controlPoints) && Number.isInteger(degree)
      && knots.length !== controlPoints.length + (degree as number) + 1) {
      errors.push(`${prefix} (spline): knots 数量必须等于控制点数 + degree + 1`);
    }
  }
  if (weights !== undefined && (!Array.isArray(weights)
    || !weights.every((weight) => isFiniteNumber(weight) && weight > 0)
    || (Array.isArray(controlPoints) && weights.length !== controlPoints.length))) {
    errors.push(`${prefix} (spline): weights 必须与控制点等长且全部大于 0`);
  }
  if (typeof closed !== 'boolean') errors.push(`${prefix} (spline): closed 必须是布尔值`);
  if (typeof periodic !== 'boolean') errors.push(`${prefix} (spline): periodic 必须是布尔值`);
  if (periodic === true && closed !== true) {
    errors.push(`${prefix} (spline): periodic 样条必须同时 closed`);
  }
}

function validateRequiredParams(obj: IntentObject, prefix: string, errors: string[]): void {
  const aliases: Partial<Record<EntityType, string[][]>> = {
    ray: [['origin', 'point', 'position', 'pos'], ['direction', 'dir']],
    xline: [['origin', 'point', 'position', 'pos'], ['direction', 'dir']],
    arc: [
      ['center', 'position', 'pos'],
      ['radius', 'r', 'diameter'],
      ['startAngle', 'start', 'startDeg'],
      ['endAngle', 'end', 'endDeg'],
    ],
    ellipse: [['center', 'position', 'pos'], ['majorAxis', 'major'], ['ratio']],
  };
  const groups = aliases[obj.type]
    ?? (REQUIRED_PARAMS[obj.type] ?? []).map((key) => [key]);
  for (const group of groups) {
    if (!hasParam(obj.params, group)) {
      errors.push(`${prefix} (${obj.type}): 缺少关键参数 "${group[0]}"`);
    }
  }
}

function hasParam(params: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => key in params);
}

function getParam(params: Record<string, unknown>, keys: string[]): unknown {
  const key = keys.find((candidate) => candidate in params);
  return key === undefined ? undefined : params[key];
}

function isNonZeroVector(value: unknown): boolean {
  return isVector(value)
    && (value[0] !== 0 || value[1] !== 0);
}

function isVector(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1]);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonDecreasing(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value >= values[index - 1]);
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
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
