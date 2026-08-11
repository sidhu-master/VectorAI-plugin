import type { MouseEvent } from 'react';

import { scenePathData, type ScenePrimitive, type Vec2 } from '@/drawing';

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
}: SceneNodeRendererProps) {
  if (primitives.length === 0) return null;
  const quality = primitives[0].quality;
  const measuredLowConfidence = quality.confidence !== undefined && quality.confidence < 0.6;
  const lowConfidence = measuredLowConfidence || (!provisional && quality.status === 'candidate');
  const isOutline = provisional && perceptionStage === 'outline';
  const regularStroke = provisional
    ? lowConfidence ? DANGER_STROKE : isOutline ? PROVISIONAL_OUTLINE_STROKE : PROVISIONAL_STROKE
    : selected ? SELECTED_STROKE : lowConfidence ? DANGER_STROKE : PRIMARY_STROKE;
  const interactive = !provisional && Boolean(onSelect);
  const labelPosition = primitiveAnchor(primitives[0]);

  return (
    <g
      data-entity-id={nodeId}
      data-scene-node="true"
      data-provisional={provisional || undefined}
      onClick={interactive ? onSelect : undefined}
      onMouseDown={interactive ? onPointerDown : undefined}
      className={interactive ? 'cursor-pointer' : undefined}
      opacity={provisional ? 0.82 : undefined}
    >
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
            : selected ? '5 4' : primitive.semanticRole === 'dimension-extension' ? '4 3' : undefined;
        if (primitive.kind === 'path') {
          const d = scenePathData(primitive.commands);
          const dimensionRole = dimensionRoleName(primitive.semanticRole);
          const arrow = primitive.semanticRole === 'dimension-arrow';
          const center = primitive.semanticRole === 'dimension-center';
          const pathStroke = center && !lowConfidence && !selected ? DIMENSION_CENTER : stroke;
          return (
            <g
              key={primitive.key}
              data-dimension-role={dimensionRole}
              pointerEvents="none"
            >
              {!provisional && !arrow && (
                <path d={d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} vectorEffect="non-scaling-stroke" />
              )}
              <path
                d={d}
                fill={arrow ? pathStroke : 'none'}
                stroke={arrow ? 'none' : pathStroke}
                strokeWidth={selected && !provisional ? 2 : 1.35}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        }
        if (primitive.kind === 'marker') {
          const radius = 3 / Math.max(scale, 0.001);
          return (
            <g key={primitive.key} pointerEvents="none">
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
        const screenHeight = primitive.role === 'dimension'
          ? primitive.height
          : primitive.height;
        return (
          <g
            key={primitive.key}
            data-dimension-role={dimensionRoleName(primitive.semanticRole)}
            transform={`translate(${primitive.position[0]} ${primitive.position[1]}) rotate(${-primitive.rotation}) scale(1 -1)`}
            pointerEvents="none"
          >
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
