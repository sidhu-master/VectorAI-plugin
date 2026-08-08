import type { MouseEvent } from 'react';
import type { Vec2 } from '@/drawing';
import type { BBox, DrawingRenderable } from './geometry';

const HIT_WIDTH = 14;
const PRIMARY_STROKE = '#cbd5e1';
const SELECTED_STROKE = '#6da9d2';
const DANGER_STROKE = '#f87171';
const CONSTRUCTION_STROKE = '#64748b';
const DIMENSION_STROKE = '#94a3b8';

interface EntityRendererProps {
  entity: DrawingRenderable;
  scale: number;
  viewport: BBox;
  selected?: boolean;
  onSelect?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: MouseEvent<SVGGElement>) => void;
}

function pointOnCircle(center: Vec2, radius: number, angle: number): Vec2 {
  const radians = angle * Math.PI / 180;
  return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
}

function arcSpan(start: number, end: number, counterClockwise: boolean): number {
  const normalizedStart = ((start % 360) + 360) % 360;
  const normalizedEnd = ((end % 360) + 360) % 360;
  return counterClockwise
    ? (normalizedEnd - normalizedStart + 360) % 360
    : (normalizedStart - normalizedEnd + 360) % 360;
}

function linePath(points: readonly Vec2[], closed = false): string {
  if (points.length === 0) return '';
  return `M ${points[0][0]} ${points[0][1]} ${points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')}${closed ? ' Z' : ''}`;
}

