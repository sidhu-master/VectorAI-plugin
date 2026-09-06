// SPDX-License-Identifier: Apache-2.0

import {
  convertLength,
  leaderPaths,
  leaderArrowTriangles,
  sampleSpline,
  type AnnotationNode,
  type GeometryNode,
  type ToleranceProjection,
  type Vec2,
} from '@vectorai/drawing-core';
import { memo, type MouseEvent, type ReactNode } from 'react';

import { nodeBounds, worldBoundsForViewport } from './geometry';
import { HatchRenderer } from './HatchRenderer';
import { ScreenSpaceLabel } from './ScreenSpaceLabel';
import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';

export interface EntityRendererProps {
  node: GeometryNode | AnnotationNode;
  viewport: DrawingWorkspaceViewport;
  selected: boolean;
  aiGrounded?: boolean;
  motionRigActive?: boolean;
  onSelect(event: MouseEvent<SVGGElement>): void;
  onContextMenu?(event: MouseEvent<SVGGElement>): void;
  onTextPointerDown?(event: MouseEvent<SVGGElement>): void;
  previewDiff?: 'created' | 'updated' | 'before' | 'deleted';
  content?: ReactNode;
}

export function EntityRenderer({
  node,
  viewport,
  selected,
  aiGrounded = false,
  motionRigActive = false,
  onSelect,
  onContextMenu,
  onTextPointerDown,
  previewDiff,
  content,
}: EntityRendererProps) {
  if (!node.visible) return null;
  const semanticClassName = node.type === 'dimension' && (node.dimensionKind === 'angular' || node.dimensionKind === 'diameter')
    ? ` vai-entity--${node.dimensionKind}-dimension`
    : node.type === 'section-hatch'
      ? ' vai-entity--section-hatch'
      : '';
  const sourceClassName = node.sourceRef?.layer === 'DETAIL-THREAD'
    ? ' vai-entity--thread-minor'
    : node.sourceRef?.layer === 'DETAIL-THREAD-LIMIT'
      ? ' vai-entity--thread-limit'
      : '';
  const className = `vai-entity vai-entity--${node.quality.status}${semanticClassName}${sourceClassName}${selected ? ' vai-entity--selected' : ''}${aiGrounded ? ' vai-entity--ai-grounded' : ''}${motionRigActive ? ' vai-entity--motion-rig' : ''}${previewDiff === undefined ? '' : ` vai-entity--preview-${previewDiff}`}`;
  const interactiveText = (node.type === 'text' || node.type === 'dimension') && onTextPointerDown !== undefined;
  return (
    <g
      className={content === undefined ? className : 'vai-cad-entity'}
      style={content !== undefined && selected ? { filter: 'brightness(1.5) drop-shadow(0 0 1px white)' } : undefined}
      data-entity-id={node.id}
      data-entity-type={node.type}
      data-selected={selected || undefined}
      data-ai-grounded={aiGrounded || undefined}
      data-motion-rig-active={motionRigActive || undefined}
      data-preview-diff={previewDiff}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseDown={interactiveText ? onTextPointerDown : undefined}
    >
      {content === undefined ? renderNode(node, viewport) : content}
    </g>
  );
}

