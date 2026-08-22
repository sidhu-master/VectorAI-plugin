// SPDX-License-Identifier: Apache-2.0

import type { DrawingMotionRigWorkspaceState } from '@vectorai/drawing-workspace';
import type { MouseEvent } from 'react';

export interface MotionRigOverlayProps {
  rig: DrawingMotionRigWorkspaceState;
  viewportScale: number;
  onHandleMouseDown(event: MouseEvent<SVGCircleElement>): void;
}

export function MotionRigOverlay({
  rig,
  viewportScale,
  onHandleMouseDown,
}: MotionRigOverlayProps) {
  const scale = Math.max(viewportScale, 0.001);
  const { anchor, handle } = rig.projection;
  const status = rig.phase === 'preview'
    ? '等待确认'
    : rig.message ?? '拖动控制点调整部件';
  return (
    <g className={`vai-motion-rig vai-motion-rig--${rig.phase}`} data-motion-rig-state={rig.phase}>
      <line
        className="vai-motion-rig__guide"
        x1={anchor[0]}
        y1={anchor[1]}
        x2={handle[0]}
        y2={handle[1]}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <circle
        data-motion-rig-anchor={true}
        className="vai-motion-rig__anchor"
        cx={anchor[0]}
        cy={anchor[1]}
        r={6 / scale}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <circle
        role="button"
        aria-label="拖动可动部件"
        tabIndex={0}
        className="vai-motion-rig__handle"
        cx={handle[0]}
        cy={handle[1]}
        r={8 / scale}
        vectorEffect="non-scaling-stroke"
        onMouseDown={(event) => {
          if (event.button !== 0 || rig.phase === 'preview') return;
          event.preventDefault();
          event.stopPropagation();
          onHandleMouseDown(event);
        }}
      />
      <g transform={`translate(${handle[0]} ${handle[1] + 14 / scale}) scale(1 -1)`} pointerEvents="none">
        <text
          data-motion-rig-status={rig.phase}
          className="vai-motion-rig__status"
          fontSize={11 / scale}
          textAnchor="middle"
        >{status}</text>
      </g>
    </g>
  );
}
