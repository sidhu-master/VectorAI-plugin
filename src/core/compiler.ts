/**
 * Compiler - 协议编译器
 *
 * 将通过 Intent Validator 的 Spatial Intent 编译为标准 SpatialModel。
 */

import type {
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  GeometryEntity,
  IntentObject,
  LineEntity,
  PointEntity,
  RayEntity,
  SpatialIntent,
  SpatialModel,
  SpatialRelation,
  XLineEntity,
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
    let supported = true;

    switch (obj.type) {
      case 'point':
        entity = compilePoint(obj, id);
        break;
      case 'line':
        entity = compileLine(obj, id);
        break;
      case 'ray':
        entity = compileRay(obj, id, 'ray');
        break;
      case 'xline':
        entity = compileRay(obj, id, 'xline');
        break;
      case 'circle':
        entity = compileCircle(obj, id);
        break;
      case 'arc':
        entity = compileArc(obj, id);
        break;
      case 'ellipse':
        entity = compileEllipse(obj, id);
        break;
      default:
        supported = false;
        errors.push(`objects[${index}]: 未知实体类型 "${obj.type}"`);
    }

    if (entity) {
      entities.push(entity);
      indexToId.set(index, id);
      if (obj.reference) {
        refToId.set(obj.reference, id);
      }
    } else if (supported) {
      errors.push(`objects[${index}] (${obj.type}): 参数无效`);
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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
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

type CompilableIntentObject = Pick<IntentObject, 'params' | 'confidence'>;

function baseEntity(
  obj: CompilableIntentObject,
  id: string,
): { id: string; visible: true; confidence?: number } {
  return obj.confidence === undefined
    ? { id, visible: true }
    : { id, visible: true, confidence: obj.confidence };
}

function compilePoint(obj: CompilableIntentObject, id: string): PointEntity | null {
  const x = asNumber(getParam(obj.params, 'x'));
  const y = asNumber(getParam(obj.params, 'y'));
  if (x === null || y === null) return null;
  return { ...baseEntity(obj, id), type: 'point', x, y };
}

function compileLine(obj: CompilableIntentObject, id: string): LineEntity | null {
  const start = asPoint(getParam(obj.params, 'start'));
  const end = asPoint(getParam(obj.params, 'end'));
  if (!start || !end) return null;
  return { ...baseEntity(obj, id), type: 'line', start, end };
}

function compileCircle(obj: CompilableIntentObject, id: string): CircleEntity | null {
  const center = asPoint(getParam(obj.params, 'center', ['position', 'pos']));
  const radius = asNumber(getParam(obj.params, 'radius', ['r', 'diameter']));
  if (!center || radius === null) return null;
  // 如果是 diameter，转换为 radius
  const actualRadius = 'diameter' in obj.params && !('radius' in obj.params) && !('r' in obj.params)
    ? radius / 2
    : radius;
  if (actualRadius <= 0) return null;
  return { ...baseEntity(obj, id), type: 'circle', center, radius: actualRadius };
}

function compileRay(
  obj: CompilableIntentObject,
  id: string,
  type: 'ray',
): RayEntity | null;
function compileRay(
  obj: CompilableIntentObject,
  id: string,
  type: 'xline',
): XLineEntity | null;
function compileRay(
  obj: CompilableIntentObject,
  id: string,
  type: 'ray' | 'xline',
): RayEntity | XLineEntity | null {
  const origin = asPoint(getParam(obj.params, 'origin', ['point', 'position', 'pos']));
  const direction = normalizeVector(asPoint(getParam(obj.params, 'direction', ['dir'])));
  if (!origin || !direction) return null;
  return { ...baseEntity(obj, id), type, origin, direction } as RayEntity | XLineEntity;
}

function compileArc(obj: CompilableIntentObject, id: string): ArcEntity | null {
  const center = asPoint(getParam(obj.params, 'center', ['position', 'pos']));
  const radiusValue = asNumber(getParam(obj.params, 'radius', ['r', 'diameter']));
  const startAngle = asNumber(getParam(obj.params, 'startAngle', ['start', 'startDeg']));
  const endAngle = asNumber(getParam(obj.params, 'endAngle', ['end', 'endDeg']));
  if (!center || radiusValue === null || startAngle === null || endAngle === null) return null;
  const radius = 'diameter' in obj.params && !('radius' in obj.params) && !('r' in obj.params)
    ? radiusValue / 2
    : radiusValue;
  if (radius <= 0) return null;
  const counterClockwise = typeof obj.params.counterClockwise === 'boolean'
    ? obj.params.counterClockwise
    : typeof obj.params.ccw === 'boolean'
      ? obj.params.ccw
      : typeof obj.params.clockwise === 'boolean'
        ? !obj.params.clockwise
        : true;
  return {
    ...baseEntity(obj, id),
    type: 'arc',
    center,
    radius,
    startAngle: normalizeAngle(startAngle),
    endAngle: normalizeAngle(endAngle),
    counterClockwise,
  };
}

function compileEllipse(obj: CompilableIntentObject, id: string): EllipseEntity | null {
  const center = asPoint(getParam(obj.params, 'center', ['position', 'pos']));
  const majorAxis = asPoint(getParam(obj.params, 'majorAxis', ['major']));
  const ratio = asNumber(getParam(obj.params, 'ratio'));
  if (!center || !majorAxis || ratio === null || ratio <= 0 || ratio > 1) return null;
  if (Math.hypot(majorAxis[0], majorAxis[1]) === 0) return null;
  const rawStart = getParam(obj.params, 'startParam', ['start']);
  const rawEnd = getParam(obj.params, 'endParam', ['end']);
  if ((rawStart === undefined) !== (rawEnd === undefined)) return null;
  const startParam = rawStart === undefined ? undefined : asNumber(rawStart);
  const endParam = rawEnd === undefined ? undefined : asNumber(rawEnd);
  if (startParam === null || endParam === null) return null;
  return {
    ...baseEntity(obj, id),
    type: 'ellipse',
    center,
    majorAxis,
    ratio,
    ...(startParam === undefined ? {} : { startParam: normalizeAngle(startParam) }),
    ...(endParam === undefined ? {} : { endParam: normalizeAngle(endParam) }),
  };
}

function normalizeVector(vector: [number, number] | null): [number, number] | null {
  if (!vector) return null;
  const length = Math.hypot(vector[0], vector[1]);
  if (length === 0) return null;
  return [vector[0] / length, vector[1] / length];
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
