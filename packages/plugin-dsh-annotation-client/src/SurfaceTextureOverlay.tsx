// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { drawingBounds, screenSpaceTransform } from '@vectorai/drawing-viewer-react';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useRef, useState, type PointerEvent } from 'react';

export function SurfaceTextureOverlay({ draft, document, scale, visible, previewHeld, onSelect, onMove }: {
  draft: EngineeringAnnotationDraft;
  document: DrawingDocument;
  scale: number;
  visible: boolean;
  previewHeld: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: readonly [number, number]): void | Promise<void>;
}) {
  if (!visible) return null;
  const geometry = new Map(document.geometry.map((node) => [String(node.id), node]));
  const bounds = drawingBounds({ ...document, annotations: [] }) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const drawingHeight = Math.max(1, bounds.maxY - bounds.minY);
  const safeScale = Math.max(scale, 1e-6);
  const [dragPositions, setDragPositions] = useState<Record<string, Vec2>>({});
  const dragRef = useRef<{ id: string; pointerId: number; startClient: Vec2; startPosition: Vec2; current: Vec2 } | null>(null);
  const suppressClickRef = useRef(false);
  const updateDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const next: Vec2 = [
      drag.startPosition[0] + (event.clientX - drag.startClient[0]) / safeScale,
      drag.startPosition[1] - (event.clientY - drag.startClient[1]) / safeScale,
    ];
    drag.current = next;
    if (Math.hypot(event.clientX - drag.startClient[0], event.clientY - drag.startClient[1]) > 3) suppressClickRef.current = true;
    setDragPositions((current) => ({ ...current, [drag.id]: next }));
  };
  const finishDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    void Promise.resolve(onMove(drag.id, drag.current)).then(() => setDragPositions((current) => {
      const next = { ...current }; delete next[drag.id]; return next;
    })).catch(() => setDragPositions((current) => {
      const next = { ...current }; delete next[drag.id]; return next;
    }));
  };
  return <g className="vai-surface-texture-overlay">
    {draft.surfaceTextures.map((intent, index) => {
      if (intent.status === 'conflict' || intent.status === 'stale') return null;
      const targetSpec = intent.controlledTargets[0];
      const target = targetSpec ? resolveAnchor(geometry.get(String(targetSpec.geometryId)), targetSpec.anchor) : null;
      if (!target) return null;
      const marker: Vec2 = dragPositions[intent.id]
        ?? (intent.labelPosition === undefined ? undefined : [intent.labelPosition[0], intent.labelPosition[1]] as Vec2)
        ?? [target[0], bounds.maxY + drawingHeight * (0.18 + index * 0.08)] as Vec2;
      return <g key={intent.id} data-surface-texture-id={intent.id} pointerEvents="all"
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef.current) { suppressClickRef.current = false; return; }
          if (!previewHeld) onSelect(intent.id);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || previewHeld) return;
          event.preventDefault(); event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          suppressClickRef.current = false;
          dragRef.current = {
            id: intent.id, pointerId: event.pointerId,
            startClient: [event.clientX, event.clientY], startPosition: marker, current: marker,
          };
        }}
        onPointerMove={updateDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => { dragRef.current = null; setDragPositions({}); }}>
        <path className="vai-surface-texture-leader" pointerEvents="none"
          d={`M ${target[0]} ${target[1]} L ${target[0]} ${marker[1]} L ${marker[0]} ${marker[1]}`} />
        <g transform={screenSpaceTransform(marker, safeScale)} data-material-removal={intent.materialRemoval}>
          <rect className="vai-surface-texture__hit" x={-18} y={-24} width={66} height={40} rx={4} />
          <path className="vai-surface-texture__symbol" d="M -8 8 L 0 -8 L 10 8" />
          {intent.materialRemoval === 'required' && <path className="vai-surface-texture__symbol" d="M -1 -6 L 14 -6" />}
          {intent.materialRemoval === 'prohibited' && <circle className="vai-surface-texture__symbol" cx={1} cy={0} r={4} />}
          <text x={18} y={-8} dominantBaseline="middle" fontSize={11}>{`${intent.parameter} ${format(intent.value)}`}</text>
        </g>
      </g>;
    })}
  </g>;
}

type TextureAnchor = EngineeringAnnotationDraft['surfaceTextures'][number]['controlledTargets'][number]['anchor'];

function resolveAnchor(node: GeometryNode | undefined, anchor: TextureAnchor): Vec2 | null {
  if (anchor.kind === 'nearest') return [anchor.point[0], anchor.point[1]];
  if (!node) return null;
  if (anchor.kind === 'center') return 'center' in node ? node.center : node.type === 'point' ? [node.x, node.y] : null;
  if (anchor.kind === 'start') return node.type === 'line' ? node.start : node.type === 'polyline' ? node.vertices[0]?.point ?? null : null;
  if (anchor.kind === 'end') return node.type === 'line' ? node.end : node.type === 'polyline' ? node.vertices.at(-1)?.point ?? null : null;
  if (anchor.kind === 'vertex' && node.type === 'polyline') return node.vertices[anchor.index]?.point ?? null;
  return null;
}

function format(value: number): string { return Number(value.toFixed(6)).toString(); }
