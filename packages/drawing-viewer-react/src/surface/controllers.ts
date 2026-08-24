// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingInteractionResult,
  DrawingSurfacePointerEvent,
} from '@vectorai/drawing-surface-api';

export interface DrawingPointerController {
  id: string;
  priority: number;
  active: boolean;
  handle(event: DrawingSurfacePointerEvent): DrawingInteractionResult;
}

export interface DrawingPointerDispatchResult extends DrawingInteractionResult {
  controllerId?: string;
}

export function dispatchPrimaryPointerEvent(
  controllers: readonly DrawingPointerController[],
  event: DrawingSurfacePointerEvent,
): DrawingPointerDispatchResult {
  const ordered = [...controllers]
    .filter(({ active }) => active)
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  for (const controller of ordered) {
    const result = controller.handle(event);
    if (result.handled) return { ...result, controllerId: controller.id };
  }
  return { handled: false };
}

export class PanZoomController implements DrawingPointerController {
  readonly id = 'vectorai.navigation.pan-zoom';
  readonly priority = -100;
  active = true;

  handle(event: DrawingSurfacePointerEvent): DrawingInteractionResult {
    return { handled: event.type === 'wheel' || (event.type === 'pointer-down' && event.button === 1) };
  }
}

export class SelectionController implements DrawingPointerController {
  readonly id = 'vectorai.selection.primary';
  readonly priority = 0;
  active = true;

  handle(event: DrawingSurfacePointerEvent): DrawingInteractionResult {
    return { handled: event.type === 'pointer-down' && event.button === 0, capture: true };
  }
}
