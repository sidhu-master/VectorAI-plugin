import type { EntityAnchor } from '../../../src/core/types.js';
import type {
  DrawingRecordValidation,
  NormalizedImageBounds,
} from './types.js';

const GEOMETRY_TYPES = new Set([
  'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
]);
const ANNOTATION_KINDS = new Set([
  'text', 'linear', 'aligned', 'angular', 'radius', 'diameter', 'ordinate', 'arc-length',
]);
const VIEW_KINDS = new Set(['primary', 'section', 'detail', 'auxiliary', 'unknown']);
const ASSOCIATION_STATUSES = new Set(['resolved', 'ambiguous', 'conflict']);
const FORBIDDEN_EXACT_KEYS = new Set(['image', 'base64', 'prompt', 'authorization']);
const FORBIDDEN_KEY_FRAGMENTS = ['token', 'credential', 'apikey', 'password', 'secret'];

export function validateDrawingManifest(value: unknown): DrawingRecordValidation {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return invalid('manifest 必须是对象');
  collectForbiddenFields(record, '$', errors);
  if (!isNonEmptyString(record.runId)) errors.push('runId 必须是非空字符串');
  if (!Number.isInteger(record.page) || (record.page as number) < 1) {
    errors.push('page 必须是从 1 开始的整数');
  }
  if (record.unit !== undefined && !['mm', 'cm', 'm'].includes(record.unit as string)) {
    errors.push('unit 不受支持');
  }
  if (record.scale !== undefined && (!isFiniteNumber(record.scale) || record.scale <= 0)) {
    errors.push('scale 必须大于 0');
  }
  if (!Array.isArray(record.views)) {
    errors.push('views 必须是数组');
  } else {
    const ids = new Set<string>();
    record.views.forEach((view, index) => {
      const item = asRecord(view);
      if (!item) {
        errors.push(`views[${index}] 必须是对象`);
        return;
      }
      if (!isNonEmptyString(item.id)) errors.push(`views[${index}].id 无效`);
      else if (ids.has(item.id)) errors.push(`views 中存在重复 id "${item.id}"`);
      else ids.add(item.id);
      if (!VIEW_KINDS.has(item.kind as string)) errors.push(`views[${index}].kind 不受支持`);
      validateBounds(item.imageBounds, `views[${index}].imageBounds`, errors);
      validateConfidence(item.confidence, `views[${index}].confidence`, errors);
    });
  }
  if (!Array.isArray(record.warnings) || !record.warnings.every((item) => typeof item === 'string')) {
    errors.push('warnings 必须是字符串数组');
  }
  return result(errors);
}

export function validateGeometryObservation(value: unknown): DrawingRecordValidation {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return invalid('geometry observation 必须是对象');
  collectForbiddenFields(record, '$', errors);
  validateIdentity(record, errors);
  if (!GEOMETRY_TYPES.has(record.type as string)) errors.push('type 不是支持的二维几何图元');
  validateBounds(record.imageBounds, 'imageBounds', errors);
  if (!asRecord(record.measuredParams)) errors.push('measuredParams 必须是对象');
  validateConfidence(record.confidence, 'confidence', errors);
  return result(errors);
}

export function validateAnnotationObservation(value: unknown): DrawingRecordValidation {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return invalid('annotation observation 必须是对象');
  collectForbiddenFields(record, '$', errors);
  validateIdentity(record, errors);
  if (!ANNOTATION_KINDS.has(record.kind as string)) errors.push('kind 不是支持的文字或尺寸类型');
  if (typeof record.rawText !== 'string') errors.push('rawText 必须是字符串');
  if (record.value !== undefined && !isFiniteNumber(record.value)) errors.push('value 必须是有限数字');
  validateBounds(record.imageBounds, 'imageBounds', errors);
  if (!Array.isArray(record.arrowheads)
    || !record.arrowheads.every(isNormalizedPoint)) errors.push('arrowheads 必须是归一化坐标数组');
  validateConfidence(record.confidence, 'confidence', errors);
  return result(errors);
}

export function validateDimensionAssociation(value: unknown): DrawingRecordValidation {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return invalid('dimension association 必须是对象');
  collectForbiddenFields(record, '$', errors);
  if (!isNonEmptyString(record.annotationId)) errors.push('annotationId 必须是非空字符串');
  if (!Array.isArray(record.targets)) {
    errors.push('targets 必须是数组');
  } else {
    record.targets.forEach((target, index) => {
      const item = asRecord(target);
      if (!item || !isNonEmptyString(item.geometryObservationId)) {
        errors.push(`targets[${index}].geometryObservationId 无效`);
      }
      if (!item || !isAnchor(item.anchor)) errors.push(`targets[${index}].anchor 无效`);
    });
  }
  validateConfidence(record.score, 'score', errors);
  if (!Array.isArray(record.reasons) || !record.reasons.every((item) => typeof item === 'string')) {
    errors.push('reasons 必须是字符串数组');
  }
  if (!ASSOCIATION_STATUSES.has(record.status as string)) errors.push('status 不受支持');
  return result(errors);
}

function validateIdentity(record: Record<string, unknown>, errors: string[]): void {
  if (!isNonEmptyString(record.id)) errors.push('id 必须是非空字符串');
  if (!isNonEmptyString(record.viewId)) errors.push('viewId 必须是非空字符串');
}

function validateBounds(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
    errors.push(`${path} 必须是 [x,y,width,height]`);
    return;
  }
  const [x, y, width, height] = value as NormalizedImageBounds;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    errors.push(`${path} 必须位于 0-1 归一化图像范围内`);
  }
}

function validateConfidence(value: unknown, path: string, errors: string[]): void {
  if (!isFiniteNumber(value) || value < 0 || value > 1) errors.push(`${path} 必须在 0-1 范围内`);
}

function collectForbiddenFields(value: unknown, path: string, errors: string[], seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenFields(item, `${path}[${index}]`, errors, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_EXACT_KEYS.has(normalized)
      || FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
      errors.push(`${path}.${key}: 禁止持久化字段`);
    }
    collectForbiddenFields(nested, `${path}.${key}`, errors, seen);
  }
}

function isAnchor(value: unknown): value is EntityAnchor {
  const record = asRecord(value);
  if (!record) return false;
  if (['start', 'end', 'center'].includes(record.kind as string)) return true;
  if (record.kind === 'vertex') return Number.isInteger(record.index) && (record.index as number) >= 0;
  if (record.kind === 'curve-parameter') return isFiniteNumber(record.parameter);
  return record.kind === 'nearest' && isNormalizedPoint(record.point);
}

function isNormalizedPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber)
    && value[0] >= 0 && value[0] <= 1 && value[1] >= 0 && value[1] <= 1;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function result(errors: string[]): DrawingRecordValidation {
  return { valid: errors.length === 0, errors };
}

function invalid(error: string): DrawingRecordValidation {
  return { valid: false, errors: [error] };
}
