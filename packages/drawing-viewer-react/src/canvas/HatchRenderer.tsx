// SPDX-License-Identifier: Apache-2.0

import type { SectionHatchAnnotation, Vec2 } from '@vectorai/drawing-core';
import { createHatchRenderPlan } from '@vectorai/drawing-hatch';
import { memo, useId, useMemo } from 'react';

export const HatchRenderer = memo(function HatchRenderer({ node, viewportScale }: { node: SectionHatchAnnotation; viewportScale: number }) {
  const clipId = `vai-hatch-${useId().replace(/:/g, '')}`;
  const vectorStroke = { vectorEffect: 'non-scaling-stroke' as const };
  const tolerance = Math.min(0.05, Math.max(1e-6, 0.25 / Math.max(viewportScale, 1e-9)));
  const result = useMemo(() => node.hatch === undefined
    ? null
    : createHatchRenderPlan(node.hatch, tolerance), [node.hatch, tolerance]);
  if (node.hatch === undefined) {
    return (
      <g data-section-hatch={node.pattern}>
        {(node.segments ?? []).map((segment, index) => (
          <line key={index} x1={segment.start[0]} y1={segment.start[1]} x2={segment.end[0]} y2={segment.end[1]} {...vectorStroke} />
        ))}
      </g>
    );
  }
  if (result === null) return null;
  if (result.status !== 'ok') return <g data-section-hatch={node.pattern} data-hatch-error={result.code} />;
  const path = result.plan.region.contours.map(contourPath).join(' ');
  return (
    <g data-section-hatch={node.pattern} data-hatch-representation="parametric">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={path} fillRule={result.plan.region.fillRule} clipRule={result.plan.region.fillRule} />
        </clipPath>
      </defs>
      {result.plan.lines.map((line, index) => (
        <line
          key={index}
          x1={line.start[0]} y1={line.start[1]} x2={line.end[0]} y2={line.end[1]}
          clipPath={`url(#${clipId})`}
          strokeDasharray={line.dashArray.length === 0 ? undefined : line.dashArray.join(' ')}
          strokeDashoffset={line.dashOffset}
          {...vectorStroke}
        />
      ))}
    </g>
  );
});

function contourPath(points: Vec2[]): string {
  if (points.length === 0) return '';
  return `M ${points[0]![0]} ${points[0]![1]} ${points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`;
}
