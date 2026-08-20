/**
 * PartitionLayer - 画布分区层：
 * 渲染 feature plane 上的图纸分区（半透明填充 + 虚线边界 + 名称标签），
 * 支持拖动顶点调整分区边界（提交 feature.update 工作区事务）。
 */
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from '@/hooks/useStore';
import {
  partitionPaletteColor,
  readDrawingPartitions,
  type DrawingPartition,
} from '@/contracts/drawing-partition';
import type { Vec2 } from '@/drawing';

interface DragState {
  partitionId: string;
  vertexIndex: number;
  draftPolygon: Vec2[];
}

export default function PartitionLayer({
  scale,
  offsetX,
  offsetY,
}: {
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const document = useStore((s) => s.document);
  const updateNode = useStore((s) => s.updateNode);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragSourceRef = useRef<DragState | null>(null);

  const partitions = useMemo(
    () => (document ? readDrawingPartitions(document) : []),
    [document],
  );

  if (partitions.length === 0) return null;

  const polygonOf = (partition: DrawingPartition): Vec2[] => (
    drag?.partitionId === partition.id ? drag.draftPolygon : partition.polygon
  );

  const toWorld = (event: ReactPointerEvent<SVGCircleElement>): Vec2 => {
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    const screenX = event.clientX - (rect?.left ?? 0);
    const screenY = event.clientY - (rect?.top ?? 0);
    return [
      (screenX - offsetX) / scale,
      (offsetY - screenY) / scale,
    ];
  };

  const handleVertexDown = (
    partition: DrawingPartition,
    vertexIndex: number,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const state: DragState = {
      partitionId: partition.id,
      vertexIndex,
      draftPolygon: [...partition.polygon],
    };
    dragSourceRef.current = state;
    setDrag(state);
  };

  const handleVertexMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    const state = dragSourceRef.current;
    if (!state) return;
    event.preventDefault();
    const point = toWorld(event);
    setDrag({
      ...state,
      draftPolygon: state.draftPolygon.map((vertex, index) => (
        index === state.vertexIndex ? point : vertex
      )),
    });
  };

  const handleVertexUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    const state = dragSourceRef.current;
    dragSourceRef.current = null;
    setDrag(null);
    if (!state || !document) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const feature = document.features.find((node) => node.id === state.partitionId);
    if (!feature) return;
    void updateNode(state.partitionId, {
      properties: {
        ...feature.properties,
        polygon: state.draftPolygon.map((point) => [point[0], point[1]]),
      },
    });
  };

  return (
    <g data-partition-layer="true">
      {partitions.map((partition) => {
        const polygon = polygonOf(partition);
        const color = partitionPaletteColor(partition.colorIndex);
        const centroid = polygonCentroid(polygon);
        return (
          <g key={partition.id} data-partition-id={partition.id}>
            <polygon
              points={polygon.map((point) => `${point[0]},${point[1]}`).join(' ')}
              fill={color}
              fillOpacity={0.09}
              stroke={color}
              strokeWidth={1.5 / scale}
              strokeDasharray={`${6 / scale} ${4 / scale}`}
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <g
              transform={`translate(${centroid[0]}, ${centroid[1]}) scale(${1 / scale}, ${-1 / scale})`}
              pointerEvents="none"
            >
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={color}
                stroke="rgba(10,14,20,0.85)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ userSelect: 'none' }}
              >
                {partition.name}
              </text>
            </g>
            {polygon.map((point, vertexIndex) => (
              <circle
                key={`${partition.id}:${vertexIndex}`}
                cx={point[0]}
                cy={point[1]}
                r={4.5 / scale}
                fill={
                  drag?.partitionId === partition.id
                  && drag.vertexIndex === vertexIndex ? '#ffffff' : color
                }
                stroke="#0b0f16"
                strokeWidth={1.2 / scale}
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => handleVertexDown(partition, vertexIndex, event)}
                onPointerMove={handleVertexMove}
                onPointerUp={handleVertexUp}
                onPointerCancel={handleVertexUp}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function polygonCentroid(polygon: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const point of polygon) {
    x += point[0];
    y += point[1];
  }
  return [x / polygon.length, y / polygon.length];
}
