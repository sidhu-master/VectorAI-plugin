// SPDX-License-Identifier: Apache-2.0

import { estimateScreenTextWidth, ScreenSpaceLabel } from '@vectorai/drawing-viewer-react';
import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';
import { useRef, useState, type PointerEvent } from 'react';

type Candidate = AxialDimensionScheme['candidates'][number];
type Role = 'parent' | 'child' | 'closure' | 'standalone';
interface IntervalLayout {
  candidate: Candidate;
  chainId?: string;
  chainIndex: number;
  role: Role;
  memberships: Array<{ chainId: string; chainIndex: number; role: Exclude<Role, 'standalone'> }>;
  lane: number;
  start: number;
  end: number;
  automaticOffset: number;
  manualOffset: number;
}
interface DragState {
  candidateId: string;
  pointerId: number;
  startClient: readonly [number, number];
  startManualOffset: number;
  automaticOffset: number;
}

export function DimensionChainOverlay({
  scheme,
  scale,
  radialExtent = 0,
  visible,
  previewHeld = false,
  onMoveCandidate,
}: {
  scheme: AxialDimensionScheme;
  scale: number;
  radialExtent?: number;
  visible: boolean;
  previewHeld?: boolean;
  onMoveCandidate?(candidateId: string, normalOffset: number): void | Promise<void>;
}) {
  const [dragPreview, setDragPreview] = useState<{ candidateId: string; manualOffset: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  if (!visible) return null;
  const conflicts = new Set(scheme.diagnostics.flatMap(({ severity, entityIds }) => severity === 'error' ? entityIds ?? [] : []));
  const layouts = layoutIntervals(scheme, scale, radialExtent, previewHeld);
  const layoutByCandidate = new Map(layouts.map((layout) => [layout.candidate.id, layout]));
  const grouped = scheme.chains.map((chain, chainIndex) => ({
    chain,
    chainIndex,
    layouts: layouts.filter(({ chainId }) => chainId === chain.id),
  }));
  const standalone = layouts.filter(({ chainId }) => chainId === undefined);
  const screenNormal = normalized([scheme.topology.axis.normal[0], -scheme.topology.axis.normal[1]]);
  const safeScale = Math.max(scale, 1e-6);

  const beginDrag = (layout: IntervalLayout, event: PointerEvent<SVGGElement>) => {
    if (event.button !== 0 || !onMoveCandidate || previewHeld) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      candidateId: layout.candidate.id,
      pointerId: event.pointerId,
      startClient: [event.clientX, event.clientY],
      startManualOffset: layout.manualOffset,
      automaticOffset: layout.automaticOffset,
    };
  };
  const updateDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0]
      + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const minimum = radialExtent + 14 / safeScale;
    const manualOffset = Math.max(drag.startManualOffset + projected, minimum - drag.automaticOffset);
    setDragPreview({ candidateId: drag.candidateId, manualOffset });
  };
  const finishDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0]
      + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const minimum = radialExtent + 14 / safeScale;
    const manualOffset = Math.max(drag.startManualOffset + projected, minimum - drag.automaticOffset);
    dragRef.current = null;
    setDragPreview(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    void Promise.resolve(onMoveCandidate?.(drag.candidateId, roundOffset(manualOffset))).catch(() => undefined);
  };
  const cancelDrag = (event: PointerEvent<SVGGElement>, releaseCapture: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    setDragPreview(null);
    if (releaseCapture) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderInterval = (layout: IntervalLayout) => {
    const manualOffset = dragPreview?.candidateId === layout.candidate.id ? dragPreview.manualOffset : layout.manualOffset;
    return <IntervalGraphic
      key={layout.candidate.id}
      scheme={scheme}
      layout={{ ...layout, manualOffset }}
      scale={scale}
      radialExtent={radialExtent}
      dragAxis={Math.abs(screenNormal[0]) > Math.abs(screenNormal[1]) ? 'x' : 'y'}
      conflict={!previewHeld && conflicts.has(layout.candidate.id)}
      draggable={Boolean(onMoveCandidate) && !previewHeld}
      onPointerDown={(event) => beginDrag(layout, event)}
      onPointerMove={updateDrag}
      onPointerUp={finishDrag}
      onPointerCancel={(event) => cancelDrag(event, true)}
      onLostPointerCapture={(event) => cancelDrag(event, false)}
    />;
  };

  return <g data-dimension-chain-overlay="true">
    {grouped.map(({ chain, chainIndex, layouts: owned }) => <g
      key={chain.id}
      className={`vai-dimension-chain-group vai-dimension-chain-group--tone-${chainIndex % 3}`}
      data-dimension-chain-group={chain.id}
    >
      {owned.map(renderInterval)}
      {!previewHeld && <ChainBracket
        scheme={scheme}
        chain={chain}
        chainIndex={chainIndex}
        layoutByCandidate={layoutByCandidate}
        dragPreview={dragPreview}
        scale={scale}
      />}
    </g>)}
    {standalone.map(renderInterval)}
  </g>;
}

