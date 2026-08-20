import type { DrawingRenderable } from './geometry';

export function filterCanvasAnnotations<T extends DrawingRenderable>(
  entities: readonly T[],
  showAnnotations: boolean,
): T[] {
  return showAnnotations
    ? [...entities]
    : entities.filter((entity) => (
      entity.type !== 'text'
      && entity.type !== 'dimension'
      && entity.type !== 'leader'
      && entity.type !== 'centerline'
      && entity.type !== 'section-hatch'
    ));
}
