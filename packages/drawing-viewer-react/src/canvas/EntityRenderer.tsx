// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { MouseEvent } from 'react';

import { nodeBounds, worldBoundsForViewport } from './geometry';
import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';

export interface EntityRendererProps {
  node: GeometryNode | AnnotationNode;
  viewport: DrawingWorkspaceViewport;
  selected: boolean;
  onSelect(event: MouseEvent<SVGGElement>): void;
  onTextPointerDown?(event: MouseEvent<SVGGElement>): void;
}

export function EntityRenderer({
  node,
  viewport,
  selected,
  onSelect,
  onTextPointerDown,
}: EntityRendererProps) {
  if (!node.visible) return null;
  const className = `vai-entity vai-entity--${node.quality.status}${selected ? ' vai-entity--selected' : ''}`;
  const interactiveText = (node.type === 'text' || node.type === 'dimension') && onTextPointerDown !== undefined;
  return (
    <g
      className={className}
      data-entity-id={node.id}
      data-entity-type={node.type}
      data-selected={selected || undefined}
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
      return <path d={splinePath(node.controlPoints, node.closed)} fill="none" {...vectorStroke} />;
    case 'text':
      return <WorldText position={node.position} rotation={node.rotation} height={node.height} align={node.alignment}>{node.content}</WorldText>;
    case 'dimension':
      return (
        <>
          {node.definitionPoints.length > 1 ? (
            <polyline points={pointsAttribute(node.definitionPoints)} fill="none" {...vectorStroke} />
          ) : null}
          <WorldText position={node.textPosition} height={Math.max(4, 10 / viewport.scale)} align="center">
            {dimensionLabel(node)}
          </WorldText>
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
      return (
        <g data-section-hatch={node.pattern}>
          {node.segments.map((segment, index) => (
            <line
              key={index}
              x1={segment.start[0]}
              y1={segment.start[1]}
              x2={segment.end[0]}
              y2={segment.end[1]}
              {...vectorStroke}
            />
          ))}
        </g>
      );
  }
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

function splinePath(points: readonly Vec2[], closed: boolean): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}${closed ? ' Z' : ''}`;
  const commands = [`M ${points[0][0]} ${points[0][1]}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const end = index === points.length - 2
      ? next
      : [(control[0] + next[0]) / 2, (control[1] + next[1]) / 2];
    commands.push(`Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`);
  }
  if (closed) commands.push('Z');
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
