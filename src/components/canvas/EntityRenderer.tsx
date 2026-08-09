import type { MouseEvent } from 'react';
import type { Vec2 } from '@/drawing';
import { entityCenter, type BBox, type DrawingRenderable } from './geometry';

const HIT_WIDTH = 14;
const PRIMARY_STROKE = '#cbd5e1';
const SELECTED_STROKE = '#6da9d2';
const DANGER_STROKE = '#f87171';
const CONSTRUCTION_STROKE = '#64748b';
const DIMENSION_STROKE = '#a9b3c1';
const DIMENSION_TEXT = '#df78ca';
const DIMENSION_CENTER = '#63c991';
const PROVISIONAL_STROKE = '#7f9bad';
const PROVISIONAL_OUTLINE_STROKE = '#7dd3fc';

interface EntityRendererProps {
  entity: DrawingRenderable;
  scale: number;
  viewport: BBox;
  selected?: boolean;
  onSelect?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: MouseEvent<SVGGElement>) => void;
  provisional?: boolean;
  label?: string;
  /** 感知阶段：outline 轮廓 / detail 细节 / annotation 标注，用于分层呈现绘制过程 */
  perceptionStage?: 'outline' | 'detail' | 'annotation' | 'reconciliation';
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

function arrowPoints(tip: Vec2, toward: Vec2, size: number): string {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return `${tip[0]},${tip[1]}`;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const base: Vec2 = [tip[0] + ux * size, tip[1] + uy * size];
  const halfWidth = size * 0.36;
  return [
    tip,
    [base[0] + nx * halfWidth, base[1] + ny * halfWidth] as Vec2,
    [base[0] - nx * halfWidth, base[1] - ny * halfWidth] as Vec2,
  ].map(([x, y]) => `${x},${y}`).join(' ');
}

function midpoint(first: Vec2, second: Vec2): Vec2 {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}

