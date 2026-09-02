// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { drawingBounds, estimateScreenTextWidth, screenSpaceTransform } from '@vectorai/drawing-viewer-react';
import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

const ROW_HEIGHT = 24;
const DRAWING_GAP = 28;

export function GdtOverlay({
  draft, document, scale, viewport, datumVisible, gdtVisible, previewHeld, selectedIntentId, onSelectDatum, onSelectIntent, onMoveDatum, onMoveGdtGroup,
}: {
  draft: EngineeringAnnotationDraft;
  document: DrawingDocument;
  scale: number;
  viewport: DrawingWorkspaceViewport;
  datumVisible: boolean;
  gdtVisible: boolean;
  previewHeld: boolean;
  selectedIntentId: string | null;
  onSelectDatum(id: string): void;
  onSelectIntent(id: string): void;
  onMoveDatum(id: string, position: readonly [number, number]): void | Promise<void>;
  onMoveGdtGroup(intentIds: readonly string[], position: readonly [number, number]): void | Promise<void>;
}) {
  const safeScale = Math.max(scale, 1e-6);
  const [datumDragPositions, setDatumDragPositions] = useState<Record<string, Vec2>>({});
  const datumDragRef = useRef<DatumDragState | null>(null);
  const suppressDatumClickRef = useRef(false);
  const datumPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gdtDragPositions, setGdtDragPositions] = useState<Record<string, Vec2>>({});
  const gdtDragRef = useRef<GdtDragState | null>(null);
  const gdtPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gdtMouseCleanupRef = useRef<(() => void) | null>(null);
  const suppressGdtClickRef = useRef(false);
  const geometry = new Map(document.geometry.map((node) => [String(node.id), node]));
  const datums = new Map(draft.datums.map((datum) => [datum.id, datum]));
  const bounds = drawingBounds({ ...document, annotations: [] }) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const groups = layoutGroups(draft, geometry, datums, bounds, viewport, safeScale);

  const updateDatumDrag = (event: PointerEvent<SVGGElement>): Vec2 | null => {
    const drag = datumDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    event.preventDefault();
    event.stopPropagation();
    const next: Vec2 = [
      drag.startPosition[0] + (event.clientX - drag.startClient[0]) / safeScale,
      drag.startPosition[1] - (event.clientY - drag.startClient[1]) / safeScale,
    ];
    if (Math.hypot(event.clientX - drag.startClient[0], event.clientY - drag.startClient[1]) > 3) {
      suppressDatumClickRef.current = true;
    }
    drag.currentPosition = next;
    setDatumDragPositions((current) => ({ ...current, [drag.datumId]: next }));
    if (datumPersistTimerRef.current !== null) clearTimeout(datumPersistTimerRef.current);
    datumPersistTimerRef.current = setTimeout(() => {
      datumPersistTimerRef.current = null;
      void Promise.resolve(onMoveDatum(drag.datumId, drag.currentPosition)).catch(() => undefined);
    }, 120);
    return next;
  };
  const commitDatumDrag = (drag: DatumDragState, next: Vec2) => {
    if (datumPersistTimerRef.current !== null) {
      clearTimeout(datumPersistTimerRef.current);
      datumPersistTimerRef.current = null;
    }
    datumDragRef.current = null;
    void Promise.resolve(onMoveDatum(drag.datumId, next)).then(() => {
      setDatumDragPositions((current) => {
        if (!(drag.datumId in current)) return current;
        const updated = { ...current };
        delete updated[drag.datumId];
        return updated;
      });
    }).catch(() => setDatumDragPositions((current) => {
      const updated = { ...current };
      delete updated[drag.datumId];
      return updated;
    }));
  };
  useEffect(() => () => {
    if (datumPersistTimerRef.current !== null) clearTimeout(datumPersistTimerRef.current);
    if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
    gdtMouseCleanupRef.current?.();
  }, []);
  const finishDatumDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = datumDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = updateDatumDrag(event) ?? drag.currentPosition;
    commitDatumDrag(drag, next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const updateGdtDragAt = (clientX: number, clientY: number): Vec2 | null => {
    const drag = gdtDragRef.current;
    if (!drag) return null;
    const dx = clientX - drag.startClient[0];
    const dy = clientY - drag.startClient[1];
    const next: Vec2 = [drag.startPosition[0] + dx / safeScale, drag.startPosition[1] - dy / safeScale];
    drag.currentPosition = next;
    if (Math.hypot(dx, dy) > 3) suppressGdtClickRef.current = true;
    setGdtDragPositions((current) => ({ ...current, [drag.groupId]: next }));
    if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
    gdtPersistTimerRef.current = setTimeout(() => {
      gdtPersistTimerRef.current = null;
      void Promise.resolve(onMoveGdtGroup(drag.intentIds, drag.currentPosition)).catch(() => undefined);
    }, 120);
    return next;
  };
  const updateGdtDrag = (event: PointerEvent<SVGGElement>): Vec2 | null => {
    const drag = gdtDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    event.preventDefault();
    event.stopPropagation();
    return updateGdtDragAt(event.clientX, event.clientY);
  };
  const commitGdtDrag = (drag: GdtDragState, next: Vec2) => {
    if (gdtPersistTimerRef.current !== null) {
      clearTimeout(gdtPersistTimerRef.current);
      gdtPersistTimerRef.current = null;
    }
    gdtDragRef.current = null;
    void Promise.resolve(onMoveGdtGroup(drag.intentIds, next)).then(() => {
      setGdtDragPositions((current) => {
        const updated = { ...current };
        delete updated[drag.groupId];
        return updated;
      });
    }).catch(() => setGdtDragPositions((current) => {
      const updated = { ...current };
      delete updated[drag.groupId];
      return updated;
    }));
  };
  const finishGdtDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = gdtDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = updateGdtDrag(event) ?? drag.currentPosition;
    commitGdtDrag(drag, next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <g className="vai-gdt-overlay" data-preview-held={previewHeld ? 'true' : undefined}>
    {datumVisible && draft.datums.map((datum) => {
      const target = resolveAnchor(geometry.get(String(datum.geometryId)), datum.anchor);
      if (!target) return null;
      const marker: Vec2 = datumDragPositions[datum.id]
        ?? datum.labelPosition as unknown as Vec2 | undefined
        ?? [target[0], bounds.minY - defaultDatumGap(bounds)];
      return <g key={datum.id} className={`vai-datum-marker vai-datum-marker--${datum.status}`} data-datum-id={datum.id}
        pointerEvents="all"
        onMouseDown={(event) => {
          // DrawingSurface owns mouse gestures for canvas panning. Datum
          // dragging is pointer-driven, so the compatibility mouse event must
          // not bubble into the canvas after pointer capture starts.
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (suppressDatumClickRef.current) { suppressDatumClickRef.current = false; return; }
          if (!previewHeld) onSelectDatum(datum.id);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          if (event.button !== 0 || previewHeld) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          suppressDatumClickRef.current = false;
          datumDragRef.current = {
            datumId: datum.id,
            pointerId: event.pointerId,
            startClient: [event.clientX, event.clientY],
            startPosition: marker,
            currentPosition: marker,
          };
        }}
        onPointerMove={updateDatumDrag}
        onPointerUp={finishDatumDrag}
        onLostPointerCapture={(event) => {
          const drag = datumDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          commitDatumDrag(drag, drag.currentPosition);
        }}
        onPointerCancel={(event) => {
          const drag = datumDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (datumPersistTimerRef.current !== null) {
            clearTimeout(datumPersistTimerRef.current);
            datumPersistTimerRef.current = null;
          }
          datumDragRef.current = null;
          setDatumDragPositions((current) => {
            const updated = { ...current };
            delete updated[drag.datumId];
            return updated;
          });
        }}>
        <path className="vai-datum-leader" pointerEvents="none" d={datumLeaderPath(target, marker)} />
        <g transform={screenSpaceTransform(marker, safeScale)}>
          <rect className="vai-datum-marker__hit" x={-14} y={-10} width={28} height={40} rx={4} />
          <path d="M -5 0 L 5 0 L 0 -8 Z" />
          <path d="M 0 0 L 0 8" />
          <rect x={-10} y={8} width={20} height={20} rx={2} />
          <text x={0} y={18} dominantBaseline="middle" textAnchor="middle" fontSize={11}>{datum.name}</text>
        </g>
      </g>;
    })}
    {gdtVisible && groups.map((sourceGroup) => {
      const group = gdtDragPositions[sourceGroup.id] ? { ...sourceGroup, origin: gdtDragPositions[sourceGroup.id]! } : sourceGroup;
      return <g key={group.id} className="vai-gdt-frame-group" data-gdt-group={group.id} pointerEvents="all"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.button !== 0 || previewHeld) return;
          if (!gdtDragRef.current) {
            gdtDragRef.current = {
              groupId: group.id, intentIds: group.intentIds, pointerId: -1,
              startClient: [event.clientX, event.clientY], startPosition: group.origin, currentPosition: group.origin,
            };
          }
          gdtMouseCleanupRef.current?.();
          const handleMouseMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            updateGdtDragAt(moveEvent.clientX, moveEvent.clientY);
          };
          const handleMouseUp = (upEvent: MouseEvent) => {
            upEvent.preventDefault();
            upEvent.stopPropagation();
            const drag = gdtDragRef.current;
            if (drag) commitGdtDrag(drag, updateGdtDragAt(upEvent.clientX, upEvent.clientY) ?? drag.currentPosition);
            gdtMouseCleanupRef.current?.();
          };
          const cleanup = () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('mouseup', handleMouseUp, true);
            if (gdtMouseCleanupRef.current === cleanup) gdtMouseCleanupRef.current = null;
          };
          gdtMouseCleanupRef.current = cleanup;
          window.addEventListener('mousemove', handleMouseMove, true);
          window.addEventListener('mouseup', handleMouseUp, true);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || previewHeld) return;
          event.preventDefault(); event.stopPropagation();
          suppressGdtClickRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          gdtDragRef.current = {
            groupId: group.id, intentIds: group.intentIds, pointerId: event.pointerId,
            startClient: [event.clientX, event.clientY], startPosition: group.origin, currentPosition: group.origin,
          };
        }}
        onPointerMove={updateGdtDrag}
        onPointerUp={finishGdtDrag}
        onLostPointerCapture={(event) => {
          const drag = gdtDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          commitGdtDrag(drag, drag.currentPosition);
        }}
        onPointerCancel={(event) => {
          const drag = gdtDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
          gdtPersistTimerRef.current = null; gdtDragRef.current = null;
          setGdtDragPositions((current) => { const updated = { ...current }; delete updated[drag.groupId]; return updated; });
        }}>
        <path className="vai-gdt-leader" pointerEvents="none" d={orthogonalLeaderPath(group)} />
        {group.rows.map(({ intent, cells, widths }, rowIndex) => {
          const totalWidth = widths.reduce((sum, width) => sum + width, 0);
          const rowOrigin: Vec2 = [group.origin[0], group.origin[1] - rowIndex * ROW_HEIGHT * group.frameScale];
          let cursor = 0;
          return <g key={intent.id} className={`vai-gdt-frame${selectedIntentId === intent.id ? ' is-selected' : ''}${intent.override ? ' is-overridden' : ''}`}
            data-gdt-id={intent.id} onClick={(event) => {
              event.stopPropagation();
              if (suppressGdtClickRef.current) { suppressGdtClickRef.current = false; return; }
              if (!previewHeld) onSelectIntent(intent.id);
            }}>
            <g transform={`translate(${rowOrigin[0]} ${rowOrigin[1]}) scale(${group.frameScale} ${-group.frameScale})`}>
              {cells.map((cell, cellIndex) => {
                const width = widths[cellIndex]!; const cellX = cursor; cursor += width;
                return <g key={`${intent.id}:${cellIndex}`}>
                  <rect x={cellX} y={0} width={width} height={ROW_HEIGHT} />
                  {cellIndex === 0
                    ? <CharacteristicMark characteristic={intent.characteristic} x={cellX + width / 2} y={ROW_HEIGHT / 2} />
                    : <text x={cellX + width / 2} y={ROW_HEIGHT / 2} dominantBaseline="middle" textAnchor="middle" fontSize={11}>{cell}</text>}
                </g>;
              })}
              <rect className="vai-gdt-frame__hit" x={0} y={0} width={totalWidth} height={ROW_HEIGHT} />
            </g>
          </g>;
        })}
      </g>;
    })}
  </g>;
}

