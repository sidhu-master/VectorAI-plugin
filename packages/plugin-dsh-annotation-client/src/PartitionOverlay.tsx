// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import type { PointerEvent } from 'react';
import { useRef, useState } from 'react';
import { partitionBands, type PartitionBand, type PartitionViewMode } from './partition-view-model';

interface BoundaryDrag {
  index: number;
  z: number;
  lastClientX: number;
  lastClientY: number;
}

export function PartitionOverlay({ draft, mode = 'functional', previewHeld, scale, onMoveBoundary }: {
  draft: PartitionDraft; mode: PartitionViewMode; previewHeld: boolean; scale: number;
  onMoveBoundary(index: number, z: number): void | Promise<void>;
}) {
  const [drag, setDrag] = useState<BoundaryDrag | null>(null);
  const current = useRef<BoundaryDrag | null>(null);
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
    setDrag(current.current);
  };
  const finishPointer = async (event: PointerEvent<SVGCircleElement>, releaseCapture: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    const value = current.current;
    current.current = null;
    if (releaseCapture) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture was already lost */ }
    }
    if (!value) return;
    try {
      await onMoveBoundary(value.index, value.z);
      setDrag(null);
    } catch {
      // Keep the local result visible. The controller exposes the persistence error and
      // the user can retry the drag or cancel the whole draft explicitly.
      setDrag(value);
    }
  };
  const bands = partitionBands(draft, mode);
  const boundaryIndices = [...new Set(bands.flatMap(({ startBoundaryIndex, endBoundaryIndex }) => [startBoundaryIndex, endBoundaryIndex]))]
    .filter((index) => index > 0 && index < draft.segments.length)
    .sort((a, b) => a - b);
  const boundaryZ = boundaryIndices.map((index) => draft.segments[index]!.zStart);
  const boundaryLanes = boundaryZ.map((z, offset) => {
    const previousIsClose = offset > 0 && Math.abs(z - boundaryZ[offset - 1]!) * scale < 18;
    const nextIsClose = offset < boundaryZ.length - 1 && Math.abs(boundaryZ[offset + 1]! - z) * scale < 18;
    return previousIsClose ? 1 : nextIsClose ? -1 : 0;
  });
  return <g data-partition-overlay="true">
    {bands.map((band, bandIndex) => {
      const radius = Math.max(...band.segments.map(({ profile }) => profile.maxRadius), 0.1) * 1.04;
      const zStart = drag?.index === band.startBoundaryIndex ? drag.z : band.zStart;
      const zEnd = drag?.index === band.endBoundaryIndex ? drag.z : band.zEnd;
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
        <g className="vai-partition-label-anchor" transform={`translate(${labelAnchor[0]} ${labelAnchor[1]}) scale(${1 / Math.max(scale, 0.01)} ${-1 / Math.max(scale, 0.01)})`} pointerEvents="none">
          <rect className="vai-partition-label-bg" x={-labelWidth / 2} y={labelY - 10} width={labelWidth} height={20} rx={7} />
          <text className="vai-partition-label" x={0} y={labelY} textAnchor="middle" dominantBaseline="middle">{label}</text>
        </g>
      </g>;
    })}
    {!previewHeld && boundaryIndices.map((index, offset) => {
      const z = drag?.index === index ? drag.z : draft.segments[index]!.zStart;
      const anchor = point(z, 0);
      const lane = boundaryLanes[offset]!;
      const position = point(z, lane * 12 / Math.max(scale, 0.01));
      return <g key={`boundary:${index}`}>
        {lane !== 0 && <line className="vai-partition-handle-leader" x1={anchor[0]} y1={anchor[1]} x2={position[0]} y2={position[1]} pointerEvents="none" />}
        <circle aria-label={`移动分区边界 ${index}`} data-handle-lane={lane} className="vai-partition-handle" cx={position[0]} cy={position[1]} r={7 / Math.max(scale, 0.01)}
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          current.current = { index, z, lastClientX: event.clientX, lastClientY: event.clientY };
          setDrag(current.current);
        }}
        onPointerMove={pointerMove}
        onPointerUp={(event) => finishPointer(event, true)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onLostPointerCapture={(event) => void finishPointer(event, false)} />
      </g>;
    })}
  </g>;
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
