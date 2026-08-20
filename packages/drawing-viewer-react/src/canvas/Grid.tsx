// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import { useId } from 'react';

export function CadGrid({
  viewport,
  showGrid,
  showAxes,
}: {
  viewport: DrawingWorkspaceViewport;
  showGrid: boolean;
  showAxes: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const minorWorld = gridWorldStep(viewport.scale);
  const minor = minorWorld * viewport.scale;
  const major = minor * 5;
  const minorId = `vai-grid-minor-${id}`;
  const majorId = `vai-grid-major-${id}`;
  return (
    <g data-cad-grid="true" pointerEvents="none">
      {showGrid ? (
        <>
          <defs>
            <pattern id={minorId} width={minor} height={minor} patternUnits="userSpaceOnUse" x={modulo(viewport.x, minor)} y={modulo(viewport.y, minor)}>
              <path d={`M ${minor} 0 L 0 0 0 ${minor}`} className="vai-grid__minor" fill="none" />
            </pattern>
            <pattern id={majorId} width={major} height={major} patternUnits="userSpaceOnUse" x={modulo(viewport.x, major)} y={modulo(viewport.y, major)}>
              <rect width={major} height={major} fill={`url(#${minorId})`} />
              <path d={`M ${major} 0 L 0 0 0 ${major}`} className="vai-grid__major" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${majorId})`} />
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
}

function gridWorldStep(scale: number): number {
  const targetWorld = 24 / Math.max(scale, 0.001);
  const exponent = Math.floor(Math.log10(targetWorld));
  const magnitude = 10 ** exponent;
  const normalized = targetWorld / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