function renderNode(node: GeometryNode | AnnotationNode, viewport: DrawingWorkspaceViewport) {
  const vectorStroke = { vectorEffect: 'non-scaling-stroke' as const };
  switch (node.type) {
    case 'point':
      return <circle cx={node.x} cy={node.y} r={3 / viewport.scale} {...vectorStroke} />;
    case 'line':
      return <line x1={node.start[0]} y1={node.start[1]} x2={node.end[0]} y2={node.end[1]} {...vectorStroke} />;
    case 'ray':
    case 'xline': {
      const points = clipExtendedLine(node.origin, node.direction, worldBoundsForViewport(viewport), node.type === 'ray');
      return points === null ? null : (
        <line x1={points[0][0]} y1={points[0][1]} x2={points[1][0]} y2={points[1][1]} {...vectorStroke} />
      );
    }
    case 'circle':
      return <circle cx={node.center[0]} cy={node.center[1]} r={node.radius} fill="none" {...vectorStroke} />;
    case 'arc':
      return <path d={arcPath(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise)} fill="none" {...vectorStroke} />;
    case 'ellipse': {
      const radiusX = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
      return (
        <ellipse
          cx={node.center[0]}
          cy={node.center[1]}
          rx={radiusX}
          ry={radiusX * node.ratio}
          transform={`rotate(${rotation} ${node.center[0]} ${node.center[1]})`}
          fill="none"
          {...vectorStroke}
        />
      );
    }
    case 'polyline':
      return <path d={polylinePath(node)} fill="none" {...vectorStroke} />;
    case 'spline':
      return <SplineRenderer node={node} viewportScale={viewport.scale} />;
    case 'text':
      return <WorldText position={node.position} rotation={node.rotation} height={node.height} align={node.alignment}>{node.content}</WorldText>;
    case 'dimension':
      if (node.dimensionKind === 'angular' && node.definitionPoints.length >= 5) {
        return <AngularDimension node={node} viewport={viewport} />;
      }
      if (node.dimensionKind === 'diameter' && node.definitionPoints.length >= 2) {
        return <DiameterDimension node={node} viewport={viewport} />;
      }
      return (
        <>
          {node.definitionPoints.length > 1 ? (
            <polyline points={pointsAttribute(node.definitionPoints)} fill="none" {...vectorStroke} />
          ) : null}
          <ScreenSpaceLabel position={node.textPosition} viewportScale={viewport.scale}>
            {dimensionLabel(node)}
          </ScreenSpaceLabel>
        </>
      );
    case 'leader': {
      const textPosition = node.points.at(-1) ?? [0, 0];
      return (
        <>
          {leaderPaths(node).map((points, index) => <polyline key={index} data-leader-role={index === 0 ? 'main' : 'branch'} points={pointsAttribute(points)} fill="none" {...vectorStroke} />)}
          {node.callout?.type === 'detail' && node.points[0] && <circle data-leader-role="detail" cx={node.points[0][0]} cy={node.points[0][1]} r={node.callout.radius} fill="none" {...vectorStroke} />}
          {leaderArrowTriangles(node).map((points, index) => <polygon key={index} data-leader-role="arrow" points={pointsAttribute(points)} fill="currentColor" />)}
          <WorldText position={textPosition} height={node.textHeight} align="left">{node.content}</WorldText>
        </>
      );
    }
    case 'centerline': {
      const bounds = nodeBounds(node);
      return bounds === null ? null : (
        <line
          x1={bounds.minX}
          y1={bounds.minY}
          x2={bounds.maxX}
          y2={bounds.maxY}
          strokeDasharray="10 4 2 4"
          {...vectorStroke}
        />
      );
    }
    case 'section-hatch':
      return <HatchRenderer node={node} viewportScale={viewport.scale} />;
  }
}

const SplineRenderer = memo(function SplineRenderer({
  node,
  viewportScale,
}: {
  node: Extract<GeometryNode, { type: 'spline' }>;
  viewportScale: number;
}) {
  return <path d={splinePath(node, viewportScale)} fill="none" vectorEffect="non-scaling-stroke" />;
});

function DiameterDimension({
  node,
  viewport,
}: {
  node: Extract<AnnotationNode, { type: 'dimension' }>;
  viewport: DrawingWorkspaceViewport;
}) {
  const [first, second, sourceFirst = first, sourceSecond = second] = node.definitionPoints;
  if (!first || !second) return null;
  const vectorStroke = { vectorEffect: 'non-scaling-stroke' as const };
  const arrowSize = 7 / Math.max(viewport.scale, 1e-9);
  const dimensionCenter: Vec2 = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const sourceCenter: Vec2 = [(sourceFirst[0] + sourceSecond[0]) / 2, (sourceFirst[1] + sourceSecond[1]) / 2];
  const horizontalDisplacement = dimensionCenter[0] - sourceCenter[0];
  const labelOnLeft = horizontalDisplacement < -1e-9;
  return <>
    <line data-diameter-role="extension" x1={sourceFirst[0]} y1={sourceFirst[1]} x2={first[0]} y2={first[1]} {...vectorStroke} />
    <line data-diameter-role="extension" x1={sourceSecond[0]} y1={sourceSecond[1]} x2={second[0]} y2={second[1]} {...vectorStroke} />
    <line data-diameter-role="dimension" x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} {...vectorStroke} />
    <path data-diameter-role="arrow" d={arrowPath(first, second, arrowSize)} {...vectorStroke} />
    <path data-diameter-role="arrow" d={arrowPath(second, first, arrowSize)} {...vectorStroke} />
    <ScreenSpaceLabel
      position={node.textPosition}
      viewportScale={viewport.scale}
      textAnchor={labelOnLeft ? 'end' : 'start'}
      offsetX={labelOnLeft ? -8 : 8}
    >
      {dimensionLabel(node)}
    </ScreenSpaceLabel>
  </>;
}

