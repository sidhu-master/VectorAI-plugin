// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import { projectCadEngineeringSymbols, type EngineeringCadScene, type CadSymbolPlacement } from '@vectorai/drawing-cad';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { CadPaperGraphics } from './CadPaperGraphics';
import { useRafPreview } from './useRafPreview';

type Move = { kind: CadSymbolPlacement['kind']; ids: string[]; position: Vec2; facing?: 1 | -1 };
type Drag = { key: string; item: CadSymbolPlacement; selectedId: string; pointerId: number; client: Vec2; position: Vec2; moved: boolean };

/** Paper geometry with the original domain selection/edit commands retained. */
export function CadSymbolOverlay({ scene, draft, scale, datumVisible, gdtVisible, textureVisible, previewHeld,
  selectedId, onSelect, onMove, onInteractionActiveChange }: {
  scene: EngineeringCadScene;
  draft: EngineeringAnnotationDraft;
  scale: number;
  datumVisible: boolean;
  gdtVisible: boolean;
  textureVisible: boolean;
  previewHeld: boolean;
  selectedId?: string | null;
  onSelect(kind: CadSymbolPlacement['kind'], id: string): void;
  onMove(move: Move): void | Promise<void>;
  onInteractionActiveChange(active: boolean): void;
}) {
  const [positions, setPositions] = useState<Record<string, Move>>({});
  const drag = useRef<Drag | null>(null);
  const pressedId = useRef<string | null>(null);
  const safeScale = Math.max(scale, 1e-6);
  const preview = useRafPreview(({ key, move }: { key: string; move: Move }) => setPositions((old) => ({ ...old, [key]: move })));
  const discard = (key: string) => setPositions((old) => { const next = { ...old }; delete next[key]; return next; });
  useEffect(() => {
    setPositions((old) => {
      const next = { ...old };
      let changed = false;
      for (const [key, move] of Object.entries(old)) {
        const stored = move.kind === 'datum' ? draft.datums.find(({ id }) => id === move.ids[0])?.labelPosition
          : move.kind === 'surface-texture' ? draft.surfaceTextures.find(({ id }) => id === move.ids[0])?.labelPosition
          : draft.geometricTolerances.find(({ id }) => id === move.ids[0])?.framePosition;
        if (stored && Math.hypot(stored[0] - move.position[0], stored[1] - move.position[1]) < 1e-6) {
          delete next[key]; changed = true;
        }
      }
      return changed ? next : old;
    });
  }, [draft]);
  const symbols = useMemo(() => {
    if (!Object.keys(positions).length) return { entities: scene.entities, placements: scene.symbolPlacements };
    const projected = structuredClone(draft);
    for (const move of Object.values(positions)) {
      if (move.kind === 'datum') {
        const node = projected.datums.find(({ id }) => id === move.ids[0]);
        if (node) node.labelPosition = [...move.position];
      } else if (move.kind === 'surface-texture') {
        const node = projected.surfaceTextures.find(({ id }) => id === move.ids[0]);
        if (node) {
          node.labelPosition = [...move.position];
          if (move.facing !== undefined) node.labelFacing = move.facing;
        }
      } else for (const node of projected.geometricTolerances) if (move.ids.includes(node.id)) node.framePosition = [...move.position];
    }
    return projectCadEngineeringSymbols(projected, scene.document, scene.profile, {
      planConfirmed: false, caxaCompatible: true, includeCandidates: true, dimensionPlacements: scene.dimensionPlacements,
    });
  }, [draft, positions, scene]);
  useEffect(() => {
    const cancel = () => {
      if (!drag.current) return;
      discard(drag.current.key); drag.current = null; preview.cancel(); onInteractionActiveChange(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('blur', cancel); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); };
  }, [onInteractionActiveChange, preview.cancel]);
  const update = (event: PointerEvent<SVGGElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return null;
    event.preventDefault(); event.stopPropagation();
    const dx = event.clientX - active.client[0], dy = event.clientY - active.client[1];
    active.moved ||= Math.hypot(dx, dy) > 3;
    active.position = [active.item.position[0] + dx / safeScale, active.item.position[1] - dy / safeScale];
    const move = { kind: active.item.kind, ids: active.item.ids, position: active.position, facing: active.item.facing };
    preview.schedule({ key: active.key, move });
    return move;
  };
  const cancel = (event: PointerEvent<SVGGElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null; preview.cancel(); discard(active.key); onInteractionActiveChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <g data-cad-symbol-overlay="true">
    {symbols.placements.map((item, index) => {
      if (!(item.kind === 'datum' ? datumVisible : item.kind === 'gdt' ? gdtVisible : textureVisible)) return null;
      const entity = symbols.entities[index];
      if (!entity || !('picture' in entity)) return null;
      const key = `${item.kind}:${item.ids.join('|')}`;
      const rows = item.kind === 'gdt' ? item.ids : [item.ids[0]!];
      const rowHeight = (item.box.maxY - item.box.minY) / rows.length;
      return <g key={key} data-cad-symbol={key}
        data-datum-id={item.kind === 'datum' ? item.ids[0] : undefined}
        data-surface-texture-id={item.kind === 'surface-texture' ? item.ids[0] : undefined}
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (previewHeld || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { key, item, selectedId: pressedId.current ?? item.ids[0]!, pointerId: event.pointerId, client: [event.clientX, event.clientY], position: item.position, moved: false };
          pressedId.current = null;
          onInteractionActiveChange(true);
        }}
        onPointerMove={update}
        onPointerUp={(event) => {
          const active = drag.current;
          if (!active || active.pointerId !== event.pointerId) return;
          const move = update(event)!; drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (!active.moved) {
            preview.cancel(); discard(key); onInteractionActiveChange(false);
            onSelect(active.item.kind, active.selectedId); return;
          }
          preview.flush({ key, move });
          void Promise.resolve(onMove(move)).catch(() => discard(key)).finally(() => onInteractionActiveChange(false));
        }} onPointerCancel={cancel} onLostPointerCapture={cancel}>
        <g pointerEvents="none"><CadPaperGraphics picture={entity.picture} profile={scene.profile} /></g>
        {rows.map((id, row) => <rect key={id} data-gdt-id={item.kind === 'gdt' ? id : undefined}
          x={item.box.minX} y={item.box.maxY - (row + 1) * rowHeight}
          width={item.box.maxX - item.box.minX} height={rowHeight}
          style={{ fill: 'transparent', stroke: selectedId === id ? '#ffffff' : 'none', strokeWidth: 1, cursor: previewHeld ? 'default' : 'move' }}
          vectorEffect="non-scaling-stroke" pointerEvents="all"
          onPointerDown={() => { pressedId.current = id; }}
          onClick={(event) => {
            event.preventDefault(); event.stopPropagation();
          }} />)}
      </g>;
    })}
  </g>;
}
