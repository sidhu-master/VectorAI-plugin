// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, DrawingDocument, DrawingRelation, Vec2 } from '@vectorai/drawing-core';
import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from 'react';

import { useDrawingWorkspace } from '../hooks';
import { CadGrid } from './Grid';
import { EntityRenderer } from './EntityRenderer';
import { SourceUnderlay } from './SourceUnderlay';
import {
  fitViewportToDrawing,
  nodeBounds,
  nodesInWorldBox,
  screenToWorld,
  zoomViewportAt,
  type Bounds2D,
} from './geometry';

type DragState =
  | { kind: 'pan'; start: Vec2; viewport: DrawingWorkspaceViewport }
  | { kind: 'box'; start: Vec2; current: Vec2; additive: boolean }
  | { kind: 'annotation'; id: string; startWorld: Vec2; currentWorld: Vec2 };

export function Canvas() {
  const snapshot = useDrawingWorkspace((state) => state.snapshot);
  const sourceResource = useDrawingWorkspace((state) => state.sourceResource);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const display = useDrawingWorkspace((state) => state.display);
  const setViewport = useDrawingWorkspace((state) => state.setViewport);
  const setMouseWorld = useDrawingWorkspace((state) => state.setMouseWorld);
  const setSelection = useDrawingWorkspace((state) => state.setSelection);
  const moveAnnotationText = useDrawingWorkspace((state) => state.moveAnnotationText);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const spacePressed = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Vec2; current: Vec2 } | null>(null);

  const document = snapshot?.document;

  useEffect(() => {
    const element = containerRef.current;
    if (element === null || document === undefined || typeof ResizeObserver === 'undefined') return;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!(width > 0 && height > 0)) return;
      if (viewport.width === 0 || viewport.height === 0) {
        setViewport(fitViewportToDrawing(document, { width, height }));
      } else if (viewport.width !== width || viewport.height !== height) {
        setViewport({ ...viewport, width, height });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [document, setViewport, viewport]);

  if (snapshot === null) return null;

  const entities = [
    ...snapshot.document.geometry,
    ...(display.annotations ? snapshot.document.annotations : []),
  ];

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = eventScreenPoint(event);
    setViewport(zoomViewportAt(viewport, point, Math.exp(-event.deltaY * 0.0015)));
  };

  const handleBackgroundMouseDown = (event: MouseEvent<SVGRectElement>) => {
    const point = eventScreenPoint(event);
    if (event.button === 1 || (event.button === 0 && spacePressed.current)) {
      event.preventDefault();
      dragRef.current = { kind: 'pan', start: point, viewport };
      return;
    }
    if (event.button !== 0) return;
    dragRef.current = {
      kind: 'box', start: point, current: point,
      additive: event.metaKey || event.ctrlKey,
    };
    setSelectionBox({ start: point, current: point });
  };

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const point = eventScreenPoint(event);
    setMouseWorld(screenToWorld(point, viewport));
    const drag = dragRef.current;
    if (drag === null) return;
    if (drag.kind === 'pan') {
      setViewport({
        ...drag.viewport,
        x: drag.viewport.x + point[0] - drag.start[0],
        y: drag.viewport.y + point[1] - drag.start[1],
      });
      return;
    }
    if (drag.kind === 'box') {
      drag.current = point;
      setSelectionBox({ start: drag.start, current: point });
      return;
    }
    drag.currentWorld = screenToWorld(point, viewport);
  };

  const handleMouseUp = (event: MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag === null) return;
    if (drag.kind === 'box') {
      const point = eventScreenPoint(event);
      const distance = Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]);
      if (distance < 3) {
        if (!drag.additive) setSelection([]);
      } else {
        const first = screenToWorld(drag.start, viewport);
        const second = screenToWorld(point, viewport);
        const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
        setSelection(drag.additive ? [...selectedIds, ...ids] : ids);
      }
      setSelectionBox(null);
      return;
    }
    if (drag.kind === 'annotation') {
      if (Math.hypot(
        drag.currentWorld[0] - drag.startWorld[0],
        drag.currentWorld[1] - drag.startWorld[1],
      ) > 0.001) {
        void moveAnnotationText(drag.id, drag.currentWorld);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Space') {
      spacePressed.current = true;
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      dragRef.current = null;
      setSelectionBox(null);
      setSelection([]);
    }
  };

  const handleEntitySelect = (id: string, event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey) {
      setSelection(selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]);
    } else {
      setSelection([id]);
    }
  };

  const handleAnnotationPointerDown = (annotation: AnnotationNode, event: MouseEvent<SVGGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = eventScreenPoint(event);
    const world = screenToWorld(point, viewport);
    dragRef.current = { kind: 'annotation', id: annotation.id, startWorld: world, currentWorld: world };
    setSelection([annotation.id]);
  };

  return (
    <div
      ref={containerRef}
      className="vai-canvas"
      data-canvas-root="true"
      role="application"
      aria-label="可交互图纸画布"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => { if (event.code === 'Space') spacePressed.current = false; }}
    >
      <svg
        className="vai-canvas__svg"
        width="100%"
        height="100%"
        aria-label="图纸画布"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setMouseWorld(null)}
        onDoubleClick={() => setViewport(fitViewportToDrawing(snapshot.document, viewport))}
      >
        <CadGrid viewport={viewport} showGrid={display.grid} showAxes={display.axes} />
        <rect
          data-canvas-background="true"
          width="100%"
          height="100%"
          fill="transparent"
          onMouseDown={handleBackgroundMouseDown}
        />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`}>
          {display.sourceUnderlay && snapshot.source !== undefined && sourceResource !== null ? (
            <SourceUnderlay source={snapshot.source} resource={sourceResource} />
          ) : null}
          {display.relations ? <RelationLayer document={snapshot.document} viewport={viewport} /> : null}
          {entities.map((node) => (
            <EntityRenderer
              key={node.id}
              node={node}
              viewport={viewport}
              selected={selectedIds.includes(node.id)}
              onSelect={(event) => handleEntitySelect(node.id, event)}
              onTextPointerDown={node.type === 'text' || node.type === 'dimension'
                ? (event) => handleAnnotationPointerDown(node, event)
                : undefined}
            />
          ))}
        </g>
        {selectionBox === null ? null : <SelectionBox box={selectionBox} />}
      </svg>
    </div>
  );
}

function RelationLayer({
  document,
  viewport,
}: {
  document: DrawingDocument;
  viewport: DrawingWorkspaceViewport;
}) {
  return (
    <g className="vai-relations">
      {document.relations.filter((relation) => relation.visible).flatMap((relation) => {
        const centers = relationNodeIds(relation).flatMap((id): Vec2[] => {
          const node = [...document.geometry, ...document.annotations].find((candidate) => candidate.id === id);
          const bounds = node === undefined ? null : nodeBounds(node);
          return bounds === null ? [] : [[(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]];
        });
        return centers.slice(1).map((center, index) => {
          const start = centers[index];
          const midpoint: Vec2 = [(start[0] + center[0]) / 2, (start[1] + center[1]) / 2];
          return (
            <g key={`${relation.id}:${index}`} data-relation-id={relation.id}>
              <line x1={start[0]} y1={start[1]} x2={center[0]} y2={center[1]} vectorEffect="non-scaling-stroke" />
              <g transform={`translate(${midpoint[0]} ${midpoint[1]}) scale(1 -1)`}>
                <text fontSize={10 / Math.max(viewport.scale, 0.001)} textAnchor="middle">{relation.kind}</text>
              </g>
            </g>
          );
        });
      })}
    </g>
  );
}

function SelectionBox({ box }: { box: { start: Vec2; current: Vec2 } }) {
  const x = Math.min(box.start[0], box.current[0]);
  const y = Math.min(box.start[1], box.current[1]);
  return (
    <rect
      data-selection-box="true"
      x={x}
      y={y}
      width={Math.abs(box.current[0] - box.start[0])}
      height={Math.abs(box.current[1] - box.start[1])}
      className="vai-canvas__selection-box"
      pointerEvents="none"
    />
  );
}

function relationNodeIds(relation: DrawingRelation): string[] {
  switch (relation.type) {
    case 'topology': return relation.nodeIds;
    case 'constraint': return relation.geometryIds;
    case 'association': return [relation.annotationId, ...relation.geometryIds];
    case 'semantic': return relation.nodeIds;
  }
}

function eventScreenPoint(event: MouseEvent<Element> | WheelEvent<Element>): Vec2 {
  const target = event.currentTarget;
  const svg = target.tagName.toLowerCase() === 'svg'
    ? target as SVGSVGElement
    : (target as SVGGraphicsElement).ownerSVGElement;
  const rect = svg?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function normalizeBounds(first: Vec2, second: Vec2): Bounds2D {
  return {
    minX: Math.min(first[0], second[0]),
    minY: Math.min(first[1], second[1]),
    maxX: Math.max(first[0], second[0]),
    maxY: Math.max(first[1], second[1]),
  };
}
