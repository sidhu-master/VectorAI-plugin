import {
  compileDrawingScene,
  type Bounds2D,
  type DrawingDocument,
  type RevisionId,
  type ScenePlane,
  type Vec2,
} from '../../../src/drawing/index.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';
import {
  rasterizeScene,
  type AffineTransform,
} from '../drawing-render/rasterize-scene.js';

export type { AffineTransform } from '../drawing-render/rasterize-scene.js';

export interface RenderDrawingRegionRequest {
  region: SourcePixelRect;
  documentToSource: AffineTransform;
  strokeWidthPixels?: number;
}

export interface RenderedSemanticPlanes {
  width: number;
  height: number;
  region: SourcePixelRect;
  planes: {
    geometry: Uint8Array;
    construction: Uint8Array;
    annotation: Uint8Array;
    text: Uint8Array;
  };
  combined: Uint8Array;
}

type SemanticPlane = keyof RenderedSemanticPlanes['planes'];

/**
 * Renders the canonical Drawing IR through the same scene compiler used by the
 * browser and visual-grounding snapshot. This module deliberately contains no
 * entity-specific geometry interpretation.
 */
export function renderDrawingRegion(
  document: DrawingDocument,
  request: RenderDrawingRegionRequest,
): RenderedSemanticPlanes {
  assertRequest(request);
  const { width, height } = request.region;
  const scene = compileDrawingScene(document, {
    revision: 'revision_source_feedback' as RevisionId,
    viewBounds: regionWorldBounds(request.region, request.documentToSource),
    scale: transformScale(request.documentToSource),
  });
  const worldToRegion: AffineTransform = [
    request.documentToSource[0],
    request.documentToSource[1],
    request.documentToSource[2],
    request.documentToSource[3],
    request.documentToSource[4] - request.region.x,
    request.documentToSource[5] - request.region.y,
  ];
  const planes = Object.fromEntries(
    (['geometry', 'construction', 'annotation', 'text'] as const).map((plane) => [
      plane,
      renderPlane(scene, plane, width, height, worldToRegion, request.strokeWidthPixels ?? 1),
    ]),
  ) as RenderedSemanticPlanes['planes'];
  const area = width * height;
  const combined = new Uint8Array(area);
  for (let index = 0; index < area; index += 1) {
    combined[index] = planes.geometry[index] || planes.construction[index]
      || planes.annotation[index] || planes.text[index] ? 1 : 0;
  }
  return {
    width,
    height,
    region: { ...request.region },
    planes,
    combined,
  };
}

function renderPlane(
  scene: ReturnType<typeof compileDrawingScene>,
  plane: SemanticPlane,
  width: number,
  height: number,
  worldToImage: AffineTransform,
  strokeWidthPixels: number,
): Uint8Array {
  const raster = rasterizeScene(scene, {
    width,
    height,
    worldToImage,
    background: [0, 0, 0, 0],
    colorForPrimitive: () => [255, 255, 255, 255],
    strokeWidthPixels: () => strokeWidthPixels,
    include: (primitive) => primitive.plane === (plane as ScenePlane),
  });
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = raster.rgba[index * 4 + 3] > 0 ? 1 : 0;
  }
  return mask;
}

function regionWorldBounds(
  region: SourcePixelRect,
  transform: AffineTransform,
): Bounds2D {
  const inverse = invertTransform(transform);
  const sourceCorners: Vec2[] = [
    [region.x, region.y],
    [region.x + region.width, region.y],
    [region.x, region.y + region.height],
    [region.x + region.width, region.y + region.height],
  ];
  const corners = sourceCorners.map((point) => transformPoint(inverse, point));
  return {
    minX: Math.min(...corners.map((point) => point[0])),
    minY: Math.min(...corners.map((point) => point[1])),
    maxX: Math.max(...corners.map((point) => point[0])),
    maxY: Math.max(...corners.map((point) => point[1])),
  };
}

function invertTransform(transform: AffineTransform): AffineTransform {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) throw new Error('SOURCE_RENDER_TRANSFORM_SINGULAR');
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function transformScale(transform: AffineTransform): number {
  return Math.max(
    Math.hypot(transform[0], transform[1]),
    Math.hypot(transform[2], transform[3]),
    0.001,
  );
}

export function transformPoint(transform: AffineTransform, point: Vec2): Vec2 {
  return [
    transform[0] * point[0] + transform[2] * point[1] + transform[4],
    transform[1] * point[0] + transform[3] * point[1] + transform[5],
  ];
}

function assertRequest(request: RenderDrawingRegionRequest): void {
  const { x, y, width, height } = request.region;
  if (![x, y, width, height].every(Number.isInteger)
    || x < 0 || y < 0 || width < 1 || height < 1
    || !request.documentToSource.every(Number.isFinite)) {
    throw new Error('SOURCE_RENDER_REQUEST_INVALID');
  }
}