function AngularDimension({
  node,
  viewport,
}: {
  node: Extract<AnnotationNode, { type: 'dimension' }>;
  viewport: DrawingWorkspaceViewport;
}) {
  const [vertex, firstExtension, secondExtension, arcStart, arcEnd] = node.definitionPoints;
  if (!vertex || !firstExtension || !secondExtension || !arcStart || !arcEnd) return null;
  const firstRadius = Math.hypot(arcStart[0] - vertex[0], arcStart[1] - vertex[1]);
  const secondRadius = Math.hypot(arcEnd[0] - vertex[0], arcEnd[1] - vertex[1]);
  const radius = (firstRadius + secondRadius) / 2;
  const startAngle = Math.atan2(arcStart[1] - vertex[1], arcStart[0] - vertex[0]);
  const endAngle = Math.atan2(arcEnd[1] - vertex[1], arcEnd[0] - vertex[0]);
  const sweep = selectAngularSweep(startAngle, endAngle, node.observedValue ?? node.computedValue);
  const tangentStep = Math.min(Math.abs(sweep) * 0.08, 0.15);
  const direction = sweep >= 0 ? 1 : -1;
  const startToward = polarPoint(vertex, radius, startAngle + direction * tangentStep);
  const endToward = polarPoint(vertex, radius, endAngle - direction * tangentStep);
  const vectorStroke = { vectorEffect: 'non-scaling-stroke' as const };
  return <>
    <line data-angular-role="extension" x1={vertex[0]} y1={vertex[1]} x2={firstExtension[0]} y2={firstExtension[1]} {...vectorStroke} />
    <line data-angular-role="extension" x1={vertex[0]} y1={vertex[1]} x2={secondExtension[0]} y2={secondExtension[1]} {...vectorStroke} />
    <path
      data-angular-role="arc"
      d={`M ${arcStart[0]} ${arcStart[1]} A ${radius} ${radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep >= 0 ? 1 : 0} ${arcEnd[0]} ${arcEnd[1]}`}
      fill="none"
      {...vectorStroke}
    />
    <path data-angular-role="arrow" d={arrowPath(arcStart, startToward, 7 / Math.max(viewport.scale, 1e-9))} {...vectorStroke} />
    <path data-angular-role="arrow" d={arrowPath(arcEnd, endToward, 7 / Math.max(viewport.scale, 1e-9))} {...vectorStroke} />
    <ScreenSpaceLabel position={node.textPosition} viewportScale={viewport.scale}>
      {dimensionLabel(node)}
    </ScreenSpaceLabel>
  </>;
}

function WorldText({
  position,
  rotation = 0,
  height,
  align,
  children,
}: {
  position: Vec2;
  rotation?: number;
  height: number;
  align: 'left' | 'center' | 'right';
  children: string;
}) {
  return (
    <g transform={`translate(${position[0]} ${position[1]}) rotate(${-rotation}) scale(1 -1)`}>
      <text
        fontSize={height}
        textAnchor={align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}
      >
        {children}
      </text>
    </g>
  );
}

function dimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  const base = node.displayText ?? (() => {
    const value = node.observedValue ?? node.computedValue;
    if (value === undefined) return '—';
    return `${node.prefix ?? ''}${value}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
  })();
  const tolerance = formatPortableTolerance(node.toleranceProjection, node.unit);
  return tolerance === undefined ? base : `${base} ${tolerance}`;
}

export function formatPortableTolerance(
  projection: ToleranceProjection | undefined,
  targetUnit: Extract<AnnotationNode, { type: 'dimension' }>['unit'],
): string | undefined {
  if (projection === undefined || (projection.status !== 'resolved' && projection.status !== 'confirmed')) return undefined;
  const preference = projection.displayPreference ?? (projection.mode === 'fit' ? 'designation' : 'deviations');
  const designation = preference === 'deviations' ? undefined : projection.fitDesignation?.trim() || undefined;
  const deviations = preference === 'designation' ? undefined : portableDeviationText(projection, targetUnit ?? projection.unit);
  return [designation, deviations].filter((value): value is string => value !== undefined).join(' ') || undefined;
}

function portableDeviationText(
  projection: ToleranceProjection,
  targetUnit: NonNullable<Extract<AnnotationNode, { type: 'dimension' }>['unit']>,
): string | undefined {
  const convert = (value: number | undefined): number | undefined => {
    if (!finite(value)) return undefined;
    if (projection.unit === targetUnit) return value;
    if (projection.unit === 'deg' || targetUnit === 'deg') return undefined;
    return Number(convertLength(value, projection.unit, targetUnit).toPrecision(15));
  };
  if (projection.mode === 'limits') {
    const upper = convert(projection.upperLimit);
    const lower = convert(projection.lowerLimit);
    return upper === undefined || lower === undefined || lower > upper
      ? undefined
      : `[${textNumber(upper)}/${textNumber(lower)}]`;
  }
  if (projection.mode !== 'bilateral' && projection.mode !== 'unilateral' && projection.mode !== 'fit') return undefined;
  const upper = convert(projection.upperDeviation);
  const lower = convert(projection.lowerDeviation);
  if (projection.mode === 'bilateral' && (upper === undefined || lower === undefined)) return undefined;
  const values = [upper, lower].filter((value): value is number => value !== undefined);
  return values.length === 0 ? undefined : values.map(signed).join('/');
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function signed(value: number): string {
  if (Object.is(value, -0) || value === 0) return '0';
  return value > 0 ? `+${textNumber(value)}` : textNumber(value);
}

function textNumber(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function pointsAttribute(points: readonly Vec2[]): string {
  return points.map((point) => `${point[0]},${point[1]}`).join(' ');
}

function splinePath(
  node: Extract<GeometryNode, { type: 'spline' }>,
  viewportScale: number,
): string {
  const points = sampleSpline(node, { maxError: Math.max(0.25 / viewportScale, 1e-8) });
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const commands = [
    `M ${points[0][0]} ${points[0][1]}`,
    ...points.slice(1).map(([x, y]) => `L ${x} ${y}`),
  ];
  if (node.closed) commands.push('Z');
  return commands.join(' ');
}

function polylinePath(node: Extract<GeometryNode, { type: 'polyline' }>): string {
  if (node.vertices.length === 0) return '';
  const output = [`M ${node.vertices[0].point[0]} ${node.vertices[0].point[1]}`];
  const segments = node.closed ? node.vertices.length : node.vertices.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const current = node.vertices[index];
    const next = node.vertices[(index + 1) % node.vertices.length];
    if (current.bulge !== undefined && Math.abs(current.bulge) > 1e-9) {
      const radius = Math.hypot(
        next.point[0] - current.point[0],
        next.point[1] - current.point[1],
      ) * (1 + current.bulge * current.bulge) / (4 * Math.abs(current.bulge));
      output.push(`A ${radius} ${radius} 0 ${Math.abs(current.bulge) > 1 ? 1 : 0} ${current.bulge > 0 ? 1 : 0} ${next.point[0]} ${next.point[1]}`);
    } else {
      output.push(`L ${next.point[0]} ${next.point[1]}`);
    }
  }
  if (node.closed) output.push('Z');
  return output.join(' ');
}

function arcPath(center: Vec2, radius: number, start: number, end: number, counterClockwise: boolean): string {
  const point = (angle: number): Vec2 => {
    const radians = angle * Math.PI / 180;
    return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
  };
  const first = point(start);
  const last = point(end);
  const span = counterClockwise ? modulo(end - start, 360) : modulo(start - end, 360);
  return `M ${first[0]} ${first[1]} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} ${counterClockwise ? 1 : 0} ${last[0]} ${last[1]}`;
}

function selectAngularSweep(start: number, end: number, valueDegrees: number | undefined): number {
  const counterClockwise = modulo(end - start, Math.PI * 2);
  const clockwise = counterClockwise - Math.PI * 2;
  if (valueDegrees === undefined) return Math.abs(counterClockwise) <= Math.abs(clockwise) ? counterClockwise : clockwise;
  const target = Math.abs(valueDegrees) * Math.PI / 180;
  return Math.abs(Math.abs(counterClockwise) - target) <= Math.abs(Math.abs(clockwise) - target)
    ? counterClockwise : clockwise;
}

function polarPoint(center: Vec2, radius: number, angle: number): Vec2 {
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
}

function arrowPath(tip: Vec2, toward: Vec2, length: number): string {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const base: Vec2 = [tip[0] + ux * length, tip[1] + uy * length];
  const halfWidth = length * 0.38;
  const first: Vec2 = [base[0] - uy * halfWidth, base[1] + ux * halfWidth];
  const second: Vec2 = [base[0] + uy * halfWidth, base[1] - ux * halfWidth];
  return `M ${tip[0]} ${tip[1]} L ${first[0]} ${first[1]} L ${second[0]} ${second[1]} Z`;
}

function clipExtendedLine(
  origin: Vec2,
  direction: Vec2,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ray: boolean,
): [Vec2, Vec2] | null {
  if (Math.hypot(direction[0], direction[1]) <= 1e-9) return null;
  let minimum = ray ? 0 : Number.NEGATIVE_INFINITY;
  let maximum = Number.POSITIVE_INFINITY;
  for (const [axisOrigin, axisDirection, low, high] of [
    [origin[0], direction[0], bounds.minX, bounds.maxX],
    [origin[1], direction[1], bounds.minY, bounds.maxY],
  ] as const) {
    if (Math.abs(axisDirection) <= 1e-9) {
      if (axisOrigin < low || axisOrigin > high) return null;
      continue;
    }
    const first = (low - axisOrigin) / axisDirection;
    const second = (high - axisOrigin) / axisDirection;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
  }
  if (minimum > maximum) return null;
  return [
    [origin[0] + direction[0] * minimum, origin[1] + direction[1] * minimum],
    [origin[0] + direction[0] * maximum, origin[1] + direction[1] * maximum],
  ];
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
