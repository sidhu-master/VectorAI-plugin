import type { CSSProperties, MouseEvent } from 'react';

import {
  scenePathData,
  vectorRevealTiming,
  type ScenePrimitive,
  type Vec2,
} from '@/drawing';

const HIT_WIDTH = 14;
const PRIMARY_STROKE = '#cbd5e1';
const SELECTED_STROKE = '#6da9d2';
const DANGER_STROKE = '#f87171';
const CONSTRUCTION_STROKE = '#64748b';
const DIMENSION_STROKE = '#788392';
const DIMENSION_TEXT = '#a66c9c';
const DIMENSION_CENTER = '#4f9274';
const SECTION_HATCH_STROKE = '#a39868';
const PROVISIONAL_STROKE = '#7f9bad';
const PROVISIONAL_OUTLINE_STROKE = '#7dd3fc';

interface SceneNodeRendererProps {
  nodeId: string;
  primitives: ScenePrimitive[];
  scale: number;
  selected?: boolean;
  onSelect?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: MouseEvent<SVGGElement>) => void;
  provisional?: boolean;
  label?: string;
  perceptionStage?: 'outline' | 'detail' | 'annotation' | 'reconciliation' | 'edit-preview';
  revealIndex?: number;
  revealCount?: number;
  annotationTextOnly?: boolean;
  textOffset?: readonly [number, number];
}

