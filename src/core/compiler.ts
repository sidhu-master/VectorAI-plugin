/**
 * Compiler - 协议编译器
 *
 * 将通过 Intent Validator 的 Spatial Intent 编译为标准 SpatialModel。
 */

import type {
  CircleEntity,
  GeometryEntity,
  LineEntity,
  PointEntity,
  SpatialIntent,
  SpatialModel,
  SpatialRelation,
} from './types';
import { PROTOCOL_NAME, PROTOCOL_VERSION } from './types';

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * 编译 SpatialIntent 为 SpatialModel
 * 返回 { model, errors } - 即使有错误也返回部分编译结果
 */
export function compileIntent(intent: SpatialIntent): {
  model: SpatialModel;
  errors: string[];
} {
  const errors: string[] = [];
  const entities: GeometryEntity[] = [];
  const relations: SpatialRelation[] = [];

  // reference -> entity ID 的映射
  const refToId = new Map<string, string>();
  // index -> entity ID 的映射
  const indexToId = new Map<number, string>();

  // 1. 编译实体
  intent.objects.forEach((obj, index) => {
    // modify 操作时保留已有 ID，否则生成新 ID
    const id = obj.id || generateId('ent');
    let entity: GeometryEntity | null = null;

    switch (obj.type) {
      case 'point':
        entity = compilePoint(obj, id);
        break;
      case 'line':
        entity = compileLine(obj, id);
        break;
      case 'circle':
        entity = compileCircle(obj, id);
        break;
      default:
        errors.push(`objects[${index}]: 未知实体类型 "${obj.type}"`);
    }

    if (entity) {
      entities.push(entity);
      indexToId.set(index, id);
      if (obj.reference) {
        refToId.set(obj.reference, id);
      }
    }
  });

  // 2. 编译关系
  if (intent.relations) {
    intent.relations.forEach((rel, index) => {
      // 将索引或引用名转换为实体 ID
      const entityIds = rel.entities.map((ref) => {
        if (typeof ref === 'number') {
          return indexToId.get(ref) || null;
        }
        return refToId.get(ref) || null;
      });

      if (entityIds.some((id) => id === null)) {
        errors.push(`relations[${index}]: 无法解析部分实体引用`);
        return;
      }

      const constraint: SpatialRelation = {
        id: generateId('rel'),
        kind: rel.kind,
        entities: entityIds as string[],
        status: 'unsolved', // MVP 默认 unsolved
      };

      if (rel.value !== undefined) constraint.value = rel.value;
      if (rel.axis !== undefined) constraint.axis = rel.axis;
      if (rel.property !== undefined) constraint.property = rel.property;

      relations.push(constraint);
    });
  }

  const model: SpatialModel = {
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
    metadata: {
      unit: 'mm',
      createdBy: 'AI',
      timestamp: Date.now(),
    },
    entities,
    relations,
  };

  return { model, errors };
}

function getParam(params: Record<string, unknown>, key: string, aliases: string[] = []): unknown {
  if (key in params) return params[key];
  for (const alias of aliases) {
    if (alias in params) return params[alias];
  }
  return undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function asPoint(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = asNumber(value[0]);
  const y = asNumber(value[1]);
  if (x === null || y === null) return null;
  return [x, y];
}

function compilePoint(obj: { params: Record<string, unknown> }, id: string): PointEntity | null {
  const x = asNumber(getParam(obj.params, 'x'));
  const y = asNumber(getParam(obj.params, 'y'));
  if (x === null || y === null) return null;
  return { id, type: 'point', visible: true, x, y };
}

function compileLine(obj: { params: Record<string, unknown> }, id: string): LineEntity | null {
  const start = asPoint(getParam(obj.params, 'start'));
  const end = asPoint(getParam(obj.params, 'end'));
  if (!start || !end) return null;
  return { id, type: 'line', visible: true, start, end };
}

function compileCircle(obj: { params: Record<string, unknown> }, id: string): CircleEntity | null {
  const center = asPoint(getParam(obj.params, 'center', ['position', 'pos']));
  const radius = asNumber(getParam(obj.params, 'radius', ['r', 'diameter']));
  if (!center || radius === null) return null;
  // 如果是 diameter，转换为 radius
  const actualRadius = 'diameter' in obj.params && !('radius' in obj.params) && !('r' in obj.params)
    ? radius / 2
    : radius;
  return { id, type: 'circle', visible: true, center, radius: actualRadius };
}
