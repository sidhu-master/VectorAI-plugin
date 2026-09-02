// SPDX-License-Identifier: Apache-2.0

import type { ToleranceProjection } from '@vectorai/drawing-core';
import { estimateScreenTextWidth, formatPortableTolerance, ScreenSpaceLabel, screenSpaceTransform } from '@vectorai/drawing-viewer-react';
import { axialDimensionIntentId } from '@vectorai/engineering-annotation';
import { allocateAxialDimensionLanes, type AxialDimensionScheme } from '@vectorai/plugin-space-contracts';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react';

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
  groupOffset: number;
  minimumGroupOffset: number;
  label: string;
  toleranceProjection?: ToleranceProjection;
}
interface DragState {
  target: { type: 'chain' | 'candidate'; id: string };
  pointerId: number;
  startClient: readonly [number, number];
  startGroupOffset: number;
  minimumGroupOffset: number;
}
interface DimensionContextMenuState {
  candidateId: string;
  chainId?: string;
  position: readonly [number, number];
}

export function DimensionChainOverlay({
  scheme,
  scale,
  radialExtent = 0,
  visible,
  previewHeld = false,
  visibleChainIds,
  onMoveChain,
  onMoveCandidate,
  onChooseClosure,
  onSetTolerance,
  toleranceByIntentId,
}: {
  scheme: AxialDimensionScheme;
  scale: number;
  radialExtent?: number;
  visible: boolean;
  previewHeld?: boolean;
  visibleChainIds?: ReadonlySet<string>;
  onMoveChain?(chainId: string, normalOffset: number): void | Promise<void>;
  onMoveCandidate?(candidateId: string, normalOffset: number): void | Promise<void>;
  onChooseClosure?(chainId: string, candidateId: string): void | Promise<void>;
  onSetTolerance?(dimensionIntentId: string): void | Promise<void>;
  toleranceByIntentId?: ReadonlyMap<string, ToleranceProjection>;
}) {
  const [dragPreviews, setDragPreviews] = useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = useState<DimensionContextMenuState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || contextMenu === null) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-dimension-context-menu]') === null) setContextMenu(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
    };
  }, [contextMenu]);
  if (!visible) return null;
  const conflicts = new Set(scheme.diagnostics.flatMap(({ severity, entityIds }) => severity === 'error' ? entityIds ?? [] : []));
  const layouts = layoutIntervals(scheme, scale, radialExtent, previewHeld, dragPreviews, toleranceByIntentId);
  const layoutByCandidate = new Map(layouts.map((layout) => [layout.candidate.id, layout]));
  const grouped = scheme.chains
    .map((chain, chainIndex) => ({
      chain,
      chainIndex,
      layouts: layouts.filter(({ chainId }) => chainId === chain.id),
    }))
    .filter(({ chain }) => visibleChainIds === undefined || visibleChainIds.has(chain.id));
  const standalone = layouts.filter(({ chainId }) => chainId === undefined);
  const screenNormal = normalized([scheme.topology.axis.normal[0], -scheme.topology.axis.normal[1]]);
  const safeScale = Math.max(scale, 1e-6);

  const beginDrag = (layout: IntervalLayout, event: PointerEvent<SVGGElement>) => {
    const target = layout.chainId === undefined
      ? { type: 'candidate' as const, id: layout.candidate.id }
      : { type: 'chain' as const, id: layout.chainId };
    const enabled = target.type === 'chain' ? Boolean(onMoveChain) : Boolean(onMoveCandidate);
    if (event.button !== 0 || !enabled || previewHeld) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClient: [event.clientX, event.clientY],
      startGroupOffset: layout.groupOffset,
      minimumGroupOffset: layout.minimumGroupOffset,
    };
  };
  const updateDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0]
      + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const targetKey = `${drag.target.type}:${drag.target.id}`;
    setDragPreviews((current) => ({
      ...current,
      [targetKey]: Math.max(drag.startGroupOffset + projected, drag.minimumGroupOffset),
    }));
  };
  const finishDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0]
      + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const groupOffset = Math.max(drag.startGroupOffset + projected, drag.minimumGroupOffset);
    const targetKey = `${drag.target.type}:${drag.target.id}`;
    dragRef.current = null;
    setDragPreviews((current) => ({ ...current, [targetKey]: groupOffset }));
    event.currentTarget.releasePointerCapture(event.pointerId);
    const save = drag.target.type === 'chain'
      ? onMoveChain?.(drag.target.id, roundOffset(groupOffset))
      : onMoveCandidate?.(drag.target.id, roundOffset(groupOffset));
    void Promise.resolve(save)
      .then(() => window.requestAnimationFrame(() => {
        setDragPreviews((current) => {
          if (!(targetKey in current)) return current;
          const next = { ...current };
          delete next[targetKey];
          return next;
        });
      }))
      .catch(() => setDragPreviews((current) => {
        const next = { ...current };
        delete next[targetKey];
        return next;
      }));
  };
  const cancelDrag = (event: PointerEvent<SVGGElement>, releaseCapture: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    const targetKey = `${drag.target.type}:${drag.target.id}`;
    setDragPreviews((current) => {
      const next = { ...current };
      delete next[targetKey];
      return next;
    });
    if (releaseCapture) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderInterval = (layout: IntervalLayout, standaloneDraggable = false, groupedDraggable = false) => {
    const ownsPointerHandlers = standaloneDraggable && Boolean(onMoveCandidate) && !previewHeld;
    const draggable = groupedDraggable || ownsPointerHandlers;
    const closureChainId = onChooseClosure && layout.chainId !== undefined
      && closureOptionsForCandidate(scheme, layout.candidate.id, layout.chainId).length > 0
      ? layout.chainId
      : undefined;
    return <IntervalGraphic
      key={layout.candidate.id}
      scheme={scheme}
      layout={layout}
      scale={scale}
      radialExtent={radialExtent}
      dragAxis={Math.abs(screenNormal[0]) > Math.abs(screenNormal[1]) ? 'x' : 'y'}
      conflict={!previewHeld && conflicts.has(layout.candidate.id)}
      draggable={draggable}
      onPointerDown={ownsPointerHandlers ? (event) => beginDrag(layout, event) : undefined}
      onPointerMove={ownsPointerHandlers ? updateDrag : undefined}
      onPointerUp={ownsPointerHandlers ? finishDrag : undefined}
      onPointerCancel={ownsPointerHandlers ? (event) => cancelDrag(event, true) : undefined}
      onLostPointerCapture={ownsPointerHandlers ? (event) => cancelDrag(event, false) : undefined}
      onContextMenu={onSetTolerance || closureChainId !== undefined
        ? (event, position) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({
            candidateId: layout.candidate.id,
            ...(closureChainId === undefined ? {} : { chainId: closureChainId }),
            position,
          });
        }
        : undefined}
    />;
  };

  const dragAxis = Math.abs(screenNormal[0]) > Math.abs(screenNormal[1]) ? 'x' : 'y';
  return <g
    className="vai-dimension-chain-overlay"
    data-dimension-chain-overlay="true"
    onPointerDown={() => setContextMenu(null)}
  >
    {grouped.map(({ chain, chainIndex, layouts: owned }) => {
      const draggable = Boolean(onMoveChain) && !previewHeld && owned.length > 0;
      return <g
        key={chain.id}
        className={`vai-dimension-chain-group vai-dimension-chain-group--tone-${chainIndex % 3}`}
        data-dimension-chain-group={chain.id}
        data-dimension-draggable={draggable || undefined}
        data-dimension-drag-axis={dragAxis}
        pointerEvents={draggable || Boolean(onChooseClosure) || Boolean(onSetTolerance) ? 'all' : 'none'}
        onPointerDown={draggable ? (event) => beginDrag(owned[0]!, event) : undefined}
        onPointerMove={draggable ? updateDrag : undefined}
        onPointerUp={draggable ? finishDrag : undefined}
        onPointerCancel={draggable ? (event) => cancelDrag(event, true) : undefined}
        onLostPointerCapture={draggable ? (event) => cancelDrag(event, false) : undefined}
      >
      {owned.map((layout) => renderInterval(layout, false, draggable))}
      {!previewHeld && <ChainBracket
        scheme={scheme}
        chain={chain}
        chainIndex={chainIndex}
        layoutByCandidate={layoutByCandidate}
        scale={scale}
        draggable={draggable}
      />}
    </g>;
    })}
    {standalone.map((layout) => renderInterval(layout, true))}
    {contextMenu && <DimensionContextMenu
      scheme={scheme}
      candidateId={contextMenu.candidateId}
      chainId={contextMenu.chainId}
      position={contextMenu.position}
      scale={safeScale}
      onChoose={(chainId) => {
        setContextMenu(null);
        void Promise.resolve(onChooseClosure?.(chainId, contextMenu.candidateId)).catch(() => undefined);
      }}
      onSetTolerance={onSetTolerance === undefined ? undefined : () => {
        setContextMenu(null);
        void Promise.resolve(onSetTolerance(axialDimensionIntentId(contextMenu.candidateId))).catch(() => undefined);
      }}
    />}
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
  dragPreviews: Readonly<Record<string, number>> = {},
  toleranceByIntentId?: ReadonlyMap<string, ToleranceProjection>,
): IntervalLayout[] {
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const coordinates = new Map(scheme.topology.stations.map(({ id, sourceCoordinate }) => [id, sourceCoordinate]));
  const closures = previewHeld ? new Set<string>() : new Set(scheme.closureCandidateIds);
  const visibleIds = [...scheme.displayedCandidateIds, ...closures];
  const membershipByCandidate = candidateMemberships(scheme);
  const safeScale = Math.max(scale, 1e-6);
  const base = radialExtent + 28 / safeScale;
  const manual = new Map(scheme.layout?.candidateNormalOffsets.map(({ candidateId, normalOffset }) => [candidateId, normalOffset]) ?? []);
  const chainOffsets = new Map(scheme.layout?.chainNormalOffsets.map(({ chainId, normalOffset }) => [chainId, normalOffset]) ?? []);
  const prepared = [...new Set(visibleIds)].flatMap((candidateId) => {
    const candidate = candidates.get(candidateId);
    if (!candidate) return [];
    const first = coordinates.get(candidate.startStationId);
    const second = coordinates.get(candidate.endStationId);
    if (first === undefined || second === undefined) return [];
    const memberships = membershipByCandidate.get(candidateId) ?? [];
    const owner = primaryMembership(memberships);
    const role: Role = closures.has(candidateId) ? 'closure' : owner?.role ?? 'standalone';
    const toleranceProjection = toleranceByIntentId?.get(axialDimensionIntentId(candidate.id));
    const tolerance = formatPortableTolerance(toleranceProjection, scheme.topology.unit);
    const label = `${candidate.nominalValue} ${scheme.topology.unit}${tolerance === undefined ? '' : ` ${tolerance}`}`;
    const halfLabelWidth = cadDimensionLabelWidth(candidate.nominalValue, scheme.topology.unit, toleranceProjection) / (2 * safeScale);
    const center = (first + second) / 2;
    const visual = { start: Math.min(first, second, center - halfLabelWidth), end: Math.max(first, second, center + halfLabelWidth) };
    return [{ candidate, first, second, memberships, owner, role, visual, label, toleranceProjection }];
  });
  const lanes = allocateAxialDimensionLanes(prepared.map(({ candidate, first, second, visual }) => ({
    id: candidate.id,
    span: Math.abs(second - first),
    occupiedStart: visual.start,
    occupiedEnd: visual.end,
  })), 8 / safeScale);
  const layouts = prepared.map(({ candidate, first, second, memberships, owner, role, label, toleranceProjection }): IntervalLayout => {
    const lane = lanes.get(candidate.id) ?? 0;
    const automaticOffset = base + lane * 26 / safeScale;
    const minimumOffset = radialExtent + 14 / safeScale;
    const candidateOffset = manual.get(candidate.id) ?? 0;
    const targetKey = owner === undefined ? `candidate:${candidate.id}` : `chain:${owner.chainId}`;
    const requestedGroupOffset = dragPreviews[targetKey]
      ?? (owner === undefined ? candidateOffset : chainOffsets.get(owner.chainId) ?? 0);
    return {
      candidate,
      label,
      ...(toleranceProjection === undefined ? {} : { toleranceProjection }),
      ...(owner === undefined ? {} : { chainId: owner.chainId }),
      chainIndex: owner?.chainIndex ?? -1,
      role,
      memberships,
      lane,
      start: first,
      end: second,
      automaticOffset,
      manualOffset: owner === undefined ? 0 : candidateOffset,
      groupOffset: requestedGroupOffset,
      minimumGroupOffset: minimumOffset - automaticOffset - (owner === undefined ? 0 : candidateOffset),
    };
  });
  const minimumByTarget = new Map<string, number>();
  for (const layout of layouts) {
    const targetKey = layout.chainId === undefined ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`;
    minimumByTarget.set(targetKey, Math.max(minimumByTarget.get(targetKey) ?? Number.NEGATIVE_INFINITY, layout.minimumGroupOffset));
  }
  return layouts.map((layout) => ({
    ...layout,
    groupOffset: Math.max(
      layout.groupOffset,
      minimumByTarget.get(layout.chainId === undefined ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`) ?? Number.NEGATIVE_INFINITY,
    ),
    minimumGroupOffset: minimumByTarget.get(
      layout.chainId === undefined ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`,
    ) ?? layout.minimumGroupOffset,
    manualOffset: layout.manualOffset + Math.max(
      layout.groupOffset,
      minimumByTarget.get(layout.chainId === undefined ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`) ?? Number.NEGATIVE_INFINITY,
    ),
  }));
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

