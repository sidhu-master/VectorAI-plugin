import { createHash } from 'node:crypto';
import type { Vec2 } from '../../../src/drawing/index.js';
import type { GeometryObservation } from './types.js';

export interface DrawingTopologyComponent {
  id: string;
  viewId: string;
  observationIds: string[];
  closed: boolean;
}

export interface DrawingTopology {
  components: DrawingTopologyComponent[];
}

export function buildDrawingTopology(
  observations: GeometryObservation[],
  endpointTolerance = 0.01,
): DrawingTopology {
  const sorted = [...observations].sort((a, b) => a.id.localeCompare(b.id));
  const parent = sorted.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  sorted.forEach((observation, index) => {
    for (let otherIndex = index + 1; otherIndex < sorted.length; otherIndex += 1) {
      const other = sorted[otherIndex];
      if (observation.viewId !== other.viewId) continue;
      if (touches(observation, other, endpointTolerance)) union(index, otherIndex);
    }
  });

  const groups = new Map<number, GeometryObservation[]>();
  sorted.forEach((observation, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), observation]);
  });
  const components = [...groups.values()].map((items): DrawingTopologyComponent => {
    const observationIds = items.map((item) => item.id).sort();
    const digest = createHash('sha256').update(`${items[0].viewId}:${observationIds.join(',')}`).digest('hex');
    return {
      id: `component_${digest.slice(0, 16)}`,
      viewId: items[0].viewId,
      observationIds,
      closed: isClosedComponent(items, endpointTolerance),
    };
  });
  components.sort((a, b) => a.id.localeCompare(b.id));
  return { components };
}

function touches(a: GeometryObservation, b: GeometryObservation, tolerance: number): boolean {
  const aEndpoints = endpoints(a);
  const bEndpoints = endpoints(b);
  return aEndpoints.some((first) => bEndpoints.some((second) => distance(first, second) <= tolerance));
}

function endpoints(observation: GeometryObservation): Vec2[] {
  const params = observation.measuredParams;
  switch (observation.type) {
    case 'point': return isPoint([params.x, params.y]) ? [[params.x as number, params.y as number]] : [];
    case 'line': return [params.start, params.end].filter(isPoint);
    case 'ray':
    case 'xline': return isPoint(params.origin) ? [params.origin] : [];
    case 'arc': return [params.start, params.end].filter(isPoint);
    case 'polyline': return Array.isArray(params.vertices)
      ? params.vertices.map((vertex) => Array.isArray(vertex) ? vertex : (vertex as { point?: unknown }).point)
        .filter(isPoint)
      : [];
    default: return [];
  }
}

function isClosedComponent(items: GeometryObservation[], tolerance: number): boolean {
  if (items.some((item) => item.type === 'circle' || item.type === 'ellipse'
    || (item.type === 'polyline' && item.measuredParams.closed === true))) return true;
  const allEndpoints = items.flatMap(endpoints);
  return items.length >= 3 && allEndpoints.length >= 6 && allEndpoints.every((point, index) =>
    allEndpoints.some((other, otherIndex) => otherIndex !== index && distance(point, other) <= tolerance));
}

function isPoint(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length >= 2
    && typeof value[0] === 'number' && Number.isFinite(value[0])
    && typeof value[1] === 'number' && Number.isFinite(value[1]);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
