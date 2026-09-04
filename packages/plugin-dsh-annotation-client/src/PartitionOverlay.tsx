// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, PartitionRevision } from '@vectorai/plugin-space-contracts';
import { screenSpaceTransform } from '@vectorai/drawing-viewer-react';
import type { PointerEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { partitionBands, type PartitionBand, type PartitionViewMode } from './partition-view-model';
import { useRafPreview } from './useRafPreview';

interface BoundaryDrag {
  target: BoundaryTarget;
  z: number;
  lastClientX: number;
  lastClientY: number;
}

type BoundaryTarget =
  | { kind: 'segment'; index: number }
  | { kind: 'semantic'; groupId: string; edge: 'start' | 'end'; label: string };

interface BoundaryHandle { key: string; z: number; target: BoundaryTarget }

export function PartitionOverlay({ draft, mode = 'functional', previewHeld, scale, onMoveBoundary, onMoveSemanticRange, onRenameBand, onInteractionActiveChange }: {
  draft: PartitionDraft | PartitionRevision; mode: PartitionViewMode; previewHeld: boolean; scale: number;
  onMoveBoundary?(index: number, z: number): void | Promise<void>;
  onMoveSemanticRange?(groupId: string, edge: 'start' | 'end', z: number): void | Promise<void>;
  onRenameBand?(band: PartitionBand, name: string): void | Promise<void>;
  onInteractionActiveChange?(active: boolean): void;
}) {
  const [drag, setDrag] = useState<BoundaryDrag | null>(null);
  const [naming, setNaming] = useState<{ bandId: string; value: string } | null>(null);
  const nameCommit = useRef<string | null>(null);
  const current = useRef<BoundaryDrag | null>(null);
  const pendingCommit = useRef<{ key: string; source: PartitionDraft | PartitionRevision } | null>(null);
  const dragPreview = useRafPreview((value: BoundaryDrag) => setDrag(value));
  const point = (z: number, r: number): [number, number] => [
    draft.axis.origin[0]! + draft.axis.direction[0]! * z + draft.axis.normal[0]! * r,
    draft.axis.origin[1]! + draft.axis.direction[1]! * z + draft.axis.normal[1]! * r,
  ];
  const pointerMove = (event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!current.current) return;
    const screenX = event.clientX - current.current.lastClientX;
    const screenY = event.clientY - current.current.lastClientY;
    const delta = (screenX * draft.axis.direction[0]! - screenY * draft.axis.direction[1]!) / Math.max(scale, 1e-6);
    current.current = {
      ...current.current,
      z: current.current.z + delta,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    dragPreview.schedule(current.current);
  };
  const finishPointer = async (event: PointerEvent<SVGCircleElement>, releaseCapture: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    const value = current.current;
    current.current = null;
    if (releaseCapture) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture was already lost */ }
    }
    if (!value) { onInteractionActiveChange?.(false); return; }
    dragPreview.flush(value);
    pendingCommit.current = { key: targetKey(value.target), source: draft };
    try {
      if (value.target.kind === 'segment') {
        if (!onMoveBoundary) throw new Error('PARTITION_BOUNDARY_HANDLER_REQUIRED');
        await onMoveBoundary(value.target.index, value.z);
      }
      else {
        if (!onMoveSemanticRange) throw new Error('PARTITION_SEMANTIC_RANGE_HANDLER_REQUIRED');
        await onMoveSemanticRange(value.target.groupId, value.target.edge, value.z);
      }
    } catch {
      pendingCommit.current = null;
      // Keep the local result visible. The controller exposes the persistence error and
      // the user can retry the drag or cancel the whole draft explicitly.
      setDrag(value);
    } finally {
      onInteractionActiveChange?.(false);
    }
  };
  const bands = useMemo(() => partitionBands(draft, mode), [draft, mode]);
  const visibleDrag = pendingCommit.current !== null && pendingCommit.current.source !== draft ? null : drag;
  const commitName = async (band: PartitionBand) => {
    if (naming?.bandId !== band.id) return;
    const name = naming.value.trim();
    if (!name || name === band.name?.trim()) {
      setNaming(null);
      return;
    }
    if (!onRenameBand) return;
    const commitKey = `${band.id}\u0000${name}`;
    if (nameCommit.current === commitKey) return;
    nameCommit.current = commitKey;
    try {
      await onRenameBand(band, name);
      setNaming(null);
    } catch {
      // The shared controller exposes the persistence failure; keep the editor
      // open so the user can retry or cancel without losing the entered name.
    } finally {
      nameCommit.current = null;
    }
  };
  const editable = onMoveBoundary !== undefined || onMoveSemanticRange !== undefined;
  const handles: BoundaryHandle[] = useMemo(() => !editable ? [] : mode === 'segments'
    ? [...new Set(bands.flatMap(({ startBoundaryIndex, endBoundaryIndex }) => [startBoundaryIndex, endBoundaryIndex]))]
      .filter((index) => index > 0 && index < draft.segments.length)
      .sort((a, b) => a - b)
      .map((index) => ({ key: `boundary:${index}`, z: draft.segments[index]!.zStart, target: { kind: 'segment', index } }))
    : bands.flatMap((band, index) => {
      const label = bandLabel(band, index);
      return [
        { key: `semantic:${band.id}:start`, z: band.zStart, target: { kind: 'semantic' as const, groupId: band.id, edge: 'start' as const, label } },
        { key: `semantic:${band.id}:end`, z: band.zEnd, target: { kind: 'semantic' as const, groupId: band.id, edge: 'end' as const, label } },
      ];
    }).sort((a, b) => a.z - b.z || a.key.localeCompare(b.key)), [bands, draft.segments, editable, mode]);
  const boundaryLanes = useMemo(() => handles.map(({ z }, offset) => {
    const previousIsClose = offset > 0 && Math.abs(z - handles[offset - 1]!.z) * scale < 18;
    const nextIsClose = offset < handles.length - 1 && Math.abs(handles[offset + 1]!.z - z) * scale < 18;
    return previousIsClose ? 1 : nextIsClose ? -1 : 0;
  }), [handles, scale]);
  return <g data-partition-overlay="true">
    {bands.map((band, bandIndex) => {
      const radius = Math.max(...band.segments.map(({ profile }) => profile.maxRadius), 0.1) * 1.04;
      const zStart = visibleDrag?.target.kind === 'segment' && visibleDrag.target.index === band.startBoundaryIndex
        || visibleDrag?.target.kind === 'semantic' && visibleDrag.target.groupId === band.id && visibleDrag.target.edge === 'start' ? visibleDrag.z : band.zStart;
      const zEnd = visibleDrag?.target.kind === 'segment' && visibleDrag.target.index === band.endBoundaryIndex
        || visibleDrag?.target.kind === 'semantic' && visibleDrag.target.groupId === band.id && visibleDrag.target.edge === 'end' ? visibleDrag.z : band.zEnd;
      const polygon = [point(zStart, -radius), point(zEnd, -radius), point(zEnd, radius), point(zStart, radius)];
      const label = bandLabel(band, bandIndex);
      const labelAnchor = point((zStart + zEnd) / 2, radius);
      const labelWidth = Math.max(44, visualLength(label) * 7 + 18);
      const labelY = -18 - (bandIndex % 3) * 22;
      return <g key={band.id} data-partition-id={band.id} data-partition-origin={band.origin} data-segment-ids={band.segmentIds.join(' ')}
        aria-label={`分区 ${label}`}>
        <polygon data-partition-band="true" points={polygon.map((value) => value.join(',')).join(' ')}
          className={`vai-partition-band vai-partition-band--${band.origin}`}
          data-line-style={band.origin === 'document' ? 'solid' : band.origin === 'ai' ? 'dotted' : 'dashed'} />
        <g className="vai-partition-label-anchor" data-screen-space-label={true} transform={screenSpaceTransform(labelAnchor, scale)}
          pointerEvents={previewHeld || !onRenameBand ? 'none' : 'all'}
          role={previewHeld || !onRenameBand ? undefined : 'button'}
          tabIndex={previewHeld || !onRenameBand ? undefined : 0}
          aria-label={previewHeld || !onRenameBand ? undefined : `重命名分区 ${label}`}
          onPointerDown={(event) => { if (onRenameBand && !previewHeld) event.stopPropagation(); }}
          onClick={(event) => {
            if (!onRenameBand || previewHeld) return;
            event.preventDefault();
            event.stopPropagation();
            setNaming({ bandId: band.id, value: band.name ?? '' });
          }}
          onKeyDown={(event) => {
            if (!onRenameBand || previewHeld || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            event.stopPropagation();
            setNaming({ bandId: band.id, value: band.name ?? '' });
          }}>
          <rect className="vai-partition-label-bg" x={-labelWidth / 2} y={labelY - 10} width={labelWidth} height={20} rx={7} />
          {naming?.bandId === band.id ? <foreignObject x={-labelWidth / 2 + 3} y={labelY - 9} width={labelWidth - 6} height={18}>
            <input className="vai-partition-label-input" aria-label={`编辑分区名称 ${label}`} autoFocus maxLength={120}
              value={naming.value}
              onChange={(event) => setNaming({ bandId: band.id, value: event.currentTarget.value })}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onBlur={() => void commitName(band)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setNaming(null);
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  return commitName(band);
                }
              }} />
          </foreignObject> : <text className="vai-partition-label" x={0} y={labelY} textAnchor="middle" dominantBaseline="middle">{label}</text>}
        </g>
      </g>;
    })}
    {!previewHeld && handles.map((handle, offset) => {
      const z = visibleDrag?.target.kind === handle.target.kind && targetKey(visibleDrag.target) === targetKey(handle.target) ? visibleDrag.z : handle.z;
      const anchor = point(z, 0);
      const lane = boundaryLanes[offset]!;
      const position = point(z, lane * 12 / Math.max(scale, 0.01));
      const ariaLabel = handle.target.kind === 'segment'
        ? `移动分区边界 ${handle.target.index}`
        : `移动${handle.target.label}${handle.target.edge === 'start' ? '起点' : '终点'}`;
      return <g key={handle.key}>
        {lane !== 0 && <line className="vai-partition-handle-leader" x1={anchor[0]} y1={anchor[1]} x2={position[0]} y2={position[1]} pointerEvents="none" />}
        <circle aria-label={ariaLabel} data-handle-lane={lane} className="vai-partition-handle" cx={position[0]} cy={position[1]} r={7 / Math.max(scale, 0.01)}
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          pendingCommit.current = null;
          current.current = { target: handle.target, z, lastClientX: event.clientX, lastClientY: event.clientY };
          setDrag(current.current);
          onInteractionActiveChange?.(true);
        }}
        onPointerMove={pointerMove}
        onPointerUp={(event) => finishPointer(event, true)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onLostPointerCapture={(event) => void finishPointer(event, false)} />
      </g>;
    })}
  </g>;
}

function targetKey(target: BoundaryTarget): string {
  return target.kind === 'segment' ? `segment:${target.index}` : `semantic:${target.groupId}:${target.edge}`;
}

function bandLabel(band: PartitionBand, index: number): string {
  const groupLabel = band.name?.trim() || band.semanticType?.trim();
  const names = groupLabel ? [groupLabel] : [...new Set(band.segments.map(({ name, semanticType }) => name?.trim() || semanticType?.trim()).filter(Boolean))] as string[];
  const label = names.length > 0 ? names.join(' · ') : `分区 ${index + 1}`;
  return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}

function visualLength(value: string): number {
  return [...value].reduce((total, character) => total + ((character.codePointAt(0) ?? 0) > 0xff ? 2 : 1), 0);
}