export default function EntityRenderer({
  entity,
  scale,
  viewport,
  selected = false,
  onSelect,
  onPointerDown,
  provisional = false,
  label,
  perceptionStage,
}: EntityRendererProps) {
  if (!entity.visible) return null;
  const measuredLowConfidence = entity.quality.confidence !== undefined
    && entity.quality.confidence < 0.6;
  const lowConfidence = measuredLowConfidence
    || (!provisional && entity.quality.status === 'candidate');
  const isOutline = provisional && perceptionStage === 'outline';
  const regularStroke = provisional
    ? lowConfidence ? DANGER_STROKE : isOutline ? PROVISIONAL_OUTLINE_STROKE : PROVISIONAL_STROKE
    : selected ? SELECTED_STROKE : lowConfidence ? DANGER_STROKE : PRIMARY_STROKE;
  const stroke = entity.type === 'ray' || entity.type === 'xline'
    ? CONSTRUCTION_STROKE
    : entity.type === 'dimension'
      ? lowConfidence ? DANGER_STROKE : selected ? SELECTED_STROKE : DIMENSION_STROKE
      : regularStroke;
  const strokeWidth = selected && !provisional ? 2 : 1.35;
  const selectedDash = provisional
    ? isOutline ? undefined : '4 3'
    : selected ? '5 4' : undefined;
  const interactive = !provisional && Boolean(onSelect);
  const groupProps = {
    'data-entity-id': entity.id,
    'data-provisional': provisional || undefined,
    onClick: interactive ? onSelect : undefined,
    onMouseDown: interactive ? onPointerDown : undefined,
    className: interactive ? 'cursor-pointer' : undefined,
    opacity: provisional ? 0.82 : undefined,
  };
  const center = entityCenter(entity);
  const labelNode = provisional && label && center ? (
    <g transform={`translate(${center[0]} ${center[1]}) scale(1 -1)`} pointerEvents="none">
      <text
        x={0}
        y={-6 / Math.max(scale, 0.001)}
        fill={stroke}
        fontSize={10 / Math.max(scale, 0.001)}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
      >
        {label}
      </text>
    </g>
  ) : null;
  const visiblePath = (path: string, dash = selectedDash) => (
    <>
      {!provisional && <path d={path} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
    </>
  );

  switch (entity.type) {
    case 'point': {
      const radius = 3 / Math.max(scale, 0.001);
      return (
        <g {...groupProps}>
          {!provisional && <circle cx={entity.x} cy={entity.y} r={HIT_WIDTH / Math.max(scale, 0.001)} fill="transparent" />}
          <circle cx={entity.x} cy={entity.y} r={radius} fill={stroke} pointerEvents="none" />
          {labelNode}
        </g>
      );
    }
    case 'line':
      return <g {...groupProps}>{visiblePath(linePath([entity.start, entity.end]))}{labelNode}</g>;
    case 'ray':
    case 'xline': {
      const points = extendedLine(entity, viewport);
      if (!points) return null;
      return <g {...groupProps}>{visiblePath(linePath(points), provisional ? '4 3' : '7 5')}{labelNode}</g>;
    }
    case 'circle':
      return (
        <g {...groupProps}>
          {!provisional && <circle cx={entity.center[0]} cy={entity.center[1]} r={entity.radius} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />}
          <circle cx={entity.center[0]} cy={entity.center[1]} r={entity.radius} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={selectedDash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {labelNode}
        </g>
      );
    case 'arc': {
      const start = pointOnCircle(entity.center, entity.radius, entity.startAngle);
      const end = pointOnCircle(entity.center, entity.radius, entity.endAngle);
      const span = arcSpan(entity.startAngle, entity.endAngle, entity.counterClockwise);
      const path = `M ${start[0]} ${start[1]} A ${entity.radius} ${entity.radius} 0 ${span > 180 ? 1 : 0} ${entity.counterClockwise ? 1 : 0} ${end[0]} ${end[1]}`;
      return <g {...groupProps}>{visiblePath(path)}{labelNode}</g>;
    }
    case 'ellipse': {
      const radiusX = Math.hypot(entity.majorAxis[0], entity.majorAxis[1]);
      if (!Number.isFinite(radiusX) || radiusX === 0) return null;
      const angle = Math.atan2(entity.majorAxis[1], entity.majorAxis[0]) * 180 / Math.PI;
      return (
        <g {...groupProps}>
          {!provisional && <ellipse cx={entity.center[0]} cy={entity.center[1]} rx={radiusX} ry={radiusX * entity.ratio} transform={`rotate(${angle} ${entity.center[0]} ${entity.center[1]})`} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />}
          <ellipse cx={entity.center[0]} cy={entity.center[1]} rx={radiusX} ry={radiusX * entity.ratio} transform={`rotate(${angle} ${entity.center[0]} ${entity.center[1]})`} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={selectedDash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {labelNode}
        </g>
      );
    }
    case 'polyline':
      return <g {...groupProps}>{visiblePath(linePath(entity.vertices.map((vertex) => vertex.point), entity.closed))}{labelNode}</g>;
    case 'spline':
      return <g {...groupProps}>{visiblePath(splinePath(entity.controlPoints, entity.closed))}{labelNode}</g>;
    case 'text': {
      const anchor = entity.alignment === 'center' ? 'middle' : entity.alignment === 'right' ? 'end' : 'start';
      return (
        <g {...groupProps}>
          <g transform={`translate(${entity.position[0]} ${entity.position[1]}) rotate(${-entity.rotation}) scale(1 -1)`}>
            <text x={0} y={0} fill={stroke} fontSize={entity.height} textAnchor={anchor} fontFamily="Inter, system-ui, sans-serif">
              {entity.content}
            </text>
          </g>
          {labelNode}
        </g>
      );
    }
    case 'dimension': {
      const points = entity.definitionPoints;
      const screenScale = Math.max(scale, 0.001);
      const arrowSize = 7 / screenScale;
      const centerSize = 5 / screenScale;
      const dimensionStroke = lowConfidence ? DANGER_STROKE : selected ? SELECTED_STROKE : DIMENSION_STROKE;
      const textStroke = lowConfidence ? DANGER_STROKE : DIMENSION_TEXT;
      const centerStroke = lowConfidence ? DANGER_STROKE : DIMENSION_CENTER;
      const dimensionLine = (first: Vec2, second: Vec2, role: string, dashed = false) => (
        <line
          data-dimension-role={role}
          x1={first[0]}
          y1={first[1]}
          x2={second[0]}
          y2={second[1]}
          stroke={dimensionStroke}
          strokeWidth={selected ? 1.8 : 1.15}
          strokeDasharray={dashed ? '4 3' : undefined}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
      const arrow = (tip: Vec2, toward: Vec2, key: string) => (
        <polygon
          key={key}
          data-dimension-role="arrow"
          points={arrowPoints(tip, toward, arrowSize)}
          fill={dimensionStroke}
          pointerEvents="none"
        />
      );
      const centerMark = (centerPoint: Vec2) => (
        <g data-dimension-role="center-mark" pointerEvents="none">
          <line
            x1={centerPoint[0] - centerSize} y1={centerPoint[1]}
            x2={centerPoint[0] + centerSize} y2={centerPoint[1]}
            stroke={centerStroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke"
          />
          <line
            x1={centerPoint[0]} y1={centerPoint[1] - centerSize}
            x2={centerPoint[0]} y2={centerPoint[1] + centerSize}
            stroke={centerStroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke"
          />
        </g>
      );
      let graphics: React.ReactNode;
      if ((entity.dimensionKind === 'linear' || entity.dimensionKind === 'aligned') && points.length >= 4) {
        const [sourceStart, sourceEnd, measureStart, measureEnd] = points;
        graphics = (
          <>
            {dimensionLine(sourceStart, measureStart, 'extension', true)}
            {dimensionLine(sourceEnd, measureEnd, 'extension', true)}
            {dimensionLine(measureStart, measureEnd, 'measure')}
            {arrow(measureStart, measureEnd, 'start')}
            {arrow(measureEnd, measureStart, 'end')}
          </>
        );
      } else if (entity.dimensionKind === 'radius' && points.length >= 2) {
        const centerPoint = points[0];
        const edge = points[1];
        const leaderEnd = points[2] ?? edge;
        graphics = (
          <>
            {dimensionLine(centerPoint, leaderEnd, 'leader')}
            {arrow(edge, centerPoint, 'radius')}
            {centerMark(centerPoint)}
          </>
        );
      } else if (points.length >= 2) {
        const first = points[0];
        const second = points[1];
        graphics = (
          <>
            {dimensionLine(first, second, 'measure')}
            {arrow(first, second, 'start')}
            {arrow(second, first, 'end')}
            {centerMark(midpoint(first, second))}
          </>
        );
      } else {
        const path = linePath(points);
        graphics = path ? visiblePath(path) : null;
      }
      return (
        <g {...groupProps} data-dimension-kind={entity.dimensionKind}>
          {graphics}
          <g transform={`translate(${entity.textPosition[0]} ${entity.textPosition[1]}) scale(1 -1)`} pointerEvents="none">
            <rect
              x={-dimensionLabel(entity).length * 3.2 / screenScale}
              y={-10 / screenScale}
              width={dimensionLabel(entity).length * 6.4 / screenScale}
              height={13 / screenScale}
              rx={2 / screenScale}
              fill="rgba(8,10,13,0.88)"
            />
            <text x={0} y={0} fill={textStroke} fontSize={11 / screenScale} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {dimensionLabel(entity)}
            </text>
          </g>
          {labelNode}
        </g>
      );
    }
  }
}
