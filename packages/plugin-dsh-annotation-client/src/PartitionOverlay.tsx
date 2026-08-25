// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import type { PointerEvent } from 'react';
import { useRef, useState } from 'react';

export function PartitionOverlay({ draft, previewHeld, scale, onMoveBoundary }: {
  draft: PartitionDraft; previewHeld: boolean; scale: number;
  onMoveBoundary(index: number, z: number): void;
}) {
  const [drag, setDrag] = useState<{ index: number; z: number } | null>(null);
  const current = useRef<{ index: number; z: number } | null>(null);
  const point = (z: number, r: number): [number, number] => [
    draft.axis.origin[0]! + draft.axis.direction[0]! * z + draft.axis.normal[0]! * r,
    draft.axis.origin[1]! + draft.axis.direction[1]! * z + draft.axis.normal[1]! * r,
  ];
  const pointerMove = (event: PointerEvent<SVGCircleElement>) => {
    if (!current.current) return;
    const delta = (event.movementX * draft.axis.direction[0]! - event.movementY * draft.axis.direction[1]!) / Math.max(scale, 1e-6);
    current.current = { ...current.current, z: current.current.z + delta };
    setDrag(current.current);
  };
  const pointerUp = (event: PointerEvent<SVGCircleElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const value = current.current;
    current.current = null;
    setDrag(null);
    if (value) onMoveBoundary(value.index, value.z);
  };
  return <g data-partition-overlay="true">
    {draft.segments.map((segment, index) => {
      const radius = Math.max(segment.profile.maxRadius, 0.1) * 1.04;
      const polygon = [point(segment.zStart, -radius), point(segment.zEnd, -radius), point(segment.zEnd, radius), point(segment.zStart, radius)];
      const origin = segment.semanticEvidenceIds.map((id) => draft.evidence.find((item) => item.id === id)?.origin).find(Boolean) ?? 'geometry';
      return <g key={segment.id} data-partition-origin={origin} data-segment-id={segment.id}>
        <polygon points={polygon.map((value) => value.join(',')).join(' ')} className={`vai-partition-band vai-partition-band--${origin}`} data-line-style={origin === 'document' ? 'solid' : origin === 'ai' ? 'dotted' : 'dashed'} />
        <g transform={`translate(${point((segment.zStart + segment.zEnd) / 2, 0).join(' ')}) scale(1 -1)`}>
          <text className="vai-partition-label" textAnchor="middle">{segment.name ?? `S${index + 1}`}</text>
        </g>
      </g>;
    })}
    {!previewHeld && draft.segments.slice(0, -1).map((segment, offset) => {
      const index = offset + 1;
      const z = drag?.index === index ? drag.z : segment.zEnd;
      const position = point(z, 0);
      return <circle key={`boundary:${index}`} aria-label={`移动分区边界 ${index}`} className="vai-partition-handle" cx={position[0]} cy={position[1]} r={7 / Math.max(scale, 0.01)}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); current.current = { index, z }; setDrag(current.current); }}
        onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />;
    })}
  </g>;
}
