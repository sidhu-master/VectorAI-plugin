// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  Vec2,
} from '@vectorai/drawing-core';
import type { DrawingSourceRef, DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import { memo, useMemo, type MouseEvent, type ReactNode } from 'react';

import { CadGrid } from '../canvas/Grid';
import { EntityRenderer } from '../canvas/EntityRenderer';
import { SourceUnderlay } from '../canvas/SourceUnderlay';
import { ScreenSpaceLabel } from '../canvas/ScreenSpaceLabel';
import { isRasterDrawingSource } from '../canvas/source-types';
import { nodeBounds } from '../canvas/geometry';

export function GridLayer({ viewport }: { viewport: DrawingWorkspaceViewport }) {
  return <CadGrid viewport={viewport} showGrid showAxes={false} />;
}

export function AxesLayer({ viewport }: { viewport: DrawingWorkspaceViewport }) {
  return <CadGrid viewport={viewport} showGrid={false} showAxes />;
}

export const SourceLayer = memo(function SourceLayer({
  document,
  source,
  sourceUrl,
}: {
  document: DrawingDocument;
  source: DrawingSourceRef | undefined;
  sourceUrl: string | null;
}) {
  if (source === undefined || !isRasterDrawingSource(source) || sourceUrl === null) return null;
  return <SourceUnderlay
    source={source}
    resource={{ url: sourceUrl, dispose() {} }}
    document={document}
  />;
});

export interface EntityLayerProps<Node extends GeometryNode | AnnotationNode> {
  nodes: readonly Node[];
  viewport: DrawingWorkspaceViewport;
  selectedIds: readonly string[];
  attentionIds: readonly string[];
  onSelect(id: string, event: MouseEvent<SVGGElement>): void;
  onContextMenu?(id: string, event: MouseEvent<SVGGElement>): void;
}

export const GeometryLayer = memo(function GeometryLayer({
  nodes,
  viewport,
  selectedIds,
  attentionIds,
  onSelect,
  onContextMenu,
}: EntityLayerProps<GeometryNode>) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const attention = useMemo(() => new Set(attentionIds), [attentionIds]);
  return <g data-layer="geometry">{nodes.map((node) => (
    <EntityRenderer
      key={node.id}
      node={node}
      viewport={viewport}
      selected={selected.has(node.id)}
      aiGrounded={attention.has(node.id)}
      onSelect={(event) => onSelect(node.id, event)}
      onContextMenu={onContextMenu === undefined ? undefined : (event) => onContextMenu(node.id, event)}
    />
  ))}</g>;
});

export const AnnotationLayer = memo(function AnnotationLayer({
  nodes,
  viewport,
  selectedIds,
  attentionIds,
  onSelect,
  onContextMenu,
  onPointerDown,
  hiddenNodeId,
  renderAnnotation,
}: EntityLayerProps<AnnotationNode> & {
  onPointerDown?(node: Extract<AnnotationNode, { type: 'dimension' }>, event: MouseEvent<SVGGElement>): void;
  hiddenNodeId?: string;
  renderAnnotation?(node: AnnotationNode): ReactNode;
}) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const attention = useMemo(() => new Set(attentionIds), [attentionIds]);
  return <g data-layer="annotations">{nodes.map((node) => node.id === hiddenNodeId ? null : (
    <EntityRenderer
      key={node.id}
      node={node}
      content={renderAnnotation?.(node)}
      viewport={viewport}
      selected={selected.has(node.id)}
      aiGrounded={attention.has(node.id)}
      onSelect={(event) => onSelect(node.id, event)}
      onContextMenu={onContextMenu === undefined ? undefined : (event) => onContextMenu(node.id, event)}
      onTextPointerDown={node.type === 'dimension'
        && (node.dimensionKind === 'diameter' || node.dimensionKind === 'angular')
        && onPointerDown !== undefined
        ? (event) => onPointerDown(node, event)
        : undefined}
    />
  ))}</g>;
});

export const RelationLayer = memo(function RelationLayer({
  document,
  viewport,
}: {
  document: DrawingDocument;
  viewport: DrawingWorkspaceViewport;
}) {
  return <g className="vai-relations" data-layer="relations">{
    document.relations.filter((relation) => relation.visible && relation.plane !== 'topology')
      .flatMap((relation) => relationSegments(document, relation, viewport))
  }</g>;
});

export function SelectionLayer({
  box,
}: {
  box: { start: Vec2; current: Vec2 } | null;
}) {
  if (box === null) return null;
  return <rect
    data-selection-box="true"
    data-layer="selection"
    x={Math.min(box.start[0], box.current[0])}
    y={Math.min(box.start[1], box.current[1])}
    width={Math.abs(box.current[0] - box.start[0])}
    height={Math.abs(box.current[1] - box.start[1])}
    className="vai-canvas__selection-box"
    pointerEvents="none"
  />;
}

export function PreviewLayer({
  nodes,
  viewport,
  diff = 'updated',
}: {
  nodes: readonly (GeometryNode | AnnotationNode)[];
  viewport: DrawingWorkspaceViewport;
  diff?: 'created' | 'updated' | 'before' | 'deleted';
}) {
  return <g data-layer="preview">{nodes.map((node) => (
    <EntityRenderer
      key={node.id}
      node={node}
      viewport={viewport}
      selected={false}
      previewDiff={diff}
      onSelect={() => undefined}
    />
  ))}</g>;
}

function relationSegments(
  document: DrawingDocument,
  relation: DrawingRelation,
  viewport: DrawingWorkspaceViewport,
) {
  const centers = relationNodeIds(relation).flatMap((id): Vec2[] => {
    const node = [...document.geometry, ...document.annotations].find((candidate) => candidate.id === id);
    const bounds = node === undefined ? null : nodeBounds(node);
    return bounds === null ? [] : [[(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]];
  });
  return centers.slice(1).map((center, index) => {
    const start = centers[index];
    const midpoint: Vec2 = [(start[0] + center[0]) / 2, (start[1] + center[1]) / 2];
    return <g key={`${relation.id}:${index}`} data-relation-id={relation.id}>
      <line x1={start[0]} y1={start[1]} x2={center[0]} y2={center[1]} vectorEffect="non-scaling-stroke" />
      <ScreenSpaceLabel position={midpoint} viewportScale={viewport.scale} fontSize={10}>
        {relation.kind}
      </ScreenSpaceLabel>
    </g>;
  });
}

function relationNodeIds(relation: DrawingRelation): string[] {
  switch (relation.type) {
    case 'topology': return relation.nodeIds;
    case 'constraint': return relation.geometryIds;
    case 'association': return [relation.annotationId, ...relation.geometryIds];
    case 'semantic': return relation.nodeIds;
  }
}
