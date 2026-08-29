// SPDX-License-Identifier: Apache-2.0

import { estimateScreenTextWidth, ScreenSpaceLabel } from '@vectorai/drawing-viewer-react';
import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';

type Candidate = AxialDimensionScheme['candidates'][number];
interface IntervalLayout { candidate: Candidate; lane: number; start: number; end: number }

export function DimensionChainOverlay({ scheme, scale, visible, previewHeld = false }: {
  scheme: AxialDimensionScheme; scale: number; visible: boolean; previewHeld?: boolean;
}) {
  if (!visible) return null;
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const displayed = scheme.displayedCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  const closures = previewHeld ? [] : scheme.closureCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  const conflicts = new Set(scheme.diagnostics.flatMap(({ severity, entityIds }) => severity === 'error' ? entityIds ?? [] : []));
  const layouts = allocateLanes(scheme, [...displayed, ...closures], scale);
  const displayedIds = new Set(displayed.map(({ id }) => id));
  return <g data-dimension-chain-overlay="true" pointerEvents="none">
    {layouts.map((layout) => <IntervalGraphic key={layout.candidate.id} scheme={scheme} layout={layout} scale={scale}
      kind={displayedIds.has(layout.candidate.id) ? 'displayed' : 'closure'}
      conflict={!previewHeld && conflicts.has(layout.candidate.id)} />)}
  </g>;
}

function allocateLanes(scheme: AxialDimensionScheme, candidates: Candidate[], scale: number): IntervalLayout[] {
  const coordinates = new Map(scheme.topology.stations.map(({ id, sourceCoordinate }) => [id, sourceCoordinate]));
  const lanes: Array<Array<{ start: number; end: number }>> = [];
  const padding = 8 / Math.max(scale, 1e-6);
  return candidates.flatMap((candidate): IntervalLayout[] => {
    const first = coordinates.get(candidate.startStationId);
    const second = coordinates.get(candidate.endStationId);
    if (first === undefined || second === undefined) return [];
    const intervalStart = Math.min(first, second);
    const intervalEnd = Math.max(first, second);
    const label = `${candidate.nominalValue} ${scheme.topology.unit}`;
    const halfLabelWidth = (estimateScreenTextWidth(label, 11) + 10) / (2 * Math.max(scale, 1e-6));
    const center = (first + second) / 2;
    const start = Math.min(intervalStart, center - halfLabelWidth);
    const end = Math.max(intervalEnd, center + halfLabelWidth);
    let lane = lanes.findIndex((occupied) => occupied.every((interval) => end + padding < interval.start || start - padding > interval.end));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane]!.push({ start, end });
    return [{ candidate, lane, start: first, end: second }];
  });
}

function IntervalGraphic({ scheme, layout, scale, kind, conflict }: {
  scheme: AxialDimensionScheme; layout: IntervalLayout; scale: number;
  kind: 'displayed' | 'closure'; conflict: boolean;
}) {
  const { candidate, lane } = layout;
  const { origin, direction, normal } = scheme.topology.axis;
  const safeScale = Math.max(scale, 1e-6);
  const offset = (24 + lane * 14) / safeScale;
  const point = (coordinate: number) => [
    origin[0] + direction[0] * coordinate + normal[0] * offset,
    origin[1] + direction[1] * coordinate + normal[1] * offset,
  ] as const;
  const a = point(layout.start);
  const b = point(layout.end);
  const middle = [(a[0] + b[0]) / 2 + normal[0] * 7 / safeScale, (a[1] + b[1]) / 2 + normal[1] * 7 / safeScale] as const;
  const tick = 4 / safeScale;
  return <g className={`vai-dimension-chain-interval vai-dimension-chain-interval--${kind}`}
    data-dimension-displayed={kind === 'displayed' || undefined}
    data-dimension-closure={kind === 'closure' || undefined}
    data-dimension-conflict={conflict || undefined}>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
    <line x1={a[0] - normal[0] * tick} y1={a[1] - normal[1] * tick} x2={a[0] + normal[0] * tick} y2={a[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <line x1={b[0] - normal[0] * tick} y1={b[1] - normal[1] * tick} x2={b[0] + normal[0] * tick} y2={b[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <ScreenSpaceLabel position={middle} viewportScale={scale} background className="vai-dimension-chain-label" data-dimension-lane={lane}>
      {`${candidate.nominalValue} ${scheme.topology.unit}`}
    </ScreenSpaceLabel>
  </g>;
}