// Shared with the workspace's Fit action; keeping it beside the layout engine
// guarantees the fitted extent uses the same lane allocation as rendering.
// eslint-disable-next-line react-refresh/only-export-components
export function dimensionChainFitPadding({ scheme, radialExtent, scale, viewport }: {
  scheme: AxialDimensionScheme;
  radialExtent: number;
  scale: number;
  viewport: { width: number; height: number };
}): number {
  const safeScale = Math.max(scale, 1e-6);
  const layouts = layoutIntervals(scheme, safeScale, radialExtent, false);
  if (layouts.length === 0) return 1.2;
  const normal = normalized(scheme.topology.axis.normal);
  const availablePixels = Math.min(
    Math.abs(normal[0]) > 1e-6 ? viewport.width / Math.abs(normal[0]) : Number.POSITIVE_INFINITY,
    Math.abs(normal[1]) > 1e-6 ? viewport.height / Math.abs(normal[1]) : Number.POSITIVE_INFINITY,
  );
  const structuralPixels = Math.max(...layouts.map(({ automaticOffset }) => (
    (automaticOffset - radialExtent) * safeScale
  ))) + 24;
  const maxManualOffset = Math.max(0, ...layouts.map(({ manualOffset }) => manualOffset));
  const stationCoordinates = scheme.topology.stations.map(({ sourceCoordinate }) => sourceCoordinate);
  const axisMin = Number.isFinite(scheme.topology.axis.zMin) ? scheme.topology.axis.zMin : Math.min(...stationCoordinates);
  const axisMax = Number.isFinite(scheme.topology.axis.zMax) ? scheme.topology.axis.zMax : Math.max(...stationCoordinates);
  const axisSpan = Math.max(0, axisMax - axisMin);
  const referenceRadius = Math.max(radialExtent, axisSpan * 0.05, 1);
  const freeFraction = Math.max(0.2, 1 - (2 * structuralPixels) / Math.max(availablePixels, 1));
  return Math.max(1.2, ((referenceRadius + maxManualOffset) / referenceRadius) / freeFraction * 1.05);
}

function layoutIntervals(
  scheme: AxialDimensionScheme,
  scale: number,
  radialExtent: number,
  previewHeld: boolean,
): IntervalLayout[] {
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const coordinates = new Map(scheme.topology.stations.map(({ id, sourceCoordinate }) => [id, sourceCoordinate]));
  const closures = previewHeld ? new Set<string>() : new Set(scheme.closureCandidateIds);
  const visibleIds = [...scheme.displayedCandidateIds, ...closures];
  const membershipByCandidate = candidateMemberships(scheme);
  const chainDepths = chainDepthIndex(scheme);
  const maxDepth = Math.max(0, ...chainDepths.values());
  const safeScale = Math.max(scale, 1e-6);
  const base = radialExtent + 28 / safeScale;
  const manual = new Map(scheme.layout?.candidateNormalOffsets.map(({ candidateId, normalOffset }) => [candidateId, normalOffset]) ?? []);
  const occupiedByRow = new Map<number, Array<{ start: number; end: number; lane: number }>>();
  return [...new Set(visibleIds)].flatMap((candidateId): IntervalLayout[] => {
    const candidate = candidates.get(candidateId);
    if (!candidate) return [];
    const first = coordinates.get(candidate.startStationId);
    const second = coordinates.get(candidate.endStationId);
    if (first === undefined || second === undefined) return [];
    const memberships = membershipByCandidate.get(candidateId) ?? [];
    const owner = primaryMembership(memberships);
    const role = closures.has(candidateId) ? 'closure' : owner?.role ?? 'standalone';
    const depth = owner === undefined ? 0 : chainDepths.get(owner.chainId) ?? 0;
    const row = role === 'parent' ? maxDepth + 1 : role === 'standalone' ? maxDepth + 2 : maxDepth - depth;
    const label = `${candidate.nominalValue} ${scheme.topology.unit}`;
    const halfLabelWidth = (estimateScreenTextWidth(label, 11) + 10) / (2 * safeScale);
    const center = (first + second) / 2;
    const visual = { start: Math.min(first, second, center - halfLabelWidth), end: Math.max(first, second, center + halfLabelWidth) };
    const occupied = occupiedByRow.get(row) ?? [];
    let lane = 0;
    while (occupied.some((item) => item.lane === lane && overlaps(visual, item, 8 / safeScale))) lane += 1;
    occupied.push({ start: visual.start, end: visual.end, lane });
    occupiedByRow.set(row, occupied);
    const automaticOffset = base + (row * 18 + lane * 14) / safeScale;
    const minimumOffset = radialExtent + 14 / safeScale;
    return [{
      candidate,
      ...(owner === undefined ? {} : { chainId: owner.chainId }),
      chainIndex: owner?.chainIndex ?? -1,
      role,
      memberships,
      lane,
      start: first,
      end: second,
      automaticOffset,
      manualOffset: Math.max(manual.get(candidateId) ?? 0, minimumOffset - automaticOffset),
    }];
  });
}

