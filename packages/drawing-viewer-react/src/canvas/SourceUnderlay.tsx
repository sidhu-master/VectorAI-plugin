// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingSourceResource } from '@vectorai/drawing-workspace';
import type { RasterDrawingSourceRef } from './source-types';


export function SourceUnderlay({
  source,
  resource,
  document,
}: {
  source: RasterDrawingSourceRef;
  resource: DrawingSourceResource;
  document: DrawingDocument;
}) {
  const sourceFrame = document.coordinateFrames.find((frame) => (
    frame.kind === 'source' && frame.id === `frame_source_${safeId(source.id)}`
  )) ?? document.coordinateFrames.find((frame) => frame.kind === 'source');
  const transform = sourceFrame?.transform;
  return (
    <g data-source-underlay={source.id} pointerEvents="none" opacity={0.28}>
      <g transform={transform === undefined
        ? `translate(0 ${source.height}) scale(1 -1)`
        : `matrix(${transform.join(' ')})`}>
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

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
