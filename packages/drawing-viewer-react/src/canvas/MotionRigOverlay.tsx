// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import type { DrawingMotionRigWorkspaceState } from '@vectorai/drawing-workspace';
import type { MouseEvent } from 'react';
import { ScreenSpaceLabel } from './ScreenSpaceLabel';

export interface MotionRigOverlayProps {
  rig: DrawingMotionRigWorkspaceState;
  viewportScale: number;
  connectorHandles?: Array<{ nodeId: string; point: Vec2 }>;
  onHandleMouseDown(event: MouseEvent<SVGCircleElement>): void;
  onConnectorMouseDown?(nodeId: string, event: MouseEvent<SVGCircleElement>): void;
}

export function MotionRigOverlay({
  rig,
  viewportScale,
  connectorHandles = [],
  onHandleMouseDown,
  onConnectorMouseDown,
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
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          onHandleMouseDown(event);
        }}
      />
      {connectorHandles.map(({ nodeId, point }) => (
        <circle
          key={nodeId}
          role="button"
          aria-label={`调整 ${nodeId} 与可动部件的接点`}
          tabIndex={0}
          className="vai-motion-rig__connector-handle"
          cx={point[0]}
          cy={point[1]}
          r={5 / scale}
          vectorEffect="non-scaling-stroke"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            onConnectorMouseDown?.(nodeId, event);
          }}
        />
      ))}
      <ScreenSpaceLabel
        position={[handle[0], handle[1] + 14 / scale]}
        viewportScale={scale}
        pointerEvents="none"
        className="vai-motion-rig__status"
        textProps={{ 'data-motion-rig-status': rig.phase } as never}
      >{status}</ScreenSpaceLabel>
    </g>
  );
}