function candidateMemberships(scheme: AxialDimensionScheme): Map<string, Array<{
  chainId: string;
  chainIndex: number;
  role: Exclude<Role, 'standalone'>;
}>> {
  const result = new Map<string, Array<{ chainId: string; chainIndex: number; role: Exclude<Role, 'standalone'> }>>();
  const add = (candidateId: string, membership: { chainId: string; chainIndex: number; role: Exclude<Role, 'standalone'> }) => {
    result.set(candidateId, [...(result.get(candidateId) ?? []), membership]);
  };
  scheme.chains.forEach((chain, chainIndex) => {
    add(chain.parentCandidateId, { chainId: chain.id, chainIndex, role: 'parent' });
    for (const candidateId of chain.childCandidateIds) add(candidateId, { chainId: chain.id, chainIndex, role: 'child' });
    add(chain.closureCandidateId, { chainId: chain.id, chainIndex, role: 'closure' });
  });
  return result;
}

function primaryMembership(memberships: IntervalLayout['memberships']): IntervalLayout['memberships'][number] | undefined {
  return memberships.find(({ role }) => role === 'closure')
    ?? memberships.find(({ role }) => role === 'parent')
    ?? memberships[0];
}

function chainDepthIndex(scheme: AxialDimensionScheme): Map<string, number> {
  const byParentCandidate = new Map(scheme.chains.map((chain) => [chain.parentCandidateId, chain]));
  const parentByChain = new Map<string, string>();
  for (const chain of scheme.chains) {
    const parent = scheme.chains.find((candidate) => candidate.childCandidateIds.includes(chain.parentCandidateId));
    if (parent) parentByChain.set(chain.id, parent.id);
  }
  const result = new Map<string, number>();
  const depth = (chainId: string): number => {
    const cached = result.get(chainId);
    if (cached !== undefined) return cached;
    const parent = parentByChain.get(chainId);
    const value = parent === undefined ? 0 : depth(parent) + 1;
    result.set(chainId, value);
    return value;
  };
  for (const chain of byParentCandidate.values()) depth(chain.id);
  return result;
}