export default function SceneNodeRenderer({
  nodeId,
  primitives,
  scale,
  selected = false,
  onSelect,
  onPointerDown,
  provisional = false,
  label,
  perceptionStage,
  revealIndex,
  revealCount,
  annotationTextOnly = false,
  textOffset,
}: SceneNodeRendererProps) {
  if (primitives.length === 0) return null;
  const quality = primitives[0].quality;
  const measuredLowConfidence = quality.confidence !== undefined && quality.confidence < 0.6;
  const lowConfidence = measuredLowConfidence || (!provisional && quality.status === 'candidate');
  const isOutline = provisional && perceptionStage === 'outline';
  const hasTextPrimitive = primitives.some((primitive) => primitive.kind === 'text');
  const displayOnly = primitives.every((primitive) => (
    primitive.plane === 'annotation' || primitive.plane === 'text'
  ));
  const textOnly = !provisional && annotationTextOnly && hasTextPrimitive && Boolean(onPointerDown);
  const geometryInteractive = !provisional && Boolean(onSelect) && !annotationTextOnly && !displayOnly;
  const regularStroke = provisional
    ? lowConfidence ? DANGER_STROKE : isOutline ? PROVISIONAL_OUTLINE_STROKE : PROVISIONAL_STROKE
    : selected ? SELECTED_STROKE : lowConfidence ? DANGER_STROKE : PRIMARY_STROKE;
  const interactive = textOnly || geometryInteractive;
  const annotationShift = annotationTextOnly && textOffset && (textOffset[0] !== 0 || textOffset[1] !== 0)
    ? `translate(${textOffset[0]} ${textOffset[1]})`
    : undefined;
  const stopDisplayOnlyEvent = (event: MouseEvent<SVGGElement>) => event.stopPropagation();
  const fromTextHandle = (event: MouseEvent<SVGGElement>): boolean => {
    const target = event.target as Element | null;
    return Boolean(target && target.closest('[data-annotation-text="true"]'));
  };
  // 点击只做选中；拖拽只能由鼠标按下启动，避免 mouseup 后的 click 事件再次激活拖动
  const textOnlyClick = (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    if (!fromTextHandle(event)) return;
    if (textOnly && onSelect) onSelect(event);
  };
  const textOnlyMouseDown = (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    if (!fromTextHandle(event)) return;
    if (event.button !== 0) return;
    event.preventDefault();
    if (textOnly && onPointerDown) onPointerDown(event);
  };
  const labelPosition = primitiveAnchor(primitives[0]);
  const revealTiming = provisional && perceptionStage === 'outline'
    && revealIndex !== undefined && revealCount !== undefined
    ? vectorRevealTiming(revealIndex, revealCount)
    : null;
  const revealStyle = revealTiming ? {
    '--vector-reveal-delay': `${revealTiming.delayMs}ms`,
    '--vector-reveal-duration': `${revealTiming.durationMs}ms`,
  } as CSSProperties : undefined;

  return (
    <g
      data-entity-id={nodeId}
      data-scene-node="true"
      data-display-only={displayOnly || undefined}
      data-provisional={provisional || undefined}
      transform={annotationShift}
      onClick={displayOnly && !interactive ? stopDisplayOnlyEvent : interactive ? (textOnly ? textOnlyClick : onSelect) : undefined}
      onMouseDown={displayOnly && !interactive ? stopDisplayOnlyEvent : interactive ? (textOnly ? textOnlyMouseDown : onPointerDown) : undefined}
      className={interactive ? 'cursor-pointer' : undefined}
      opacity={provisional ? 0.82 : displayOnly ? 0.68 : undefined}
    >
      {provisional && (
        <animate
          data-agent-preview-animation="enter"
          attributeName="opacity"
          from="0.18"
          to="0.82"
          dur={perceptionStage === 'outline' ? '320ms' : '220ms'}
          fill="freeze"
        />
      )}
      {primitives.map((primitive) => {
        const stroke = primitive.role === 'construction'
          ? CONSTRUCTION_STROKE
          : primitive.role === 'dimension'
            ? lowConfidence ? DANGER_STROKE : selected ? SELECTED_STROKE : DIMENSION_STROKE
            : regularStroke;
        const dash = primitive.role === 'construction'
          ? provisional ? '4 3' : '7 5'
          : provisional
            ? isOutline ? undefined : '4 3'
            : selected ? '5 4'
              : primitive.semanticRole === 'dimension-extension'
                || primitive.semanticRole === 'dimension-angular-extension' ? '4 3' : undefined;
        if (primitive.kind === 'path') {
          const d = scenePathData(primitive.commands);
          const dimensionRole = dimensionRoleName(primitive.semanticRole);
          const arrow = primitive.semanticRole === 'dimension-arrow';
          const center = primitive.semanticRole === 'dimension-center';
          const sectionHatch = primitive.semanticRole === 'section-hatch';
          const pathStroke = sectionHatch && !lowConfidence && !selected
            ? SECTION_HATCH_STROKE
            : center && !lowConfidence && !selected ? DIMENSION_CENTER : stroke;
          return (
            <g
              key={primitive.key}
              data-dimension-role={dimensionRole}
              pointerEvents={textOnly ? 'none' : displayOnly || interactive ? undefined : 'none'}
            >
              {geometryInteractive && !arrow && (
                <path d={d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />
              )}
              <path
                d={d}
                fill={arrow ? pathStroke : 'none'}
                stroke={arrow ? 'none' : pathStroke}
                strokeWidth={sectionHatch ? 1.1 : selected && !provisional ? 2 : 1.35}
                strokeDasharray={revealTiming && !arrow ? 1 : dash}
                strokeDashoffset={revealTiming && !arrow ? 1 : undefined}
                pathLength={revealTiming && !arrow ? 1 : undefined}
                data-vector-reveal={revealTiming && !arrow ? 'true' : undefined}
                className={revealTiming && !arrow ? 'vector-stroke-reveal' : undefined}
                style={revealTiming && !arrow ? revealStyle : undefined}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        }
        if (primitive.kind === 'marker') {
          const radius = 3 / Math.max(scale, 0.001);
          return (
            <g key={primitive.key} pointerEvents={textOnly ? 'none' : displayOnly || interactive ? undefined : 'none'}>
              {!provisional && (
                <circle cx={primitive.position[0]} cy={primitive.position[1]} r={HIT_WIDTH / Math.max(scale, 0.001)} fill="transparent" />
              )}
              <circle cx={primitive.position[0]} cy={primitive.position[1]} r={radius} fill={stroke} />
            </g>
          );
        }
        const fill = lowConfidence
          ? DANGER_STROKE
          : primitive.role === 'dimension' ? DIMENSION_TEXT : stroke;
        const screenHeight = primitive.height;
        // 文字偏移已由外层 annotationShift 平移一次，这里不再叠加，避免文字位移 2 倍
        const position = [primitive.position[0], primitive.position[1]] as const;
        return (
          <g
            key={primitive.key}
            data-dimension-role={dimensionRoleName(primitive.semanticRole)}
            transform={`translate(${position[0]} ${position[1]}) rotate(${-primitive.rotation}) scale(1 -1)`}
            pointerEvents={displayOnly && !textOnly ? undefined : undefined}
          >
            <g data-annotation-text={textOnly ? 'true' : undefined}>
              {primitive.role === 'dimension' && (
                <rect
                  x={-primitive.content.length * screenHeight * 0.3}
                  y={-screenHeight * 0.9}
                  width={primitive.content.length * screenHeight * 0.6}
                  height={screenHeight * 1.2}
                  rx={2 / Math.max(scale, 0.001)}
                  fill="rgba(8,10,13,0.88)"
                />
              )}
              <text
                x={0}
                y={0}
                fill={fill}
                fontSize={screenHeight}
                textAnchor={textAnchor(primitive.alignment)}
                fontFamily={primitive.role === 'dimension' ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}
              >
                {primitive.content}
              </text>
            </g>
          </g>
        );
      })}
      {provisional && label && labelPosition && (
        <g transform={`translate(${labelPosition[0]} ${labelPosition[1]}) scale(1 -1)`} pointerEvents="none">
          <text
            x={0}
            y={-6 / Math.max(scale, 0.001)}
            fill={regularStroke}
            fontSize={10 / Math.max(scale, 0.001)}
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

function primitiveAnchor(primitive: ScenePrimitive): Vec2 | null {
  if (primitive.kind === 'marker' || primitive.kind === 'text') return primitive.position;
  const move = primitive.commands.find((command) => command.op === 'M');
  return move && move.op === 'M' ? move.point : null;
}

function dimensionRoleName(role: string | undefined): string | undefined {
  if (role === 'dimension-center') return 'center-mark';
  return role?.startsWith('dimension-') ? role.slice('dimension-'.length) : undefined;
}

function textAnchor(alignment: 'left' | 'center' | 'right'): 'start' | 'middle' | 'end' {
  return alignment === 'center' ? 'middle' : alignment === 'right' ? 'end' : 'start';
}
