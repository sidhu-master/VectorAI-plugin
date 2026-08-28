// SPDX-License-Identifier: Apache-2.0

import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';

export function DimensionChainOverlay({
  scheme,
  scale,
  visible,
  previewHeld = false,
}: {
  scheme: AxialDimensionScheme;
  scale: number;
  visible: boolean;
  previewHeld?: boolean;
}) {
  if (!visible) return null;
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const displayed = scheme.displayedCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  const closures = previewHeld ? [] : scheme.closureCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  const conflicts = new Set(scheme.diagnostics.flatMap(({ severity, entityIds }) => severity === 'error' ? entityIds ?? [] : []));
  return <g data-dimension-chain-overlay="true" pointerEvents="none">
    {displayed.map((candidate, index) => <IntervalGraphic
      key={candidate.id} scheme={scheme} candidate={candidate} scale={scale} level={index}
      kind="displayed" conflict={!previewHeld && conflicts.has(candidate.id)}
    />)}
    {closures.map((candidate, index) => <IntervalGraphic
      key={candidate.id} scheme={scheme} candidate={candidate} scale={scale} level={index}
      kind="closure" conflict={conflicts.has(candidate.id)}
    />)}
  </g>;
}

function IntervalGraphic({ scheme, candidate, scale, level, kind, conflict }: {
  scheme: AxialDimensionScheme;
  candidate: AxialDimensionScheme['candidates'][number];
  scale: number;
  level: number;
  kind: 'displayed' | 'closure';
  conflict: boolean;
}) {
  const start = scheme.topology.stations.find(({ id }) => id === candidate.startStationId);
  const end = scheme.topology.stations.find(({ id }) => id === candidate.endStationId);
  if (!start || !end) return null;
  const { origin, direction, normal } = scheme.topology.axis;
  const offset = (24 + level % 4 * 14) / Math.max(scale, 1e-6);
  const point = (coordinate: number) => [
    origin[0] + direction[0] * coordinate + normal[0] * offset,
    origin[1] + direction[1] * coordinate + normal[1] * offset,
  ] as const;
  const a = point(start.sourceCoordinate);
  const b = point(end.sourceCoordinate);
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  return <g
    className={`vai-dimension-chain-interval vai-dimension-chain-interval--${kind}`}
    data-dimension-displayed={kind === 'displayed' || undefined}
    data-dimension-closure={kind === 'closure' || undefined}
    data-dimension-conflict={conflict || undefined}
  >
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
    <line x1={a[0]} y1={a[1] - 4 / scale} x2={a[0]} y2={a[1] + 4 / scale} vectorEffect="non-scaling-stroke" />
    <line x1={b[0]} y1={b[1] - 4 / scale} x2={b[0]} y2={b[1] + 4 / scale} vectorEffect="non-scaling-stroke" />
    <text x={middle[0]} y={middle[1] - 5 / scale} textAnchor="middle" fontSize={11 / scale}>
      {candidate.nominalValue} {scheme.topology.unit}
    </text>
  </g>;
}
