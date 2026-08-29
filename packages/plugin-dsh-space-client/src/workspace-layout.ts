// SPDX-License-Identifier: Apache-2.0

export interface WorkspaceLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_DRAWING_WIDTH = 420;
const MIN_CHAT_WIDTH = 360;

export function calculateWorkspaceLayout(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): WorkspaceLayout {
  const availableDrawingWidth = Math.max(0, rect.width - MIN_CHAT_WIDTH);
  const preferredDrawingWidth = Math.round(rect.width * 0.56);
  return {
    left: rect.left,
    top: rect.top,
    width: Math.min(Math.max(MIN_DRAWING_WIDTH, preferredDrawingWidth), availableDrawingWidth),
    height: rect.height,
  };
}
