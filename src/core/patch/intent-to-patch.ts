import { compileIntent } from '../compiler';
import { validateIntent } from '../intent-validator';
import type { GeometryEntity, IntentObject, SpatialIntent, SpatialModel } from '../types';
import type { EntityPatch, SpatialOperation, SpatialPatch } from './types';

export function compileIntentToPatch(
  intent: SpatialIntent,
  currentModel: SpatialModel,
): { patch: SpatialPatch; errors: string[] } {
  if (intent.objects.length === 0 && (!intent.relations || intent.relations.length === 0)) {
    return { patch: { operations: [] }, errors: [] };
  }

  if (intent.operation === 'modify') {
    return compileModifyIntent(intent, currentModel);
  }

  const validation = validateIntent(intent);
  if (!validation.valid) return { patch: { operations: [] }, errors: validation.errors };

  const compiled = compileIntent(intent);
  if (compiled.errors.length > 0) return { patch: { operations: [] }, errors: compiled.errors };

  const additions: SpatialOperation[] = [
    ...compiled.model.entities.map((entity): SpatialOperation => ({ type: 'entity.add', entity })),
    ...compiled.model.relations.map((relation): SpatialOperation => ({ type: 'relation.add', relation })),
  ];

  if (intent.operation !== 'replace') {
    return { patch: { operations: additions }, errors: [] };
  }

  return {
    patch: {
      operations: [
        ...currentModel.relations.map((relation): SpatialOperation => ({
          type: 'relation.delete', relationId: relation.id,
        })),
        ...currentModel.entities.map((entity): SpatialOperation => ({
          type: 'entity.delete', entityId: entity.id,
        })),
        ...additions,
      ],
    },
    errors: [],
  };
}

function compileModifyIntent(
  intent: SpatialIntent,
  currentModel: SpatialModel,
): { patch: SpatialPatch; errors: string[] } {
  const errors: string[] = [];
  const hydratedObjects: IntentObject[] = [];

  for (const [index, object] of intent.objects.entries()) {
    if (!object.id) {
      errors.push(`objects[${index}]: modify 操作缺少实体 id`);
      continue;
    }
    const current = currentModel.entities.find((entity) => entity.id === object.id);
    if (!current) {
      errors.push(`objects[${index}]: 实体 "${object.id}" 不存在`);
      continue;
    }
    if (current.type !== object.type) {
      errors.push(`objects[${index}]: 不能将 ${current.type} 修改为 ${object.type}`);
      continue;
    }
    hydratedObjects.push({ ...object, params: { ...entityParams(current), ...object.params } });
  }

  if (errors.length > 0) return { patch: { operations: [] }, errors };

  const hydratedIntent: SpatialIntent = { ...intent, objects: hydratedObjects };
  const validation = validateIntent(hydratedIntent);
  if (!validation.valid) return { patch: { operations: [] }, errors: validation.errors };

  const compiled = compileIntent(hydratedIntent);
  if (compiled.errors.length > 0) return { patch: { operations: [] }, errors: compiled.errors };

  const operations: SpatialOperation[] = compiled.model.entities.map((entity) => {
    const current = currentModel.entities.find((item) => item.id === entity.id)!;
    return {
      type: 'entity.update',
      entityId: entity.id,
      changes: changedGeometry(current, entity),
    };
  });
  operations.push(...compiled.model.relations.map((relation): SpatialOperation => ({
    type: 'relation.add', relation,
  })));

  return { patch: { operations }, errors: [] };
}

function entityParams(entity: GeometryEntity): Record<string, unknown> {
  switch (entity.type) {
    case 'point': return { x: entity.x, y: entity.y };
    case 'line': return { start: entity.start, end: entity.end };
    case 'ray':
    case 'xline': return { origin: entity.origin, direction: entity.direction };
    case 'circle': return { center: entity.center, radius: entity.radius };
    case 'arc': return {
      center: entity.center,
      radius: entity.radius,
      startAngle: entity.startAngle,
      endAngle: entity.endAngle,
      counterClockwise: entity.counterClockwise,
    };
    case 'ellipse': return {
      center: entity.center,
      majorAxis: entity.majorAxis,
      ratio: entity.ratio,
      ...(entity.startParam === undefined ? {} : { startParam: entity.startParam }),
      ...(entity.endParam === undefined ? {} : { endParam: entity.endParam }),
    };
    case 'polyline': return { vertices: entity.vertices, closed: entity.closed };
    case 'spline': return {
      degree: entity.degree,
      controlPoints: entity.controlPoints,
      knots: entity.knots,
      ...(entity.weights === undefined ? {} : { weights: entity.weights }),
      closed: entity.closed,
      periodic: entity.periodic,
    };
    case 'text': return {
      content: entity.content, position: entity.position, height: entity.height,
      rotation: entity.rotation, alignment: entity.alignment,
      verticalAlignment: entity.verticalAlignment,
      ...(entity.maxWidth === undefined ? {} : { maxWidth: entity.maxWidth }),
    };
    case 'dimension': return {
      dimensionKind: entity.dimensionKind,
      associationStatus: entity.associationStatus,
      targets: entity.targets,
      ...(entity.candidates === undefined ? {} : { candidates: entity.candidates }),
      ...(entity.observedValue === undefined ? {} : { observedValue: entity.observedValue }),
      ...(entity.computedValue === undefined ? {} : { computedValue: entity.computedValue }),
      textPosition: entity.textPosition,
      definitionPoints: entity.definitionPoints,
    };
    default: return {};
  }
}

function changedGeometry(current: GeometryEntity, next: GeometryEntity): EntityPatch {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entityParams(next))) {
    if (JSON.stringify(value) !== JSON.stringify(entityParams(current)[key])) changes[key] = value;
  }
  return changes as EntityPatch;
}
