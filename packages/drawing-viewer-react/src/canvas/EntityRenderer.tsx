// SPDX-License-Identifier: Apache-2.0

import { sampleSpline, type AnnotationNode, type GeometryNode, type Vec2 } from '@vectorai/drawing-core';
import type { MouseEvent } from 'react';

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
  onTextPointerDown?(event: MouseEvent<SVGGElement>): void;
  previewDiff?: 'created' | 'updated' | 'before' | 'deleted';
}

export function EntityRenderer({
  node,
  viewport,
  selected,
  aiGrounded = false,
  motionRigActive = false,
  onSelect,
  onTextPointerDown,
  previewDiff,
}: EntityRendererProps) {
  if (!node.visible) return null;
  const semanticClassName = node.type === 'dimension' && (node.dimensionKind === 'angular' || node.dimensionKind === 'diameter')
    ? ` vai-entity--${node.dimensionKind}-dimension`
    : node.type === 'section-hatch'
      ? ' vai-entity--section-hatch'
      : '';
  const className = `vai-entity vai-entity--${node.quality.status}${semanticClassName}${selected ? ' vai-entity--selected' : ''}${aiGrounded ? ' vai-entity--ai-grounded' : ''}${motionRigActive ? ' vai-entity--motion-rig' : ''}${previewDiff === undefined ? '' : ` vai-entity--preview-${previewDiff}`}`;
  const interactiveText = (node.type === 'text' || node.type === 'dimension') && onTextPointerDown !== undefined;
  return (
    <g
      className={className}
      data-entity-id={node.id}
      data-entity-type={node.type}
      data-selected={selected || undefined}
      data-ai-grounded={aiGrounded || undefined}
      data-motion-rig-active={motionRigActive || undefined}
      data-preview-diff={previewDiff}
      onClick={onSelect}
      onMouseDown={interactiveText ? onTextPointerDown : undefined}
    >
      {renderNode(node, viewport)}
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
      return <path d={splinePath(node, viewport)} fill="none" {...vectorStroke} />;
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
          <polyline points={pointsAttribute(node.points)} fill="none" {...vectorStroke} />
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
  return <>
    <line data-diameter-role="extension" x1={sourceFirst[0]} y1={sourceFirst[1]} x2={first[0]} y2={first[1]} {...vectorStroke} />
    <line data-diameter-role="extension" x1={sourceSecond[0]} y1={sourceSecond[1]} x2={second[0]} y2={second[1]} {...vectorStroke} />
    <line data-diameter-role="dimension" x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} {...vectorStroke} />
    <path data-diameter-role="arrow" d={arrowPath(first, second, arrowSize)} {...vectorStroke} />
    <path data-diameter-role="arrow" d={arrowPath(second, first, arrowSize)} {...vectorStroke} />
    <ScreenSpaceLabel position={node.textPosition} viewportScale={viewport.scale}>
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
  if (node.displayText !== undefined) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  if (value === undefined) return '—';
  return `${node.prefix ?? ''}${value}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
}

function pointsAttribute(points: readonly Vec2[]): string {
  return points.map((point) => `${point[0]},${point[1]}`).join(' ');
}

function splinePath(
  node: Extract<GeometryNode, { type: 'spline' }>,
  viewport: DrawingWorkspaceViewport,
): string {
  const points = sampleSpline(node, { maxError: Math.max(0.25 / viewport.scale, 1e-8) });
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
