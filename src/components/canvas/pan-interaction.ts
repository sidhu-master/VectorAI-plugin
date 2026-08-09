export interface CanvasScreenPoint {
  x: number;
  y: number;
}

export interface CanvasViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasPanPreview {
  transform: CanvasViewTransform;
  deltaX: number;
  deltaY: number;
}

export function createCanvasPanSession(
  startPointer: CanvasScreenPoint,
  startTransform: CanvasViewTransform,
  commit: (transform: CanvasViewTransform) => void,
) {
  let latest = { ...startTransform };
  let finished = false;

  return {
    preview(pointer: CanvasScreenPoint): CanvasPanPreview {
      const deltaX = pointer.x - startPointer.x;
      const deltaY = pointer.y - startPointer.y;
      latest = {
        scale: startTransform.scale,
        offsetX: startTransform.offsetX + deltaX,
        offsetY: startTransform.offsetY + deltaY,
      };
      return { transform: { ...latest }, deltaX, deltaY };
    },
    finish(): CanvasViewTransform {
      if (!finished) {
        finished = true;
        commit({ ...latest });
      }
      return { ...latest };
    },
  };
}