interface DatumDragState {
  datumId: string;
  pointerId: number;
  startClient: readonly [number, number];
  startPosition: Vec2;
  currentPosition: Vec2;
}

interface GdtDragState {
  groupId: string;
  intentIds: string[];
  pointerId: number;
  startClient: readonly [number, number];
  startPosition: Vec2;
  currentPosition: Vec2;
}

function defaultDatumGap(bounds: { minY: number; maxY: number }): number {
  return Math.max(4, Math.min(12, Math.abs(bounds.maxY - bounds.minY) * 0.12));
}

function datumLeaderPath(target: Vec2, marker: Vec2): string {
  return `M ${target[0]} ${target[1]} L ${target[0]} ${marker[1]} L ${marker[0]} ${marker[1]}`;
}

interface GdtRow {
  intent: EngineeringAnnotationDraft['geometricTolerances'][number];
  cells: string[];
  widths: number[];
}

interface GdtGroup {
  id: string;
  intentIds: string[];
  target: Vec2;
  origin: Vec2;
  rows: GdtRow[];
  width: number;
  side: 'top' | 'bottom';
  lane: number;
  frameScale: number;
}

function layoutGroups(
  draft: EngineeringAnnotationDraft,
  geometry: ReadonlyMap<string, GeometryNode>,
  datums: ReadonlyMap<string, EngineeringAnnotationDraft['datums'][number]>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  _viewport: DrawingWorkspaceViewport,
  scale: number,
): GdtGroup[] {
  const grouped = new Map<string, { id: string; target: Vec2; rows: GdtRow[] }>();
  for (const intent of draft.geometricTolerances) {
    const target = intent.controlledTargets[0];
    const point = target ? resolveAnchor(geometry.get(String(target.geometryId)), target.anchor) : null;
    if (!target || !point) continue;
    const value = intent.override?.value ?? intent.computed.value;
    const datumCell = intent.datumReferenceFrame.map((reference) => {
      const name = datums.get(reference.datumId)?.name ?? '?';
      return `${name}${reference.materialCondition ? `(${reference.materialCondition.toUpperCase()})` : ''}`;
    }).join('-');
    const cells = [
      characteristicSymbol(intent.characteristic),
      value === undefined ? '—' : `${intent.toleranceZone.shape === 'diametrical' ? '⌀' : ''}${value} mm`,
      ...(datumCell ? [datumCell] : []),
    ];
    const widths = cells.map((cell, index) => (
      index === 0 ? 26 : Math.max(44, estimateScreenTextWidth(cell, 11) + 16)
    ));
    const key = String(target.geometryId);
    const existing = grouped.get(key) ?? { id: key, target: point, rows: [] };
    existing.rows.push({ intent, cells, widths });
    grouped.set(key, existing);
  }
  for (const group of grouped.values()) {
    const valueWidth = Math.max(...group.rows.map(({ widths }) => widths[1] ?? 44));
    group.rows = group.rows.map((row) => ({
      ...row,
      widths: row.widths.map((width, index) => index === 1 ? valueWidth : width),
    }));
  }
  const ordered = [...grouped.values()].sort((left, right) => left.target[0] - right.target[0]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const drawingWidth = Math.max(1, Math.abs(bounds.maxX - bounds.minX));
  const drawingHeight = Math.max(1, Math.abs(bounds.maxY - bounds.minY));
  const frameScale = Math.min(1, 1 / scale);
  return ordered.map(({ id, target, rows }, groupIndex) => {
    const width = Math.max(...rows.map(({ widths }) => widths.reduce((sum, value) => sum + value, 0)));
    const bearingStack = rows.length >= 3;
    const stored = rows.find(({ intent }) => intent.framePosition !== undefined)?.intent.framePosition as unknown as Vec2 | undefined;
    const automaticSide = !bearingStack && target[0] >= centerX ? 'bottom' : 'top';
    const side = stored ? (stored[1] >= target[1] ? 'top' : 'bottom') : automaticSide;
    const laneDistance = Math.max(6, drawingHeight * (0.22 + groupIndex * 0.12));
    const x = stored?.[0] ?? (bearingStack
      ? target[0] < centerX ? bounds.minX - drawingWidth * 0.18 : bounds.maxX + drawingWidth * 0.04
      : target[0] - drawingWidth * 0.06);
    const y = stored?.[1] ?? (side === 'top' ? bounds.maxY + laneDistance : bounds.minY - laneDistance);
    return {
      id, intentIds: rows.map(({ intent }) => intent.id), target, rows, width, side,
      lane: groupIndex, frameScale, origin: [x, y],
    };
  });
}

function orthogonalLeaderPath(group: GdtGroup): string {
  const frameLeft = group.origin[0];
  const frameRight = frameLeft + group.width * group.frameScale;
  const frameTop = group.origin[1];
  const frameBottom = frameTop - group.rows.length * ROW_HEIGHT * group.frameScale;
  const attachX = Math.max(frameLeft, Math.min(group.target[0], frameRight));
  const laneGap = Math.min(DRAWING_GAP - 4, 10 + group.lane * 4) * group.frameScale;
  const laneY = group.side === 'top'
    ? frameBottom - laneGap
    : frameTop + laneGap;
  const attachY = group.side === 'top' ? frameBottom : frameTop;
  return `M ${group.target[0]} ${group.target[1]} L ${group.target[0]} ${laneY} L ${attachX} ${laneY} L ${attachX} ${attachY}`;
}

function characteristicSymbol(value: EngineeringAnnotationDraft['geometricTolerances'][number]['characteristic']): string {
  return {
    straightness: '—', flatness: '▱', circularity: '○', cylindricity: '⌭',
    'profile-line': '⌒', 'profile-surface': '⌓', parallelism: '∥', perpendicularity: '⊥', angularity: '∠',
    position: '⌖', coaxiality: '◎', symmetry: '⌯', 'circular-runout': '↗', 'total-runout': '⌰',
  }[value];
}

function CharacteristicMark({ characteristic, x, y }: {
  characteristic: EngineeringAnnotationDraft['geometricTolerances'][number]['characteristic'];
  x: number;
  y: number;
}) {
  return <text data-gdt-symbol={characteristic} x={x} y={y} dominantBaseline="middle" textAnchor="middle"
    fontFamily={characteristic === 'total-runout' ? "'Apple Symbols', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Segoe UI Symbol', sans-serif" : undefined}
    fontSize={characteristic === 'total-runout' ? 14 : 11}>
    {characteristicSymbol(characteristic)}
  </text>;
}

type OverlayAnchor = EngineeringAnnotationDraft['datums'][number]['anchor']
  | EngineeringAnnotationDraft['geometricTolerances'][number]['controlledTargets'][number]['anchor'];

function resolveAnchor(node: GeometryNode | undefined, anchor: OverlayAnchor): Vec2 | null {
  if (anchor.kind === 'nearest') {
    const [x, y] = anchor.point;
    return typeof x === 'number' && typeof y === 'number' ? [x, y] : null;
  }
  if (!node) return null;
  if (anchor.kind === 'center') return 'center' in node ? node.center : node.type === 'point' ? [node.x, node.y] : null;
  if (anchor.kind === 'start') return node.type === 'line' ? node.start : node.type === 'polyline' ? node.vertices[0]?.point ?? null : null;
  if (anchor.kind === 'end') return node.type === 'line' ? node.end : node.type === 'polyline' ? node.vertices.at(-1)?.point ?? null : null;
  if (anchor.kind === 'vertex' && node.type === 'polyline') return node.vertices[anchor.index]?.point ?? null;
  return null;
}
