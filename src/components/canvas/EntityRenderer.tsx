import type { MouseEvent } from 'react';

import {
  compileAnnotationNode,
  compileDrawingNode,
  type AnnotationNode,
} from '@/drawing';
import { type BBox, type DrawingRenderable } from './geometry';
import { applyDimensionTextDrag } from './annotation-text-utils';
import SceneNodeRenderer from './SceneNodeRenderer';

interface EntityRendererProps {
  entity: DrawingRenderable;
  scale: number;
  viewport: BBox;
  selected?: boolean;
  onSelect?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: MouseEvent<SVGGElement>) => void;
  annotationTextOnly?: boolean;
  textOffset?: readonly [number, number];
  provisional?: boolean;
  label?: string;
  perceptionStage?: 'outline' | 'detail' | 'annotation' | 'reconciliation' | 'edit-preview';
  revealIndex?: number;
  revealCount?: number;
}

/**
 * Compatibility boundary for existing canvas callers. Geometry interpretation lives in
 * the shared SceneCompiler; this component only applies browser interaction and styles.
 */
export default function EntityRenderer({
  entity,
  scale,
  viewport,
  textOffset,
  ...interaction
}: EntityRendererProps) {
  if (!entity.visible) return null;
  // 拖动/避让偏移不整体平移标注：尺寸标注按语义重算（延长线起点固定、
  // 标注线跟随文字），引线标注保持箭头端锚定在几何上，仅移动文字端。
  let renderEntity: DrawingRenderable = entity;
  let renderTextOffset = textOffset;
  const hasOffset = textOffset !== undefined && (textOffset[0] !== 0 || textOffset[1] !== 0);
  if (hasOffset && entity.type === 'dimension') {
    const next = applyDimensionTextDrag(entity, [
      entity.textPosition[0] + textOffset[0],
      entity.textPosition[1] + textOffset[1],
    ]);
    renderEntity = {
      ...entity,
      textPosition: next.textPosition,
      definitionPoints: next.definitionPoints,
    };
    renderTextOffset = undefined;
  } else if (hasOffset && entity.type === 'leader' && entity.points.length >= 2) {
    renderEntity = {
      ...entity,
      points: entity.points.map((point, index) => (index === 0
        ? point
        : [point[0] + textOffset[0], point[1] + textOffset[1]] as [number, number])),
    };
    renderTextOffset = undefined;
  }
  const primitives = isAnnotation(renderEntity)
    ? compileAnnotationNode(renderEntity, scale)
    : compileDrawingNode(renderEntity, { viewBounds: viewport });
  return (
    <SceneNodeRenderer
      nodeId={entity.id}
      primitives={primitives}
      scale={scale}
      {...interaction}
      textOffset={renderTextOffset}
    />
  );
}

function isAnnotation(entity: DrawingRenderable): entity is AnnotationNode {
  return entity.type === 'text'
    || entity.type === 'dimension'
    || entity.type === 'leader'
    || entity.type === 'centerline'
    || entity.type === 'section-hatch';
}
