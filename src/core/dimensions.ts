import type {
  DimensionEntity,
  DimensionTarget,
  GeometryEntity,
  SpatialModel,
  Vec2,
} from './types';

export function computeDimensionValue(
  model: SpatialModel,
  dimension: DimensionEntity,
): number | undefined {
  const entities = dimension.targets
    .map((target) => model.entities.find((entity) => entity.id === target.entityId));
  if (entities.some((entity) => !entity)) return undefined;

  switch (dimension.dimensionKind) {
    case 'radius': return radiusOf(entities[0]);
    case 'diameter': {
      const radius = radiusOf(entities[0]);
      return radius === undefined ? undefined : radius * 2;
    }
    case 'arc-length': return entities[0]?.type === 'arc'
      ? entities[0].radius * arcSweepRadians(entities[0])
      : undefined;
    case 'angular': return angleBetween(entities[0], entities[1]);
    case 'linear':
    case 'aligned':
    case 'ordinate': {
      const points = dimension.targets.map((target) => resolveAnchor(model, target));
      if (!points[0] || !points[1]) return undefined;
      return distance(points[0], points[1]);
    }
  }
}

export function refreshDimensions(model: SpatialModel): SpatialModel {
  const refreshed = structuredClone(model);
  refreshed.entities = refreshed.entities.map((entity) => {
    if (entity.type !== 'dimension' || entity.associationStatus === 'ambiguous') return entity;
    const computedValue = computeDimensionValue(refreshed, entity);
    if (computedValue === undefined) return { ...entity, associationStatus: 'conflict' };
    return {
      ...entity,
      computedValue,
      associationStatus: valuesAgree(entity, computedValue) ? 'resolved' : 'conflict',
    };
  });
  return refreshed;
}

function valuesAgree(dimension: DimensionEntity, computedValue: number): boolean {
  if (dimension.observedValue === undefined) return true;
  const lower = dimension.observedValue + (dimension.tolerance?.lower ?? 0);
  const upper = dimension.observedValue + (dimension.tolerance?.upper ?? 0);
  return computedValue >= lower - 1e-9 && computedValue <= upper + 1e-9;
}

function resolveAnchor(model: SpatialModel, target: DimensionTarget): Vec2 | undefined {
  const entity = model.entities.find((item) => item.id === target.entityId);
  if (!entity) return undefined;
  const anchor = target.anchor;
  if (anchor.kind === 'nearest') return anchor.point;
  if (anchor.kind === 'vertex') {
    return entity.type === 'polyline' ? entity.vertices[anchor.index]?.point
      : entity.type === 'spline' ? entity.controlPoints[anchor.index] : undefined;
  }
  if (anchor.kind === 'curve-parameter') return curvePoint(entity, anchor.parameter);
  if (anchor.kind === 'center') return entityCenter(entity);
  if (anchor.kind === 'start') return entityEndpoint(entity, true);
  return entityEndpoint(entity, false);
}

function entityCenter(entity: GeometryEntity): Vec2 | undefined {
  switch (entity.type) {
    case 'point': return [entity.x, entity.y];
    case 'line': return midpoint(entity.start, entity.end);
    case 'ray':
    case 'xline': return entity.origin;
    case 'circle':
    case 'arc':
    case 'ellipse': return entity.center;
    default: return undefined;
  }
}

function entityEndpoint(entity: GeometryEntity, start: boolean): Vec2 | undefined {
  switch (entity.type) {
    case 'point': return [entity.x, entity.y];
    case 'line': return start ? entity.start : entity.end;
    case 'ray':
    case 'xline': return entity.origin;
    case 'arc': return curvePoint(entity, start ? entity.startAngle : entity.endAngle);
    case 'polyline': return entity.vertices[start ? 0 : entity.vertices.length - 1]?.point;
    case 'spline': return entity.controlPoints[start ? 0 : entity.controlPoints.length - 1];
    default: return undefined;
  }
}

function curvePoint(entity: GeometryEntity, parameter: number): Vec2 | undefined {
  const radians = parameter * Math.PI / 180;
  if (entity.type === 'circle' || entity.type === 'arc') {
    return [entity.center[0] + entity.radius * Math.cos(radians), entity.center[1] + entity.radius * Math.sin(radians)];
  }
  if (entity.type === 'line') {
    return [entity.start[0] + (entity.end[0] - entity.start[0]) * parameter,
      entity.start[1] + (entity.end[1] - entity.start[1]) * parameter];
  }
  return undefined;
}

function radiusOf(entity: GeometryEntity | undefined): number | undefined {
  return entity?.type === 'circle' || entity?.type === 'arc' ? entity.radius : undefined;
}

function angleBetween(first: GeometryEntity | undefined, second: GeometryEntity | undefined): number | undefined {
  const a = directionOf(first);
  const b = directionOf(second);
  if (!a || !b) return undefined;
  const cosine = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  return Math.acos(Math.abs(cosine)) * 180 / Math.PI;
}

function directionOf(entity: GeometryEntity | undefined): Vec2 | undefined {
  if (entity?.type === 'line') {
    const length = distance(entity.start, entity.end);
    return [(entity.end[0] - entity.start[0]) / length, (entity.end[1] - entity.start[1]) / length];
  }
  return entity?.type === 'ray' || entity?.type === 'xline' ? entity.direction : undefined;
}

function arcSweepRadians(entity: Extract<GeometryEntity, { type: 'arc' }>): number {
  const raw = entity.counterClockwise
    ? entity.endAngle - entity.startAngle
    : entity.startAngle - entity.endAngle;
  return (((raw % 360) + 360) % 360) * Math.PI / 180;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
