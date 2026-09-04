// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, Vec2 } from '@vectorai/drawing-core';
import type {
  DrawingWorkspaceDisplay,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';

import {
  fitViewportToDrawing,
  nodesInWorldBox,
  screenToWorld,
  zoomViewportAt,
  type Bounds2D,
} from '../canvas/geometry';
import {
  AnnotationLayer,
  GeometryLayer,
  RelationLayer,
  SelectionLayer,
  SourceLayer,
} from './layers';
import { CadGrid } from '../canvas/Grid';
import { EntityRenderer } from '../canvas/EntityRenderer';
import { projectAnnotationDrag } from '../canvas/annotation-drag';

type DragState =
  | { kind: 'pan'; start: Vec2; viewport: DrawingWorkspaceViewport; clearSelectionOnClick: boolean }
  | { kind: 'box'; start: Vec2; current: Vec2; additive: boolean }
  | { kind: 'annotation'; annotation: Extract<AnnotationNode, { type: 'dimension' }>; startWorld: Vec2; currentWorld: Vec2 };

export interface DrawingSurfaceAnnotationChanges {
  textPosition: Vec2;
  definitionPoints: Vec2[];
}

export interface DrawingSurfaceProps {
  snapshot: DrawingWorkspaceSnapshot;
  viewport: DrawingWorkspaceViewport;
  selectedIds: readonly string[];
  attentionIds?: readonly string[];
  display?: Partial<DrawingWorkspaceDisplay>;
  sourceUrl?: string | null;
  worldLayers?: ReactNode;
  screenLayers?: ReactNode;
  className?: string;
  fitToDrawingOnResize?: boolean | 'geometry';
  fitPadding?: number;
  onViewportChange(viewport: DrawingWorkspaceViewport): void;
  onSelectionChange(ids: readonly string[]): void;
  onNodeContextMenu?(nodeId: string, event: MouseEvent<SVGGElement>): void;
  onAnnotationChange?(nodeId: string, changes: DrawingSurfaceAnnotationChanges): boolean | void | Promise<boolean | void>;
  onInteractionActiveChange?(active: boolean): void;
  onMouseWorldChange?(point: Vec2 | null): void;
}

const DEFAULT_DISPLAY: DrawingWorkspaceDisplay = {
  grid: true,
  axes: true,
  relations: true,
  annotations: true,
  sourceUnderlay: false,
};
const EMPTY_IDS: readonly string[] = [];
const IGNORE_SELECTION = () => undefined;

export function DrawingSurface({
  snapshot,
  viewport,
  selectedIds,
  attentionIds = EMPTY_IDS,
  display: displayInput,
  sourceUrl = null,
  worldLayers,
  screenLayers,
  className = 'vai-canvas',
  fitToDrawingOnResize = false,
  fitPadding = 1.2,
  onViewportChange,
  onSelectionChange,
  onNodeContextMenu,
  onAnnotationChange,
  onInteractionActiveChange,
  onMouseWorldChange,
}: DrawingSurfaceProps) {
  const display = { ...DEFAULT_DISPLAY, ...displayInput };
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: Vec2; current: Vec2 } | null>(null);
  const [annotationDragPreview, setAnnotationDragPreview] = useState<AnnotationNode | null>(null);
  const annotationPreviewFrameRef = useRef<number | null>(null);
  const queuedAnnotationPreviewRef = useRef<AnnotationNode | null>(null);

  const cancelQueuedAnnotationPreview = useCallback(() => {
    if (annotationPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(annotationPreviewFrameRef.current);
      annotationPreviewFrameRef.current = null;
    }
    queuedAnnotationPreviewRef.current = null;
  }, []);
  const queueAnnotationPreview = useCallback((preview: AnnotationNode) => {
    queuedAnnotationPreviewRef.current = preview;
    if (annotationPreviewFrameRef.current !== null) return;
    annotationPreviewFrameRef.current = window.requestAnimationFrame(() => {
      annotationPreviewFrameRef.current = null;
      const queued = queuedAnnotationPreviewRef.current;
      queuedAnnotationPreviewRef.current = null;
      if (queued !== null) setAnnotationDragPreview(queued);
    });
  }, []);

  useEffect(() => cancelQueuedAnnotationPreview, [cancelQueuedAnnotationPreview]);

  useEffect(() => {
    if (annotationDragPreview?.type !== 'dimension') return;
    const persisted = snapshot.document.annotations.find(({ id }) => id === annotationDragPreview.id);
    if (persisted?.type === 'dimension'
      && JSON.stringify(persisted.textPosition) === JSON.stringify(annotationDragPreview.textPosition)
      && JSON.stringify(persisted.definitionPoints) === JSON.stringify(annotationDragPreview.definitionPoints)) {
      setAnnotationDragPreview(null);
    }
  }, [annotationDragPreview, snapshot.document.annotations]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const preventConversationScroll = (event: globalThis.WheelEvent) => event.preventDefault();
    element.addEventListener('wheel', preventConversationScroll, { passive: false });
    return () => element.removeEventListener('wheel', preventConversationScroll);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!(width > 0 && height > 0) || (viewport.width === width && viewport.height === height)) return;
      onViewportChange(
        fitToDrawingOnResize || viewport.width === 0 || viewport.height === 0
          ? fitViewportToDrawing(
            fitToDrawingOnResize === 'geometry'
              ? { ...snapshot.document, annotations: [] }
              : snapshot.document,
            { width, height },
            fitPadding,
          )
          : { ...viewport, width, height },
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitPadding, fitToDrawingOnResize, onViewportChange, snapshot.document, viewport]);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onViewportChange(zoomViewportAt(viewport, eventScreenPoint(event), event.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  const handleMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    const point = eventScreenPoint(event);
    const boxSelect = event.button === 0 && (event.metaKey || event.ctrlKey);
    if (event.button === 1 || (event.button === 0 && !boxSelect)) {
      event.preventDefault();
      dragRef.current = {
        kind: 'pan',
        start: point,
        viewport,
        clearSelectionOnClick: event.button === 0 && isBlankCanvasTarget(event),
      };
      return;
    }
    if (!boxSelect) return;
    dragRef.current = { kind: 'box', start: point, current: point, additive: true };
    setSelectionBox({ start: point, current: point });
  };

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const point = eventScreenPoint(event);
    onMouseWorldChange?.(screenToWorld(point, viewport));
    const drag = dragRef.current;
    if (drag !== null && event.buttons === 0) {
      dragRef.current = null;
      cancelQueuedAnnotationPreview();
      setAnnotationDragPreview(null);
      setSelectionBox(null);
      onInteractionActiveChange?.(false);
      return;
    }
    if (drag?.kind === 'pan') {
      onViewportChange({
        ...drag.viewport,
        x: drag.viewport.x + point[0] - drag.start[0],
        y: drag.viewport.y + point[1] - drag.start[1],
      });
    } else if (drag?.kind === 'box') {
      drag.current = point;
      setSelectionBox({ start: drag.start, current: point });
    } else if (drag?.kind === 'annotation') {
      drag.currentWorld = screenToWorld(point, viewport);
      queueAnnotationPreview(projectAnnotationDrag(drag.annotation, drag.startWorld, drag.currentWorld));
    }
  };

  const handleMouseUp = (event: MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'pan') {
      const point = eventScreenPoint(event);
      if (drag.clearSelectionOnClick && Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) < 3) {
        onSelectionChange([]);
      }
      return;
    }
    if (drag?.kind === 'box') {
      const point = eventScreenPoint(event);
      if (Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) >= 3) {
        const first = screenToWorld(drag.start, viewport);
        const second = screenToWorld(point, viewport);
        const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
        onSelectionChange(drag.additive ? [...new Set([...selectedIds, ...ids])] : ids);
      }
      setSelectionBox(null);
      return;
    }
    if (drag?.kind === 'annotation') {
      drag.currentWorld = screenToWorld(eventScreenPoint(event), viewport);
      const projected = projectAnnotationDrag(drag.annotation, drag.startWorld, drag.currentWorld);
      cancelQueuedAnnotationPreview();
      if (Math.hypot(
        drag.currentWorld[0] - drag.startWorld[0],
        drag.currentWorld[1] - drag.startWorld[1],
      ) > 0.001) {
        setAnnotationDragPreview(projected);
        const save = onAnnotationChange?.(drag.annotation.id, {
          textPosition: projected.textPosition,
          definitionPoints: projected.definitionPoints,
        });
        void Promise.resolve(save).then(
          (saved) => { if (saved === false) setAnnotationDragPreview(null); },
          () => setAnnotationDragPreview(null),
        ).finally(() => onInteractionActiveChange?.(false));
      } else {
        setAnnotationDragPreview(null);
        onInteractionActiveChange?.(false);
      }
    }
  };

  const handleAnnotationPointerDown = useCallback((
    annotation: Extract<AnnotationNode, { type: 'dimension' }>,
    event: MouseEvent<SVGGElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const world = screenToWorld(eventScreenPoint(event), viewport);
    const original = structuredClone(annotation);
    dragRef.current = { kind: 'annotation', annotation: original, startWorld: world, currentWorld: world };
    onInteractionActiveChange?.(true);
    setAnnotationDragPreview(original);
    onSelectionChange([annotation.id]);
  }, [cancelQueuedAnnotationPreview, onInteractionActiveChange, onSelectionChange, viewport]);

  const selectEntity = useCallback((id: string, event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    onSelectionChange(event.metaKey || event.ctrlKey
      ? selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]
      : [id]);
  }, [onSelectionChange, selectedIds]);

  const handleNodeContextMenu = useMemo(() => onNodeContextMenu === undefined
    ? undefined
    : (id: string, event: MouseEvent<SVGGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = null;
      onInteractionActiveChange?.(false);
      cancelQueuedAnnotationPreview();
      setSelectionBox(null);
      onNodeContextMenu(id, event);
    }, [cancelQueuedAnnotationPreview, onInteractionActiveChange, onNodeContextMenu]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    dragRef.current = null;
    onInteractionActiveChange?.(false);
    cancelQueuedAnnotationPreview();
    setAnnotationDragPreview(null);
    setSelectionBox(null);
    onSelectionChange([]);
  };

  return <div
    ref={containerRef}
    className={className}
    data-canvas-root="true"
    data-controlled-drawing-surface="true"
    role="application"
    aria-label="可交互图纸画布"
    tabIndex={0}
    onKeyDown={handleKeyDown}
  >
    <svg
      className="vai-canvas__svg"
      width="100%"
      height="100%"
      aria-label="图纸画布"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => onMouseWorldChange?.(null)}
    >
      <CadGrid viewport={viewport} showGrid={display.grid} showAxes={display.axes} />
      <rect data-canvas-background="true" width="100%" height="100%" fill="transparent" />
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`}>
        {display.sourceUnderlay ? <SourceLayer
          document={snapshot.document}
          source={snapshot.source}
          sourceUrl={sourceUrl}
        /> : null}
        {display.relations ? <RelationLayer document={snapshot.document} viewport={viewport} /> : null}
        <GeometryLayer
          nodes={snapshot.document.geometry}
          viewport={viewport}
          selectedIds={selectedIds}
          attentionIds={attentionIds}
          onSelect={selectEntity}
          onContextMenu={handleNodeContextMenu}
        />
        {display.annotations ? <AnnotationLayer
          nodes={snapshot.document.annotations}
          hiddenNodeId={annotationDragPreview?.id}
          viewport={viewport}
          selectedIds={selectedIds}
          attentionIds={attentionIds}
          onSelect={selectEntity}
          onContextMenu={handleNodeContextMenu}
          onPointerDown={onAnnotationChange === undefined ? undefined : handleAnnotationPointerDown}
        /> : null}
        {display.annotations && annotationDragPreview !== null ? <g data-layer="annotation-drag-preview" pointerEvents="none">
          <EntityRenderer
            node={annotationDragPreview}
            viewport={viewport}
            selected={selectedIds.includes(annotationDragPreview.id)}
            onSelect={IGNORE_SELECTION}
          />
        </g> : null}
        {worldLayers}
      </g>
      <SelectionLayer box={selectionBox} />
      {screenLayers}
    </svg>
  </div>;
}

function eventScreenPoint(event: MouseEvent<Element> | WheelEvent<Element>): Vec2 {
  const target = event.currentTarget;
  const svg = target.tagName.toLowerCase() === 'svg'
    ? target as SVGSVGElement
    : (target as SVGGraphicsElement).ownerSVGElement;
  const bounds = svg?.getBoundingClientRect();
  return [event.clientX - (bounds?.left ?? 0), event.clientY - (bounds?.top ?? 0)];
}

function isBlankCanvasTarget(event: MouseEvent<SVGSVGElement>): boolean {
  const target = event.target as Element & { dataset?: DOMStringMap };
  return target === event.currentTarget || target.dataset?.canvasBackground === 'true';
}

function normalizeBounds(first: Vec2, second: Vec2): Bounds2D {
  return {
    minX: Math.min(first[0], second[0]), minY: Math.min(first[1], second[1]),
    maxX: Math.max(first[0], second[0]), maxY: Math.max(first[1], second[1]),
  };
}
