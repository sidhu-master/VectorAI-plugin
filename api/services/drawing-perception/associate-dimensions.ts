import type { EntityAnchor, Vec2 } from '../../../src/core/types.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  DimensionAssociationTarget,
  GeometryObservation,
} from './types.js';

export interface AssociationWeights {
  arrowContact: number;
  leaderIntersection: number;
  distance: number;
  direction: number;
  symbolCompatibility: number;
}

export interface AssociateDimensionsInput {
  annotations: AnnotationObservation[];
  geometry: GeometryObservation[];
  weights?: Partial<AssociationWeights>;
  ambiguityDelta?: number;
  conflictScore?: number;
}

interface ScoredCandidate {
  targets: DimensionAssociationTarget[];
  score: number;
  reasons: string[];
  key: string;
}

const DEFAULT_WEIGHTS: AssociationWeights = {
  arrowContact: 0.3,
  leaderIntersection: 0,
  distance: 0.3,
  direction: 0,
  symbolCompatibility: 0.4,
};

export function associateDimensions(input: AssociateDimensionsInput): DimensionAssociation[] {
  const weights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const ambiguityDelta = input.ambiguityDelta ?? 0.08;
  const conflictScore = input.conflictScore ?? 0.35;
  return input.annotations
    .filter((annotation) => annotation.kind !== 'text')
    .map((annotation) => {
      const compatible = input.geometry.filter((item) => item.viewId === annotation.viewId);
      const candidates = buildCandidates(annotation, compatible, weights)
        .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
      const best = candidates[0];
      if (!best || best.score < conflictScore) {
        return {
          annotationId: annotation.id, targets: [], score: best?.score ?? 0,
          reasons: best?.reasons ?? ['no-compatible-geometry'], status: 'conflict' as const,
          ...(candidates.length > 0 ? { candidates: candidates.slice(0, 2).map(stripKey) } : {}),
        };
      }
      const ambiguous = Boolean(candidates[1]
        && best.score - candidates[1].score < ambiguityDelta);
      return {
        annotationId: annotation.id,
        targets: ambiguous ? [] : best.targets,
        score: round(best.score),
        reasons: best.reasons,
        status: ambiguous ? 'ambiguous' as const : 'resolved' as const,
        ...(ambiguous ? { candidates: candidates.slice(0, 2).map(stripKey) } : {}),
      };
    });
}

function buildCandidates(
  annotation: AnnotationObservation,
  geometry: GeometryObservation[],
  weights: AssociationWeights,
): ScoredCandidate[] {
  if (annotation.kind === 'angular') {
    const linear = geometry.filter(isLinear);
    const pairs: ScoredCandidate[] = [];
    for (let first = 0; first < linear.length; first += 1) {
      for (let second = first + 1; second < linear.length; second += 1) {
        const items = [linear[first], linear[second]];
        pairs.push(scoreCandidate(annotation, items, [anchor('start'), anchor('start')], weights));
      }
    }
    return pairs;
  }

  return geometry.flatMap((item) => {
    if (annotation.kind === 'diameter' && item.type !== 'circle') return [];
    if (annotation.kind === 'radius' && item.type !== 'circle' && item.type !== 'arc') return [];
    if (annotation.kind === 'arc-length' && item.type !== 'arc') return [];
    if (['linear', 'aligned', 'ordinate'].includes(annotation.kind) && !isLinear(item)) return [];
    const anchors: EntityAnchor[] = ['diameter', 'radius', 'arc-length'].includes(annotation.kind)
      ? [anchor('center')]
      : [anchor('start'), anchor('end')];
    return [scoreCandidate(annotation, [item], anchors, weights)];
  });
}

function scoreCandidate(
  annotation: AnnotationObservation,
  items: GeometryObservation[],
  anchors: EntityAnchor[],
  weights: AssociationWeights,
): ScoredCandidate {
  const reasons = ['symbol-compatible'];
  const itemBounds = unionBounds(items.map((item) => item.imageBounds));
  const proximity = Math.max(0, 1 - distance(center(annotation.imageBounds), center(itemBounds)) / 0.5);
  if (proximity > 0) reasons.push('near-annotation');
  const contact = annotation.arrowheads.some((point) => distanceToBounds(point, itemBounds) <= 0.025) ? 1 : 0;
  if (contact) reasons.push('arrow-contact');
  const totalWeight = weights.symbolCompatibility + weights.distance + weights.arrowContact
    + weights.direction + weights.leaderIntersection;
  const raw = weights.symbolCompatibility + weights.distance * proximity + weights.arrowContact * contact;
  const targets = items.map((item, index) => ({
    geometryObservationId: item.id,
    anchor: anchors[index] ?? anchors[0],
  }));
  if (items.length === 1 && anchors.length === 2) {
    targets.push({ geometryObservationId: items[0].id, anchor: anchors[1] });
  }
  return {
    targets,
    score: totalWeight > 0 ? round(raw / totalWeight) : 0,
    reasons,
    key: targets.map((target) => target.geometryObservationId).join(','),
  };
}

function stripKey(candidate: ScoredCandidate) {
  return { targets: candidate.targets, score: candidate.score, reasons: candidate.reasons };
}

function isLinear(item: GeometryObservation): boolean {
  return item.type === 'line' || item.type === 'ray' || item.type === 'xline';
}

function anchor(kind: 'start' | 'end' | 'center'): EntityAnchor {
  return { kind };
}

function center(bounds: [number, number, number, number]): Vec2 {
  return [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
}

function unionBounds(bounds: Array<[number, number, number, number]>): [number, number, number, number] {
  const minX = Math.min(...bounds.map((item) => item[0]));
  const minY = Math.min(...bounds.map((item) => item[1]));
  const maxX = Math.max(...bounds.map((item) => item[0] + item[2]));
  const maxY = Math.max(...bounds.map((item) => item[1] + item[3]));
  return [minX, minY, maxX - minX, maxY - minY];
}

function distanceToBounds(point: Vec2, bounds: [number, number, number, number]): number {
  const dx = Math.max(bounds[0] - point[0], 0, point[0] - (bounds[0] + bounds[2]));
  const dy = Math.max(bounds[1] - point[1], 0, point[1] - (bounds[1] + bounds[3]));
  return Math.hypot(dx, dy);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
