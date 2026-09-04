// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { drawingBounds, screenSpaceTransform } from '@vectorai/drawing-viewer-react';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { SurfaceTextureSymbol } from './SurfaceTextureSymbol';
import { useRafPreview } from './useRafPreview';

export function SurfaceTextureOverlay({ draft, document, scale, visible, previewHeld, attachToGdt, onSelect, onMove, onInteractionActiveChange }: {
  draft: EngineeringAnnotationDraft;
  document: DrawingDocument;
  scale: number;
  visible: boolean;
  previewHeld: boolean;
  attachToGdt?: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: readonly [number, number]): void | Promise<void>;
  onInteractionActiveChange?(active: boolean): void;
}) {
  const geometry = useMemo(() => new Map(document.geometry.map((node) => [String(node.id), node])), [document.geometry]);
  const bounds = useMemo(() => drawingBounds({ ...document, annotations: [] })
    ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }, [document]);
  const drawingHeight = Math.max(1, bounds.maxY - bounds.minY);
  const safeScale = Math.max(scale, 1e-6);
  const [dragPositions, setDragPositions] = useState<Record<string, Vec2>>({});
  const dragRef = useRef<{ id: string; pointerId: number; startClient: Vec2; startPosition: Vec2; current: Vec2 } | null>(null);
  const suppressClickRef = useRef(false);
  const dragPreview = useRafPreview(({ id, position }: { id: string; position: Vec2 }) => {
    setDragPositions((current) => ({ ...current, [id]: position }));
  });
  const gdtTargetIds = useMemo(() => attachToGdt ? new Set(draft.geometricTolerances
    .filter((intent) => intent.status !== 'conflict' && intent.status !== 'stale')
    .map((intent) => intent.controlledTargets[0]?.geometryId)
    .filter((id): id is string => id !== undefined)
    .map(String)) : null, [attachToGdt, draft.geometricTolerances]);
  useEffect(() => {
    setDragPositions((current) => {
      let changed = false;
      const next = { ...current };
      for (const [id, preview] of Object.entries(current)) {
        const position = draft.surfaceTextures.find((intent) => intent.id === id)?.labelPosition;
        if (position !== undefined && Math.hypot(position[0] - preview[0], position[1] - preview[1]) <= 0.0005) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [draft.surfaceTextures]);
  if (!visible) return null;
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
    dragPreview.schedule({ id: drag.id, position: next });
  };
  const finishDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    dragPreview.flush({ id: drag.id, position: drag.current });
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    void Promise.resolve(onMove(drag.id, drag.current)).catch(() => setDragPositions((current) => {
      const next = { ...current }; delete next[drag.id]; return next;
    })).finally(() => onInteractionActiveChange?.(false));
  };
  return <g className="vai-surface-texture-overlay">
    {draft.surfaceTextures.map((intent, index) => {
      if (intent.status === 'conflict' || intent.status === 'stale') return null;
      const targetSpec = intent.controlledTargets[0];
      if (targetSpec && gdtTargetIds?.has(String(targetSpec.geometryId))) return null;
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
          onInteractionActiveChange?.(true);
        }}
        onPointerMove={updateDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          dragPreview.cancel(); dragRef.current = null; setDragPositions({}); onInteractionActiveChange?.(false);
        }}>
        <path className="vai-surface-texture-leader" pointerEvents="none"
          d={`M ${target[0]} ${target[1]} L ${target[0]} ${marker[1]} L ${marker[0]} ${marker[1]}`} />
        <g transform={screenSpaceTransform(marker, safeScale)} data-material-removal={intent.materialRemoval}>
          <rect className="vai-surface-texture__hit" x={-16} y={-46} width={58} height={58} rx={4} />
          <SurfaceTextureSymbol materialRemoval={intent.materialRemoval} />
          <text className="vai-surface-texture__value" x={-2} y={-23} textAnchor="middle" fontSize={11}
            aria-label={`${intent.parameter} ${format(intent.value)}`}>{format(intent.value)}</text>
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