function IntervalGraphic({ scheme, layout, scale, radialExtent, dragAxis, conflict, draggable, ...pointerHandlers }: {
  scheme: AxialDimensionScheme;
  layout: IntervalLayout;
  scale: number;
  radialExtent: number;
  dragAxis: 'x' | 'y';
  conflict: boolean;
  draggable: boolean;
  onPointerDown(event: PointerEvent<SVGGElement>): void;
  onPointerMove(event: PointerEvent<SVGGElement>): void;
  onPointerUp(event: PointerEvent<SVGGElement>): void;
  onPointerCancel(event: PointerEvent<SVGGElement>): void;
  onLostPointerCapture(event: PointerEvent<SVGGElement>): void;
}) {
  const { candidate, lane, role } = layout;
  const { origin, direction, normal } = scheme.topology.axis;
  const safeScale = Math.max(scale, 1e-6);
  const offset = layout.automaticOffset + layout.manualOffset;
  const point = (coordinate: number, normalOffset: number) => [
    origin[0] + direction[0] * coordinate + normal[0] * normalOffset,
    origin[1] + direction[1] * coordinate + normal[1] * normalOffset,
  ] as const;
  const a = point(layout.start, offset);
  const b = point(layout.end, offset);
  const witnessA = point(layout.start, radialExtent + 3 / safeScale);
  const witnessB = point(layout.end, radialExtent + 3 / safeScale);
  const middle = [(a[0] + b[0]) / 2 + normal[0] * 7 / safeScale, (a[1] + b[1]) / 2 + normal[1] * 7 / safeScale] as const;
  const tick = 4 / safeScale;
  return <g
    className={`vai-dimension-chain-interval vai-dimension-chain-interval--${role}`}
    data-dimension-candidate-id={candidate.id}
    data-dimension-chain-id={layout.chainId}
    data-dimension-chain-index={layout.chainIndex}
    data-dimension-role={role}
    data-dimension-chain-memberships={layout.memberships.map(({ chainId }) => chainId).join(' ')}
    data-dimension-membership-roles={layout.memberships.map(({ role }) => role).join(' ')}
    data-dimension-shared={layout.memberships.length > 1 || undefined}
    data-dimension-lane={lane}
    data-normal-offset={offset}
    data-dimension-displayed={role !== 'closure' || undefined}
    data-dimension-closure={role === 'closure' || undefined}
    data-dimension-conflict={conflict || undefined}
    data-dimension-draggable={draggable || undefined}
    data-dimension-drag-axis={dragAxis}
    pointerEvents={draggable ? 'all' : 'none'}
    {...pointerHandlers}
  >
    <line className="vai-dimension-chain-extension" data-dimension-extension="start" x1={witnessA[0]} y1={witnessA[1]} x2={a[0]} y2={a[1]} vectorEffect="non-scaling-stroke" />
    <line className="vai-dimension-chain-extension" data-dimension-extension="end" x1={witnessB[0]} y1={witnessB[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
    <line className="vai-dimension-chain-line" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
    <line x1={a[0] - normal[0] * tick} y1={a[1] - normal[1] * tick} x2={a[0] + normal[0] * tick} y2={a[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <line x1={b[0] - normal[0] * tick} y1={b[1] - normal[1] * tick} x2={b[0] + normal[0] * tick} y2={b[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <ScreenSpaceLabel position={middle} viewportScale={scale} background className="vai-dimension-chain-label" data-dimension-lane={lane}>
      {`${candidate.nominalValue} ${scheme.topology.unit}`}
    </ScreenSpaceLabel>
  </g>;
}

function ChainBracket({ scheme, chain, chainIndex, layoutByCandidate, dragPreview, scale }: {
  scheme: AxialDimensionScheme;
  chain: AxialDimensionScheme['chains'][number];
  chainIndex: number;
  layoutByCandidate: ReadonlyMap<string, IntervalLayout>;
  dragPreview: { candidateId: string; manualOffset: number } | null;
  scale: number;
}) {
  const layouts = [chain.parentCandidateId, ...chain.childCandidateIds, chain.closureCandidateId]
    .flatMap((id) => layoutByCandidate.get(id) ?? []);
  if (layouts.length < 2) return null;
  const safeScale = Math.max(scale, 1e-6);
  const { origin, direction, normal } = scheme.topology.axis;
  const offsetOf = (layout: IntervalLayout) => layout.automaticOffset
    + (dragPreview?.candidateId === layout.candidate.id ? dragPreview.manualOffset : layout.manualOffset);
  const offsets = layouts.map(offsetOf);
  const coordinate = Math.min(...layouts.map(({ start, end }) => Math.min(start, end))) - 12 / safeScale;
  const near = Math.min(...offsets);
  const far = Math.max(...offsets);
  const point = (normalOffset: number) => [
    origin[0] + direction[0] * coordinate + normal[0] * normalOffset,
    origin[1] + direction[1] * coordinate + normal[1] * normalOffset,
  ] as const;
  const a = point(near);
  const b = point(far);
  const cap = 6 / safeScale;
  const title = point(far + 12 / safeScale);
  return <g className="vai-dimension-chain-bracket" data-dimension-chain-bracket={chain.id} pointerEvents="none">
    <path d={`M ${a[0] + direction[0] * cap} ${a[1] + direction[1] * cap} L ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${b[0] + direction[0] * cap} ${b[1] + direction[1] * cap}`} fill="none" vectorEffect="non-scaling-stroke" />
    {layouts.map((layout) => {
      const member = point(offsetOf(layout));
      return <line
        key={layout.candidate.id}
        data-dimension-chain-member={layout.candidate.id}
        x1={member[0]}
        y1={member[1]}
        x2={member[0] + direction[0] * cap}
        y2={member[1] + direction[1] * cap}
        vectorEffect="non-scaling-stroke"
      />;
    })}
    <ScreenSpaceLabel position={title} viewportScale={scale} background className="vai-dimension-chain-title" data-dimension-chain-title={chain.id}>
      {`尺寸链 ${chainIndex + 1}`}
    </ScreenSpaceLabel>
  </g>;
}

function overlaps(left: { start: number; end: number }, right: { start: number; end: number }, padding: number): boolean {
  return !(left.end + padding < right.start || left.start - padding > right.end);
}

function normalized(value: readonly [number, number]): readonly [number, number] {
  const length = Math.hypot(value[0], value[1]) || 1;
  return [value[0] / length, value[1] / length];
}

function roundOffset(value: number): number { return Math.round(value * 1_000) / 1_000; }
