import type {
  AnnotationNode,
  CenterlineAnnotation,
  DrawingRelation,
  GeometryNode,
  SectionHatchAnnotation,
} from '@/drawing';
import type { DrawingRenderable } from './geometry';

export function filterCanvasRelations(relations: readonly DrawingRelation[]): DrawingRelation[] {
  return relations.filter((relation) => relation.visible && relation.plane !== 'topology');
}

export function hasTextSelectableAnnotation(entity: DrawingRenderable): entity is AnnotationNode {
  return entity.type === 'text' || entity.type === 'dimension' || entity.type === 'leader';
}

export function isCanvasSelectable(entity: DrawingRenderable): entity is GeometryNode | AnnotationNode {
  return entity.type !== 'centerline'
    && entity.type !== 'section-hatch'
    || hasTextSelectableAnnotation(entity);
}

export type SelectableCanvasAnnotation = Exclude<AnnotationNode, CenterlineAnnotation | SectionHatchAnnotation>;
