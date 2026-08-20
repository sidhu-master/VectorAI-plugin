// SPDX-License-Identifier: Apache-2.0

import type { DrawingSourceRef, DrawingSourceResource } from '@vectorai/drawing-workspace';

export function SourceUnderlay({
  source,
  resource,
}: {
  source: DrawingSourceRef;
  resource: DrawingSourceResource;
}) {
  return (
    <g data-source-underlay={source.id} pointerEvents="none" opacity={0.72}>
      <g transform={`translate(0 ${source.height}) scale(1 -1)`}>
        <image
          href={resource.url}
          x={0}
          y={0}
          width={source.width}
          height={source.height}
          preserveAspectRatio="none"
        />
      </g>
    </g>
  );
}
