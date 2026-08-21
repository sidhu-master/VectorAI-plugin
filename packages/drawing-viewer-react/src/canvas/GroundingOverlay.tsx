// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';
import type {
  DrawingGroundingOverlay as DrawingGroundingOverlayModel,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';

import { nodeBounds, type Bounds2D, type DrawingRenderable } from './geometry';

export function GroundingOverlay({
  document,
  overlay,
  viewport,
}: {
  document: DrawingDocument;
  overlay: DrawingGroundingOverlayModel;
  viewport: DrawingWorkspaceViewport;
}) {
  const nodes = new Map<string, DrawingRenderable>([
    ...document.geometry,
    ...document.annotations,
  ].map((node) => [node.id, node]));
  const scale = Math.max(viewport.scale, 0.001);
  const padding = 6 / scale;

  return (
    <g className="vai-grounding" pointerEvents="none" aria-label="AI 识别图元">
      {overlay.groups.map((group) => {
        const groundedNodes = group.nodeIds.flatMap((id) => {
          const node = nodes.get(id);
          const bounds = node === undefined ? null : nodeBounds(node);
          return node === undefined || bounds === null ? [] : [{ node, bounds }];
        });
        const bounds = combineBounds(groundedNodes.map(({ bounds: nodeBoundsValue }) => nodeBoundsValue));
        if (bounds === null) return null;
        const colorClass = `vai-grounding--color-${Math.abs(group.colorIndex) % 6}`;
        const outline = expandBounds(bounds, padding);
        const labelWidth = Math.max(34, group.label.length * 13 + 14) / scale;
        const labelHeight = 20 / scale;
        const labelPosition: Vec2 = [outline.minX, outline.maxY + 4 / scale];

        return (
          <g
            key={group.groundingId}
            className={`vai-grounding__group ${colorClass}`}
            data-grounding-group={group.partKey}
            data-grounding-id={group.groundingId}
          >
            <rect
              className="vai-grounding__outline"
              x={outline.minX}
              y={outline.minY}
              width={Math.max(outline.maxX - outline.minX, 12 / scale)}
              height={Math.max(outline.maxY - outline.minY, 12 / scale)}
              vectorEffect="non-scaling-stroke"
            />
            {groundedNodes.map(({ node, bounds: nodeBoundsValue }) => {
              const highlighted = expandBounds(nodeBoundsValue, 3 / scale);
              return (
                <rect
                  key={node.id}
                  data-grounding-node={node.id}
                  className="vai-grounding__node"
                  x={highlighted.minX}
                  y={highlighted.minY}
                  width={Math.max(highlighted.maxX - highlighted.minX, 8 / scale)}
                  height={Math.max(highlighted.maxY - highlighted.minY, 8 / scale)}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {group.interfaces.flatMap((item) => {
              const node = document.geometry.find((candidate) => candidate.id === item.nodeId);
              if (node?.type !== 'line') return [];
              const point = node[item.endpoint];
              return [(
                <circle
                  key={item.interfaceId}
                  data-grounding-interface={item.interfaceId}
                  className="vai-grounding__interface"
                  cx={point[0]}
                  cy={point[1]}
                  r={4 / scale}
                  vectorEffect="non-scaling-stroke"
                />
              )];
            })}
            <g transform={`translate(${labelPosition[0]} ${labelPosition[1]}) scale(1 -1)`}>
              <rect
                className="vai-grounding__label-bg"
                x={0}
                y={-labelHeight}
                width={labelWidth}
                height={labelHeight}
                rx={4 / scale}
              />
              <text
                data-grounding-label={group.label}
                className="vai-grounding__label"
                x={7 / scale}
                y={-6 / scale}
                fontSize={11 / scale}
              >{group.label}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function combineBounds(bounds: Bounds2D[]): Bounds2D | null {
  if (bounds.length === 0) return null;
  return bounds.slice(1).reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY),
  }), bounds[0]!);
}

function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}