function splinePath(points: readonly Vec2[], closed: boolean): string {
  if (points.length < 2) return points.length === 1 ? `M ${points[0][0]} ${points[0][1]}` : '';
  if (points.length === 2) return linePath(points, closed);
  const commands = [`M ${points[0][0]} ${points[0][1]}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const midpoint: Vec2 = [(control[0] + next[0]) / 2, (control[1] + next[1]) / 2];
    commands.push(`Q ${control[0]} ${control[1]} ${midpoint[0]} ${midpoint[1]}`);
  }
  const last = points.at(-1)!;
  const beforeLast = points.at(-2)!;
  commands.push(`Q ${beforeLast[0]} ${beforeLast[1]} ${last[0]} ${last[1]}`);
  if (closed) commands.push('Z');
  return commands.join(' ');
}

function extendedLine(entity: Extract<DrawingRenderable, { type: 'ray' | 'xline' }>, viewport: BBox): [Vec2, Vec2] | null {
  const length = Math.hypot(entity.direction[0], entity.direction[1]);
  if (!Number.isFinite(length) || length === 0) return null;
  const unit: Vec2 = [entity.direction[0] / length, entity.direction[1] / length];
  const span = Math.max(viewport.maxX - viewport.minX, viewport.maxY - viewport.minY, 1) * 4;
  const forward: Vec2 = [entity.origin[0] + unit[0] * span, entity.origin[1] + unit[1] * span];
  if (entity.type === 'ray') return [entity.origin, forward];
  return [
    [entity.origin[0] - unit[0] * span, entity.origin[1] - unit[1] * span],
    forward,
  ];
}

function dimensionLabel(entity: Extract<DrawingRenderable, { type: 'dimension' }>): string {
  if (entity.displayText) return entity.displayText;
  const value = entity.observedValue ?? entity.computedValue;
  return `${entity.prefix ?? ''}${value === undefined ? '—' : value}${entity.unit ? ` ${entity.unit}` : ''}${entity.suffix ?? ''}`;
}

export default function EntityRenderer({
  entity,
  scale,
  viewport,
  selected = false,
  onSelect,
  onPointerDown,
}: EntityRendererProps) {
  if (!entity.visible) return null;
  const lowConfidence = entity.quality.status === 'candidate'
    || (entity.quality.confidence !== undefined && entity.quality.confidence < 0.6);
  const regularStroke = selected ? SELECTED_STROKE : lowConfidence ? DANGER_STROKE : PRIMARY_STROKE;
  const stroke = entity.type === 'ray' || entity.type === 'xline'
    ? CONSTRUCTION_STROKE
    : entity.type === 'dimension'
      ? lowConfidence ? DANGER_STROKE : selected ? SELECTED_STROKE : DIMENSION_STROKE
      : regularStroke;
  const strokeWidth = selected ? 2 : 1.35;
  const selectedDash = selected ? '5 4' : undefined;
  const groupProps = {
    'data-entity-id': entity.id,
    onClick: onSelect,
    onMouseDown: onPointerDown,
    className: onSelect ? 'cursor-pointer' : undefined,
  };
  const visiblePath = (path: string, dash = selectedDash) => (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
    </>
  );

  switch (entity.type) {
    case 'point': {
      const radius = 3 / Math.max(scale, 0.001);
      return (
        <g {...groupProps}>
          <circle cx={entity.x} cy={entity.y} r={HIT_WIDTH / Math.max(scale, 0.001)} fill="transparent" />
          <circle cx={entity.x} cy={entity.y} r={radius} fill={stroke} pointerEvents="none" />
        </g>
      );
    }
    case 'line':
      return <g {...groupProps}>{visiblePath(linePath([entity.start, entity.end]))}</g>;
    case 'ray':
    case 'xline': {
      const points = extendedLine(entity, viewport);
      if (!points) return null;
      return <g {...groupProps}>{visiblePath(linePath(points), '7 5')}</g>;
    }
    case 'circle':
      return (
        <g {...groupProps}>
          <circle cx={entity.center[0]} cy={entity.center[1]} r={entity.radius} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />
          <circle cx={entity.center[0]} cy={entity.center[1]} r={entity.radius} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={selectedDash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>
      );
    case 'arc': {
      const start = pointOnCircle(entity.center, entity.radius, entity.startAngle);
      const end = pointOnCircle(entity.center, entity.radius, entity.endAngle);
      const span = arcSpan(entity.startAngle, entity.endAngle, entity.counterClockwise);
      const path = `M ${start[0]} ${start[1]} A ${entity.radius} ${entity.radius} 0 ${span > 180 ? 1 : 0} ${entity.counterClockwise ? 1 : 0} ${end[0]} ${end[1]}`;
      return <g {...groupProps}>{visiblePath(path)}</g>;
    }
    case 'ellipse': {
      const radiusX = Math.hypot(entity.majorAxis[0], entity.majorAxis[1]);
      if (!Number.isFinite(radiusX) || radiusX === 0) return null;
      const angle = Math.atan2(entity.majorAxis[1], entity.majorAxis[0]) * 180 / Math.PI;
      return (
        <g {...groupProps}>
          <ellipse cx={entity.center[0]} cy={entity.center[1]} rx={radiusX} ry={radiusX * entity.ratio} transform={`rotate(${angle} ${entity.center[0]} ${entity.center[1]})`} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />
          <ellipse cx={entity.center[0]} cy={entity.center[1]} rx={radiusX} ry={radiusX * entity.ratio} transform={`rotate(${angle} ${entity.center[0]} ${entity.center[1]})`} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={selectedDash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>
      );
    }
    case 'polyline':
      return <g {...groupProps}>{visiblePath(linePath(entity.vertices.map((vertex) => vertex.point), entity.closed))}</g>;
    case 'spline':
      return <g {...groupProps}>{visiblePath(splinePath(entity.controlPoints, entity.closed))}</g>;
    case 'text': {
      const anchor = entity.alignment === 'center' ? 'middle' : entity.alignment === 'right' ? 'end' : 'start';
      return (
        <g {...groupProps} transform={`translate(${entity.position[0]} ${entity.position[1]}) rotate(${-entity.rotation}) scale(1 -1)`}>
          <text x={0} y={0} fill={stroke} fontSize={entity.height} textAnchor={anchor} fontFamily="Inter, system-ui, sans-serif">
            {entity.content}
          </text>
        </g>
      );
    }
    case 'dimension': {
      const path = linePath(entity.definitionPoints);
      return (
        <g {...groupProps}>
          {path && visiblePath(path)}
          {entity.definitionPoints.map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r={2.2 / Math.max(scale, 0.001)} fill={stroke} pointerEvents="none" />
          ))}
          <g transform={`translate(${entity.textPosition[0]} ${entity.textPosition[1]}) scale(1 -1)`} pointerEvents="none">
            <text x={0} y={-4} fill={stroke} fontSize={11 / Math.max(scale, 0.001)} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {dimensionLabel(entity)}
            </text>
          </g>
        </g>
      );
    }
  }
}
