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
import { MotionRigOverlay } from './MotionRigOverlay';
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
  | {
    kind: 'pan';
    start: Vec2;
    viewport: DrawingWorkspaceViewport;
    clearSelectionOnClick: boolean;
  }
  | { kind: 'box'; start: Vec2; current: Vec2; additive: boolean }
  | { kind: 'annotation'; id: string; startWorld: Vec2; currentWorld: Vec2 }
  | { kind: 'motion-rig'; startWorld: Vec2; currentWorld: Vec2 };

export interface CanvasProps {
  motionPreviewHeld?: boolean;
}

export function Canvas({ motionPreviewHeld = false }: CanvasProps) {
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const groundingOverlay = useDrawingWorkspace((state) => state.groundingOverlay);
  const motionRig = useDrawingWorkspace((state) => state.motionRig);
  const sourceResource = useDrawingWorkspace((state) => state.sourceResource);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const display = useDrawingWorkspace((state) => state.display);
  const setViewport = useDrawingWorkspace((state) => state.setViewport);
  const setMouseWorld = useDrawingWorkspace((state) => state.setMouseWorld);
  const setSelection = useDrawingWorkspace((state) => state.setSelection);
  const moveAnnotationText = useDrawingWorkspace((state) => state.moveAnnotationText);
  const rebuildMotionRigFromSelection = useDrawingWorkspace((state) => state.rebuildMotionRigFromSelection);
  const beginMotionRigDrag = useDrawingWorkspace((state) => state.beginMotionRigDrag);
  const beginMotionRigConnectorDrag = useDrawingWorkspace((state) => state.beginMotionRigConnectorDrag);
  const updateMotionRigDrag = useDrawingWorkspace((state) => state.updateMotionRigDrag);
  const finishMotionRigDrag = useDrawingWorkspace((state) => state.finishMotionRigDrag);
  const resetMotionRigDrag = useDrawingWorkspace((state) => state.resetMotionRigDrag);
  const cancelMotionRig = useDrawingWorkspace((state) => state.cancelMotionRig);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const spacePressed = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Vec2; current: Vec2 } | null>(null);

  const document = snapshot?.document;

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const preventConversationScroll = (event: globalThis.WheelEvent) => event.preventDefault();
    element.addEventListener('wheel', preventConversationScroll, { passive: false });
    return () => element.removeEventListener('wheel', preventConversationScroll);
  }, []);

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
  const groundedNodeIds = new Set(
    groundingOverlay?.groups
      .filter((group) => group.role !== 'reference')
      .flatMap((group) => group.nodeIds) ?? [],
  );
  const motionRigNodeIds = new Set([
    ...(motionRig?.projection.controlBodyNodeIds ?? []),
    ...(motionRig?.projection.connectors.map(({ nodeId }) => nodeId) ?? []),
  ]);
  const motionRigConnectorHandles = motionRig?.projection.connectors.flatMap((binding) => {
    const node = snapshot.document.geometry.find(({ id }) => String(id) === binding.nodeId);
    if (!node) return [];
    const point = connectorMovingPoint(node, binding.movingEndpoint);
    return point === null ? [] : [{ nodeId: binding.nodeId, point }];
  }) ?? [];
  const motionPreviewBeforeEntities = !motionPreviewHeld || formalSnapshot === null || motionRig === null
    ? []
    : [...motionRigNodeIds].flatMap((id) => {
      const before = formalSnapshot.document.geometry.find((node) => String(node.id) === id);
      const after = snapshot.document.geometry.find((node) => String(node.id) === id);
      return before === undefined || after === undefined || drawingNodesEqual(before, after) ? [] : [before];
    });
  const previewBeforeEntities = motionPreviewHeld || preview === null || formalSnapshot === null ? [] : [
    ...formalSnapshot.document.geometry,
    ...(display.annotations ? formalSnapshot.document.annotations : []),
  ].filter((node) => (
    preview.diff.updatedNodeIds.includes(node.id) || preview.diff.deletedNodeIds.includes(node.id)
  ));
  const previewMotion = motionPreviewHeld || preview === null || formalSnapshot === null
    ? []
    : preview.diff.updatedNodeIds.flatMap((id) => {
    const before = [...formalSnapshot.document.geometry, ...formalSnapshot.document.annotations]
      .find((node) => node.id === id);
    const after = [...snapshot.document.geometry, ...snapshot.document.annotations]
      .find((node) => node.id === id);
    const first = before === undefined ? null : nodeBounds(before);
    const second = after === undefined ? null : nodeBounds(after);
    if (first === null || second === null) return [];
    const from: Vec2 = [(first.minX + first.maxX) / 2, (first.minY + first.maxY) / 2];
    const to: Vec2 = [(second.minX + second.maxX) / 2, (second.minY + second.maxY) / 2];
    return Math.hypot(from[0] - to[0], from[1] - to[1]) <= 1e-9 ? [] : [{ id, from, to }];
  });

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const point = eventScreenPoint(event);
    setViewport(zoomViewportAt(viewport, point, event.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  const handleCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    const point = eventScreenPoint(event);
    const boxSelect = event.button === 0
      && (event.metaKey || event.ctrlKey)
      && !spacePressed.current;
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
    dragRef.current = {
      kind: 'box', start: point, current: point,
      additive: true,
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
    if (drag.kind === 'motion-rig') {
      drag.currentWorld = screenToWorld(point, viewport);
      updateMotionRigDrag(drag.currentWorld);
      return;
    }
    drag.currentWorld = screenToWorld(point, viewport);
  };

  const handleMouseUp = (event: MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag === null) return;
    if (drag.kind === 'pan') {
      const point = eventScreenPoint(event);
      const distance = Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]);
      if (drag.clearSelectionOnClick && distance < 3) setSelection([]);
      return;
    }
    if (drag.kind === 'box') {
      const point = eventScreenPoint(event);
      const distance = Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]);
      if (distance < 3) {
        if (!drag.additive) setSelection([]);
      } else {
        const first = screenToWorld(drag.start, viewport);
        const second = screenToWorld(point, viewport);
        const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
        const nextSelection = drag.additive ? [...selectedIds, ...ids] : ids;
        setSelection(nextSelection);
        if (motionRig !== null && nextSelection.length > 0) {
          queueMicrotask(() => { void rebuildMotionRigFromSelection(); });
        }
      }
      setSelectionBox(null);
      return;
    }
    if (drag.kind === 'motion-rig') {
      finishMotionRigDrag();
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
      if (dragRef.current?.kind === 'motion-rig') {
        dragRef.current = null;
        resetMotionRigDrag();
        return;
      }
      if (motionRig !== null) {
        void cancelMotionRig();
        return;
      }
      dragRef.current = null;
      setSelectionBox(null);
      setSelection([]);
    }
  };

  const handleEntitySelect = (id: string, event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    const nextSelection = event.metaKey || event.ctrlKey
      ? (selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id])
      : [id];
    setSelection(nextSelection);
    if (motionRig !== null && nextSelection.length > 0) {
      queueMicrotask(() => { void rebuildMotionRigFromSelection(); });
    }
  };

  const handleMotionRigPointerDown = (event: MouseEvent<SVGCircleElement>) => {
    const point = eventScreenPoint(event);
    const world = screenToWorld(point, viewport);
    beginMotionRigDrag(world);
    dragRef.current = { kind: 'motion-rig', startWorld: world, currentWorld: world };
  };

  const handleMotionRigConnectorPointerDown = (nodeId: string, event: MouseEvent<SVGCircleElement>) => {
    const point = eventScreenPoint(event);
    const world = screenToWorld(point, viewport);
    beginMotionRigConnectorDrag(nodeId, world);
    dragRef.current = { kind: 'motion-rig', startWorld: world, currentWorld: world };
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
      data-motion-preview-held={motionPreviewHeld || undefined}
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
        onMouseDown={handleCanvasMouseDown}
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
        />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`}>
          <defs>
            <marker id="vai-preview-motion-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {display.sourceUnderlay && snapshot.source !== undefined && sourceResource !== null ? (
            <SourceUnderlay
              source={snapshot.source}
              resource={sourceResource}
              document={snapshot.document}
            />
          ) : null}
          {display.relations ? <RelationLayer document={snapshot.document} viewport={viewport} /> : null}
          {motionPreviewBeforeEntities.map((node) => (
            <g
              key={`motion-preview-before:${node.id}`}
              className="vai-motion-preview__before"
              data-motion-preview-before={node.id}
              pointerEvents="none"
            >
              <EntityRenderer
                node={node}
                viewport={viewport}
                selected={false}
                onSelect={() => {}}
              />
            </g>
          ))}
          {previewBeforeEntities.map((node) => (
            <EntityRenderer
              key={`preview-before:${node.id}`}
              node={node}
              viewport={viewport}
              selected={false}
              previewDiff={preview?.diff.deletedNodeIds.includes(node.id) ? 'deleted' : 'before'}
              onSelect={() => {}}
            />
          ))}
          {previewMotion.map(({ id, from, to }) => (
            <line
              key={`preview-motion:${id}`}
              data-motion-vector={id}
              className="vai-preview-motion"
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#vai-preview-motion-arrow)"
              pointerEvents="none"
            />
          ))}
          {entities.map((node) => (
            <EntityRenderer
              key={node.id}
              node={node}
              viewport={viewport}
              selected={!motionPreviewHeld && selectedIds.includes(node.id)}
              aiGrounded={!motionPreviewHeld && groundedNodeIds.has(node.id)}
              motionRigActive={!motionPreviewHeld && motionRigNodeIds.has(node.id)}
              previewDiff={motionPreviewHeld ? undefined : preview?.diff.createdNodeIds.includes(node.id)
                ? 'created'
                : preview?.diff.updatedNodeIds.includes(node.id)
                  ? 'updated'
                  : undefined}
              onSelect={(event) => handleEntitySelect(node.id, event)}
              onTextPointerDown={node.type === 'text' || node.type === 'dimension'
                ? (event) => handleAnnotationPointerDown(node, event)
                : undefined}
            />
          ))}
          {motionRig === null || motionPreviewHeld ? null : (
            <MotionRigOverlay
              rig={motionRig}
              viewportScale={viewport.scale}
              connectorHandles={motionRigConnectorHandles}
              onHandleMouseDown={handleMotionRigPointerDown}
              onConnectorMouseDown={handleMotionRigConnectorPointerDown}
            />
          )}
        </g>
        {selectionBox === null || motionPreviewHeld ? null : <SelectionBox box={selectionBox} />}
      </svg>
    </div>
  );
}

function drawingNodesEqual(
  first: DrawingDocument['geometry'][number],
  second: DrawingDocument['geometry'][number],
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function connectorMovingPoint(
  node: DrawingDocument['geometry'][number],
  movingEndpoint: 'start' | 'end' | 'first' | 'last',
): Vec2 | null {
  if (node.type === 'line') {
    if (movingEndpoint === 'start' || movingEndpoint === 'end') return node[movingEndpoint];
  }
  if (node.type === 'polyline') {
    if (movingEndpoint === 'first') return node.vertices[0]?.point ?? null;
    if (movingEndpoint === 'last') return node.vertices[node.vertices.length - 1]?.point ?? null;
  }
  if (node.type === 'spline') {
    if (movingEndpoint === 'first') return node.controlPoints[0] ?? null;
    if (movingEndpoint === 'last') return node.controlPoints[node.controlPoints.length - 1] ?? null;
  }
  return null;
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
      {document.relations.filter((relation) => (
        relation.visible && relation.plane !== 'topology'
      )).flatMap((relation) => {
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

function isBlankCanvasTarget(event: MouseEvent<SVGSVGElement>): boolean {
  if (event.target === event.currentTarget) return true;
  const target = event.target as EventTarget & { dataset?: { canvasBackground?: string } };
  return target.dataset?.canvasBackground === 'true';
}
