import type { ViewCoordinateTransform } from './build-patches.js';

export const DEFAULT_UNSCALED_PAGE_WIDTH_MM = 500;

export function imageToCadTransform(
  heightToWidthRatio: number | undefined,
): ViewCoordinateTransform {
  const ratio = heightToWidthRatio ?? 1;
  return {
    scaleX: DEFAULT_UNSCALED_PAGE_WIDTH_MM,
    scaleY: -DEFAULT_UNSCALED_PAGE_WIDTH_MM * ratio,
    offsetX: 0,
    offsetY: DEFAULT_UNSCALED_PAGE_WIDTH_MM * ratio,
  };
}
