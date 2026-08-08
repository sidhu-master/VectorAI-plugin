import type {
  AnnotationObservation,
  GeometryObservation,
  GlobalContour,
  NormalizedImageBounds,
} from './types.js';

export interface NumberedGlobalContours {
  contours: GlobalContour[];
  idMap: Record<string, string>;
}

export function numberGlobalContours(
  _runId: string,
  page: number,
  viewId: string,
  contours: GlobalContour[],
): NumberedGlobalContours {
  const ordered = structuredClone(contours).sort(compareContours);
  const idMap: Record<string, string> = {};
  const view = safeSegment(viewId);
  const numbered = ordered.map((contour, index) => {
    const id = `ctr_p${page}_${view}_${String(index + 1).padStart(4, '0')}`;
    idMap[contour.id] = id;
    return { ...contour, id };
  });
  return { contours: numbered, idMap };
}

export function numberRegionObservations(
  page: number,
  viewId: string,
  regionId: string,
  geometry: GeometryObservation[],
  annotations: AnnotationObservation[],
): { geometry: GeometryObservation[]; annotations: AnnotationObservation[] } {
  const stem = `p${page}_${safeSegment(viewId)}_${safeSegment(regionId)}`;
  const numberedGeometry = structuredClone(geometry).sort(compareObservations)
    .map((observation, index) => ({
      ...observation,
      id: `geo_${stem}_${String(index + 1).padStart(4, '0')}`,
      viewId,
    }));
  const counters = new Map<'txt' | 'dim', number>();
  const numberedAnnotations = structuredClone(annotations).sort(compareObservations)
    .map((annotation) => {
      const prefix = annotation.kind === 'text' ? 'txt' : 'dim';
      const index = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, index);
      return {
        ...annotation,
        id: `${prefix}_${stem}_${String(index).padStart(4, '0')}`,
        viewId,
      };
    });
  return { geometry: numberedGeometry, annotations: numberedAnnotations };
}

function compareContours(first: GlobalContour, second: GlobalContour): number {
  return first.imageBounds[1] - second.imageBounds[1]
    || first.imageBounds[0] - second.imageBounds[0]
    || first.geometryFamily.localeCompare(second.geometryFamily)
    || compareNumbers(first.imageBounds, second.imageBounds);
}

function compareObservations(
  first: { imageBounds: NormalizedImageBounds; type?: string; kind?: string },
  second: { imageBounds: NormalizedImageBounds; type?: string; kind?: string },
): number {
  return first.imageBounds[1] - second.imageBounds[1]
    || first.imageBounds[0] - second.imageBounds[0]
    || (first.type ?? first.kind ?? '').localeCompare(second.type ?? second.kind ?? '')
    || compareNumbers(first.imageBounds, second.imageBounds);
}

function compareNumbers(first: number[], second: number[]): number {
  for (let index = 0; index < Math.min(first.length, second.length); index += 1) {
    if (first[index] !== second[index]) return first[index] - second[index];
  }
  return first.length - second.length;
}

function safeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 48) || 'view';
}