function IntervalGraphic({ scheme, layout, scale, radialExtent, dragAxis, conflict, draggable, ...pointerHandlers }: {
  scheme: AxialDimensionScheme;
  layout: IntervalLayout;
  scale: number;
  radialExtent: number;
  dragAxis: 'x' | 'y';
  conflict: boolean;
  draggable: boolean;
  onPointerDown?(event: PointerEvent<SVGGElement>): void;
  onPointerMove?(event: PointerEvent<SVGGElement>): void;
  onPointerUp?(event: PointerEvent<SVGGElement>): void;
  onPointerCancel?(event: PointerEvent<SVGGElement>): void;
  onLostPointerCapture?(event: PointerEvent<SVGGElement>): void;
  onContextMenu?(event: ReactMouseEvent<SVGGElement>, position: readonly [number, number]): void;
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
  const lineMiddle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const labelOffset = (role === 'closure' ? 14 : 11) / safeScale;
  const middle = [lineMiddle[0] + normal[0] * labelOffset, lineMiddle[1] + normal[1] * labelOffset] as const;
  const screenLength = Math.abs(layout.end - layout.start) * safeScale;
  const closureDash = screenLength < 24
    ? `${Math.max(1, screenLength / 5) / safeScale} ${Math.max(.8, screenLength / 10) / safeScale}`
    : `${5 / safeScale} ${4 / safeScale}`;
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
    pointerEvents={draggable || pointerHandlers.onContextMenu ? 'all' : 'none'}
    {...pointerHandlers}
    onContextMenu={pointerHandlers.onContextMenu
      ? (event) => pointerHandlers.onContextMenu?.(event, middle)
      : undefined}
  >
    <line className="vai-dimension-chain-extension" data-dimension-extension="start" x1={witnessA[0]} y1={witnessA[1]} x2={a[0]} y2={a[1]} vectorEffect="non-scaling-stroke" />
    <line className="vai-dimension-chain-extension" data-dimension-extension="end" x1={witnessB[0]} y1={witnessB[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
    <line
      className="vai-dimension-chain-line"
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      strokeDasharray={role === 'closure' ? closureDash : undefined}
      vectorEffect="non-scaling-stroke"
    />
    <line x1={a[0] - normal[0] * tick} y1={a[1] - normal[1] * tick} x2={a[0] + normal[0] * tick} y2={a[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <line x1={b[0] - normal[0] * tick} y1={b[1] - normal[1] * tick} x2={b[0] + normal[0] * tick} y2={b[1] + normal[1] * tick} vectorEffect="non-scaling-stroke" />
    <CadDimensionLabel
      position={middle}
      viewportScale={scale}
      nominalValue={candidate.nominalValue}
      unit={scheme.topology.unit}
      projection={layout.toleranceProjection}
      fallback={layout.label}
      lane={lane}
    />
  </g>;
}

function CadDimensionLabel({ position, viewportScale, nominalValue, unit, projection, fallback, lane }: {
  position: readonly [number, number];
  viewportScale: number;
  nominalValue: number;
  unit: AxialDimensionScheme['topology']['unit'];
  projection?: ToleranceProjection;
  fallback: string;
  lane: number;
}) {
  const parts = cadToleranceParts(projection, unit);
  if (parts === null) {
    return <ScreenSpaceLabel position={position} viewportScale={viewportScale} background className="vai-dimension-chain-label" data-dimension-lane={lane}>
      {fallback}
    </ScreenSpaceLabel>;
  }
  const main = `${nominalValue}`;
  const suffix = `${unit}${parts.designation === undefined ? '' : ` ${parts.designation}`}`;
  const mainWidth = estimateScreenTextWidth(main, 11);
  const suffixWidth = estimateScreenTextWidth(suffix, 8.5);
  const deviationWidth = parts.symmetric === undefined
    ? Math.max(estimateScreenTextWidth(parts.upper ?? '', 7.5), estimateScreenTextWidth(parts.lower ?? '', 7.5))
    : estimateScreenTextWidth(parts.symmetric, 8.5);
  const gapAfterMain = deviationWidth > 0 ? 2 : 4;
  const gapAfterDeviation = deviationWidth > 0 ? 4 : 0;
  const contentWidth = mainWidth + gapAfterMain + deviationWidth + gapAfterDeviation + suffixWidth;
  const width = contentWidth + 10;
  const height = parts.upper !== undefined && parts.lower !== undefined ? 21 : 17;
  let cursor = -contentWidth / 2;
  const mainCenter = cursor + mainWidth / 2;
  cursor += mainWidth + gapAfterMain;
  const deviationStart = cursor;
  cursor += deviationWidth + gapAfterDeviation;
  const suffixCenter = cursor + suffixWidth / 2;
  return <g
    className="vai-dimension-chain-label vai-dimension-chain-label--cad"
    data-dimension-lane={lane}
    data-screen-space-label={true}
    transform={screenSpaceTransform(position, viewportScale)}
  >
    <rect className="vai-screen-space-label__background" x={-width / 2} y={-height / 2} width={width} height={height} rx={4} />
    <text className="vai-dimension-chain-label__nominal" x={mainCenter} y={0} fontSize={11} textAnchor="middle" dominantBaseline="middle">{main}</text>
    {parts.symmetric !== undefined
      ? <text className="vai-dimension-chain-label__tolerance vai-dimension-chain-label__tolerance--symmetric" x={deviationStart} y={0} fontSize={8.5} textAnchor="start" dominantBaseline="middle">{parts.symmetric}</text>
      : <text className="vai-dimension-chain-label__tolerance vai-dimension-chain-label__tolerance--asymmetric" fontSize={7.5} textAnchor="start">
        <tspan x={deviationStart} y={-3.5}>{parts.upper}</tspan>
        <tspan x={deviationStart} y={5}>{parts.lower}</tspan>
      </text>}
    <text className="vai-dimension-chain-label__designation" x={suffixCenter} y={0} fontSize={8.5} textAnchor="middle" dominantBaseline="middle">{suffix}</text>
  </g>;
}

function cadDimensionLabelWidth(
  nominalValue: number,
  unit: AxialDimensionScheme['topology']['unit'],
  projection?: ToleranceProjection,
): number {
  const parts = cadToleranceParts(projection, unit);
  if (parts === null) {
    const tolerance = formatPortableTolerance(projection, unit);
    return estimateScreenTextWidth(`${nominalValue} ${unit}${tolerance === undefined ? '' : ` ${tolerance}`}`, 11) + 10;
  }
  const mainWidth = estimateScreenTextWidth(`${nominalValue}`, 11);
  const suffixWidth = estimateScreenTextWidth(`${unit}${parts.designation === undefined ? '' : ` ${parts.designation}`}`, 8.5);
  const deviationWidth = parts.symmetric === undefined
    ? Math.max(estimateScreenTextWidth(parts.upper ?? '', 7.5), estimateScreenTextWidth(parts.lower ?? '', 7.5))
    : estimateScreenTextWidth(parts.symmetric, 8.5);
  return mainWidth + (deviationWidth > 0 ? 2 : 4) + deviationWidth
    + (deviationWidth > 0 ? 4 : 0) + suffixWidth + 10;
}

function cadToleranceParts(projection: ToleranceProjection | undefined, unit: AxialDimensionScheme['topology']['unit']): {
  designation?: string;
  symmetric?: string;
  upper?: string;
  lower?: string;
} | null {
  if (projection === undefined || projection.unit !== unit
    || (projection.status !== 'resolved' && projection.status !== 'confirmed')) return null;
  const preference = projection.displayPreference ?? (projection.mode === 'fit' ? 'designation' : 'deviations');
  const designation = preference === 'deviations' ? undefined : projection.fitDesignation?.trim() || undefined;
  if (preference === 'designation') return designation === undefined ? null : { designation };
  const upper = projection.upperDeviation;
  const lower = projection.lowerDeviation;
  if (!Number.isFinite(upper) || !Number.isFinite(lower)) return designation === undefined ? null : { designation };
  if (upper! > 0 && Math.abs(upper! + lower!) <= 1e-9) {
    return { ...(designation === undefined ? {} : { designation }), symmetric: `±${cadNumber(upper!)}` };
  }
  return {
    ...(designation === undefined ? {} : { designation }),
    upper: cadSignedNumber(upper!),
    lower: cadSignedNumber(lower!),
  };
}

function cadSignedNumber(value: number): string {
  return value > 0 ? `+${cadNumber(value)}` : cadNumber(value);
}

function cadNumber(value: number): string {
  return Object.is(value, -0) || value === 0 ? '0' : Number(value.toFixed(6)).toString();
}

function DimensionContextMenu({ scheme, candidateId, chainId, position, scale, onChoose, onSetTolerance }: {
  scheme: AxialDimensionScheme;
  candidateId: string;
  chainId?: string;
  position: readonly [number, number];
  scale: number;
  onChoose(chainId: string): void;
  onSetTolerance?(): void;
}) {
  const options = chainId === undefined ? [] : closureOptionsForCandidate(scheme, candidateId, chainId);
  const width = options.length > 1 ? 188 : 148;
  const rowHeight = 30;
  const toleranceRows = onSetTolerance === undefined ? 0 : 1;
  return <g
    className="vai-dimension-closure-menu"
    data-dimension-closure-menu={candidateId}
    data-dimension-context-menu={candidateId}
    role="menu"
    transform={screenSpaceTransform(position, scale)}
    pointerEvents="all"
    onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
  >
    <rect className="vai-dimension-closure-menu__surface" x={0} y={0} width={width} height={(options.length + toleranceRows) * rowHeight} rx={8} />
    {onSetTolerance && <g
      className="vai-dimension-closure-menu__item"
      data-action="set-tolerance"
      role="menuitem"
      onClick={(event) => { event.stopPropagation(); onSetTolerance(); }}
    >
      <rect x={3} y={3} width={width - 6} height={rowHeight - 6} rx={6} />
      <text x={12} y={rowHeight / 2} dominantBaseline="middle" fontSize={11}>设置公差</text>
    </g>}
    {options.map(({ chain, chainIndex, current }, optionIndex) => {
      const label = current
        ? options.length > 1 ? `尺寸链 ${chainIndex + 1} · 当前缺省段` : '当前缺省段'
        : options.length > 1 ? `尺寸链 ${chainIndex + 1} · 切换为缺省段` : '切换为缺省段';
      return <g
        key={chain.id}
        className="vai-dimension-closure-menu__item"
        data-closure-chain-id={chain.id}
        data-closure-current={current || undefined}
        role="menuitem"
        aria-disabled={current || undefined}
        transform={`translate(0 ${(optionIndex + toleranceRows) * rowHeight})`}
        onClick={current ? undefined : (event) => { event.stopPropagation(); onChoose(chain.id); }}
      >
        <rect x={3} y={3} width={width - 6} height={rowHeight - 6} rx={6} />
        <text x={12} y={rowHeight / 2} dominantBaseline="middle" fontSize={11}>{label}</text>
      </g>;
    })}
  </g>;
}

function closureOptionsForCandidate(scheme: AxialDimensionScheme, candidateId: string, chainId: string) {
  return scheme.chains.flatMap((chain, chainIndex) => chain.id !== chainId ? [] : (
    chain.closureCandidateId === candidateId
      ? [{ chain, chainIndex, current: true }]
      : chain.alternativeClosureCandidateIds.includes(candidateId)
        ? [{ chain, chainIndex, current: false }]
        : []
  ));
}

function ChainBracket({ scheme, chain, chainIndex, layoutByCandidate, scale, draggable }: {
  scheme: AxialDimensionScheme;
  chain: AxialDimensionScheme['chains'][number];
  chainIndex: number;
  layoutByCandidate: ReadonlyMap<string, IntervalLayout>;
  scale: number;
  draggable: boolean;
}) {
  const layouts = [chain.parentCandidateId, ...chain.childCandidateIds, chain.closureCandidateId]
    .flatMap((id) => layoutByCandidate.get(id) ?? [])
    .filter((layout) => layout.chainId === chain.id);
  if (layouts.length === 0) return null;
  const safeScale = Math.max(scale, 1e-6);
  const { origin, direction, normal } = scheme.topology.axis;
  const offsetOf = (layout: IntervalLayout) => layout.automaticOffset + layout.manualOffset;
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
  const titleAnchor = Math.max(...layouts.map(offsetOf));
  const title = point(titleAnchor + 12 / safeScale);
  return <g className="vai-dimension-chain-bracket" data-dimension-chain-bracket={chain.id} pointerEvents={draggable ? 'all' : 'none'}>
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

function normalized(value: readonly unknown[]): readonly [number, number] {
  const x = typeof value[0] === 'number' ? value[0] : 0;
  const y = typeof value[1] === 'number' ? value[1] : 0;
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

function roundOffset(value: number): number { return Math.round(value * 1_000) / 1_000; }
