import type { GlobalContour } from './types.js';

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

function compareContours(first: GlobalContour, second: GlobalContour): number {
  return first.imageBounds[1] - second.imageBounds[1]
    || first.imageBounds[0] - second.imageBounds[0]
    || first.geometryFamily.localeCompare(second.geometryFamily)
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
