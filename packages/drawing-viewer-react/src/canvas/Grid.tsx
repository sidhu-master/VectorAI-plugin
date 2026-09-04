// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import { memo, useId } from 'react';

import { gridPatternMetrics } from './grid-pattern';

export const CadGrid = memo(function CadGrid({
  viewport,
  showGrid,
  showAxes,
}: {
  viewport: DrawingWorkspaceViewport;
  showGrid: boolean;
  showAxes: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const metrics = gridPatternMetrics(viewport);
  const minorId = `vai-grid-minor-${id}`;
  const majorId = `vai-grid-major-${id}`;
  return (
    <g data-cad-grid="true" pointerEvents="none">
      {showGrid ? (
        <>
          <defs>
            <pattern
              id={minorId}
              data-grid-pattern="minor"
              width={metrics.minorSize}
              height={metrics.minorSize}
              patternUnits="userSpaceOnUse"
              x={metrics.minorX}
              y={metrics.minorY}
            >
              <path d={`M ${metrics.minorSize} 0 H 0 V ${metrics.minorSize}`} className="vai-grid__minor" fill="none" />
            </pattern>
            <pattern
              id={majorId}
              data-grid-pattern="major"
              width={metrics.majorSize}
              height={metrics.majorSize}
              patternUnits="userSpaceOnUse"
              x={metrics.majorX}
              y={metrics.majorY}
            >
              <path d={`M ${metrics.majorSize} 0 H 0 V ${metrics.majorSize}`} className="vai-grid__major" fill="none" />
            </pattern>
          </defs>
          <rect data-grid-layer="minor" width="100%" height="100%" fill={`url(#${minorId})`} />
          <rect data-grid-layer="major" width="100%" height="100%" fill={`url(#${majorId})`} />
        </>
      ) : null}
      {showAxes ? (
        <g className="vai-grid__axes">
          <line data-axis="x" x1={0} y1={viewport.y} x2="100%" y2={viewport.y} vectorEffect="non-scaling-stroke" />
          <line data-axis="y" x1={viewport.x} y1={0} x2={viewport.x} y2="100%" vectorEffect="non-scaling-stroke" />
          <text data-axis-label="x" x={Math.max(8, viewport.width - 18)} y={viewport.y - 7}>X</text>
          <text data-axis-label="y" x={viewport.x + 7} y={14}>Y</text>
        </g>
      ) : null}
    </g>
  );
});
