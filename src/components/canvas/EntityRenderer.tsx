import type { MouseEvent } from 'react';

import {
  compileAnnotationNode,
  compileDrawingNode,
} from '@/drawing';
import { type BBox, type DrawingRenderable } from './geometry';
import SceneNodeRenderer from './SceneNodeRenderer';

interface EntityRendererProps {
  entity: DrawingRenderable;
  scale: number;
  viewport: BBox;
  selected?: boolean;
  onSelect?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: MouseEvent<SVGGElement>) => void;
  provisional?: boolean;
  label?: string;
  perceptionStage?: 'outline' | 'detail' | 'annotation' | 'reconciliation' | 'edit-preview';
}

/**
 * Compatibility boundary for existing canvas callers. Geometry interpretation lives in
 * the shared SceneCompiler; this component only applies browser interaction and styles.
 */
export default function EntityRenderer({
  entity,
  scale,
  viewport,
  ...interaction
}: EntityRendererProps) {
  if (!entity.visible) return null;
  const primitives = entity.type === 'text' || entity.type === 'dimension'
    ? compileAnnotationNode(entity, scale)
    : compileDrawingNode(entity, { viewBounds: viewport });
  return (
    <SceneNodeRenderer
      nodeId={entity.id}
      primitives={primitives}
      scale={scale}
      {...interaction}
    />
  );
}
