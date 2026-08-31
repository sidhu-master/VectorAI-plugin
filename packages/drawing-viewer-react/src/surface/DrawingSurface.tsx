// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import type {
  DrawingWorkspaceDisplay,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import {
  useEffect,
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

type DragState =
  | { kind: 'pan'; start: Vec2; viewport: DrawingWorkspaceViewport; clearSelectionOnClick: boolean }
  | { kind: 'box'; start: Vec2; current: Vec2; additive: boolean };

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
  onMouseWorldChange?(point: Vec2 | null): void;
}

const DEFAULT_DISPLAY: DrawingWorkspaceDisplay = {
  grid: true,
  axes: true,
  relations: true,
  annotations: true,
  sourceUnderlay: false,
};

export function DrawingSurface({
  snapshot,
  viewport,
  selectedIds,
  attentionIds = [],
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
  onMouseWorldChange,
}: DrawingSurfaceProps) {
  const display = { ...DEFAULT_DISPLAY, ...displayInput };
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: Vec2; current: Vec2 } | null>(null);

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
    if (drag?.kind === 'pan') {
      onViewportChange({
        ...drag.viewport,
        x: drag.viewport.x + point[0] - drag.start[0],
        y: drag.viewport.y + point[1] - drag.start[1],
      });
    } else if (drag?.kind === 'box') {
      drag.current = point;
      setSelectionBox({ start: drag.start, current: point });
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
    }
  };

  const selectEntity = (id: string, event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    onSelectionChange(event.metaKey || event.ctrlKey
      ? selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]
      : [id]);
  };

  const handleNodeContextMenu = onNodeContextMenu === undefined
    ? undefined
    : (id: string, event: MouseEvent<SVGGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onNodeContextMenu(id, event);
    };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    dragRef.current = null;
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
          viewport={viewport}
          selectedIds={selectedIds}
          attentionIds={attentionIds}
          onSelect={selectEntity}
          onContextMenu={handleNodeContextMenu}
        /> : null}
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
